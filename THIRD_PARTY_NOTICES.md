# Third-party notices

The icon picker bundles icons from the following sets. Each is converted to a
single 24×24 SVG path at build-prep time (see `scripts/gen-mdi-icons.cjs` and
`scripts/gen-icon-sets.cjs`).

| Set | Used for | Licence |
|-----|----------|---------|
| [Material Design Icons](https://pictogrammers.com/library/mdi/) (`@mdi/js`) | "Material" tab | Apache License 2.0 |
| [Font Awesome Free](https://fontawesome.com) 7.x — Copyright Fonticons, Inc. | "Font Awesome" tab (solid, regular and brand icons) | Icons: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| [Noto Emoji](https://github.com/googlefonts/noto-emoji) (monochrome) — Copyright Google | "Emoji" tab (glyph outlines) | [SIL Open Font License 1.1](https://openfontlicense.org) |
| [Emojibase](https://emojibase.dev) data | Emoji names and search tags | MIT |

Font Awesome Free icons were converted to a different viewBox and merged into
the picker's data files; no other changes were made to their shapes. Emoji
outlines had overlapping contours merged and were simplified (tolerance
≈ 0.17 % of the icon size). Brand icons are trademarks of their respective
owners and are provided for identification only.
