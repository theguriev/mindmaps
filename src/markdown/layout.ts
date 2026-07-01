/**
 * Lays out parsed markdown into absolutely-positioned runs + decorations,
 * measured against a Canvas 2D context. No soft wrapping (nodes are nowrap):
 * width is the widest line, height is the stacked line heights.
 */
import { parseBlocks, type CellAlign } from './blocks'
import type { InlineRun } from './inline'

export interface MarkdownRun {
  text: string
  font: string
  color: string
  x: number
  y: number
  width: number
  lineHeight: number
  fontSize: number
  underline: boolean
  strike: boolean
  codeBg: boolean
}

export interface MarkdownDecoration {
  kind:
    | 'quote-bar'
    | 'code-bg'
    | 'hr'
    | 'table-cell'
    | 'table-header'
    | 'table-border'
  x: number
  y: number
  width: number
  height: number
  color: string
}

export interface MarkdownLayout {
  width: number
  height: number
  runs: MarkdownRun[]
  decorations: MarkdownDecoration[]
}

export interface LayoutOptions {
  align?: 'left' | 'right'
  /** Override the body font family (e.g. a handwriting font for sticky notes). */
  fontFamily?: string
}

export const MD_FONT =
  "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
export const MD_MONO =
  "SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace"

const TEXT_COLOR = '#24292e'
const LINK_COLOR = '#0366d6'
const MUTED_COLOR = '#6a737d'
const CODE_BG = 'rgba(27,31,35,0.05)'
const QUOTE_BAR = '#dfe2e5'
const HR_COLOR = '#e1e4e8'
const TABLE_BORDER = '#d0d7de'
const TABLE_HEADER_BG = '#f6f8fa'
const TABLE_ZEBRA_BG = '#f6f8fa'

const BASE_SIZE = 16
const BASE_LH = 1.5
const CODE_SIZE = 13
const HEADING_SIZE: Record<number, number> = {
  1: 32,
  2: 24,
  3: 20,
  4: 16,
  5: 14,
  6: 13
}

const BLANK_GAP = 10
const CODE_PAD_X = 10
const CODE_PAD_Y = 8
const LIST_INDENT = 20
const QUOTE_INDENT = 16
const HR_HEIGHT = 20
const CELL_PAD_X = 12
const CELL_PAD_Y = 6
const TABLE_BORDER_W = 1
const TABLE_MIN_COL = 36

function fontString (
  size: number,
  opts: {
    bold?: boolean
    italic?: boolean
    heading?: boolean
    mono?: boolean
    family?: string
  }
): string {
  const weight = opts.bold ? 700 : opts.heading ? 600 : 400
  const italic = opts.italic ? 'italic ' : ''
  const family = opts.mono ? MD_MONO : (opts.family ?? MD_FONT)
  return `${italic}${weight} ${size}px ${family}`
}

interface DraftRun {
  text: string
  font: string
  color: string
  relX: number
  width: number
  underline: boolean
  strike: boolean
  codeBg: boolean
}

/** A table run/decoration is positioned relative to the table's own top-left;
 *  the second layout pass offsets it by the table's line origin. */
interface SubRun extends DraftRun {
  relY: number
  lineHeight: number
  fontSize: number
}
interface SubDeco {
  kind: MarkdownDecoration['kind']
  relX: number
  relY: number
  width: number
  height: number
  color: string
}

interface DraftLine {
  runs: DraftRun[]
  width: number
  height: number
  lineHeight: number
  fontSize: number
  quote: boolean
  /** Present only for table lines — a self-contained sub-layout. */
  table?: { runs: SubRun[]; decorations: SubDeco[] }
}

