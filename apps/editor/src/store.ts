import { createLocalStore } from '@mindmaps/storage'

/** The standalone editor keeps every map in the browser. Swapping this for
 *  `createWpStore({ root, nonce })` is all it takes to run against WordPress. */
export const store = createLocalStore()
