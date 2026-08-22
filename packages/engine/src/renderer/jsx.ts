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
 *
 * This is a real module (not a `.d.ts`) so consumers outside the package can
 * pull the augmentation in with `import type {} from '…/renderer/jsx'`, which
 * erases at build time. Ambient declaration files are not visible across
 * package boundaries.
 */
import type {
  GroupProps,
  BoxProps,
  DiscProps,
  BezierProps,
  TriangleProps,
  MarkdownProps,
  PlusIconProps,
  SpriteProps
} from './types'

type WithKey<P> = P & { key?: string | number | null }

declare module 'react' {
  // The JSX namespace is how React 19 exposes intrinsic elements; augmenting
  // it is only possible with a namespace declaration.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      // `import('react').ReactNode` inline: a top-level type import used only
      // inside a module augmentation reads as unused to noUnusedLocals.
      group: WithKey<GroupProps> & { children?: import('react').ReactNode }
      box: WithKey<BoxProps>
      disc: WithKey<DiscProps>
      bezier: WithKey<BezierProps>
      triangle: WithKey<TriangleProps>
      markdown: WithKey<MarkdownProps>
      plus: WithKey<PlusIconProps>
      sprite: WithKey<SpriteProps>
    }
  }
}
