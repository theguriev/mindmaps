/**
 * The embed's stylesheet is enqueued into somebody else's WordPress page, so
 * the rule it has to keep is: style nothing the embed does not own.
 *
 * This compiles `index.css` with Tailwind's own compiler — the same input the
 * Vite build feeds it — and walks every rule in the result. A stray
 * `@import 'tailwindcss'` (Preflight, which resets `*`, headings, lists, links
 * and form controls document-wide) fails here rather than on the first site
 * that installs the plugin.
 */
import { readFileSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from 'tailwindcss'
import { beforeAll, describe, expect, it } from 'vitest'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ENTRY = path.join(HERE, 'index.css')
const ENGINE_STYLES = path.resolve(HERE, '../../../packages/engine/src/styles.css')

/* -------------------------------------------------------------------------
   Compiling
   ------------------------------------------------------------------------- */

/** The directory a bare specifier's package lives in, walking up from `base`. */
function packageDir (name: string, base: string): string {
  let dir = base
  for (;;) {
    const candidate = path.join(dir, 'node_modules', name)
    try {
      if (statSync(candidate).isDirectory()) return candidate
    } catch {
      /* keep walking */
    }
    const parent = path.dirname(dir)
    if (parent === dir) throw new Error(`Cannot resolve "${name}" from ${base}`)
    dir = parent
  }
}

/**
 * Resolves the `@import`s this stylesheet uses: relative paths, `pkg/file.css`
 * subpaths, and packages whose only export condition is `style`
 * (`tw-animate-css`), which `require.resolve` refuses to look at.
 */
function resolveStylesheet (id: string, base: string): string {
  if (id.startsWith('.') || path.isAbsolute(id)) return path.resolve(base, id)

  const segments = id.split('/')
  const name = segments[0].startsWith('@')
    ? `${segments.shift()}/${segments.shift()}`
    : (segments.shift() as string)
  const dir = packageDir(name, base)
  if (segments.length > 0) return path.join(dir, ...segments)

  const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
    exports?: Record<string, { style?: string }>
    style?: string
    main?: string
  }
  const entry = pkg.exports?.['.']?.style ?? pkg.style ?? pkg.main
  if (entry === undefined) throw new Error(`"${name}" exposes no stylesheet`)
  return path.join(dir, entry)
}

async function compileEntry (): Promise<string> {
  const compiled = await compile(await readFile(ENTRY, 'utf8'), {
    base: HERE,
    async loadStylesheet (id, base) {
      const file = resolveStylesheet(id, base)
      return { path: file, base: path.dirname(file), content: await readFile(file, 'utf8') }
    }
  })
  // A handful of utilities the engine's own markup uses, so the utility layer
  // is populated the way a real build populates it.
  return compiled.build(['p-4', 'text-sm', 'bg-background', 'border', 'flex'])
}

/* -------------------------------------------------------------------------
   Walking the result
   ------------------------------------------------------------------------- */

interface StyleRule {
  /** The resolved selector, with any nesting `&` substituted away. */
  selector: string
  /** The declarations this rule itself makes (not those of nested rules). */
  declarations: string
}

/** Splits a selector list on its top-level commas only. */
function splitSelectors (selector: string): string[] {
  const parts: string[] = []
  let depth = 0
  let buffer = ''
  for (const char of selector) {
    if (char === '(' || char === '[') depth += 1
    else if (char === ')' || char === ']') depth -= 1
    if (char === ',' && depth === 0) {
      parts.push(buffer)
      buffer = ''
    } else buffer += char
  }
  parts.push(buffer)
  return parts.map((part) => part.trim()).filter((part) => part !== '')
}

/** `&` against the enclosing selector, so a nested rule reads as it lands. */
function resolveNesting (selector: string, parent: string | undefined): string {
  if (!selector.includes('&')) return selector
  const outer = parent === undefined ? '*' : `:is(${parent})`
  return selector.replace(/&/g, outer)
}

