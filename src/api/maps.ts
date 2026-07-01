/**
 * localStorage-backed map persistence (ported from `utils/api/maps.js` and
 * `map.js`). Kept synchronous — callers wrap in effects where needed.
 */
import type { MapDoc, NodeId } from '@/mindmap/types'

export const PREFIX = 'map-'

function guid (): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function getMap (id: NodeId): MapDoc | null {
  const raw = localStorage.getItem(PREFIX + id)
  return raw ? (JSON.parse(raw) as MapDoc) : null
}

export function saveMap (id: NodeId, map: MapDoc): void {
  localStorage.setItem(PREFIX + id, JSON.stringify(map))
}

export function allMaps (): MapDoc[] {
  return Object.keys(localStorage)
    .filter((key) => key.indexOf(PREFIX) === 0)
    .map((key) => JSON.parse(localStorage.getItem(key) as string) as MapDoc)
}

export function addMap (data: Omit<MapDoc, 'id'>): MapDoc {
  const id = guid()
  const modified = new Date().toISOString()
  const newData: MapDoc = { id, modified, ...data }
  localStorage.setItem(PREFIX + id, JSON.stringify(newData))
  return newData
}

export function delMaps (ids: NodeId[]): void {
  for (const id of ids) localStorage.removeItem(PREFIX + id)
}
