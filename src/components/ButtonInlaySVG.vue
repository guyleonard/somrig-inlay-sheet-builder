<script setup lang="ts">
import { computed } from 'vue'
import { BUTTON_MODELS, type ButtonType } from '../data/buttonModels'
/**
 * ButtonInlaySVG — renders a button inlay as an SVG.
 *
 * Supports two button types via the `buttonType` prop:
 *
 * 'somrig'  (default) — portrait 41.2 × 71.9 mm, horizontal divider at y=36mm.
 *   Physical dimensions from Aasikki PDF template. Zones split left/right within
 *   each top/bottom half.
 *
 * 'bilresa' — landscape 63.3 × 36.3 mm, vertical divider at x=31.65mm (centre).
 *   Stadium outline (fully-rounded rectangle, r=18.15mm). Zones split top/bottom
 *   within each left/right half. 'top' prop/half = left; 'bottom' = right.
 *
 * 'hue-dimmer-v1' / 'hue-dimmer-v2' — portrait 35 × 92 mm, 'stacked' layout:
 *   2 + 2 zones give the four stacked buttons (on / up / down / off).
 *
 * 'sonoff-snzb-01m' — round 50 mm, 2 × 2 quadrants. 'sonoff-snzb-01p' — round
 *   45 mm, single button (halves = 1, bottom half not rendered).
 *   All Hue/Sonoff dimensions are approximate; see src/data/buttonModels.ts.
 *
 * Indicators (dot/dash/double-dot/triple-dot) are positioned near the inner or outer edge
 * of each half, axis-correct for the button orientation.
 */

export type ZoneCount = 1 | 2 | 3
export type IndicatorType =
  | 'dot'
  | 'double-dot'
  | 'triple-dot'
  | 'dash'
  | 'none'
export type { ButtonType }

export interface ZoneConfig {
  /** MDI icon path string (from @mdi/js) */
  icon?: string
  /** Action type indicator shown at bottom of zone */
  indicator?: IndicatorType
  /** Icon size in mm — overrides component-level ICON_SIZE */
  iconSize?: number
  /** Icon color — overrides component-level iconColor prop */
  iconColor?: string
  /** Icon rotation in degrees clockwise, default 0, applied after scaling */
  iconRotation?: number
  /** Label text */
  label?: string
  /** Label font size in mm, default 3 */
  labelSize?: number
  /** Label color — defaults to iconColor at render time */
  labelColor?: string
  /** Label rotation in degrees, independent of iconRotation, default 0 */
  labelRotation?: number
  /** Label position relative to icon: 'below' (default) or 'above'. Ignored when no icon. */
  labelPosition?: 'below' | 'above'
  /** Shift icon toward opposite edge to share zone space with label, default false */
  labelShiftIcon?: boolean
}

export interface SeparatorStyleProp {
  thickness?: number
  color?: string
  style?: 'solid' | 'dashed' | 'dotted'
}

const props = withDefaults(
  defineProps<{
    /** Button model — controls shape, dimensions and layout orientation */
    buttonType?: ButtonType
    /** Number of zones in the top/left half: 1 = full, 2 = split, 3 = thirds */
    topZones?: ZoneCount
    /** Number of zones in the bottom/right half: 1 = full, 2 = split, 3 = thirds */
    botZones?: ZoneCount
    /** Per-zone config for top/left half (index 0 = first zone) */
    topZoneConfig?: ZoneConfig[]
    /** Per-zone config for bottom/right half (index 0 = first zone) */
    botZoneConfig?: ZoneConfig[]
    /** Indicator position for top/left half: 'inner' = near divider, 'outer' = near edge */
    topIndicatorPos?: 'inner' | 'outer'
    /** Indicator position for bottom/right half: 'inner' = near divider, 'outer' = near edge */
    botIndicatorPos?: 'inner' | 'outer'
    /** Separator style between the two halves */
    horizontalSeparator?: SeparatorStyleProp
    /** Zone sub-divider style */
    verticalSeparator?: SeparatorStyleProp
    /** Stroke color for outlines/dividers */
    strokeColor?: string
    /** Fill color for the inlay background */
    fillColor?: string
    /** Icon fill color */
    iconColor?: string
    /** Scale factor applied to the viewBox (1 = 1px per mm) */
    scale?: number
  }>(),
  {
    buttonType: 'somrig',
    topZones: 1,
    botZones: 1,
    topZoneConfig: () => [],
    botZoneConfig: () => [],
    topIndicatorPos: 'inner',
    botIndicatorPos: 'inner',
    horizontalSeparator: () => ({
      thickness: 0.3,
      color: '#000000',
      style: 'solid' as const,
    }),
    verticalSeparator: () => ({
      thickness: 0.3,
      color: '#000000',
      style: 'solid' as const,
    }),
    strokeColor: '#000000',
    fillColor: '#ffffff',
    iconColor: '#000000',
    scale: 1,
  },
)

