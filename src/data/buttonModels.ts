/**
 * Button model registry — single source of truth for every supported remote.
 *
 * Every model is still described as two "halves" (top/bottom in the data model)
 * so saved designs and the editor stay compatible; `layout` decides how a half
 * is cut into zones:
 *  - 'portrait'  halves are top/bottom, zones inside a half split left/right.
 *  - 'landscape' halves are left/right, zones inside a half split top/bottom.
 *  - 'stacked'   halves are top/bottom, zones inside a half split top/bottom
 *                (e.g. 2 + 2 zones = four stacked buttons).
 */
export type ButtonType =
  | 'somrig'
  | 'bilresa'
  | 'hue-dimmer-v1'
  | 'hue-dimmer-v2'
  | 'sonoff-snzb-01m'
  | 'sonoff-snzb-01p'

export type ButtonLayout = 'portrait' | 'landscape' | 'stacked'

export interface ButtonModel {
  label: string
  W: number // mm
  H: number // mm
  outlinePath: string
  layout: ButtonLayout
  dividerPos: number // Y for portrait/stacked, X for landscape
  zoneCenter: number // X for portrait, Y for landscape (2-zone split)
  /** Per-half override of zoneCenter [top/left half, bottom/right half] for staggered splits. */
  zoneCenters?: [number, number]
  /** Number of halves (physical buttons groups) the model has: 1 hides the bottom/right half. */
  halves: 1 | 2
  /** Zones per half on a fresh button. */
  defaultZones: [1 | 2 | 3, 1 | 2 | 3]
  /** A front-plate STL exists in public/models, so 3MF export works. */
  has3mf: boolean
  /** Dimensions come from retailer/manufacturer listings, not a measured part. */
  approximate: boolean
}

const SOMRIG_OUTLINE =
  'M 20.59 0.09 C 27.92 0.09 30.72 0.74 30.72 0.74 C 30.72 0.74 33.07 1.03 35.15 2.67 ' +
  'C 37.24 4.32 39.12 5.81 39.96 11.66 C 40.81 17.51 41.09 35.97 41.09 35.97 ' +
  'C 41.09 35.97 40.81 54.43 39.96 60.27 C 39.12 66.12 37.24 67.61 35.15 69.26 ' +
  'C 33.07 70.91 30.72 71.19 30.72 71.19 C 30.72 71.19 27.92 71.84 20.59 71.84 ' +
  'C 13.26 71.84 10.45 71.19 10.45 71.19 C 10.45 71.19 8.11 70.91 6.02 69.26 ' +
  'C 3.94 67.61 2.06 66.12 1.22 60.27 C 0.37 54.43 0.09 35.97 0.09 35.97 ' +
  'C 0.09 35.97 0.37 17.51 1.22 11.66 C 2.06 5.81 3.94 4.32 6.02 2.67 ' +
  'C 8.11 1.03 10.45 0.74 10.45 0.74 C 10.45 0.74 13.26 0.09 20.59 0.09 Z'

// Vertical stadium outline: W=36.3, H=63.3, r=18.15 (= W/2 — fully rounded top/bottom)
const BILRESA_OUTLINE =
  'M 0 18.15 A 18.15 18.15 0 0 1 36.3 18.15 L 36.3 45.15 A 18.15 18.15 0 0 1 0 45.15 Z'

/** Rounded rectangle with corner radius r, as an SVG path. */
function roundedRect(w: number, h: number, r: number): string {
  return (
    `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} ` +
    `A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} ` +
    `V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`
  )
}

/** Circle of diameter d, as an SVG path. */
function circle(d: number): string {
  const r = d / 2
  return `M 0 ${r} A ${r} ${r} 0 0 1 ${d} ${r} A ${r} ${r} 0 0 1 0 ${r} Z`
}

export const BUTTON_MODELS: Record<ButtonType, ButtonModel> = {
  somrig: {
    label: 'Somrig',
    W: 41.2,
    H: 71.9,
    outlinePath: SOMRIG_OUTLINE,
    layout: 'portrait',
    dividerPos: 36.0,
    zoneCenter: 20.2,
    halves: 2,
    defaultZones: [1, 1],
    has3mf: true,
    approximate: false,
  },
  bilresa: {
    label: 'Bilresa',
    W: 36.3,
    H: 63.3,
    outlinePath: BILRESA_OUTLINE,
    layout: 'portrait',
    dividerPos: 31.65,
    zoneCenter: 18.15,
    halves: 2,
    defaultZones: [1, 1],
    has3mf: true,
    approximate: false,
  },
  // Hue Dimmer Switch: four stacked buttons (on / brighter / dimmer / off).
  // 35 × 92 mm body per Philips' spec sheet.
  'hue-dimmer-v1': {
    label: 'Hue Dimmer v1',
    W: 35,
    H: 92,
    outlinePath: roundedRect(35, 92, 3),
    layout: 'stacked',
    dividerPos: 46,
    zoneCenter: 17.5,
    halves: 2,
    defaultZones: [2, 2],
    has3mf: false,
    approximate: true,
  },
  // The v2 housing is only ~0.2 mm wider than v1; same four-button layout.
  'hue-dimmer-v2': {
    label: 'Hue Dimmer v2',
    W: 35.3,
    H: 92,
    outlinePath: roundedRect(35.3, 92, 3),
    layout: 'stacked',
    dividerPos: 46,
    zoneCenter: 17.65,
    halves: 2,
    defaultZones: [2, 2],
    has3mf: false,
    approximate: true,
  },
  // Orb 4-in-1: φ50 body, φ46.3 button face. Horizontal divider is centred; the
  // vertical line is staggered ±1.83 mm (top left of centre, bottom right).
  // Measured from public/photos/SNZB-01M.png with φ50 as scale (≈ ±0.2 mm).
  'sonoff-snzb-01m': {
    label: 'Sonoff SNZB-01M',
    W: 46.3,
    H: 46.3,
    outlinePath: circle(46.3),
    layout: 'portrait',
    dividerPos: 23.15,
    zoneCenter: 23.15,
    zoneCenters: [21.32, 24.98],
    halves: 2,
    defaultZones: [2, 2],
    has3mf: false,
    approximate: true,
  },
  // Single round button inside a fixed ring. The inlay covers the button only:
  // φ24.5 inside the φ45 body, measured from public/photos/sonoff-snzb-01.jpg
  // with φ45 as scale (≈ ±0.3 mm).
  'sonoff-snzb-01p': {
    label: 'Sonoff SNZB-01P',
    W: 24.5,
    H: 24.5,
    outlinePath: circle(24.5),
    layout: 'portrait',
    dividerPos: 24.5, // whole face is the "top" half
    zoneCenter: 12.25,
    halves: 1,
    defaultZones: [1, 1],
    has3mf: false,
    approximate: true,
  },
}

export const BUTTON_TYPES = Object.keys(BUTTON_MODELS) as ButtonType[]

export function isButtonType(value: unknown): value is ButtonType {
  return typeof value === 'string' && value in BUTTON_MODELS
}
