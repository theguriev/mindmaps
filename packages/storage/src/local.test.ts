import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalStore, PREFIX } from './local'
import { MapStoreError } from './types'

/** Minimal in-memory Storage stand-in (node has no localStorage). */
function memoryStorage (initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial))
  return {
    get length () {
      return data.size
    },
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v)
    },
    removeItem: (k: string) => {
      data.delete(k)
    },
    clear: () => data.clear()
  } as Storage
}

const doc = (id: string, over: Record<string, unknown> = {}) =>
  JSON.stringify({ id, title: id, content: [], ...over })

describe('createLocalStore', () => {
  let storage: Storage
  let ids: number

  beforeEach(() => {
    ids = 0
    storage = memoryStorage()
  })

  const store = () =>
    createLocalStore({ storage, makeId: () => `id-${++ids}` })

  it('round-trips a created map', async () => {
    const created = await store().create({ title: 'Plan', content: [] })
    expect(created.id).toBe('id-1')
    expect(created.modified).toBeTypeOf('string')
    expect(await store().get('id-1')).toMatchObject({ id: 'id-1', title: 'Plan' })
  })

  it('lists only map- keys, newest first, skipping corrupt entries', async () => {
    storage.setItem(PREFIX + 'a', doc('a', { modified: '2026-01-01' }))
    storage.setItem(PREFIX + 'b', doc('b', { modified: '2026-06-01' }))
    storage.setItem(PREFIX + 'broken', '{not json')
    storage.setItem('unrelated', 'x')

    const maps = await store().list()
    expect(maps.map((m) => m.id)).toEqual(['b', 'a'])
  })

  it('reads legacy entries that carry no id, using the key', async () => {
    storage.setItem(PREFIX + 'legacy', JSON.stringify({ title: 'Old', content: [] }))
    expect(await store().get('legacy')).toMatchObject({ id: 'legacy', title: 'Old' })
  })

  it('returns null for a missing map and ignores unknown ids on remove', async () => {
    expect(await store().get('nope')).toBeNull()
    await expect(store().remove(['nope'])).resolves.toBeUndefined()
  })

  it('saves under the requested id and refreshes `modified`', async () => {
    await store().save('x', { id: 'ignored', title: 'T', content: [] })
    const raw = storage.getItem(PREFIX + 'x')
    expect(JSON.parse(raw!)).toMatchObject({ id: 'x', title: 'T' })
  })

  it('surfaces a full quota instead of reporting a phantom save', async () => {
    const failing = memoryStorage()
    failing.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError')
    }
    await expect(
      createLocalStore({ storage: failing }).save('x', { id: 'x', title: '', content: [] })
    ).rejects.toBeInstanceOf(MapStoreError)
  })
})
