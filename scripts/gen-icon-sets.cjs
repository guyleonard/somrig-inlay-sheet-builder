#!/usr/bin/env node
// Generates the extra icon sets used by the icon picker, normalised to the same
// 24×24 single-path form as the Material Design icons (so saved designs, the
// SVG renderer and the 3MF export treat every set identically):
//
//   src/data/faIconsData.json     Font Awesome Free (solid, regular, brands)
//   src/data/emojiIconsData.json  Noto Emoji (monochrome outline font)
//
// Run: node scripts/gen-icon-sets.cjs
// Re-run after upgrading @fortawesome/fontawesome-free or emojibase-data.
// Needs network on first run (downloads the Noto Emoji font into node_modules/.cache).
//
// Licences (credited in THIRD_PARTY_NOTICES.md and the picker footer):
//   Font Awesome Free icons — CC BY 4.0;  Noto Emoji — SIL OFL 1.1.

const fs = require('node:fs')
const path = require('node:path')
const https = require('node:https')
const svgpath = require('svgpath')
const opentype = require('opentype.js')
const polygonClipping = require('polygon-clipping')

const ROOT = path.join(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'src/data')
const BOX = 24

/** Scale a path to fit the 24×24 box (aspect preserved) and centre it. */
function toBox(d, x, y, w, h, digits = 2) {
  const s = BOX / Math.max(w, h)
  return svgpath(d)
    .translate(-x, -y)
    .scale(s)
    .translate((BOX - w * s) / 2, (BOX - h * s) / 2)
    .abs()
    .round(digits)
    .toString()
}

// ── Font Awesome Free ────────────────────────────────────────────────────────

function genFontAwesome() {
  const faDir = path.join(ROOT, 'node_modules/@fortawesome/fontawesome-free')
  const families = JSON.parse(
    fs.readFileSync(path.join(faDir, 'metadata/icon-families.json'), 'utf8'),
  )
  const icons = []
  for (const style of ['solid', 'regular', 'brands']) {
    const dir = path.join(faDir, 'svgs', style)
    for (const file of fs.readdirSync(dir).sort()) {
      if (!file.endsWith('.svg')) continue
      const id = file.slice(0, -4)
      const svg = fs.readFileSync(path.join(dir, file), 'utf8')
      const vb = svg.match(/viewBox="([\d.\s-]+)"/)
      const ds = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1])
      if (!vb || ds.length === 0) continue
      const [x, y, w, h] = vb[1].trim().split(/\s+/).map(Number)
      const meta = families[id]
      const terms = (meta?.search?.terms ?? []).filter((t) => t !== id)
      const label = (
        meta?.label ?? id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      ).toString()
      const name =
        style === 'solid'
          ? label
          : `${label} (${style === 'regular' ? 'outline' : 'brand'})`
      icons.push([name, toBox(ds.join(' '), x, y, w, h), terms.join(' ')])
    }
  }
  return icons
}

// ── Noto Emoji (monochrome) ──────────────────────────────────────────────────

const FONT_URL =
  'https://raw.githubusercontent.com/google/fonts/main/ofl/notoemoji/NotoEmoji%5Bwght%5D.ttf'

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
          return download(res.headers.location, dest).then(resolve, reject)
        if (res.statusCode !== 200)
          return reject(new Error(`${url} → HTTP ${res.statusCode}`))
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          fs.mkdirSync(path.dirname(dest), { recursive: true })
          fs.writeFileSync(dest, Buffer.concat(chunks))
          resolve()
        })
      })
      .on('error', reject)
  })
}

/** Flatten an opentype.js path into closed point rings (curves sampled). */
function flattenRings(commands, steps = 5) {
  const rings = []
  let cur = []
  let lx = 0
  let ly = 0
  const close = () => {
    if (cur.length >= 3) rings.push(cur)
    cur = []
  }
  for (const c of commands) {
    if (c.type === 'M') {
      close()
      cur = [[c.x, c.y]]
    } else if (c.type === 'L') {
      cur.push([c.x, c.y])
    } else if (c.type === 'Q') {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        const u = 1 - t
        cur.push([
          u * u * lx + 2 * u * t * c.x1 + t * t * c.x,
          u * u * ly + 2 * u * t * c.y1 + t * t * c.y,
        ])
      }
    } else if (c.type === 'C') {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        const u = 1 - t
        cur.push([
          u ** 3 * lx + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t ** 3 * c.x,
          u ** 3 * ly + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t ** 3 * c.y,
        ])
      }
    } else if (c.type === 'Z') {
      close()
    }
    if (c.x !== undefined) {
      lx = c.x
      ly = c.y
    }
  }
  close()
  return rings
}

