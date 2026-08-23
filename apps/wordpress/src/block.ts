/**
 * The editor half of the `mind-maps/map` block.
 *
 * The plugin registers the block in PHP and renders it there, so a post that
 * already contains one works without this file. What it cannot do without this
 * file is put the block in the inserter: a block with no client registration
 * has no `edit`, and the editor will not offer what it cannot draw.
 *
 * Written against WordPress' own React (`wp.element`), not the app's. They are
 * two different copies, and elements made by one are not renderable by the
 * other — the same reason the command palette gets no icons from us. So: no
 * JSX, no imports from `react`, and nothing from this file ever reaches the
 * app's bundle. What it does share is the map projection, which is pure
 * arithmetic over stored coordinates and belongs to neither React.
 *
 * The map is drawn here as a still picture. The front end mounts the real
 * thing, but a live, pannable, editable canvas inside the post editor would be
 * two editors fighting over the same drag — so what an author sees while
 * writing is the shape of the map they picked, and nothing to click.
 */
import { previewPaths, PREVIEW_SPAN, type MapPreview } from '@mindmaps/engine/preview'
import { parseMapSummary } from '@mindmaps/storage/document'
import { LOGO_DATA_URL } from '@mindmaps/engine/logo'

/* -------------------------------------------------------------------------
   The globals WordPress puts on the page. Declared rather than imported: the
   editor enqueues these as `wp-*` script handles and they arrive as globals.
   ---------------------------------------------------------------------- */

interface WpElement {
  createElement: (type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]) => unknown
  useState: <T>(initial: T | (() => T)) => [T, (next: T | ((prev: T) => T)) => void]
  useEffect: (effect: () => void | (() => void), deps?: unknown[]) => void
}

interface BlockAttributes {
  id: number
  height: number
  controls: boolean
}

interface EditProps {
  attributes: BlockAttributes
  setAttributes: (next: Partial<BlockAttributes>) => void
}

interface Wp {
  element: WpElement
  blocks: { registerBlockType: (name: string, settings: Record<string, unknown>) => void }
  blockEditor: {
    useBlockProps: (props?: Record<string, unknown>) => Record<string, unknown>
    InspectorControls: unknown
  }
  components: Record<string, unknown>
  apiFetch: (options: { path: string }) => Promise<unknown>
  i18n: { __: (text: string, domain?: string) => string }
}

const wp = (globalThis as unknown as { wp?: Wp }).wp

/** A row of the picker: what the block needs to name and draw a map. */
interface MapChoice {
  id: string
  title: string
  nodes: number
  preview: MapPreview | null
}

/** The block's own name, matching `Render\BLOCK_NAME` in the plugin. */
const BLOCK_NAME = 'mind-maps/map'

/** Height bounds, matching what the shortcode accepts. */
const MIN_HEIGHT = 200
const MAX_HEIGHT = 1200

/**
 * The map list, as choices.
 *
 * `parseMapSummary` is the app's own reader, so this understands both shapes
 * the endpoint can return — a summary, or the whole document it still sends —
 * and neither this file nor the app has to know which came back.
 */
export function toChoices (body: unknown): MapChoice[] {
  if (!Array.isArray(body)) return []
  const choices: MapChoice[] = []
  for (const row of body) {
    const summary = parseMapSummary(row)
    if (summary === null) continue
    choices.push({
      id: String(summary.id),
      title: summary.title === '' ? 'Untitled map' : summary.title,
      nodes: summary.nodes,
      preview: summary.preview
    })
  }
  return choices
}

/**
 * The still picture: the map's shape, as an SVG string.
 *
 * The same projection the map list draws its thumbnails from — points, the
 * lines between them, and nothing that would need a canvas to measure. Built
 * as markup rather than as elements so it costs one `dangerouslySetInnerHTML`
 * instead of a few hundred nodes in WordPress' React.
 */
export function previewSvg (preview: MapPreview | null, size: number): string {
  const pad = 16
  const side = PREVIEW_SPAN + 2 * pad
  if (preview === null) {
    return `<svg viewBox="0 0 ${side} ${side}" width="${size}" height="${size}" aria-hidden="true"></svg>`
  }
  const { edges, dots, roots } = previewPaths(preview)
  const dx = (PREVIEW_SPAN - preview.width) / 2
  const dy = (PREVIEW_SPAN - preview.height) / 2
  return (
    `<svg viewBox="${-pad} ${-pad} ${side} ${side}" width="${size}" height="${size}" ` +
    'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    `<g transform="translate(${dx} ${dy})">` +
    `<path d="${edges}" stroke-width="7" opacity="0.55"/>` +
    `<path d="${dots}" stroke-width="16" opacity="0.85"/>` +
    `<path d="${roots}" stroke-width="28"/>` +
    '</g></svg>'
  )
}

/** "12 nodes", and "1 node" when that is what it is. */
export function nodeLabel (nodes: number): string {
  return `${nodes} ${nodes === 1 ? 'node' : 'nodes'}`
}

/* -------------------------------------------------------------------------
   Registration.
   ---------------------------------------------------------------------- */