/** Convert line style to stroke-dasharray value */
function getDashArray(
  style: 'solid' | 'dashed' | 'dotted' | undefined,
  thickness: number,
): string | undefined {
  if (!style || style === 'solid') return undefined
  if (style === 'dashed') return `${thickness * 4} ${thickness * 2}`
  if (style === 'dotted') return `${thickness} ${thickness * 2}`
  return undefined
}

// ── Button geometry configs ───────────────────────────────────────────────────
// Defined in src/data/buttonModels.ts (shared with the app shell).

const config = computed(() => BUTTON_MODELS[props.buttonType])
const showBottom = computed(() => config.value.halves === 2)

// ── Indicator + icon constants (mm) ──────────────────────────────────────────
const DOT_R = 0.75
const DASH_W = 4.5
const DASH_H = 1.5
const DASH_R = DASH_H / 2
const INDICATOR_MARGIN = 3.5 // mm from half-edge to indicator centre
const ICON_SIZE = 12 // default MDI icon size in mm

// Unique clip-path ID (needed when multiple instances on same page)
const uid = Math.random().toString(36).slice(2, 8)
const clipId = `inlay-clip-${uid}`

// ── Zone geometry ─────────────────────────────────────────────────────────────
interface Zone {
  x: number
  y: number
  w: number
  h: number
  cx: number
  cy: number
}

/**
 * Compute zones for one half of the button.
 *
 * Portrait  (Somrig):  halfStart = yStart, halfLength = half height.
 *                      Zones are vertical slices (different X, same Y span).
 * Landscape (BILRESA): halfStart = xStart, halfLength = half width.
 *                      Zones are horizontal slices (different Y, same X span).
 */
