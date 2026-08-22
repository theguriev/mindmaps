/**
 * Turning a store failure into something a page visitor can read.
 *
 * `MapStoreError` carries the plugin's stable `code` and the HTTP `status`
 * (see the error table in `docs/wordpress-contract.md`), which is exactly the
 * branch this needs — matching on message text would break the first time
 * somebody translates the plugin.
 */
import { MapStoreError } from '@mindmaps/storage'

export interface ErrorNotice {
  /** One line, addressed to whoever is looking at the page. */
  title: string
  /** The backend's own message, when it adds anything. */
  detail?: string
  /** Whether trying again could plausibly work. */
  retryable: boolean
}

export function describeStoreError (error: unknown): ErrorNotice {
  if (!(error instanceof MapStoreError)) {
    return {
      title: 'Something went wrong while loading the mind map.',
      detail: error instanceof Error ? error.message : undefined,
      retryable: true
    }
  }

  switch (error.code) {
    case 'network_error':
      return {
        title: 'Could not reach the site. Check your connection and try again.',
        detail: error.message,
        retryable: true
      }
    case 'mindmap_forbidden':
      return {
        title: 'You do not have permission to open this mind map.',
        retryable: false
      }
    case 'mindmap_not_found':
      return { title: 'This mind map no longer exists.', retryable: false }
    case 'invalid_response':
      return {
        title: 'The site returned a mind map this editor cannot read.',
        detail: error.message,
        retryable: false
      }
    default:
      break
  }

  // A nonce goes stale when the login session rolls over, and the fix is a
  // reload of the page rather than a retry of the request.
  if (error.status === 401 || error.status === 403) {
    return {
      title: 'Your session has expired. Reload the page and sign in again.',
      detail: error.message,
      retryable: false
    }
  }
  if (error.status === 404) {
    return { title: 'This mind map no longer exists.', retryable: false }
  }

  return {
    title: 'The site could not load this mind map.',
    detail: error.message,
    retryable: true
  }
}