export function registerMapBlock (): void {
  if (wp === undefined) return
  const el = wp.element.createElement
  const { useEffect, useState } = wp.element
  const { useBlockProps, InspectorControls } = wp.blockEditor
  const { PanelBody, SelectControl, RangeControl, ToggleControl, Placeholder, Spinner } =
    wp.components as Record<string, unknown>
  const __ = wp.i18n.__

  function useMaps (): { maps: MapChoice[] | null, failed: boolean } {
    const [maps, setMaps] = useState<MapChoice[] | null>(null)
    const [failed, setFailed] = useState(false)
    useEffect(() => {
      let live = true
      wp!.apiFetch({ path: '/mindmaps/v1/maps' }).then(
        (body) => {
          if (live) setMaps(toChoices(body))
        },
        () => {
          if (live) setFailed(true)
        }
      )
      return () => {
        live = false
      }
    }, [])
    return { maps, failed }
  }

  function Edit ({ attributes, setAttributes }: EditProps) {
    const { maps, failed } = useMaps()
    const chosen = maps?.find((map) => map.id === String(attributes.id)) ?? null
    // One call, above the branch: this is a hook, and the two states below are
    // not two components.
    const blockProps = useBlockProps(
      chosen === null ? undefined : { className: 'mind-maps-block-preview' }
    )

    const options = [
      { value: '0', label: __('Choose a mind map…', 'mind-maps') },
      ...(maps ?? []).map((map) => ({ value: map.id, label: map.title }))
    ]

    const picker = el(SelectControl, {
      label: __('Mind map', 'mind-maps'),
      value: String(attributes.id),
      options,
      disabled: maps === null,
      onChange: (value: string) => setAttributes({ id: Number(value) }),
      __next40pxDefaultSize: true,
      __nextHasNoMarginBottom: true
    })

    const inspector = el(
      InspectorControls,
      null,
      el(
        PanelBody,
        { title: __('Mind map', 'mind-maps') },
        picker,
        el(RangeControl, {
          label: __('Height', 'mind-maps'),
          value: attributes.height,
          min: MIN_HEIGHT,
          max: MAX_HEIGHT,
          step: 20,
          onChange: (value: number) => setAttributes({ height: value ?? MIN_HEIGHT }),
          __next40pxDefaultSize: true,
          __nextHasNoMarginBottom: true
        }),
        el(ToggleControl, {
          label: __('Show controls', 'mind-maps'),
          help: attributes.controls
            ? __('Readers get the title, the zoom and the export menu.', 'mind-maps')
            : __('Just the map. It arrives framed on the whole thing, since there is no zoom to reach for.', 'mind-maps'),
          checked: attributes.controls,
          onChange: (value: boolean) => setAttributes({ controls: value }),
          __nextHasNoMarginBottom: true
        })
      )
    )

    // Nothing picked yet — or the pick has gone missing, which is worth saying
    // rather than drawing an empty frame over.
    if (chosen === null) {
      return el(
        'div',
        blockProps,
        inspector,
        el(
          Placeholder,
          {
            icon: el('img', { src: LOGO_DATA_URL, alt: '', width: 24, height: 24 }),
            label: __('Mind Map', 'mind-maps'),
            instructions: failed
              ? __('The mind maps could not be loaded.', 'mind-maps')
              : attributes.id > 0 && maps !== null
                ? __('That mind map is no longer available. Pick another one.', 'mind-maps')
                : __('Pick a map to place in this post. Readers get the live map; here it is a picture.', 'mind-maps')
          },
          maps === null && !failed ? el(Spinner, null) : picker
        )
      )
    }

    return el(
      'div',
      blockProps,
      inspector,
      el(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            background: '#fff'
          }
        },
        el('div', {
          style: { flex: '0 0 auto', color: '#1e1e1e', lineHeight: 0 },
          dangerouslySetInnerHTML: { __html: previewSvg(chosen.preview, 96) }
        }),
        el(
          'div',
          { style: { minWidth: 0 } },
          el('div', { style: { fontWeight: 600, fontSize: '15px' } }, chosen.title),
          el(
            'div',
            { style: { color: '#757575', fontSize: '13px', marginTop: '2px' } },
            `${nodeLabel(chosen.nodes)} · ${attributes.height}px` +
              (attributes.controls ? '' : ` · ${__('no controls', 'mind-maps')}`)
          ),
          el(
            'div',
            { style: { color: '#757575', fontSize: '12px', marginTop: '8px' } },
            __('Readers get the live map. This is a still of it.', 'mind-maps')
          )
        )
      )
    )
  }

  wp.blocks.registerBlockType(BLOCK_NAME, {
    apiVersion: 3,
    title: __('Mind Map', 'mind-maps'),
    description: __('Place one of your mind maps in this post.', 'mind-maps'),
    category: 'widgets',
    icon: el('img', { src: LOGO_DATA_URL, alt: '', width: 20, height: 20 }),
    keywords: [__('mind map', 'mind-maps'), __('diagram', 'mind-maps'), __('brainstorm', 'mind-maps')],
    attributes: {
      id: { type: 'integer', default: 0 },
      height: { type: 'integer', default: 600 },
      controls: { type: 'boolean', default: true }
    },
    example: {},
    edit: Edit,
    // Server-rendered: the markup comes from `Render\block_callback`, so the
    // post content stores the attributes and nothing else.
    save: () => null
  })
}

registerMapBlock()