function computeHalfZones(
  count: ZoneCount,
  halfStart: number,
  halfLength: number,
  half: 0 | 1,
): Zone[] {
  const cfg = config.value
  if (cfg.layout === 'stacked') {
    const rh = halfLength / count
    return Array.from({ length: count }, (_, row) => ({
      x: 0,
      y: halfStart + row * rh,
      w: cfg.W,
      h: rh,
      cx: cfg.W / 2,
      cy: halfStart + row * rh + rh / 2,
    }))
  }
  if (cfg.layout === 'portrait') {
    const yStart = halfStart
    const height = halfLength
    const { W } = cfg
    const zoneCenter = cfg.zoneCenters?.[half] ?? cfg.zoneCenter
    if (count === 1) {
      return [
        {
          x: 0,
          y: yStart,
          w: W,
          h: height,
          cx: W / 2,
          cy: yStart + height / 2,
        },
      ]
    }
    if (count === 2) {
      const lw = zoneCenter
      const rw = W - zoneCenter
      return [
        {
          x: 0,
          y: yStart,
          w: lw,
          h: height,
          cx: lw / 2,
          cy: yStart + height / 2,
        },
        {
          x: lw,
          y: yStart,
          w: rw,
          h: height,
          cx: lw + rw / 2,
          cy: yStart + height / 2,
        },
      ]
    }
    const zw = W / 3
    return [0, 1, 2].map((col) => ({
      x: col * zw,
      y: yStart,
      w: zw,
      h: height,
      cx: col * zw + zw / 2,
      cy: yStart + height / 2,
    }))
  } else {
    const xStart = halfStart
    const width = halfLength
    const { H } = cfg
    const zoneCenter = cfg.zoneCenters?.[half] ?? cfg.zoneCenter
    if (count === 1) {
      return [
        { x: xStart, y: 0, w: width, h: H, cx: xStart + width / 2, cy: H / 2 },
      ]
    }
    if (count === 2) {
      const th = zoneCenter
      const bh = H - zoneCenter
      return [
        {
          x: xStart,
          y: 0,
          w: width,
          h: th,
          cx: xStart + width / 2,
          cy: th / 2,
        },
        {
          x: xStart,
          y: th,
          w: width,
          h: bh,
          cx: xStart + width / 2,
          cy: th + bh / 2,
        },
      ]
    }
    const zh = H / 3
    return [0, 1, 2].map((row) => ({
      x: xStart,
      y: row * zh,
      w: width,
      h: zh,
      cx: xStart + width / 2,
      cy: row * zh + zh / 2,
    }))
  }
}

// Top half = left half for landscape
const topHalfLength = computed(() => config.value.dividerPos)
// Bottom half = right half for landscape; its start = dividerPos
const botHalfStart = computed(() => config.value.dividerPos)
const botHalfLength = computed(() => {
  const cfg = config.value
  return cfg.layout === 'landscape'
    ? cfg.W - cfg.dividerPos
    : cfg.H - cfg.dividerPos
})

const topZoneList = computed(() =>
  computeHalfZones(props.topZones, 0, topHalfLength.value, 0),
)
const botZoneList = computed(() =>
  computeHalfZones(props.botZones, botHalfStart.value, botHalfLength.value, 1),
)

// ── Sub-divider positions ─────────────────────────────────────────────────────

/**
 * Portrait:  returns X positions for vertical lines spanning the given half.
 * Landscape: returns Y positions for horizontal lines spanning the given half.
 */
function halfSubDividers(
  count: ZoneCount,
  half: 0 | 1,
  start = 0,
  length = 0,
): number[] {
  const cfg = config.value
  if (count === 1) return []
  if (cfg.layout === 'stacked') {
    return Array.from(
      { length: count - 1 },
      (_, i) => start + (length / count) * (i + 1),
    )
  }
  if (cfg.layout === 'portrait') {
    return count === 2
      ? [cfg.zoneCenters?.[half] ?? cfg.zoneCenter]
      : [cfg.W / 3, (cfg.W / 3) * 2]
  } else {
    return count === 2
      ? [cfg.zoneCenters?.[half] ?? cfg.zoneCenter]
      : [cfg.H / 3, (cfg.H / 3) * 2]
  }
}

const topSubDividers = computed(() =>
  halfSubDividers(props.topZones, 0, 0, topHalfLength.value),
)
const botSubDividers = computed(() =>
  halfSubDividers(props.botZones, 1, botHalfStart.value, botHalfLength.value),
)

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the {cx, cy} centre of an indicator for a zone.
 *
 * Portrait:  indicator moves along Y (near top or bottom edge of zone),
 *            centred on zone X.
 * Landscape: indicator moves along X (near left or right edge of zone),
 *            centred on zone Y.
 *
 * 'inner' means towards the centre divider; 'outer' means towards the
 * outer button edge.
 */