/**
 * Every style rule in a stylesheet, at-rules (`@media`, `@supports`, `@layer`)
 * transparently descended into. `@keyframes` steps are not selectors and are
 * skipped.
 */
function styleRules (css: string): StyleRule[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: StyleRule[] = []
  const open: Array<{ head: string; selector?: string; index: number }> = []
  let buffer = ''

  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (char === '{') {
      const head = buffer.trim()
      buffer = ''
      const inKeyframes = open.some((frame) => frame.head.startsWith('@keyframes'))
      if (head.startsWith('@') || inKeyframes) {
        open.push({ head, index: -1 })
        continue
      }
      const parent = [...open].reverse().find((frame) => frame.selector !== undefined)
      const selector = resolveNesting(head, parent?.selector)
      open.push({ head, selector, index: rules.length })
      rules.push({ selector, declarations: '' })
    } else if (char === '}') {
      const frame = open.pop()
      if (frame !== undefined && frame.index >= 0) {
        rules[frame.index].declarations += buffer
      }
      buffer = ''
    } else if (char === ';') {
      const frame = [...open].reverse().find((f) => f.index >= 0)
      if (frame !== undefined) rules[frame.index].declarations += buffer + ';'
      buffer = ''
    } else buffer += char
  }
  return rules
}

/** A rule that only sets custom properties paints nothing on the host page. */
function customPropertiesOnly (declarations: string): boolean {
  return declarations
    .split(';')
    .map((d) => d.trim())
    .filter((d) => d !== '')
    .every((d) => d.startsWith('--'))
}

/**
 * Whether a single compound selector can only match markup the embed owns:
 * something under a mount container, a Radix portal the engine rendered, or a
 * class of its own (every utility and component class is the embed's).
 */