/** Douglas–Peucker simplification of a closed ring (tolerance in 24-box units). */
function simplifyRing(pts, eps) {
  if (pts.length <= 4) return pts
  // Anchor on the two points farthest apart so the closed loop splits cleanly.
  let ai = 0
  let bi = 0
  let best = -1
  for (let i = 0; i < pts.length; i++) {
    const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2
    if (d > best) {
      best = d
      bi = i
    }
  }
  const half = (from, to) => {
    const seg = []
    const n = pts.length
    for (let i = from; i !== to; i = (i + 1) % n) seg.push(pts[i])
    seg.push(pts[to])
    return seg
  }
  const rdp = (seg) => {
    if (seg.length < 3) return seg
    const [x1, y1] = seg[0]
    const [x2, y2] = seg[seg.length - 1]
    const len = Math.hypot(x2 - x1, y2 - y1) || 1e-9
    let idx = -1
    let dmax = 0
    for (let i = 1; i < seg.length - 1; i++) {
      const d = Math.abs((x2 - x1) * (y1 - seg[i][1]) - (x1 - seg[i][0]) * (y2 - y1)) / len
      if (d > dmax) {
        dmax = d
        idx = i
      }
    }
    if (dmax <= eps) return [seg[0], seg[seg.length - 1]]
    return [...rdp(seg.slice(0, idx + 1)).slice(0, -1), ...rdp(seg.slice(idx))]
  }
  const a = rdp(half(ai, bi))
  const b = rdp(half(bi, ai))
  return [...a.slice(0, -1), ...b.slice(0, -1)]
}

function signedArea(ring) {
  let a = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[(i + 1) % ring.length]
    a += x1 * y2 - x2 * y1
  }
  return a / 2
}

/**
 * Emoji glyphs are drawn with overlapping contours (the font relies on the
 * nonzero fill rule). The 3D export needs clean outer/hole polygons, so
 * resolve the overlaps here: largest contour first, same winding as the
 * largest = add, opposite = carve out. Returns an SVG path of straight
 * segments scaled into the 24×24 box, or null if clipping fails.
 */
function glyphToCleanPath(commands, bb) {
  const w = bb.x2 - bb.x1
  const h = bb.y2 - bb.y1
  const s = BOX / Math.max(w, h)
  const ox = (BOX - w * s) / 2
  const oy = (BOX - h * s) / 2
  const rings = flattenRings(commands).map((r) =>
    r.map(([x, y]) => [(x - bb.x1) * s + ox, (y - bb.y1) * s + oy]),
  )
  if (rings.length === 0) return null
  rings.sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)))
  const fillSign = Math.sign(signedArea(rings[0]))
  let area = []
  try {
    for (const r of rings) {
      const poly = [[...r, r[0]]]
      area =
        Math.sign(signedArea(r)) === fillSign
          ? polygonClipping.union(area, [poly])
          : polygonClipping.difference(area, [poly])
    }
  } catch {
    return null
  }
  const f = (n) => Number(n.toFixed(2))
  const d = []
  for (const polygon of area) {
    for (const ring of polygon) {
      const pts = simplifyRing(ring.slice(0, -1), 0.04) // drop closing duplicate
      if (pts.length < 3) continue
      d.push(
        `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`,
      )
    }
  }
  return d.length ? d.join('') : null
}

async function genEmoji() {
  const fontFile = path.join(ROOT, 'node_modules/.cache/NotoEmoji.ttf')
  if (!fs.existsSync(fontFile)) await download(FONT_URL, fontFile)
  const buf = fs.readFileSync(fontFile)
  const font = opentype.parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  )
  const data = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, 'node_modules/emojibase-data/en/data.json'),
      'utf8',
    ),
  )
  const icons = []
  for (const e of data) {
    // Single code points only (a variation selector is fine); ZWJ sequences,
    // flags and skin-tone variants have no monochrome glyph.
    const cps = [...e.emoji].map((c) => c.codePointAt(0)).filter((c) => c !== 0xfe0f)
    if (cps.length !== 1) continue
    const glyph = font.charToGlyph(String.fromCodePoint(cps[0]))
    if (!glyph || glyph.index === 0) continue
    const p = glyph.getPath(0, 0, font.unitsPerEm)
    const bb = p.getBoundingBox()
    const w = bb.x2 - bb.x1
    const h = bb.y2 - bb.y1
    if (!(w > 0 && h > 0)) continue
    const name = e.label.replace(/\b\w/g, (c) => c.toUpperCase())
    if (name.startsWith('Regional Indicator')) continue // plain letters, used for flags
    const clean = glyphToCleanPath(p.commands, bb)
    if (!clean) continue
    icons.push([name, clean, (e.tags ?? []).join(' ')])
  }
  return icons
}

function write(file, icons) {
  const out = path.join(OUT_DIR, file)
  fs.writeFileSync(out, JSON.stringify(icons))
  console.log(
    `Generated ${icons.length} icons → ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`,
  )
}

async function main() {
  write('faIconsData.json', genFontAwesome())
  write('emojiIconsData.json', await genEmoji())
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
