/**
 * HostConfig for the custom canvas reconciler (React 19 / react-reconciler 0.33).
 *
 * Mutation mode: the reconciler mutates a `SceneNode` tree in place and
 * `resetAfterCommit` asks the container to schedule a repaint. Nothing here
 * touches the DOM — painting happens separately in `paint.ts`.
 *
 * NOTE: `@types/react-reconciler@0.33` lags the 0.33 runtime (it still models the
 * React 18 `commitUpdate`/`createContainer`/`getCurrentEventPriority` shapes), so
 * this config is authored against the *actual* runtime and typed per-parameter
 * rather than via the outdated `HostConfig<…>` generic.
 */
import { createContext } from 'react'
import { DefaultEventPriority } from 'react-reconciler/constants'
import type { AnyProps, Container, ElementType, SceneNode } from './types'

type Type = ElementType
type Props = AnyProps
const NO_CONTEXT = {}

function createNode (type: SceneNode['type'], props: Props): SceneNode {
  return { type, props, children: [], parent: null }
}

function appendChild (parent: SceneNode, child: SceneNode) {
  if (child.parent) {
    const i = child.parent.children.indexOf(child)
    if (i !== -1) child.parent.children.splice(i, 1)
  }
  parent.children.push(child)
  child.parent = parent
}

function insertBefore (parent: SceneNode, child: SceneNode, before: SceneNode) {
  if (child.parent) {
    const i = child.parent.children.indexOf(child)
    if (i !== -1) child.parent.children.splice(i, 1)
  }
  const idx = parent.children.indexOf(before)
  parent.children.splice(idx === -1 ? parent.children.length : idx, 0, child)
  child.parent = parent
}

function removeChild (parent: SceneNode, child: SceneNode) {
  const i = parent.children.indexOf(child)
  if (i !== -1) parent.children.splice(i, 1)
  child.parent = null
}

// React 19 manages an ambient "current update priority" through the host config.
let currentUpdatePriority = 0 // NoEventPriority

export const hostConfig = {
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  isPrimaryRenderer: true,
  noTimeout: -1 as const,
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,

  getRootHostContext: () => NO_CONTEXT,
  getChildHostContext: () => NO_CONTEXT,
  getPublicInstance: (instance: SceneNode) => instance,

  prepareForCommit: () => null,
  resetAfterCommit: (container: Container) => container.onCommit(),
  preparePortalMount: () => {},

  createInstance: (type: Type, props: Props) => createNode(type, props),
  createTextInstance: (text: string) =>
    createNode('markdown', { text } as unknown as Props),

  appendInitialChild: appendChild,
  appendChild,
  appendChildToContainer: (container: Container, child: SceneNode) =>
    appendChild(container.root, child),

  insertBefore,
  insertInContainerBefore: (container: Container, child: SceneNode, before: SceneNode) =>
    insertBefore(container.root, child, before),

  removeChild,
  removeChildFromContainer: (container: Container, child: SceneNode) =>
    removeChild(container.root, child),

  finalizeInitialChildren: () => false,
  shouldSetTextContent: () => false,

  // React 19 signature: (instance, type, prevProps, nextProps, internalHandle).
  // There is no `updatePayload` argument anymore.
  commitUpdate: (instance: SceneNode, _type: Type, _prevProps: Props, nextProps: Props) => {
    instance.props = nextProps
  },
  commitTextUpdate: (textInstance: SceneNode, _oldText: string, newText: string) => {
    textInstance.props = { text: newText } as unknown as Props
  },

  clearContainer: (container: Container) => {
    for (const child of container.root.children) child.parent = null
    container.root.children = []
  },

  // ---- React 19 update-priority (replaces getCurrentEventPriority) ----
  getCurrentUpdatePriority: () => currentUpdatePriority,
  setCurrentUpdatePriority: (priority: number) => {
    currentUpdatePriority = priority
  },
  resolveUpdatePriority: () => currentUpdatePriority || DefaultEventPriority,

  // ---- React 19 host hooks we don't need (safe no-ops for a canvas renderer) ----
  maySuspendCommit: () => false,
  startSuspendingCommit: () => {},
  suspendInstance: () => {},
  waitForCommitToBeReady: () => null,
  shouldAttemptEagerTransition: () => false,
  requestPostPaintCallback: () => {},
  trackSchedulerEvent: () => {},
  resolveEventType: () => null,
  resolveEventTimeStamp: () => -1.1,
  resetFormInstance: () => {},
  preloadInstance: () => true,
  NotPendingTransition: null,
  HostTransitionContext: createContext(null),

  // ---- misc no-ops ----
  getInstanceFromNode: () => null,
  beforeActiveInstanceBlur: () => {},
  afterActiveInstanceBlur: () => {},
  prepareScopeUpdate: () => {},
  getInstanceFromScope: () => null,
  detachDeletedInstance: () => {}
}
