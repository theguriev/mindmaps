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
  apply: (m: RegExpExecArray, style: InlineStyle, push: (runs: InlineRun[]) => void) => void
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
    // Link [text](href)
    re: /\[([^\]]*)\]\(([^)]+)\)/,
    precedence: 4,
    apply: (m, style, push) => {
      const inner = parseInlineWith(m[1], { ...style, link: true })
      for (const r of inner) r.href = m[2]
      push(inner)
    }
  },
  {
    re: /\*\*([\s\S]+?)\*\*/,
    precedence: 3,
    apply: (m, style, push) =>
      push(parseInlineWith(m[1], { ...style, bold: true }))
  },
  {
    re: /__([\s\S]+?)__/,
    precedence: 3,
    apply: (m, style, push) =>
      push(parseInlineWith(m[1], { ...style, bold: true }))
  },
  {
    re: /~~([\s\S]+?)~~/,
    precedence: 2,
    apply: (m, style, push) =>
      push(parseInlineWith(m[1], { ...style, strike: true }))
  },
  {
    re: /(?<![*\w])\*([^*\n]+?)\*(?!\*)/,
    precedence: 1,
    apply: (m, style, push) =>
      push(parseInlineWith(m[1], { ...style, italic: true }))
  },
  {
    re: /(?<![_\w])_([^_\n]+?)_(?![_\w])/,
    precedence: 1,
    apply: (m, style, push) =>
      push(parseInlineWith(m[1], { ...style, italic: true }))
  }
]

function parseInlineWith (text: string, style: InlineStyle): InlineRun[] {
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
  best.matcher.apply(best.m, style, push)
  const after = text.slice(best.index + best.m[0].length)
  if (after) push(parseInlineWith(after, style))

  return out
}

export function parseInline (text: string): InlineRun[] {
  return parseInlineWith(text, { ...BASE })
}
