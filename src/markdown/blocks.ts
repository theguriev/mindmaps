/**
 * Block-level markdown parsing for the canvas text renderer.
 *
 * Node text is rendered with `white-space: nowrap` in the original app, so there
 * is no soft word-wrapping: each source line becomes its own visual line and
 * blocks only introduce vertical structure, indentation and decorations.
 */
import { parseInline, type InlineRun, type LinkDefs } from './inline'

export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'list-item'
  | 'blockquote'
  | 'code'
  | 'table'
  | 'hr'
  | 'blank'

export type CellAlign = 'left' | 'center' | 'right'

export interface Block {
  type: BlockType
  runs: InlineRun[]
  /** Heading level 1..6. */
  level?: number
  /** For list items: the bullet ('•') or ordinal ('1.'). */
  marker?: string
  ordered?: boolean
  /** Nesting depth for lists / quotes. */
  depth?: number
  /** Raw code (unformatted). */
  code?: string
  /** For tables: rows → cells → inline runs (row 0 is the header). */
  rows?: InlineRun[][][]
  /** For tables: per-column text alignment. */
  aligns?: CellAlign[]
}

const HEADING = /^(#{1,6})\s+(.*)$/
const HR = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/
const UL = /^(\s*)[-*+]\s+(.*)$/
const OL = /^(\s*)(\d+)\.\s+(.*)$/
const QUOTE = /^\s*>\s?(.*)$/
const FENCE = /^\s*```(.*)$/
// A Setext heading underline under a paragraph line: `===` (H1) or `---` (H2).
const SETEXT = /^ {0,3}(=+|-+)\s*$/
// A link reference definition: `[label]: url "optional title"`.
const LINK_DEF = /^\s*\[([^\]]+)\]:\s*(\S+)(?:\s+.*)?$/

/** Collect `[label]: url` reference definitions (ignoring those inside code
 *  fences) so links defined anywhere in the text resolve, then report which
 *  line indices were definitions so the renderer can skip them. */
function collectLinkDefs (lines: string[]): { defs: LinkDefs; defLines: Set<number> } {
  const defs: LinkDefs = new Map()
  const defLines = new Set<number>()
  let inFence = false
  lines.forEach((line, idx) => {
    if (FENCE.test(line)) {
      inFence = !inFence
      return
    }
    if (inFence) return
    const d = LINK_DEF.exec(line)
    if (d) {
      defs.set(d[1].trim().toLowerCase(), d[2])
      defLines.add(idx)
    }
  })
  return { defs, defLines }
}
// A GFM table delimiter row: only dashes, colons, pipes and spaces, e.g.
// `--- | :--: | ---:` or `| --- | --- |`.
const TABLE_DELIM = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/

/** Split a table row into trimmed cells, tolerating optional outer pipes. */
function splitCells (line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((c) => c.trim())
}

function cellAlign (delim: string): CellAlign {
  const left = delim.startsWith(':')
  const right = delim.endsWith(':')
  if (left && right) return 'center'
  if (right) return 'right'
  return 'left'
}

export function parseBlocks (src: string): Block[] {
  const lines = (src ?? '').split('\n')
  const { defs, defLines } = collectLinkDefs(lines)
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Link reference definitions render nothing.
    if (defLines.has(i)) {
      i++
      continue
    }

    // Fenced code block.
    const fence = FENCE.exec(line)
    if (fence) {
      i++
      const codeLines: string[] = []
      while (i < lines.length && !FENCE.test(lines[i])) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length) i++ // consume closing fence
      blocks.push({ type: 'code', runs: [], code: codeLines.join('\n') })
      continue
    }

    if (line.trim() === '') {
      blocks.push({ type: 'blank', runs: [] })
      i++
      continue
    }

    if (HR.test(line)) {
      blocks.push({ type: 'hr', runs: [] })
      i++
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        runs: parseInline(heading[2], defs)
      })
      i++
      continue
    }

    const ol = OL.exec(line)
    if (ol) {
      blocks.push({
        type: 'list-item',
        ordered: true,
        marker: `${ol[2]}.`,
        depth: Math.floor(ol[1].length / 2),
        runs: parseInline(ol[3], defs)
      })
      i++
      continue
    }

    const ul = UL.exec(line)
    if (ul) {
      blocks.push({
        type: 'list-item',
        ordered: false,
        marker: '•',
        depth: Math.floor(ul[1].length / 2),
        runs: parseInline(ul[2], defs)
      })
      i++
      continue
    }

    const quote = QUOTE.exec(line)
    if (quote) {
      blocks.push({ type: 'blockquote', runs: parseInline(quote[1], defs) })
      i++
      continue
    }

    // GFM table: a header row with pipes immediately followed by a delimiter
    // row (dashes/colons). Body rows continue until a blank / non-pipe line.
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      TABLE_DELIM.test(lines[i + 1])
    ) {
      const aligns = splitCells(lines[i + 1]).map(cellAlign)
      const rows: InlineRun[][][] = [
        splitCells(line).map((c) => parseInline(c, defs))
      ]
      i += 2
      while (
        i < lines.length &&
        lines[i].includes('|') &&
        lines[i].trim() !== '' &&
        !FENCE.test(lines[i])
      ) {
        rows.push(splitCells(lines[i]).map((c) => parseInline(c, defs)))
        i++
      }
      blocks.push({ type: 'table', runs: [], rows, aligns })
      continue
    }

    // Setext heading: this paragraph line underlined by === (H1) or --- (H2).
    // Checked here (after the other block types) so the underline isn't first
    // taken as a horizontal rule; consuming it also keeps a lone `---` an <hr>.
    const setext = i + 1 < lines.length && !defLines.has(i + 1)
      ? SETEXT.exec(lines[i + 1])
      : null
    if (setext) {
      blocks.push({
        type: 'heading',
        level: setext[1][0] === '=' ? 1 : 2,
        runs: parseInline(line, defs)
      })
      i += 2
      continue
    }

    blocks.push({ type: 'paragraph', runs: parseInline(line, defs) })
    i++
  }

  return blocks
}
