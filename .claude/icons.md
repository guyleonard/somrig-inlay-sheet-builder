# Icons Deep-Dive

Every icon is a single SVG path string in a 24×24 box. A chosen icon is stored in
the design as that raw path (`ActionZone.icon`), so the renderer, the PDF/SVG
export and the 3MF export treat every set identically and saved designs don't
depend on which set an icon came from.

## Sets

| Tab | Source | Data file | Generator |
|-----|--------|-----------|-----------|
| Material | `@mdi/js` | `src/data/mdiAllIconsData.json` | `npm run generate:icons` |
| Font Awesome | `@fortawesome/fontawesome-free` (solid, regular, brands — 2,883) | `src/data/faIconsData.json` | `npm run generate:icon-sets` |
| Emoji | Noto Emoji monochrome font + `emojibase-data` names (≈1,390 single-codepoint emoji) | `src/data/emojiIconsData.json` | `npm run generate:icon-sets` |

`src/data/iconSets.ts` registers the sets (label, licence credit, lazy loader);
`IconPickerModal.vue` shows one tab per set and loads each only when first opened.
Data rows are `[name, path, keywords?]`; keywords are matched on word starts.

All three data files are generated and excluded from Biome (`biome.json`) — don't
hand-edit or format them. Licences/credits are in `THIRD_PARTY_NOTICES.md` and in
the picker footer (Font Awesome icons are CC BY 4.0, so the credit must stay).

## Gotchas

- **Emoji outlines must be cleaned.** Noto Emoji glyphs use overlapping contours
  that rely on the nonzero fill rule. The 3MF exporter groups rings into
  outer+holes by nesting, so raw glyph paths exported as non-watertight meshes in
  ~22 % of cases. `gen-icon-sets.cjs` therefore flattens each glyph, resolves
  overlaps with `polygon-clipping` (largest contour first; same winding adds,
  opposite carves), and simplifies (Douglas–Peucker, 0.04 in 24-box units). After
  that the non-watertight rate matches Material icons (≈ 2–3 %).
- Only single-codepoint emoji are included (no ZWJ sequences, flags or skin tones);
  regional-indicator letters are dropped.
- The generator downloads the Noto Emoji font on first run into
  `node_modules/.cache/` (needs network).
- FA icons keep their original solid/outline/brand variants; non-solid ones are
  suffixed "(outline)" / "(brand)" in the name.
- Dev server: the first open of a big tab can take a few seconds (Vite transforms
  the JSON); production serves it as a compressed lazy chunk.
