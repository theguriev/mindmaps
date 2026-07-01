/**
 * Radial branch/edge editor (a transient DOM/SVG overlay, not part of the canvas
 * scene). Beyond colour it edits line weight, style (solid/dashed) and shape
 * (straight/smooth). Segments apply to the whole sub-branch via `onPick`; the
 * editor stays open for multiple tweaks and closes on an outside click.
 */
import type { LineShape, LineStyle, RawNode } from '@/mindmap/types'

const GREY = '#979797'
const HILITE = '#409eff'
const HIT = 'rgba(0,0,0,0)'

export interface EdgeStyle {
  stroke?: string
  strokeWidth?: number
  lineStyle?: LineStyle
  lineShape?: LineShape
}

const PASTEL = [
  { fill: '#67d7c4', d: 'M57.515,23.152 A62,62,0,0,1,23.726,57.281 L13.394,32.336 A35,35,0,0,0,32.468,13.07 Z' },
  { fill: '#9ed56b', d: 'M24.298,57.04 A62,62,0,0,1,-23.726,57.281 L-13.394,32.336 A35,35,0,0,0,13.717,32.2 Z' },
  { fill: '#ebd95f', d: 'M-23.152,57.515 A62,62,0,0,1,-57.281,23.726 L-32.336,13.394 A35,35,0,0,0,-13.07,32.468 Z' },
  { fill: '#efa670', d: 'M-57.04,24.298 A62,62,0,0,1,-57.281,-23.726 L-32.336,-13.394 A35,35,0,0,0,-32.2,13.717 Z' },
  { fill: '#e68782', d: 'M-57.515,-23.152 A62,62,0,0,1,-23.726,-57.281 L-13.394,-32.336 A35,35,0,0,0,-32.468,-13.07 Z' },
  { fill: '#e096e9', d: 'M-24.298,-57.04 A62,62,0,0,1,23.726,-57.281 L13.394,-32.336 A35,35,0,0,0,-13.717,-32.2 Z' },
  { fill: '#988ee3', d: 'M23.152,-57.515 A62,62,0,0,1,57.281,-23.726 L32.336,-13.394 A35,35,0,0,0,13.07,-32.468 Z' },
  { fill: '#7aa3e5', d: 'M57.04,-24.298 A62,62,0,0,1,57.281,23.726 L32.336,13.394 A35,35,0,0,0,32.2,-13.717 Z' }
]

const VIVID = [
  { fill: '#e8e525', d: 'M89.996,-0.89999 A90,90,0,0,1,77.942,45 L56.292,32.5 A65,65,0,0,0,64.997,-0.64999 Z' },
  { fill: '#69b500', d: 'M78.388,44.218 A90,90,0,0,1,45,77.942 L32.5,56.292 A65,65,0,0,0,56.614,31.935 Z' },
  { fill: '#0a660d', d: 'M45.777,77.488 A90,90,0,0,1,5.5109e-15,90 L3.9801e-15,65 A65,65,0,0,0,33.061,55.964 Z' },
  { fill: '#3e8975', d: 'M0.89999,89.996 A90,90,0,0,1,-45,77.942 L-32.5,56.292 A65,65,0,0,0,0.64999,64.997 Z' },
  { fill: '#0da7d3', d: 'M-44.218,78.388 A90,90,0,0,1,-77.942,45 L-56.292,32.5 A65,65,0,0,0,-31.935,56.614 Z' },
  { fill: '#075978', d: 'M-77.488,45.777 A90,90,0,0,1,-90,5.0990e-14 L-65,3.6826e-14 A65,65,0,0,0,-55.964,33.061 Z' },
  { fill: '#272727', d: 'M-89.996,0.89999 A90,90,0,0,1,-77.942,-45 L-56.292,-32.5 A65,65,0,0,0,-64.997,0.64999 Z' },
  { fill: '#5f5f5f', d: 'M-78.388,-44.218 A90,90,0,0,1,-45,-77.942 L-32.5,-56.292 A65,65,0,0,0,-56.614,-31.935 Z' },
  { fill: '#d0d0d0', d: 'M-45.777,-77.488 A90,90,0,0,1,-1.6533e-14,-90 L-1.1940e-14,-65 A65,65,0,0,0,-33.061,-55.964 Z' },
  { fill: '#e23e2b', d: 'M-0.89999,-89.996 A90,90,0,0,1,45,-77.942 L32.5,-56.292 A65,65,0,0,0,-0.64999,-64.997 Z' },
  { fill: '#a65427', d: 'M44.218,-78.388 A90,90,0,0,1,77.942,-45 L56.292,-32.5 A65,65,0,0,0,31.935,-56.614 Z' },
  { fill: '#ffaa38', d: 'M77.488,-45.777 A90,90,0,0,1,90,0 L65,0 A65,65,0,0,0,55.964,-33.061 Z' }
]

