/**
 * Lays out parsed markdown into absolutely-positioned runs + decorations,
 * measured against a Canvas 2D context. No soft wrapping (nodes are nowrap):
 * width is the widest line, height is the stacked line heights.
 */
import { parseBlocks } from './blocks'
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
  kind: 'quote-bar' | 'code-bg' | 'hr'
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

function fontString (
  size: number,
  opts: { bold?: boolean; italic?: boolean; heading?: boolean; mono?: boolean }
): string {
  const weight = opts.bold ? 700 : opts.heading ? 600 : 400
  const italic = opts.italic ? 'italic ' : ''
  return `${italic}${weight} ${size}px ${opts.mono ? MD_MONO : MD_FONT}`
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

interface DraftLine {
  runs: DraftRun[]
  width: number
  height: number
  lineHeight: number
  fontSize: number
  quote: boolean
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
  opts: { heading?: number; quote?: boolean; startX?: number }
): { runs: DraftRun[]; width: number } {
  const out: DraftRun[] = []
  let cursor = opts.startX ?? 0
  for (const r of runs) {
    const font = fontString(size, {
      bold: r.style.bold,
      italic: r.style.italic,
      heading: opts.heading !== undefined,
      mono: r.style.code
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
        const { runs, width } = measureInline(ctx, block.runs, size, { heading: block.level })
        pushLine({ runs, width, height: lh, lineHeight: lh, fontSize: size, quote: false })
        break
      }
      case 'paragraph': {
        const lh = Math.round(BASE_SIZE * BASE_LH)
        const { runs, width } = measureInline(ctx, block.runs, BASE_SIZE, {})
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
          startX
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
        const marker = measureInline(ctx, markerRuns, BASE_SIZE, { startX: markerStart })
        // Body must start after the marker so wide (multi-digit) markers never overlap it.
        const bodyStart = Math.max(indent, marker.width)
        const body = measureInline(ctx, block.runs, BASE_SIZE, { startX: bodyStart })
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
