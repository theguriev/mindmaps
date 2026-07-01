import { useEffect, useLayoutEffect, useRef, type MouseEvent } from 'react'
import type { MindNode } from '@/mindmap/types'
import { useMarkdownToolbar } from '@/hooks/useMarkdownToolbar'
import { TextToolBar } from './TextToolBar'

/**
 * DOM textarea overlay for editing a node's markdown source. Positioned over the
 * node in screen space; the canvas hides the node's text while this is open.
 */
export function TextEditorOverlay ({
  node,
  left,
  top,
  scale = 1,
  onInput,
  onStartResize
}: {
  node: MindNode
  left: number
  top: number
  scale?: number
  onInput: (value: string) => void
  onStartResize: (node: MindNode, e: MouseEvent) => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const toolbar = useMarkdownToolbar(textareaRef, onInput)

  // Restore selection after a formatting action re-renders the value (no-op
  // unless an action queued a selection).
  useLayoutEffect(() => {
    toolbar.restoreSelection(textareaRef.current)
  })

  // Focus on open.
  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.focus()
      const len = ta.value.length
      ta.setSelectionRange(len, len)
    }
  }, [])

  return (
    <div
      className="absolute z-20"
      style={{ left, top, transform: `translate(-50%, -50%) scale(${scale})` }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <TextToolBar
        actions={{
          bold: toolbar.bold,
          italic: toolbar.italic,
          strikethrough: toolbar.strikethrough,
          code: toolbar.code,
          link: toolbar.link,
          orderedList: toolbar.orderedList,
          bulletedList: toolbar.bulletedList,
          blockquote: toolbar.blockquote
        }}
      />
      <textarea
        ref={textareaRef}
        rows={1}
        value={node.name}
        style={{ width: node.width, height: node.height }}
        className="box-border block min-h-[74px] min-w-[300px] resize-none rounded-md border-2 border-foreground bg-background pt-11 pr-2.5 pb-2.5 pl-2.5 text-sm leading-normal outline-none"
        onChange={(e) => onInput(e.target.value)}
        onClick={(e) => e.stopPropagation()}
      />
      <div
        className="absolute right-0.5 bottom-0.5 size-3.5 cursor-se-resize after:absolute after:right-1.5 after:bottom-0.5 after:h-2.5 after:w-0.5 after:rotate-45 after:bg-foreground after:content-[''] before:absolute before:right-1 before:bottom-0.5 before:h-1.5 before:w-0.5 before:rotate-45 before:bg-foreground before:content-['']"
        onMouseDown={(e) => {
          e.stopPropagation()
          e.preventDefault()
          onStartResize(node, e)
        }}
      />
    </div>
  )
}
