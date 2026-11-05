import type { IconOption } from './mdiIcons'

/**
 * Icon sources offered by the picker. Every set is normalised to a single
 * 24×24 SVG path (see scripts/gen-mdi-icons.cjs and scripts/gen-icon-sets.cjs),
 * so a chosen icon is stored and rendered/exported exactly like any other.
 * Data is loaded lazily, one set at a time.
 */
export type IconSetId = 'mdi' | 'fa' | 'emoji'

export interface IconSet {
  id: IconSetId
  label: string
  /** Shown in the picker footer; required by the set's licence. */
  credit: string
  load: () => Promise<IconOption[]>
}

function fromTuples(rows: unknown): IconOption[] {
  return (rows as [string, string, string?][]).map(
    ([name, path, keywords]) => ({ name, path, keywords }),
  )
}

export const ICON_SETS: IconSet[] = [
  {
    id: 'mdi',
    label: 'Material',
    credit: 'Material Design Icons (Apache 2.0)',
    load: async () => (await import('./mdiAllIcons')).MDI_ALL_ICONS,
  },
  {
    id: 'fa',
    label: 'Font Awesome',
    credit: 'Font Awesome Free by Fonticons, Inc. (CC BY 4.0)',
    load: async () => fromTuples((await import('./faIconsData.json')).default),
  },
  {
    id: 'emoji',
    label: 'Emoji',
    credit: 'Noto Emoji by Google (SIL OFL 1.1)',
    load: async () =>
      fromTuples((await import('./emojiIconsData.json')).default),
  },
]