function ownedByTheEmbed (selector: string): boolean {
  const normalized = selector.replace(/['"]/g, '')
  if (normalized.includes('.mind-maps-app')) return true
  if (normalized.includes('[data-slot=')) return true
  // An unescaped `.` is a class token — `.p-4`, `.hover\:bg-accent:hover`,
  // `:where(.space-y-1>:not(:last-child))`.
  return /(^|[^\\])\./.test(normalized)
}

describe('the embed stylesheet', () => {
  let compiled: string
  let rules: StyleRule[]

  beforeAll(async () => {
    compiled = await compileEntry()
    rules = styleRules(compiled)
  })

  it('compiles, tokens and utilities and all', () => {
    // If the theme layer or the engine's tokens went missing, everything below
    // would pass by vacuously styling nothing.
    expect(compiled).toContain('.p-4')
    // `@theme inline` resolves `bg-background` straight to the engine's token.
    expect(compiled).toContain('background-color: var(--background)')
    expect(compiled).toContain('--background: #ffffff')
    expect(rules.length).toBeGreaterThan(10)
  })

  it('styles nothing outside the embed', () => {
    const offenders = rules.filter(
      (rule) =>
        !customPropertiesOnly(rule.declarations) &&
        splitSelectors(rule.selector).some((part) => !ownedByTheEmbed(part))
    )
    // Preflight's `*`, `html`, `body`, `h1`…`h6`, `a`, `ol, ul, menu`,
    // `button, input, select, optgroup, textarea` land here when somebody
    // imports the full `tailwindcss` entry (directly or through the engine's
    // stylesheet) instead of theme + utilities.
    expect(offenders.map((rule) => rule.selector)).toEqual([])
  })

  it('keeps every rule out of a cascade layer', () => {
    // An unlayered declaration beats a layered one whatever its specificity,
    // and the host's CSS is unlayered: WordPress' own `forms.css` says
    // `textarea { padding: 8px }`. Layer anything here and it loses that
    // fight — which is how the node editor's `pt-11` stopped reserving room
    // for its toolbar and the text ended up underneath it, invisible.
    //
    // `properties` is Tailwind's own fallback block for `@property`-less
    // browsers; it declares custom properties and paints nothing, so it is the
    // one layer allowed here.
    const layers = new Set(
      Array.from(compiled.matchAll(/@layer\s+([\w-]+)/g), (m) => m[1])
    )
    layers.delete('properties')
    expect(Array.from(layers)).toEqual([])
  })

  it('marks the utilities important, so a host rule cannot outrank them', () => {
    // Unlayered only puts the embed in the same competition as the host; a
    // theme rule like `.entry-content textarea` still outranks a single
    // utility class on specificity. `important` is what settles it, and it is
    // what the flag exists for — a widget dropped into a page it does not own.
    const utility = rules.find((rule) => rule.selector === '.p-4')
    expect(utility?.declarations).toMatch(/!important/)
  })

  it('never pulls in Preflight, whichever import brings it', () => {
    const source = compiled
    // Preflight's own giveaways, in the shape Tailwind emits them.
    expect(source).not.toMatch(/(^|[{}])\s*html\s*,\s*:host\s*\{/)
    expect(source).not.toMatch(/(^|[{}])\s*h1\s*,/)
  })

  it('keeps the resets the engine markup needs, under the mount container', () => {
    const boxSizing = rules.filter((rule) => /box-sizing:\s*border-box/.test(rule.declarations))
    expect(boxSizing.length).toBeGreaterThan(0)
    for (const rule of boxSizing) {
      expect(splitSelectors(rule.selector).every(ownedByTheEmbed)).toBe(true)
    }

    // The reset has to reach form controls (font inheritance) and replaced
    // elements (the canvas and lucide's icons are `display: block`).
    const declarationsFor = (pattern: RegExp) =>
      rules.filter((rule) => pattern.test(rule.selector)).map((rule) => rule.declarations).join(' ')
    expect(declarationsFor(/\btextarea\b/)).toMatch(/font:\s*inherit/)
    expect(declarationsFor(/\bcanvas\b/)).toMatch(/display:\s*block/)
  })

  it('reaches the Radix portals, which render outside the container', () => {
    // Popovers, dropdowns, tooltips and the ⌘K/search dialogs are portalled
    // onto `body`; the reset must follow them there.
    const reset = rules.find((rule) => /box-sizing:\s*border-box/.test(rule.declarations))
    const selector = reset?.selector.replace(/['"]/g, '') ?? ''
    for (const slot of [
      'popover-content',
      'dropdown-menu-content',
      'tooltip-content',
      'dialog-content'
    ]) {
      expect(selector).toContain(`[data-slot=${slot}]`)
    }
  })
})

/* -------------------------------------------------------------------------
   Token duplication
   ------------------------------------------------------------------------- */

/** The `--name: value` pairs of the block a header opens. */
function blockProperties (css: string, header: string): Map<string, string> {
  const start = css.indexOf(header)
  if (start < 0) throw new Error(`No "${header}" block`)
  let depth = 0
  let end = start
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth += 1
    else if (css[i] === '}') {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  const body = css.slice(css.indexOf('{', start) + 1, end).replace(/\/\*[\s\S]*?\*\//g, '')
  const properties = new Map<string, string>()
  for (const declaration of body.split(';')) {
    const [name, ...rest] = declaration.split(':')
    if (!name.trim().startsWith('--')) continue
    properties.set(name.trim(), rest.join(':').trim().replace(/\s+/g, ' '))
  }
  return properties
}

describe('the design tokens copied from the engine', () => {
  it('are identical to the engine\'s own', async () => {
    // The engine's stylesheet cannot be imported here (its first line is the
    // `@import 'tailwindcss'` that would bring Preflight back), so its tokens
    // are duplicated in `index.css`. This is the guard against that copy
    // silently drifting.
    const [embed, engine] = await Promise.all([
      readFile(ENTRY, 'utf8'),
      readFile(ENGINE_STYLES, 'utf8')
    ])

    for (const header of [':root {', '@theme inline {']) {
      expect(
        Object.fromEntries(blockProperties(embed, header)),
        `${header.trim()} drifted from packages/engine/src/styles.css`
      ).toEqual(Object.fromEntries(blockProperties(engine, header)))
    }
  })
})
