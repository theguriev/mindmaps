import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { BootError, parseBoot, resolveMapId, type BootConfig } from './boot'
import './index.css'

declare global {
  interface Window {
    mindMapsBoot?: unknown
  }
}

/** The attribute the shortcode and the block's `render_callback` both emit. */
const MOUNT_SELECTOR = '[data-mind-maps-root]'

/** Marks a container as mounted, so running this twice is harmless. */
const MOUNTED_FLAG = 'mindMapsMounted'

/** Container class every rule in `index.css` hangs off. */
const CONTAINER_CLASS = 'mind-maps-app'

/**
 * A boot payload the plugin failed to print is not something the visitor can
 * act on, but leaving an empty box on the page is worse than saying so — and
 * the message is what tells the administrator to look at PHP, not JavaScript.
 */
function renderBootFailure (container: HTMLElement, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  container.classList.add(CONTAINER_CLASS)
  container.textContent = ''

  const box = document.createElement('div')
  box.setAttribute('role', 'alert')
  box.className = 'p-4 text-sm text-destructive'
  box.textContent = 'The mind map could not start.'

  const detail = document.createElement('div')
  detail.className = 'mt-1 text-xs text-muted-foreground'
  detail.textContent = message

  box.appendChild(detail)
  container.appendChild(box)
  console.error('[mind-maps]', error)
}

function mount (container: HTMLElement, boot: BootConfig): void {
  container.classList.add(CONTAINER_CLASS)
  createRoot(container).render(
    <StrictMode>
      {/* Each embed reads its own map id; the payload is the page-wide default. */}
      <App boot={boot} mapId={resolveMapId(container.dataset.mapId, boot)} />
    </StrictMode>
  )
}

/**
 * Mounts one React root per mount point. A page may carry several embeds (two
 * shortcodes in one post, a block plus a widget), and the script is enqueued on
 * pages that carry none at all — finding nothing is the normal case, not an
 * error, so this returns quietly.
 */
function mountAll (): void {
  const containers = Array.from(
    document.querySelectorAll<HTMLElement>(MOUNT_SELECTOR)
  ).filter((el) => el.dataset[MOUNTED_FLAG] !== '1')

  if (containers.length === 0) return

  let boot: BootConfig
  try {
    boot = parseBoot(window.mindMapsBoot)
  } catch (error) {
    // Only a BootError is a contract problem worth showing; anything else is a
    // bug in here and should surface as itself.
    if (!(error instanceof BootError)) throw error
    for (const container of containers) {
      container.dataset[MOUNTED_FLAG] = '1'
      renderBootFailure(container, error)
    }
    return
  }

  for (const container of containers) {
    container.dataset[MOUNTED_FLAG] = '1'
    mount(container, boot)
  }
}

// WordPress may print this script in the head, in the footer, with `defer`, or
// through a caching plugin that moves it — so the DOM may or may not be ready.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAll, { once: true })
} else {
  mountAll()
}
