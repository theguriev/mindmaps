/**
 * Wraps the HostConfig into a reconciler instance and exposes a tiny root API
 * (`createSceneRoot`) that mounts React elements into a mutable scene tree.
 *
 * `@types/react-reconciler@0.33` lags the 0.33 runtime, so we type the reconciler
 * instance loosely and match the *actual* runtime signatures
 * (`createContainer` now takes split error handlers).
 */
import ReactReconciler from 'react-reconciler'
import { LegacyRoot } from 'react-reconciler/constants'
import type { ReactNode } from 'react'
import { hostConfig } from './hostConfig'
import type { Container, SceneNode } from './types'

interface LooseReconciler {
  createContainer: (...args: unknown[]) => unknown
  updateContainer: (element: ReactNode | null, root: unknown, ...rest: unknown[]) => void
}

const reconciler = ReactReconciler(hostConfig as never) as unknown as LooseReconciler

export interface SceneRoot {
  render: (element: ReactNode) => void
  unmount: () => void
  getRoot: () => SceneNode
}

/**
 * @param onCommit Invoked after every React commit; the caller schedules a
 * canvas repaint here.
 */
export function createSceneRoot (onCommit: () => void): SceneRoot {
  const root: SceneNode = {
    type: 'ROOT',
    props: {} as SceneNode['props'],
    children: [],
    parent: null
  }
  const container: Container = { root, onCommit }
  const onError = (err: unknown) => console.error('[canvas-reconciler]', err)

  // LegacyRoot → updateContainer commits synchronously, so the scene tree is
  // fully built before the next repaint (no blank first frame).
  // React 19 createContainer args:
  //   containerInfo, tag, hydrationCallbacks, isStrictMode,
  //   concurrentUpdatesByDefaultOverride, identifierPrefix,
  //   onUncaughtError, onCaughtError, onRecoverableError, transitionCallbacks
  const fiberRoot = reconciler.createContainer(
    container,
    LegacyRoot,
    null,
    false,
    null,
    '',
    onError,
    onError,
    onError,
    null
  )

  return {
    render (element) {
      reconciler.updateContainer(element, fiberRoot, null, null)
    },
    unmount () {
      reconciler.updateContainer(null, fiberRoot, null, null)
    },
    getRoot () {
      return root
    }
  }
}