function indicatorPos(
  zone: Zone,
  half: 'top' | 'bottom',
  position: 'inner' | 'outer',
): { cx: number; cy: number } {
  const cfg = config.value
  if (cfg.layout !== 'landscape') {
    const atBottom =
      (half === 'top' && position === 'inner') ||
      (half === 'bottom' && position === 'outer')
    return {
      cx: zone.cx,
      cy: atBottom
        ? zone.y + zone.h - INDICATOR_MARGIN
        : zone.y + INDICATOR_MARGIN,
    }
  } else {
    // Landscape: 'top' half = left half, inner = towards centre (right side)
    const atRight =
      (half === 'top' && position === 'inner') ||
      (half === 'bottom' && position === 'outer')
    return {
      cx: atRight
        ? zone.x + zone.w - INDICATOR_MARGIN
        : zone.x + INDICATOR_MARGIN,
      cy: zone.cy,
    }
  }
}

/**
 * Returns the dot positions for a multi-dot (double/triple) indicator.
 * Offset axis matches the button orientation so the dots sit side-by-side
 * along the same edge as a single dot would, centred on the single-dot spot.
 */
function dotPositions(
  zone: Zone,
  half: 'top' | 'bottom',
  position: 'inner' | 'outer',
  count: number,
): { cx: number; cy: number }[] {
  const { cx, cy } = indicatorPos(zone, half, position)
  const horizontal = config.value.layout !== 'landscape'
  return Array.from({ length: count }, (_, i) => {
    const offset = (i - (count - 1) / 2) * DOT_R * 4
    return horizontal ? { cx: cx + offset, cy } : { cx, cy: cy + offset }
  })
}

/**
 * Returns x/y/width/height for the dash indicator rect.
 * In portrait the dash is horizontal; in landscape it is rotated 90° (vertical).
 */
function dashRect(
  zone: Zone,
  half: 'top' | 'bottom',
  position: 'inner' | 'outer',
): { x: number; y: number; width: number; height: number } {
  const { cx, cy } = indicatorPos(zone, half, position)
  if (config.value.layout !== 'landscape') {
    return {
      x: cx - DASH_W / 2,
      y: cy - DASH_H / 2,
      width: DASH_W,
      height: DASH_H,
    }
  } else {
    return {
      x: cx - DASH_H / 2,
      y: cy - DASH_W / 2,
      width: DASH_H,
      height: DASH_W,
    }
  }
}

/** SVG transform to centre a 24×24 MDI icon path at (cx, cy) scaled to given size (mm) */
function iconTransform(
  cx: number,
  cy: number,
  sizeMm?: number,
  rotation?: number,
): string {
  const s = (sizeMm ?? ICON_SIZE) / 24
  const tx = cx - (24 * s) / 2
  const ty = cy - (24 * s) / 2
  const rot = rotation ?? 0
  return `translate(${tx},${ty}) scale(${s}) rotate(${rot},12,12)`
}

// ── Label layout helpers ──────────────────────────────────────────────────────

const LABEL_GAP = 1 // mm gap between icon edge and label center

/**
 * Compute the Y center for the icon, shifted when labelShiftIcon is enabled.
 * When no label or labelShiftIcon is false, icon stays at zone.cy.
 */
function computeIconCY(zone: Zone, cfg: ZoneConfig): number {
  if (!cfg.label || !cfg.labelShiftIcon) return zone.cy
  const labelSize = cfg.labelSize ?? 3
  const pos = cfg.labelPosition ?? 'below'
  const shift = (LABEL_GAP + labelSize) / 2
  return pos === 'below' ? zone.cy - shift : zone.cy + shift
}

/**
 * Rotate point (x, y) around (cx, cy) by deg degrees clockwise (SVG convention).
 */
function rotatePoint(
  x: number,
  y: number,
  cx: number,
  cy: number,
  deg: number,
): [number, number] {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return [
    cx + (x - cx) * cos - (y - cy) * sin,
    cy + (x - cx) * sin + (y - cy) * cos,
  ]
}

/**
 * Final render center for the icon.
 * When labelShiftIcon + labelRotation, the icon's *position* is rotated around
 * zone center so it stays in the "above/below" relationship with the label in the
 * rotated frame — without affecting the icon's own visual orientation.
 */
