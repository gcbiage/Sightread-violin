import { ViolinConfig } from './config'

/** A lane in the violin view: an extra lane for out-of-range notes, or a string index. */
export type ViolinLane = 'below' | 'above' | number

export interface ViolinPlacement {
  lane: ViolinLane
  /** Index into `config.strings`, or null when the note is in an extra lane. */
  stringIndex: number | null
  /** Semitones above the open string, or null when the note is in an extra lane. */
  semitones: number | null
  /** Finger number (0 = open string), or null when unknown. */
  finger: number | null
  /** True when the note falls outside the configured range (drawn in grey). */
  outOfRange: boolean
}

function fingerFor(config: ViolinConfig, semitones: number): number | null {
  return config.fingerBySemitone[semitones] ?? null
}

/**
 * Decide where a note is drawn.
 *
 * Rule: a string can play its open note up to `maxSemitones` above it. When more than one
 * string can play a note (only possible if `maxSemitones` >= 7), the string with the smallest
 * offset wins, i.e. open strings and lower fingers are preferred.
 *
 * Returns null when the note should not be drawn at all.
 */
export function placeViolinNote(midiNote: number, config: ViolinConfig): ViolinPlacement | null {
  const { strings } = config
  if (strings.length === 0) {
    return null
  }

  let best: { stringIndex: number; semitones: number } | null = null
  for (let i = 0; i < strings.length; i++) {
    const semitones = midiNote - strings[i].openMidi
    if (semitones < 0 || semitones > strings[i].maxSemitones) {
      continue
    }
    if (!best || semitones < best.semitones) {
      best = { stringIndex: i, semitones }
    }
  }

  if (best) {
    return {
      lane: best.stringIndex,
      stringIndex: best.stringIndex,
      semitones: best.semitones,
      finger: fingerFor(config, best.semitones),
      outOfRange: false,
    }
  }

  const lowest = Math.min(...strings.map((s) => s.openMidi))
  if (midiNote < lowest) {
    if (config.belowRange === 'discard') {
      return null
    }
    return { lane: 'below', stringIndex: null, semitones: null, finger: null, outOfRange: true }
  }

  const highest = Math.max(...strings.map((s) => s.openMidi + s.maxSemitones))
  if (midiNote > highest) {
    if (config.aboveRange === 'discard') {
      return null
    }
    if (config.aboveRange === 'lane') {
      return { lane: 'above', stringIndex: null, semitones: null, finger: null, outOfRange: true }
    }
    const top = strings.length - 1
    const semitones = midiNote - strings[top].openMidi
    return {
      lane: top,
      stringIndex: top,
      semitones,
      finger: fingerFor(config, semitones),
      outOfRange: true,
    }
  }

  // A gap between strings (only possible with maxSemitones < 6): draw it in grey on the
  // closest string below it.
  let closest = 0
  for (let i = 0; i < strings.length; i++) {
    if (strings[i].openMidi <= midiNote) {
      closest = i
    }
  }
  const semitones = midiNote - strings[closest].openMidi
  return {
    lane: closest,
    stringIndex: closest,
    semitones,
    finger: fingerFor(config, semitones),
    outOfRange: true,
  }
}

/** Which extra lanes the current config needs, from left to right. */
export function getViolinLanes(config: ViolinConfig): ViolinLane[] {
  const lanes: ViolinLane[] = []
  if (config.belowRange === 'lane') {
    lanes.push('below')
  }
  config.strings.forEach((_, i) => lanes.push(i))
  if (config.aboveRange === 'lane') {
    lanes.push('above')
  }
  return lanes
}
