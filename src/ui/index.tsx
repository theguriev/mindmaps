/**
 * Small, dependency-free UI primitives approximating the ant-design-vue
 * components the original used (Button, Input, Modal, Dropdown, Popover, Tag,
 * Tooltip, Empty, Divider, Menu).
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react'
import './ui.css'

type ButtonVariant = 'default' | 'primary' | 'link' | 'danger'

export function Button ({
  children,
  variant = 'default',
  ghost,
  loading,
  disabled,
  onClick,
  className = '',
  title,
  style
}: {
  children?: ReactNode
  variant?: ButtonVariant
  ghost?: boolean
  loading?: boolean
  disabled?: boolean
  onClick?: (e: React.MouseEvent) => void
  className?: string
  title?: string
  style?: CSSProperties
}) {
  return (
    <button
      className={`ui-btn ui-btn--${variant}${ghost ? ' ui-btn--ghost' : ''} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      title={title}
      style={style}
    >
      {loading && <span className="ui-btn__spinner" />}
      {children}
    </button>
  )
}

export function Input ({
  value,
  onChange,
  placeholder,
  className = '',
  autoFocus
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}) {
  return (
    <input
      className={`ui-input ${className}`}
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function Divider ({ vertical }: { vertical?: boolean }) {
  return <div className={vertical ? 'ui-divider--vertical' : 'ui-divider'} />
}

export function Tag ({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span className="ui-tag" title={title}>
      {children}
    </span>
  )
}

export function Tooltip ({
  title,
  children
}: {
  title: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <span
      className="ui-tooltip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && <span className="ui-tooltip__bubble">{title}</span>}
    </span>
  )
}

export function Empty ({ description = 'No data' }: { description?: string }) {
  return (
    <div className="ui-empty">
      <div className="ui-empty__icon">🗂️</div>
      <div>{description}</div>
    </div>
  )
}

export function Modal ({
  visible,
  title,
  onClose,
  children,
  footer
}: {
  visible: boolean
  title?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, onClose])

  if (!visible) return null
  return (
    <div className="ui-modal__mask" onMouseDown={onClose}>
      <div className="ui-modal" onMouseDown={(e) => e.stopPropagation()}>
        {title !== undefined && (
          <div className="ui-modal__head">
            <span>{title}</span>
            <button className="ui-modal__close" onClick={onClose}>
              ×
            </button>
          </div>
        )}
        <div className="ui-modal__body">{children}</div>
        {footer}
      </div>
    </div>
  )
}

/** Floating panel anchored under a trigger; closes on outside click. */
function Floating ({
  content,
  children
}: {
  content: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const triggerRef = useRef<HTMLSpanElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    if (open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ left: r.left, top: r.bottom + 6 })
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !popRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <>
      <span
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'inline-flex' }}
      >
        {children}
      </span>
      {open && (
        <div
          ref={popRef}
          className="ui-pop"
          style={{ left: pos.left, top: pos.top }}
          onClick={() => setOpen(false)}
        >
          {content}
        </div>
      )}
    </>
  )
}

export function Dropdown ({
  overlay,
  children
}: {
  overlay: ReactNode
  children: ReactNode
}) {
  return <Floating content={overlay}>{children}</Floating>
}

export function Popover ({
  content,
  children
}: {
  content: ReactNode
  children: ReactNode
}) {
  return <Floating content={content}>{children}</Floating>
}

export function Menu ({ children }: { children: ReactNode }) {
  return <div className="ui-menu">{children}</div>
}

export function MenuItem ({
  children,
  onClick
}: {
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <div className="ui-menu__item" onClick={onClick}>
      {children}
    </div>
  )
}

export function MenuDivider () {
  return <div className="ui-menu__divider" />
}
