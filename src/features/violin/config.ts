/**
 * Violin layout configuration.
 *
 * Everything that decides *where* a note is drawn in the violin visualization lives here,
 * so the rules can change later (more positions, different tunings, viola, etc.)
 * without touching the renderer.
 */

export type ViolinStringId = 'G' | 'D' | 'A' | 'E'

export interface ViolinString {
  id: ViolinStringId
  /** MIDI number of the open string. */
  openMidi: number
  /**
   * Highest playable offset, in semitones above the open string.
   * 6 = open string + 6 semitones (e.g. A string: A4 … D#5), which covers every
   * chromatic note in 1st position without gaps between strings.
   */
  maxSemitones: number
}

/** What to do with notes that no string covers. */
export type BelowRangeMode = 'lane' | 'discard'
export type AboveRangeMode = 'top-string' | 'lane' | 'discard'

export interface ViolinConfig {
  /** Ordered from lowest to highest string (left → right on screen). */
  strings: ViolinString[]
  /**
   * Finger used for each semitone offset above the open string (index = semitones).
   * Offsets past the end of this table have no finger number.
   */
  fingerBySemitone: number[]
  /**
   * Notes below the lowest open string (G3) cannot be played on a violin.
   * 'lane'    → drawn in grey in an extra lane to the left of the G string.
   * 'discard' → not drawn at all.
   */
  belowRange: BelowRangeMode
  /**
   * Notes above the highest covered note (A#5 with the default config).
   * 'top-string' → drawn in grey on the E string (where they are played, in higher positions).
   * 'lane'       → drawn in grey in an extra lane to the right of the E string.
   * 'discard'    → not drawn at all.
   */
  aboveRange: AboveRangeMode
}

export const DEFAULT_VIOLIN_CONFIG: ViolinConfig = {
  strings: [
    { id: 'G', openMidi: 55, maxSemitones: 6 }, // G3 … C#4
    { id: 'D', openMidi: 62, maxSemitones: 6 }, // D4 … G#4
    { id: 'A', openMidi: 69, maxSemitones: 6 }, // A4 … D#5
    { id: 'E', openMidi: 76, maxSemitones: 6 }, // E5 … A#5
  ],
  // 1st position: 0 = open, 1–2 = 1st finger (low/high), 3–4 = 2nd, 5–6 = 3rd, 7 = 4th.
  fingerBySemitone: [0, 1, 1, 2, 2, 3, 3, 4],
  belowRange: 'lane',
  aboveRange: 'top-string',
}
