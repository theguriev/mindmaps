import { useRef, type RefObject } from 'react'
import { wrap } from '@/utils/wrap'

export interface PendingSelection {
  start: number
  end: number
}

/**
 * Markdown formatting actions for the editing textarea (bold/italic/…/lists).
 * Ported from `useMarkdownToolbar.js`, adapted for a React-controlled textarea:
 * each action computes the new value + selection, calls `onChange`, and records
 * the selection to be restored after the controlled re-render.
 */
export function useMarkdownToolbar (
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  onChange: (value: string) => void
) {
  const pendingSel = useRef<PendingSelection | null>(null)

  const textareaWrap = (wherewith: string) => {
    const dom = textareaRef.current
    if (!dom) return
    const { str, start, end } = wrap(
      dom.value,
      dom.selectionStart,
      dom.selectionEnd,
      wherewith
    )
    onChange(str)
    pendingSel.current = { start, end }
  }

  const textareaLists = (
    itemFn: (line: string, index: number) => string,
    offset: number
  ) => {
    const dom = textareaRef.current
    if (!dom) return
    const start = dom.selectionStart
    const end = dom.selectionEnd
    const slice = dom.value.substr(start, end)
    const newVal = slice.split('\n').map(itemFn).join('\n')
    const endOffset = slice.split('\n').length * offset
    const next =
      dom.value.substr(0, start) + newVal + dom.value.substr(end, dom.value.length)
    onChange(next)
    pendingSel.current = { start, end: end + endOffset }
  }

  const bold = () => textareaWrap('**')
  const italic = () => textareaWrap('_')
  const strikethrough = () => textareaWrap('~~')
  const code = () => textareaWrap('```')

  const link = () => {
    const dom = textareaRef.current
    if (!dom) return
    const start = dom.selectionStart
    const end = dom.selectionEnd
    const next =
      dom.value.substring(0, start) +
      '[' +
      dom.value.substr(start, end) +
      ']' +
      '(http://beagl.in)'
    onChange(next)
    pendingSel.current = { start: start + 1, end: end + 1 }
  }

  const orderedList = () => textareaLists((line, index) => `${index + 1}. ${line}`, 3)
  const bulletedList = () => textareaLists((line) => `* ${line}`, 2)
  const blockquote = () => textareaLists((line) => `> ${line}`, 2)

  return {
    pendingSel,
    bold,
    italic,
    strikethrough,
    code,
    link,
    orderedList,
    bulletedList,
    blockquote
  }
}
