/**
 * Inline markdown parsing for the canvas text renderer.
 *
 * Produces a flat list of styled runs from a single line of markdown. Supports
 * the subset the app actually uses: bold, italic, strikethrough, inline code
 * and links. Nesting (e.g. bold inside a quote, italic inside bold) is handled
 * by recursion.
 */
export interface InlineStyle {
  bold: boolean
  italic: boolean
  strike: boolean
  code: boolean
  link: boolean
}

export interface InlineRun {
  text: string
  style: InlineStyle
  href?: string
}

/** Link reference definitions (`[label]: url`), keyed by lower-cased label. */
export type LinkDefs = Map<string, string>

const BASE: InlineStyle = {
  bold: false,
  italic: false,
  strike: false,
  code: false,
  link: false
}

interface Matcher {
  re: RegExp
  /** Higher wins when two matches start at the same index. */
  precedence: number
  apply: (
    m: RegExpExecArray,
    style: InlineStyle,
    push: (runs: InlineRun[]) => void,
    defs: LinkDefs
  ) => void
}

/** Emit `label`'s text as a link when it resolves, else the literal source. */
function refLink (
  m: RegExpExecArray,
  label: string,
  text: string,
  style: InlineStyle,
  push: (runs: InlineRun[]) => void,
  defs: LinkDefs
): void {
  const href = defs.get(label.trim().toLowerCase())
  if (!href) {
    push([{ text: m[0], style }])
    return
  }
  const inner = parseInlineWith(text, { ...style, link: true }, defs)
  for (const r of inner) r.href = href
  push(inner)
}

// Remote images can't be embedded on the canvas without tainting it (which
// breaks PNG/JPEG export), so an image renders as a labelled placeholder chip.
function imageRun (alt: string, style: InlineStyle): InlineRun[] {
  return [{ text: `🖼 ${alt.trim() || 'image'}`, style: { ...style } }]
}

const MATCHERS: Matcher[] = [
  {
    // Inline code — literal, no inner formatting.
    re: /`([^`]+)`/,
    precedence: 5,
    apply: (m, style, push) =>
      push([{ text: m[1], style: { ...style, code: true } }])
  },
  {
    // Inline image ![alt](src "title") — placeholder chip.
    re: /!\[([^\]]*)\]\(([^)]+)\)/,
    precedence: 7,
    apply: (m, style, push) => push(imageRun(m[1], style))
  },
  {
    // Reference image ![alt][label] or collapsed ![alt][].
    re: /!\[([^\]]*)\]\[([^\]]*)\]/,
    precedence: 7,
    apply: (m, style, push, defs) => {
      const label = (m[2] || m[1]).trim().toLowerCase()
      if (defs.get(label)) push(imageRun(m[1], style))
      else push([{ text: m[0], style }])
    }
  },
  {
    // Shortcut reference image ![label].
    re: /!\[([^\]]+)\]/,
    precedence: 7,
    apply: (m, style, push, defs) => {
      if (defs.get(m[1].trim().toLowerCase())) push(imageRun(m[1], style))
      else push([{ text: m[0], style }])
    }
  },
  {
    // Autolink in angle brackets: <http://…> or <mailto:…>
    re: /<((?:https?:\/\/|mailto:)[^>\s]+)>/,
    precedence: 6,
    apply: (m, style, push) =>
      push([{ text: m[1], style: { ...style, link: true }, href: m[1] }])
  },
  {
    // Bare URL autolink — stops before trailing sentence punctuation.
    re: /https?:\/\/[^\s<]*[^\s<.,;:!?)\]}'"]/,
    precedence: 6,
    apply: (m, style, push) =>
      push([{ text: m[0], style: { ...style, link: true }, href: m[0] }])
  },
  {
    // Link [text](href)
    re: /\[([^\]]*)\]\(([^)]+)\)/,
    precedence: 4,
    apply: (m, style, push, defs) => {
      const inner = parseInlineWith(m[1], { ...style, link: true }, defs)
      for (const r of inner) r.href = m[2]
      push(inner)
    }
  },
  {
    // Reference link: [text][label] or collapsed [text][] (label = text).
    re: /\[([^\]]*)\]\[([^\]]*)\]/,
    precedence: 4,
    apply: (m, style, push, defs) =>
      refLink(m, m[2] || m[1], m[1], style, push, defs)
  },
  {
    re: /\*\*([\s\S]+?)\*\*/,
    precedence: 3,
    apply: (m, style, push, defs) =>
      push(parseInlineWith(m[1], { ...style, bold: true }, defs))
  },
  {
    re: /__([\s\S]+?)__/,
    precedence: 3,
    apply: (m, style, push, defs) =>
      push(parseInlineWith(m[1], { ...style, bold: true }, defs))
  },
  {
    re: /~~([\s\S]+?)~~/,
    precedence: 2,
    apply: (m, style, push, defs) =>
      push(parseInlineWith(m[1], { ...style, strike: true }, defs))
  },
  {
    re: /(?<![*\w])\*([^*\n]+?)\*(?!\*)/,
    precedence: 1,
    apply: (m, style, push, defs) =>
      push(parseInlineWith(m[1], { ...style, italic: true }, defs))
  },
  {
    re: /(?<![_\w])_([^_\n]+?)_(?![_\w])/,
    precedence: 1,
    apply: (m, style, push, defs) =>
      push(parseInlineWith(m[1], { ...style, italic: true }, defs))
  },
  {
    // Shortcut reference link: [label] resolved against definitions (lowest
    // precedence — inline and full reference links win at the same position).
    re: /\[([^\]]+)\]/,
    precedence: 0,
    apply: (m, style, push, defs) => refLink(m, m[1], m[1], style, push, defs)
  }
]

function parseInlineWith (
  text: string,
  style: InlineStyle,
  defs: LinkDefs
): InlineRun[] {
  if (text === '') return []
  const out: InlineRun[] = []
  const push = (runs: InlineRun[]) => {
    for (const r of runs) out.push(r)
  }

  let best: { index: number; matcher: Matcher; m: RegExpExecArray } | null = null
  for (const matcher of MATCHERS) {
    const m = matcher.re.exec(text)
    if (!m) continue
    if (
      best === null ||
      m.index < best.index ||
      (m.index === best.index && matcher.precedence > best.matcher.precedence)
    ) {
      best = { index: m.index, matcher, m }
    }
  }

  if (best === null) {
    return [{ text, style }]
  }

  const before = text.slice(0, best.index)
  if (before) out.push({ text: before, style })
  best.matcher.apply(best.m, style, push, defs)
  const after = text.slice(best.index + best.m[0].length)
  if (after) push(parseInlineWith(after, style, defs))

  return out
}

export function parseInline (text: string, defs: LinkDefs = new Map()): InlineRun[] {
  return parseInlineWith(text, { ...BASE }, defs)
}
