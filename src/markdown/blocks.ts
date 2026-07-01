/**
 * Block-level markdown parsing for the canvas text renderer.
 *
 * Node text is rendered with `white-space: nowrap` in the original app, so there
 * is no soft word-wrapping: each source line becomes its own visual line and
 * blocks only introduce vertical structure, indentation and decorations.
 */
import { parseInline, type InlineRun } from './inline'

export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'list-item'
  | 'blockquote'
  | 'code'
  | 'hr'
  | 'blank'

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
}

const HEADING = /^(#{1,6})\s+(.*)$/
const HR = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/
const UL = /^(\s*)[-*+]\s+(.*)$/
const OL = /^(\s*)(\d+)\.\s+(.*)$/
const QUOTE = /^\s*>\s?(.*)$/
const FENCE = /^\s*```(.*)$/

export function parseBlocks (src: string): Block[] {
  const lines = (src ?? '').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

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
        runs: parseInline(heading[2])
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
        runs: parseInline(ol[3])
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
        runs: parseInline(ul[2])
      })
      i++
      continue
    }

    const quote = QUOTE.exec(line)
    if (quote) {
      blocks.push({ type: 'blockquote', runs: parseInline(quote[1]) })
      i++
      continue
    }

    blocks.push({ type: 'paragraph', runs: parseInline(line) })
    i++
  }

  return blocks
}