function iconRenderCenter(zone: Zone, cfg: ZoneConfig): [number, number] {
  const baseCY = computeIconCY(zone, cfg)
  if (!cfg.label || !cfg.labelShiftIcon || !cfg.labelRotation)
    return [zone.cx, baseCY]
  return rotatePoint(zone.cx, baseCY, zone.cx, zone.cy, cfg.labelRotation)
}

/**
 * Compute the Y center for the label text.
 * - No icon: centered at zone.cy
 * - Icon present, labelShiftIcon false: placed at icon edge + gap
 * - Icon present, labelShiftIcon true: shifted symmetrically with icon
 */
function computeLabelY(zone: Zone, cfg: ZoneConfig): number {
  const labelSize = cfg.labelSize ?? 3
  const iconSize = cfg.iconSize ?? ICON_SIZE
  const pos = cfg.labelPosition ?? 'below'
  const hasIcon = !!cfg.icon

  if (!hasIcon) return zone.cy

  if (!cfg.labelShiftIcon) {
    const offset = iconSize / 2 + LABEL_GAP + labelSize / 2
    return pos === 'below' ? zone.cy + offset : zone.cy - offset
  }

  const shift = (iconSize + LABEL_GAP) / 2
  return pos === 'below' ? zone.cy + shift : zone.cy - shift
}
</script>