/** Lay out a GFM table into runs + decorations relative to its own top-left. */
function layoutTable (
  ctx: CanvasRenderingContext2D,
  rows: InlineRun[][][],
  aligns: CellAlign[],
  family?: string
): { width: number; height: number; runs: SubRun[]; decorations: SubDeco[] } {
  const nCols = rows.reduce((m, r) => Math.max(m, r.length), 0)
  if (nCols === 0) return { width: 0, height: 0, runs: [], decorations: [] }

  const lineH = Math.round(BASE_SIZE * BASE_LH)
  const rowH = lineH + CELL_PAD_Y * 2

  // Measure every cell; track column widths and per-cell content widths.
  const colW = new Array<number>(nCols).fill(TABLE_MIN_COL)
  const cells: Array<Array<{ runs: DraftRun[]; width: number }>> = []
  for (let r = 0; r < rows.length; r++) {
    cells[r] = []
    for (let c = 0; c < nCols; c++) {
      const m = measureInline(ctx, rows[r][c] ?? [], BASE_SIZE, {
        bold: r === 0,
        family
      })
      cells[r][c] = m
      colW[c] = Math.max(colW[c], m.width + CELL_PAD_X * 2)
    }
  }

  const colX: number[] = []
  let cx = 0
  for (let c = 0; c < nCols; c++) {
    colX[c] = cx
    cx += colW[c]
  }
  const width = cx
  const height = rowH * rows.length

  const runs: SubRun[] = []
  const decorations: SubDeco[] = []

  // Backgrounds: header row + zebra striping on alternate body rows.
  decorations.push({ kind: 'table-header', relX: 0, relY: 0, width, height: rowH, color: TABLE_HEADER_BG })
  for (let r = 1; r < rows.length; r++) {
    if (r % 2 === 0) {
      decorations.push({ kind: 'table-cell', relX: 0, relY: r * rowH, width, height: rowH, color: TABLE_ZEBRA_BG })
    }
  }

  // Grid: horizontal + vertical borders (last one pulled inside the extent).
  for (let r = 0; r <= rows.length; r++) {
    const y = r === rows.length ? height - TABLE_BORDER_W : r * rowH
    decorations.push({ kind: 'table-border', relX: 0, relY: y, width, height: TABLE_BORDER_W, color: TABLE_BORDER })
  }
  for (let c = 0; c <= nCols; c++) {
    const x = c === nCols ? width - TABLE_BORDER_W : colX[c]
    decorations.push({ kind: 'table-border', relX: x, relY: 0, width: TABLE_BORDER_W, height, color: TABLE_BORDER })
  }

  // Cell text, aligned within its column.
  for (let r = 0; r < rows.length; r++) {
    const relY = r * rowH + CELL_PAD_Y
    for (let c = 0; c < nCols; c++) {
      const cell = cells[r][c]
      const align = aligns[c] ?? 'left'
      let textX = colX[c] + CELL_PAD_X
      if (align === 'center') textX = colX[c] + (colW[c] - cell.width) / 2
      else if (align === 'right') textX = colX[c] + colW[c] - CELL_PAD_X - cell.width
      for (const run of cell.runs) {
        runs.push({
          ...run,
          relX: textX + run.relX,
          relY,
          lineHeight: lineH,
          fontSize: BASE_SIZE
        })
      }
    }
  }

  return { width, height, runs, decorations }
}

function runColor (r: InlineRun, headingLevel?: number, quote?: boolean): string {
  if (r.style.link) return LINK_COLOR
  if (quote) return MUTED_COLOR
  if (headingLevel === 6) return MUTED_COLOR
  return TEXT_COLOR
}

function measureInline (
  ctx: CanvasRenderingContext2D,
  runs: InlineRun[],
  size: number,
  opts: {
    heading?: number
    quote?: boolean
    startX?: number
    bold?: boolean
    family?: string
  }
): { runs: DraftRun[]; width: number } {
  const out: DraftRun[] = []
  let cursor = opts.startX ?? 0
  for (const r of runs) {
    const font = fontString(size, {
      bold: r.style.bold || opts.bold,
      italic: r.style.italic,
      heading: opts.heading !== undefined,
      mono: r.style.code,
      family: opts.family
    })
    ctx.font = font
    const width = ctx.measureText(r.text).width + (r.style.code ? 6 : 0)
    out.push({
      text: r.text,
      font,
      color: runColor(r, opts.heading, opts.quote),
      relX: cursor,
      width,
      underline: r.style.link,
      strike: r.style.strike,
      codeBg: r.style.code
    })
    cursor += width
  }
  return { runs: out, width: cursor }
}

