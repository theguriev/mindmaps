import { describe, expect, it } from 'vitest'
import { MapStoreError } from '@mindmaps/storage'
import { describeStoreError } from './errors'

describe('describeStoreError', () => {
  it('branches on the plugin\'s stable error codes, not on message text', () => {
    const forbidden = describeStoreError(
      new MapStoreError('Sorry, you are not allowed to do that.', 'mindmap_forbidden', 403)
    )
    expect(forbidden.title).toMatch(/permission/i)
    expect(forbidden.retryable).toBe(false)

    const missing = describeStoreError(
      new MapStoreError('No such map', 'mindmap_not_found', 404)
    )
    expect(missing.title).toMatch(/no longer exists/i)
    expect(missing.retryable).toBe(false)
  })

  it('offers a retry only where one could work', () => {
    expect(describeStoreError(new MapStoreError('offline', 'network_error')).retryable).toBe(true)
    expect(
      describeStoreError(new MapStoreError('bad shape', 'invalid_response')).retryable
    ).toBe(false)
  })

  it('reads an unrecognized auth failure as a stale nonce', () => {
    const stale = describeStoreError(new MapStoreError('Cookie check failed', 'rest_cookie_invalid_nonce', 403))
    expect(stale.title).toMatch(/session has expired/i)
    expect(stale.retryable).toBe(false)
  })

  it('still says something useful for a non-store error', () => {
    const notice = describeStoreError(new TypeError('boom'))
    expect(notice.title).toMatch(/something went wrong/i)
    expect(notice.detail).toBe('boom')
    expect(notice.retryable).toBe(true)
  })
})