<template>
  <svg
    :viewBox="`0 0 ${config.W} ${config.H}`"
    :width="`${config.W * scale}mm`"
    :height="`${config.H * scale}mm`"
    xmlns="http://www.w3.org/2000/svg"
    overflow="visible"
  >
    <defs>
      <clipPath :id="clipId">
        <path :d="config.outlinePath" />
      </clipPath>
    </defs>

    <!-- Button outline + background -->
    <path
      :d="config.outlinePath"
      :fill="fillColor"
      :stroke="strokeColor"
      stroke-width="0.1"
      stroke-dasharray="0.1, 0.6"
    />

    <g :clip-path="`url(#${clipId})`">

      <!-- ── Centre divider ─────────────────────────────────────── -->
      <!-- Portrait/stacked: horizontal line -->
      <line
        v-if="config.layout !== 'landscape' && showBottom"
        x1="0" :y1="config.dividerPos"
        :x2="config.W" :y2="config.dividerPos"
        :stroke="horizontalSeparator?.color ?? strokeColor"
        :stroke-width="horizontalSeparator?.thickness ?? 0.3"
        :stroke-dasharray="getDashArray(horizontalSeparator?.style, horizontalSeparator?.thickness ?? 0.3)"
      />
      <!-- Landscape: vertical line -->
      <line
        v-else-if="showBottom"
        :x1="config.dividerPos" y1="0"
        :x2="config.dividerPos" :y2="config.H"
        :stroke="horizontalSeparator?.color ?? strokeColor"
        :stroke-width="horizontalSeparator?.thickness ?? 0.3"
        :stroke-dasharray="getDashArray(horizontalSeparator?.style, horizontalSeparator?.thickness ?? 0.3)"
      />

      <!-- ── Top/left-half zone sub-dividers ───────────────────── -->
      <template v-if="config.layout === 'stacked'">
        <line
          v-for="hy in topSubDividers"
          :key="`top-sdiv-${hy}`"
          x1="0" :y1="hy"
          :x2="config.W" :y2="hy"
          :stroke="verticalSeparator?.color ?? strokeColor"
          :stroke-width="verticalSeparator?.thickness ?? 0.3"
          :stroke-dasharray="getDashArray(verticalSeparator?.style, verticalSeparator?.thickness ?? 0.3)"
        />
      </template>
      <template v-else-if="config.layout === 'portrait'">
        <!-- Vertical lines spanning the top half -->
        <line
          v-for="vx in topSubDividers"
          :key="`top-vdiv-${vx}`"
          :x1="vx" y1="0"
          :x2="vx" :y2="config.dividerPos"
          :stroke="verticalSeparator?.color ?? strokeColor"
          :stroke-width="verticalSeparator?.thickness ?? 0.3"
          :stroke-dasharray="getDashArray(verticalSeparator?.style, verticalSeparator?.thickness ?? 0.3)"
        />
      </template>
      <template v-else>
        <!-- Horizontal lines spanning the left half -->
        <line
          v-for="hy in topSubDividers"
          :key="`top-hdiv-${hy}`"
          x1="0" :y1="hy"
          :x2="config.dividerPos" :y2="hy"
          :stroke="verticalSeparator?.color ?? strokeColor"
          :stroke-width="verticalSeparator?.thickness ?? 0.3"
          :stroke-dasharray="getDashArray(verticalSeparator?.style, verticalSeparator?.thickness ?? 0.3)"
        />
      </template>

      <!-- ── Bottom/right-half zone sub-dividers ───────────────── -->
      <template v-if="!showBottom" />
      <template v-else-if="config.layout === 'stacked'">
        <line
          v-for="hy in botSubDividers"
          :key="`bot-sdiv-${hy}`"
          x1="0" :y1="hy"
          :x2="config.W" :y2="hy"
          :stroke="verticalSeparator?.color ?? strokeColor"
          :stroke-width="verticalSeparator?.thickness ?? 0.3"
          :stroke-dasharray="getDashArray(verticalSeparator?.style, verticalSeparator?.thickness ?? 0.3)"
        />
      </template>
      <template v-else-if="config.layout === 'portrait'">
        <!-- Vertical lines spanning the bottom half -->
        <line
          v-for="vx in botSubDividers"
          :key="`bot-vdiv-${vx}`"
          :x1="vx" :y1="config.dividerPos"
          :x2="vx" :y2="config.H"
          :stroke="verticalSeparator?.color ?? strokeColor"
          :stroke-width="verticalSeparator?.thickness ?? 0.3"
          :stroke-dasharray="getDashArray(verticalSeparator?.style, verticalSeparator?.thickness ?? 0.3)"
        />
      </template>
      <template v-else>
        <!-- Horizontal lines spanning the right half -->
        <line
          v-for="hy in botSubDividers"
          :key="`bot-hdiv-${hy}`"
          :x1="config.dividerPos" :y1="hy"
          :x2="config.W" :y2="hy"
          :stroke="verticalSeparator?.color ?? strokeColor"
          :stroke-width="verticalSeparator?.thickness ?? 0.3"
          :stroke-dasharray="getDashArray(verticalSeparator?.style, verticalSeparator?.thickness ?? 0.3)"
        />
      </template>

      <!-- ── Top/left-half zones ───────────────────────────────── -->
      <g v-for="(zone, i) in topZoneList" :key="`top-${i}`">
        <g
          v-if="topZoneConfig[i]?.icon"
          :transform="iconTransform(iconRenderCenter(zone, topZoneConfig[i])[0], iconRenderCenter(zone, topZoneConfig[i])[1], topZoneConfig[i].iconSize, topZoneConfig[i].iconRotation)"
          :fill="topZoneConfig[i].iconColor ?? iconColor"
        >
          <path :d="topZoneConfig[i].icon" />
        </g>

        <text
          v-if="topZoneConfig[i]?.label"
          :x="zone.cx"
          :y="computeLabelY(zone, topZoneConfig[i])"
          text-anchor="middle"
          dominant-baseline="central"
          font-family="'DejaVu Sans', sans-serif"
          :font-size="topZoneConfig[i].labelSize ?? 3"
          :fill="topZoneConfig[i].labelColor ?? topZoneConfig[i].iconColor ?? iconColor"
          :transform="topZoneConfig[i].labelRotation
            ? `rotate(${topZoneConfig[i].labelRotation},${zone.cx},${zone.cy})`
            : undefined"
        >{{ topZoneConfig[i].label }}</text>

        <circle
          v-if="topZoneConfig[i]?.indicator === 'dot'"
          :cx="indicatorPos(zone, 'top', topIndicatorPos).cx"
          :cy="indicatorPos(zone, 'top', topIndicatorPos).cy"
          :r="DOT_R"
          :fill="iconColor"
        />
        <g v-else-if="topZoneConfig[i]?.indicator === 'double-dot' || topZoneConfig[i]?.indicator === 'triple-dot'">
          <circle
            v-for="(d, di) in dotPositions(zone, 'top', topIndicatorPos, topZoneConfig[i]?.indicator === 'triple-dot' ? 3 : 2)"
            :key="di"
            :cx="d.cx"
            :cy="d.cy"
            :r="DOT_R" :fill="iconColor"
          />
        </g>
        <rect
          v-else-if="topZoneConfig[i]?.indicator === 'dash'"
          :x="dashRect(zone, 'top', topIndicatorPos).x"
          :y="dashRect(zone, 'top', topIndicatorPos).y"
          :width="dashRect(zone, 'top', topIndicatorPos).width"
          :height="dashRect(zone, 'top', topIndicatorPos).height"
          :rx="DASH_R" :ry="DASH_R"
          :fill="iconColor"
        />
      </g>

      <!-- ── Bottom/right-half zones ───────────────────────────── -->
      <g v-for="(zone, i) in (showBottom ? botZoneList : [])" :key="`bot-${i}`">
        <g
          v-if="botZoneConfig[i]?.icon"
          :transform="iconTransform(iconRenderCenter(zone, botZoneConfig[i])[0], iconRenderCenter(zone, botZoneConfig[i])[1], botZoneConfig[i].iconSize, botZoneConfig[i].iconRotation)"
          :fill="botZoneConfig[i].iconColor ?? iconColor"
        >
          <path :d="botZoneConfig[i].icon" />
        </g>

        <text
          v-if="botZoneConfig[i]?.label"
          :x="zone.cx"
          :y="computeLabelY(zone, botZoneConfig[i])"
          text-anchor="middle"
          dominant-baseline="central"
          font-family="'DejaVu Sans', sans-serif"
          :font-size="botZoneConfig[i].labelSize ?? 3"
          :fill="botZoneConfig[i].labelColor ?? botZoneConfig[i].iconColor ?? iconColor"
          :transform="botZoneConfig[i].labelRotation
            ? `rotate(${botZoneConfig[i].labelRotation},${zone.cx},${zone.cy})`
            : undefined"
        >{{ botZoneConfig[i].label }}</text>

        <circle
          v-if="botZoneConfig[i]?.indicator === 'dot'"
          :cx="indicatorPos(zone, 'bottom', botIndicatorPos).cx"
          :cy="indicatorPos(zone, 'bottom', botIndicatorPos).cy"
          :r="DOT_R"
          :fill="iconColor"
        />
        <g v-else-if="botZoneConfig[i]?.indicator === 'double-dot' || botZoneConfig[i]?.indicator === 'triple-dot'">
          <circle
            v-for="(d, di) in dotPositions(zone, 'bottom', botIndicatorPos, botZoneConfig[i]?.indicator === 'triple-dot' ? 3 : 2)"
            :key="di"
            :cx="d.cx"
            :cy="d.cy"
            :r="DOT_R" :fill="iconColor"
          />
        </g>
        <rect
          v-else-if="botZoneConfig[i]?.indicator === 'dash'"
          :x="dashRect(zone, 'bottom', botIndicatorPos).x"
          :y="dashRect(zone, 'bottom', botIndicatorPos).y"
          :width="dashRect(zone, 'bottom', botIndicatorPos).width"
          :height="dashRect(zone, 'bottom', botIndicatorPos).height"
          :rx="DASH_R" :ry="DASH_R"
          :fill="iconColor"
        />
      </g>

    </g>
  </svg>
</template>
