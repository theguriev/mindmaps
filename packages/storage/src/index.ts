/**
 * Storage backends for mind maps: one contract, two implementations.
 *
 *   createLocalStore()  — browser localStorage (the standalone editor)
 *   createWpStore({…})  — the WordPress REST API (the plugin)
 */
export type { MapStore } from './types'
export { MapStoreError } from './types'
export { createLocalStore, PREFIX } from './local'
export type { LocalStoreOptions } from './local'
export { createWpStore } from './wp'
export type { WpStoreOptions } from './wp'
export { DOC_VERSION, parseContent, parseMapDoc, toWire } from './document'