export function layoutMarkdown (
  ctx: CanvasRenderingContext2D,
  text: string,
  options: LayoutOptions = {}
): MarkdownLayout {
  const align = options.align ?? 'left'
  const family = options.fontFamily
  const blocks = parseBlocks(text)
  const lines: DraftLine[] = []
  // Marks code-block line ranges for a unified background.
  const codeRanges: Array<{ start: number; end: number }> = []
  const hrLines = new Set<number>()

  const pushLine = (line: DraftLine) => lines.push(line)

  for (const block of blocks) {
    switch (block.type) {
      case 'blank':
        pushLine({ runs: [], width: 0, height: BLANK_GAP, lineHeight: BLANK_GAP, fontSize: 0, quote: false })
        break
      case 'hr':
        hrLines.add(lines.length)
        pushLine({ runs: [], width: 0, height: HR_HEIGHT, lineHeight: HR_HEIGHT, fontSize: 0, quote: false })
        break
      case 'heading': {
        const size = HEADING_SIZE[block.level ?? 1]
        const lh = Math.round(size * 1.25)
        const { runs, width } = measureInline(ctx, block.runs, size, { heading: block.level, family })
        pushLine({ runs, width, height: lh, lineHeight: lh, fontSize: size, quote: false })
        break
      }
      case 'paragraph': {
        const lh = Math.round(BASE_SIZE * BASE_LH)
        const { runs, width } = measureInline(ctx, block.runs, BASE_SIZE, { family })
        pushLine({ runs, width, height: lh, lineHeight: lh, fontSize: BASE_SIZE, quote: false })
        break
      }
      case 'blockquote': {
        const lh = Math.round(BASE_SIZE * BASE_LH)
        // Left-align indents the text from the left (bar on the left); right-align
        // reserves the indent on the right so the bar sits after the text, not on it.
        const startX = align === 'right' ? 0 : QUOTE_INDENT
        const { runs, width } = measureInline(ctx, block.runs, BASE_SIZE, {
          quote: true,
          startX,
          family
        })
        const lineWidth = align === 'right' ? width + QUOTE_INDENT : width
        pushLine({ runs, width: lineWidth, height: lh, lineHeight: lh, fontSize: BASE_SIZE, quote: true })
        break
      }
      case 'list-item': {
        const lh = Math.round(BASE_SIZE * BASE_LH)
        const indent = LIST_INDENT * ((block.depth ?? 0) + 1)
        const markerStart = indent - LIST_INDENT
        const markerRuns: InlineRun[] = [
          { text: `${block.marker} `, style: { bold: false, italic: false, strike: false, code: false, link: false } }
        ]
        const marker = measureInline(ctx, markerRuns, BASE_SIZE, { startX: markerStart, family })
        // Body must start after the marker so wide (multi-digit) markers never overlap it.
        const bodyStart = Math.max(indent, marker.width)
        const body = measureInline(ctx, block.runs, BASE_SIZE, { startX: bodyStart, family })
        pushLine({
          runs: [...marker.runs, ...body.runs],
          width: Math.max(marker.width, body.width),
          height: lh,
          lineHeight: lh,
          fontSize: BASE_SIZE,
          quote: false
        })
        break
      }
      case 'code': {
        const codeLines = (block.code ?? '').split('\n')
        const start = lines.length
        const lh = Math.round(CODE_SIZE * 1.5)
        for (let li = 0; li < codeLines.length; li++) {
          const first = li === 0
          const last = li === codeLines.length - 1
          ctx.font = fontString(CODE_SIZE, { mono: true })
          const width = ctx.measureText(codeLines[li]).width
          pushLine({
            runs: [
              {
                text: codeLines[li],
                font: fontString(CODE_SIZE, { mono: true }),
                color: TEXT_COLOR,
                relX: CODE_PAD_X,
                width,
                underline: false,
                strike: false,
                codeBg: false
              }
            ],
            width: width + CODE_PAD_X * 2,
            height: lh + (first ? CODE_PAD_Y : 0) + (last ? CODE_PAD_Y : 0),
            lineHeight: lh,
            fontSize: CODE_SIZE,
            quote: false
          })
        }
        codeRanges.push({ start, end: lines.length - 1 })
        break
      }
      case 'table': {
        const table = layoutTable(ctx, block.rows ?? [], block.aligns ?? [], family)
        pushLine({
          runs: [],
          width: table.width,
          height: table.height,
          lineHeight: table.height,
          fontSize: 0,
          quote: false,
          table
        })
        break
      }
    }
  }

  const layoutWidth = Math.max(0, ...lines.map((l) => l.width))

  // Second pass: absolute positions + decorations.
  const runs: MarkdownRun[] = []
  const decorations: MarkdownDecoration[] = []
  let y = 0
  const lineTops: number[] = []

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]
    lineTops.push(y)
    const shift = align === 'right' ? layoutWidth - line.width : 0

    // A table carries its own sub-layout; offset it by the line origin.
    if (line.table) {
      for (const d of line.table.decorations) {
        decorations.push({
          kind: d.kind,
          x: d.relX + shift,
          y: y + d.relY,
          width: d.width,
          height: d.height,
          color: d.color
        })
      }
      for (const r of line.table.runs) {
        runs.push({
          text: r.text,
          font: r.font,
          color: r.color,
          x: r.relX + shift,
          y: y + r.relY,
          width: r.width,
          lineHeight: r.lineHeight,
          fontSize: r.fontSize,
          underline: r.underline,
          strike: r.strike,
          codeBg: r.codeBg
        })
      }
      y += line.height
      continue
    }

    const isCode = codeRanges.some((r) => idx >= r.start && idx <= r.end)
    const topPad = isCode && codeRanges.some((r) => r.start === idx) ? CODE_PAD_Y : 0

    if (line.quote) {
      decorations.push({
        kind: 'quote-bar',
        x: align === 'right' ? shift + line.width - 4 : shift,
        y,
        width: 4,
        height: line.lineHeight,
        color: QUOTE_BAR
      })
    }

    if (hrLines.has(idx)) {
      decorations.push({
        kind: 'hr',
        x: 0,
        y: y + line.height / 2,
        width: layoutWidth,
        height: 2,
        color: HR_COLOR
      })
    }

    for (const r of line.runs) {
      runs.push({
        text: r.text,
        font: r.font,
        color: r.color,
        x: r.relX + shift,
        y: y + topPad,
        width: r.width,
        lineHeight: line.lineHeight,
        fontSize: line.fontSize,
        underline: r.underline,
        strike: r.strike,
        codeBg: r.codeBg
      })
    }

    y += line.height
  }

  for (const range of codeRanges) {
    const top = lineTops[range.start]
    const bottomLine = lines[range.end]
    const bottom = lineTops[range.end] + bottomLine.height
    const shift = align === 'right' ? layoutWidth - Math.max(...lines.slice(range.start, range.end + 1).map((l) => l.width)) : 0
    const blockWidth = Math.max(...lines.slice(range.start, range.end + 1).map((l) => l.width))
    decorations.unshift({
      kind: 'code-bg',
      x: shift,
      y: top,
      width: blockWidth,
      height: bottom - top,
      color: CODE_BG
    })
  }

  return { width: layoutWidth, height: y, runs, decorations }
}
