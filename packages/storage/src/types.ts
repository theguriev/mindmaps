/**
 * The storage contract every backend implements. The engine never talks to a
 * backend directly — a host loads a document through a `MapStore` and hands it
 * to `<MindMapEditor/>`.
 */
import type { MapDoc, MapSummary } from '@mindmaps/engine'

export interface MapStore {
  /**
   * Every map the current user can see, newest first — as summaries, not
   * documents. A screen that lists a hundred maps needs a hundred titles, not
   * a hundred maps; `get` is how you ask for one.
   */
  list: () => Promise<MapSummary[]>
  /** One map, or null when it does not exist (or is not readable). */
  get: (id: string) => Promise<MapDoc | null>
  /** Create a map; the backend assigns the id. */
  create: (doc: Omit<MapDoc, 'id'>) => Promise<MapDoc>
  /** Overwrite a map. Returns what the backend stored (ids/timestamps applied). */
  save: (id: string, doc: MapDoc) => Promise<MapDoc>
  /**
   * Mark a map as a template, or stop. Its own operation because it is the one
   * write a list row makes, and a row has no document to write: routing it
   * through `save` meant sending back the content the list happened to be
   * holding, which quietly reverted anything edited elsewhere since.
   */
  setTemplate: (id: string, template: boolean) => Promise<void>
  /** Delete maps. Missing ids are ignored. */
  remove: (ids: string[]) => Promise<void>
}

/** Thrown by stores for backend failures the UI may want to distinguish. */
export class MapStoreError extends Error {
  readonly code: string
  readonly status?: number

  constructor (message: string, code: string, status?: number) {
    super(message)
    this.name = 'MapStoreError'
    this.code = code
    this.status = status
  }
}
