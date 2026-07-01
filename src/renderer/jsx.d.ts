/**
 * Declares the custom canvas host elements as JSX intrinsic elements so they
 * can be written as `<group>`, `<box>`, `<bezier>` … inside `.tsx` files and
 * type-check against their prop interfaces.
 *
 * Names are chosen to avoid clashing with the built-in SVG intrinsics
 * (`rect`, `circle`, `image`): we use `box`, `disc`, `picture` instead.
 *
 * React 19 moved the JSX namespace under the `react` module (the automatic
 * runtime resolves `import('react').JSX`), so we augment it there rather than
 * the old global `JSX` namespace.
 */
import 'react'
import type { ReactNode } from 'react'
import type {
  GroupProps,
  BoxProps,
  DiscProps,
  BezierProps,
  TriangleProps,
  MarkdownProps,
  PlusIconProps,
  PictureProps
} from './types'

type WithKey<P> = P & { key?: string | number | null }

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      group: WithKey<GroupProps> & { children?: ReactNode }
      box: WithKey<BoxProps>
      disc: WithKey<DiscProps>
      bezier: WithKey<BezierProps>
      triangle: WithKey<TriangleProps>
      markdown: WithKey<MarkdownProps>
      plus: WithKey<PlusIconProps>
      picture: WithKey<PictureProps>
    }
  }
}
