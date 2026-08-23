import { describe, expect, it } from 'vitest'
import { sceneToSvg } from './svgExport'
import type { SceneNode } from './types'

/** A scene node as the reconciler builds it, minus the parent link the
 *  serializer never reads. */
function node (type: SceneNode['type'], props: Record<string, unknown>): SceneNode {
  return { type, props, children: [], parent: null } as unknown as SceneNode
}

function scene (children: SceneNode[]): SceneNode {
  const root = node('group', {})
  root.children = children
  return root
}

const box = (props: Record<string, unknown>): SceneNode =>
  node('box', { x: 0, y: 0, width: 10, height: 10, ...props })

describe('sceneToSvg', () => {
  it('draws a scene', () => {
    const svg = sceneToSvg(scene([box({ fill: '#ff0000' })]), 100, 50)

    expect(svg).toContain('<svg')
    expect(svg).toContain('width="100" height="50"')
    expect(svg).toContain('fill="#ff0000"')
  })

  it('escapes a colour that would close its own attribute', () => {
    // The document validator refuses this today. The exporter escapes it
    // anyway: a validator can grow a hole, and a serializer that only works
    // for the inputs it happens to get is not a serializer.
    const poison = '#000" /><script>alert(1)</script><rect fill="'

    const svg = sceneToSvg(scene([box({ fill: poison, stroke: poison, strokeWidth: 2 })]), 10, 10)

    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
    // The attribute it was trying to break out of is still one attribute.
    expect(svg).toContain('&quot;')
  })

  it('escapes the background it is given', () => {
    const svg = sceneToSvg(scene([]), 10, 10, '#fff"><script>alert(1)</script>')

    expect(svg).not.toContain('<script>')
  })

  it('escapes a branch colour, which is the one a stored map controls', () => {
    const svg = sceneToSvg(
      scene([
        node('bezier', {
          x1: 0,
          y1: 0,
          cx1: 1,
          cy1: 1,
          cx2: 2,
          cy2: 2,
          x2: 3,
          y2: 3,
          stroke: '#000" onload="alert(1)',
          strokeWidth: 2
        })
      ]),
      10,
      10
    )

    expect(svg).not.toContain('onload="alert(1)"')
    expect(svg).toContain('&quot;')
  })
})