interface Weight {
  value: number | undefined
  hit: string
  vis: string
}
const WEIGHTS: Weight[] = [
  { value: 10, hit: 'M115.79,-6.9558 A116,116,0,0,1,111.71,31.242 L92.453,25.856 A96,96,0,0,0,95.827,-5.7565 Z', vis: 'M110.8,-6.656 A111,111,0,0,1,106.9,29.896 L97.268,27.203 A101,101,0,0,0,100.82,-6.0564 Z' },
  { value: 8, hit: 'M109.64,37.885 A116,116,0,0,1,91.254,71.615 L75.52,59.268 A96,96,0,0,0,90.736,31.353 Z', vis: 'M103.97,35.925 A110,110,0,0,1,86.534,67.911 L80.24,62.972 A102,102,0,0,0,96.407,33.313 Z' },
  { value: 6, hit: 'M86.795,76.958 A116,116,0,0,1,56.902,101.09 L47.091,83.657 A96,96,0,0,0,71.831,63.69 Z', vis: 'M81.558,72.314 A109,109,0,0,1,53.468,94.985 L50.525,89.757 A103,103,0,0,0,77.068,68.334 Z' },
  { value: 4, hit: 'M50.738,104.32 A116,116,0,0,1,13.887,115.17 L11.492,95.31 A96,96,0,0,0,41.99,86.33 Z', vis: 'M47.239,97.121 A108,108,0,0,1,12.929,107.22 L12.45,103.25 A104,104,0,0,0,45.489,93.524 Z' },
  { value: 2, hit: 'M6.9558,115.79 A116,116,0,0,1,-31.242,111.71 L-25.856,92.453 A96,96,0,0,0,5.7565,95.827 Z', vis: 'M6.4161,106.81 A107,107,0,0,1,-28.818,103.05 L-28.28,101.12 A105,105,0,0,0,6.2962,104.81 Z' },
  { value: undefined, hit: 'M-37.885,109.64 A116,116,0,0,1,-71.615,91.254 L-59.268,75.52 A96,96,0,0,0,-31.353,90.736 Z', vis: 'M-36.252,104.91 A107,107,0,0,1,-66.059,84.174 L-64.824,82.6 A105,105,0,0,0,-32.986,95.462 Z' }
]

const DASH_HIT = 'M-94.973,66.604 A116,116,0,0,1,-111.43,32.235 L-92.219,26.677 A96,96,0,0,0,-78.599,55.121 Z'
const DASH_VIS = 'M-84.32966372557033,59.13973128052095,-88.25954159700157,53.09664129761081,-93.40087411721525,56.18964952853959,-89.24207132123462,62.584764170648384 ZM-90.31224271061099,49.52472934383077,-93.55496863501513,43.08674788959287,-99.00477263317134,45.596655533646825,-95.57315005297667,52.40966503376266 ZM-95.20314499914375,39.31108218139016,-97.71952154084002,32.55603031435654,-103.41192085389866,34.45249809965887,-100.74895927093853,41.601048133704154 Z'
const SOLID_HIT = 'M-113.16,25.495 A116,116,0,0,1,-115.64,-9.0859 L-95.705,-7.5194 A96,96,0,0,0,-93.653,21.099 Z'
const SOLID_VIS = 'M-100.48151070085152,22.637712059187045 A109,109,0,0,1,-102.68355500105935,-8.06768444749908 L-108.66512131180068,-8.53764664832427 A103,103,0,0,0,-106.334802586338,23.956413732537747 Z'

const STRAIGHT_HIT = 'M-106.46,-46.069 A116,116,0,0,1,-86.563,-77.219 L-71.639,-63.905 A96,96,0,0,0,-88.104,-38.126 Z'
const SMOOTH_HIT = 'M-85.787,-78.081 A116,116,0,0,1,-56.87,-101.1 L-47.065,-83.671 A96,96,0,0,0,-70.996,-64.619 Z'

