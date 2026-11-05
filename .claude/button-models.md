# Button Models Deep-Dive

`src/data/buttonModels.ts` is the single source of truth for every supported
remote (label, size, outline path, layout, divider/zone positions, default zone
counts, 3MF support). `ButtonInlaySVG.vue`, `App.vue`, `useSheets.ts` and
`ButtonEditorPanel.vue` all read from it — add a remote there, not in each file.

## Data model

Every model is two "halves" (`top` / `bottom` in the saved data), each with 1–3
zones. `layout` decides how a half is cut:

| layout | halves | zones inside a half |
|--------|--------|---------------------|
| `portrait` | top / bottom | split left / right |
| `landscape` | left / right | split top / bottom |
| `stacked` | top / bottom | split top / bottom (2 + 2 = four stacked buttons) |

- `halves: 1` hides the bottom half in the renderer and the editor (SNZB-01P).
- `zoneCenters: [top, bottom]` overrides the 2-zone split per half, for staggered
  crosses (SNZB-01M). Falls back to `zoneCenter`.
- Switching model resets *untouched* buttons (no icon/label) to the model's
  `defaultZones`; edited buttons keep their content.
- Saves with an unknown `buttonType` fall back to `somrig`.

## Models

| Model | Size (mm) | Layout | 3MF | Source |
|-------|-----------|--------|-----|--------|
| Somrig | 41.2 × 71.9 | portrait | yes | Aasikki PDF template |
| Bilresa | 36.3 × 63.3 | portrait | yes | measured part |
| Hue Dimmer v1 | 35 × 92 | stacked 2+2, fractions | no | Philips spec sheet; proportions from photo |
| Hue Dimmer v2 (older) | 35.08 × 91.59 | stacked 2+2, fractions | no | r/Hue thread; proportions from photo |
| Hue Dimmer v2 (newer) | 35.31 × 91.88 | stacked 2+2, fractions | no | r/Hue thread; proportions from photo |
| Sonoff SNZB-01M | φ46.3 face (φ50 body) | portrait 2×2, staggered | no | measured from image |
| Sonoff SNZB-01P | φ24.5 button (φ45 body) | single zone | no | measured from image |

Hue and Sonoff sizes are **approximate** (`approximate: true`) — retailer,
manufacturer or forum figures, not calipers. Philips lists the Hue v2 as
80 × 125 mm; that is believed to be the wall plate/packaging, not the remote.
The v2 corner radius (6 mm) is an estimate.

### Hue Dimmer layouts

Both are 'stacked' with 2 + 2 zones (on / brighter / dimmer / off), but the
zone heights are not equal — `zoneFractions: [top half, bottom half]` gives
each zone's share of its half:

- **v1:** four separate buttons, heights ≈ 32 / 18.5 / 18.5 / 31 % of the face
  (`[0.63, 0.37]`, `[0.37, 0.63]`).
- **v2:** top button, a middle *rocker*, bottom button, ≈ 33 / 36 / 32 %
  (`[0.647, 0.353]`, `[0.353, 0.647]`). The rocker is still two zones (up and
  down) so each can carry its own icon; its centre divider is hidden by default
  via `defaultSeparators.horizontal.thickness = 0` (the user can raise the
  thickness in the editor). Fresh buttons get this default; switching model
  only changes a button's divider if it was still at the previous model's default.
- Two v2 housing revisions exist (older 35.08 × 91.59, newer 35.31 × 91.88);
  they are separate models with identical layout.
- Photos in `docs/reference/hue-dimmer-v{1,2}-button-layout.jpeg` were used for
  proportions (small, in a wall plate — treat as ±2 %). No schematics exist.

## How the Sonoff geometry was measured

Reference line drawings live in `docs/reference/` (not `public/`, so they don't
ship). Pixel positions of the lines were measured and scaled using the known
overall diameter (φ50 / φ45) as the scale, accurate to roughly ±0.2–0.3 mm.

- `sonoff-snzb-01m-button-layout.png` — outer ring 518 px = φ50 (10.36 px/mm).
  Horizontal divider is centred. Vertical line sits ±1.83 mm off-centre (top
  left, bottom right). Button face φ46.3. The dots in the drawing are the
  *button numbers* (1–4), not press counts.
- `sonoff-snzb-01p-ring-diameters.jpg` — outer 488 px = φ45 (10.84 px/mm), inner
  button 266 px = φ24.5. The ring around the button is fixed housing, so the
  inlay outline is the button only.

## Press types

`ActionType` is `single | double | triple | hold | none`, drawn as one dot, two
dots, three dots, a dash, or nothing. Both Sonoff remotes support single,
double, triple and long press on every button. 3MF handles the indicator dots
generically (any `<circle>`), so no export change was needed.

## 3MF

Only Somrig and Bilresa have a `public/models/<type>_front_plate.stl`. The 3MF
button is hidden when `has3mf` is false. No free-to-use front-plate files were
found for the Hue or Sonoff remotes (only wall mounts/covers, licences
unchecked). If one is added, drop the STL in `public/models/`, set `has3mf`,
and credit the author.
