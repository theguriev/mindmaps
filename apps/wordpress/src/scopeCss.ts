/**
 * Confining the embed's utilities to the embed.
 *
 * Tailwind emits a class per utility — `.flex`, `.block`, `.hidden`,
 * `.container`, `.border`, `.table` — and this bundle emits them `!important`,
 * because a widget dropped into somebody else's page has to win against the
 * theme that owns it. Enqueued on every front-end page carrying a map, that is
 * two hundred ordinary English words redefined site-wide, with `!important` so
 * the site owner cannot take them back. A theme built on Bootstrap breaks on
 * any page with a map in it.
 *
 * So every selector this stylesheet ships is confined to the markup the embed
 * owns. Two ways, because one is not enough:
 *
 *   .flex  →  :where(SCOPE) .flex, .flex:where(SCOPE)
 *
 * The first is the ordinary case — something inside a mount. The second is the
 * portal roots themselves: `PopoverContent` puts `rounded-md border p-4` on
 * the very element that carries `[data-slot="popover-content"]`, which a
 * descendant combinator never matches.
 *
 * `:where()` is what makes this safe to do wholesale: it contributes nothing
 * to specificity, so utilities keep fighting each other exactly as they did —
 * order and `!important` unchanged — and only stop reaching outside.
 */

/** What counts as "the embed": a mount container, or a portal it rendered. */
export const SCOPES = [
  '.mind-maps-app',
  "[data-slot='popover-content']",
  "[data-slot='dropdown-menu-content']",
  "[data-slot='tooltip-content']",
  "[data-slot='dialog-portal']",
  "[data-slot='dialog-overlay']",
  "[data-slot='dialog-content']"
]

const SCOPE = `:where(${SCOPES.join(',')})`

/**
 * Selectors that are already the embed's, or that scoping would break.
 *
 * - anything already naming a scope is confined by construction;
 * - `:root` and `*` blocks carry their own scope in this file, and the token
 *   fallbacks Tailwind emits for `@property`-less browsers must keep applying
 *   to the elements that read them;
 * - `from`/`to`/percentages are keyframe steps, not selectors.
 */
function alreadyOwned (selector: string): boolean {
  const s = selector.trim()
  if (s === '') return true
  if (SCOPES.some((scope) => s.includes(scope.replace(/'/g, '')) || s.includes(scope))) return true
  if (/^(from|to|\d+%)$/.test(s)) return true
  // `:root`, `*` and the bare pseudo-elements are Tailwind's custom-property
  // blocks. They declare variables the utilities read; scoping them would
  // leave a utility outside the embed reading a value that is no longer
  // defined — and they paint nothing on their own.
  if (/^:root\b/.test(s) || s === '*' || s === ':host') return true
  if (/^::?(before|after|backdrop|file-selector-button|placeholder|marker|selection)\b/.test(s)) {
    return true
  }
  return false
}

/** Splits a selector list on its top-level commas only. */
export function splitSelectorList (selector: string): string[] {
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

/** One selector, confined — as a descendant of the embed, and as the embed. */
function scopeSelector (selector: string): string {
  if (alreadyOwned(selector)) return selector
  // The compound the scope has to attach to is the first one; a descendant
  // further along stays where it is. `.a .b` → `:where(S) .a .b` and
  // `.a:where(S) .b`.
  const [head, ...rest] = selector.split(/\s+/)
  const tail = rest.length > 0 ? ' ' + rest.join(' ') : ''
  return `${SCOPE} ${selector},${head}${SCOPE}${tail}`
}

/**
 * Rewrites every style rule in a stylesheet to be the embed's.
 *
 * A small scanner rather than a CSS parser: this runs over Tailwind's own
 * output, which is regular, and pulling a parser into the build to walk it
 * would be the larger risk. At-rules are descended into (`@media`, `@supports`,
 * `@layer`) except `@keyframes`, whose steps are not selectors.
 */
export function scopeCss (css: string): string {
  let out = ''
  let buffer = ''
  const stack: Array<{ keyframes: boolean }> = []

  const inKeyframes = () => stack.some((frame) => frame.keyframes)

  for (let i = 0; i < css.length; i++) {
    const char = css[i]

    if (char === '{') {
      const head = buffer
      buffer = ''
      const trimmed = head.trim()
      if (trimmed.startsWith('@')) {
        stack.push({ keyframes: /^@(-\w+-)?keyframes\b/.test(trimmed) })
        out += head + '{'
        continue
      }
      stack.push({ keyframes: inKeyframes() })
      const selectors = inKeyframes()
        ? trimmed
        : splitSelectorList(trimmed).map(scopeSelector).join(',')
      // Keep whatever whitespace preceded the selector, so the output still
      // reads as the input did.
      out += head.slice(0, head.length - head.trimStart().length) + selectors + '{'
      continue
    }

    if (char === '}') {
      out += buffer + '}'
      buffer = ''
      stack.pop()
      continue
    }

    buffer += char
  }

  return out + buffer
}