export function EdgeEditor ({
  x,
  y,
  current,
  onPick
}: {
  x: number
  y: number
  current: EdgeStyle
  onPick: (patch: Partial<RawNode>) => void
}) {
  const curWeight = current.strokeWidth
  const curStyle: LineStyle = current.lineStyle ?? 'solid'
  const curShape: LineShape = current.lineShape ?? 'smooth'

  const pick = (patch: Partial<RawNode>) => (e: React.MouseEvent) => {
    e.stopPropagation()
    onPick(patch)
  }

  return (
    <svg
      className="fixed z-50 -translate-x-1/2 -translate-y-1/2 drop-shadow-xl [&_.hit]:cursor-pointer [&_.seg]:cursor-pointer"
      width={250}
      height={250}
      viewBox="-125 -125 250 250"
      xmlns="http://www.w3.org/2000/svg"
      style={{ left: x, top: y }}
    >
      {/* Faint background wheel + centre hole */}
      <path
        d="M0,-93 A93,93,0,0,1,92.33120313440956,-11.1332352778695 L120.12984493831782,-14.485177081959243 A121,121,0,0,1,-80.2754432347867,90.53647449209925 L-61.69930761020797,69.58588535343165 A93,93,0,0,1,-72.80334406734008,57.867720644695325 L-94.72263045320591,75.29026019363586 A121,121,0,0,1,-119.66994706487438,-17.89144403032254 L-91.97772790936625,-13.751275163801623 A93,93,0,0,1,-88.02982255397542,-29.995838729990545 L-114.53342504334437,-39.026843939019955 A121,121,0,0,1,-49.60281731443898,-110.36557667348272 L-38.12447942349442,-84.82643496391647 A93,93,0,0,1,0-93 M32,0 A32,32,0,0,0,-32,0 A32,32,0,0,0,32,0"
        fill="rgba(0,0,0,0.08)"
      />

      {/* Line weight */}
      <g>
        {WEIGHTS.map((w) => {
          const selected = curWeight === w.value
          return (
            <g key={String(w.value)} onClick={pick({ strokeWidth: w.value })}>
              <path className="hit" d={w.hit} fill={HIT} />
              <path d={w.vis} fill={selected ? HILITE : GREY} />
            </g>
          )
        })}
      </g>

      {/* Line style */}
      <g onClick={pick({ lineStyle: 'dashed' })}>
        <path className="hit" d={DASH_HIT} fill={HIT} />
        <path d={DASH_VIS} fill={curStyle === 'dashed' ? HILITE : GREY} />
      </g>
      <g onClick={pick({ lineStyle: 'solid' })}>
        <path className="hit" d={SOLID_HIT} fill={HIT} />
        <path d={SOLID_VIS} fill={curStyle === 'solid' ? HILITE : GREY} />
      </g>

      {/* Line shape */}
      <g onClick={pick({ lineShape: 'straight' })}>
        <path className="hit" d={STRAIGHT_HIT} fill={HIT} />
        <polyline
          transform="translate(-107 -54) scale(1.9) rotate(300)"
          points="-2.31217783 7.53108891 4.75 9.29903811 6.25 6.70096189 13.3121778 8.46891109"
          stroke={curShape === 'straight' ? HILITE : GREY}
          strokeWidth={3}
          fill="none"
        />
      </g>
      <g onClick={pick({ lineShape: 'smooth' })}>
        <path className="hit" d={SMOOTH_HIT} fill={HIT} />
        <path
          transform="scale(1.9) translate(-24 -42) rotate(125)"
          d="M-2.8434354,6.51657658 C-1.77770015,9.27894918 0.503379707,10.1076905 3.99980417,9.00280057 C7.49622862,7.89791062 9.77743904,8.72478491 10.8434354,11.4834234"
          stroke={curShape === 'smooth' ? HILITE : GREY}
          strokeWidth={3}
          fill="none"
        />
      </g>

      {/* Colours — vivid (outer) + pastel (inner) */}
      <g>
        {VIVID.map((c) => (
          <path
            key={c.fill}
            className="seg"
            d={c.d}
            fill={c.fill}
            stroke={current.stroke === c.fill ? '#111827' : 'none'}
            strokeWidth={current.stroke === c.fill ? 2.5 : 0}
            onClick={pick({ stroke: c.fill })}
          />
        ))}
        {PASTEL.map((c) => (
          <path
            key={c.fill}
            className="seg"
            d={c.d}
            fill={c.fill}
            stroke={current.stroke === c.fill ? '#111827' : 'none'}
            strokeWidth={current.stroke === c.fill ? 2.5 : 0}
            onClick={pick({ stroke: c.fill })}
          />
        ))}
      </g>
    </svg>
  )
}
