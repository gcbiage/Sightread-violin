import { DEFAULT_VIOLIN_CONFIG, ViolinConfig } from './config'
import { getViolinLanes, placeViolinNote } from './placement'

const G3 = 55
const C4 = 60
const CS4 = 61
const D4 = 62
const GS4 = 68
const A4 = 69
const DS5 = 75
const E5 = 76
const AS5 = 82
const B5 = 83

describe('placeViolinNote (default config: open string + 6 semitones)', () => {
  const place = (n: number) => placeViolinNote(n, DEFAULT_VIOLIN_CONFIG)

  it('puts open strings on their own string with finger 0', () => {
    expect(place(G3)).toMatchObject({ stringIndex: 0, semitones: 0, finger: 0, outOfRange: false })
    expect(place(D4)).toMatchObject({ stringIndex: 1, semitones: 0, finger: 0 })
    expect(place(A4)).toMatchObject({ stringIndex: 2, semitones: 0, finger: 0 })
    expect(place(E5)).toMatchObject({ stringIndex: 3, semitones: 0, finger: 0 })
  })

  it('covers every chromatic note from G3 to A#5 without gaps', () => {
    for (let n = G3; n <= AS5; n++) {
      const p = place(n)
      expect(p).not.toBeNull()
      expect(p!.outOfRange).toBe(false)
      expect(typeof p!.stringIndex).toBe('number')
    }
  })

  it('uses the expected string for the notes just below the next open string', () => {
    expect(place(C4)).toMatchObject({ stringIndex: 0, semitones: 5, finger: 3 })
    expect(place(CS4)).toMatchObject({ stringIndex: 0, semitones: 6, finger: 3 })
    expect(place(GS4)).toMatchObject({ stringIndex: 1, semitones: 6 })
    expect(place(DS5)).toMatchObject({ stringIndex: 2, semitones: 6 })
    expect(place(AS5)).toMatchObject({ stringIndex: 3, semitones: 6 })
  })

  it('maps semitones to 1st-position fingers', () => {
    const fingers = [A4, A4 + 1, A4 + 2, A4 + 3, A4 + 4, A4 + 5, A4 + 6].map(
      (n) => place(n)!.finger,
    )
    expect(fingers).toEqual([0, 1, 1, 2, 2, 3, 3])
  })

  it('sends notes below G3 to the left lane, in grey', () => {
    expect(place(G3 - 1)).toMatchObject({ lane: 'below', stringIndex: null, outOfRange: true })
  })

  it('draws notes above A#5 in grey on the E string', () => {
    expect(place(B5)).toMatchObject({
      lane: 3,
      stringIndex: 3,
      semitones: 7,
      finger: 4,
      outOfRange: true,
    })
    expect(place(B5 + 5)).toMatchObject({ lane: 3, finger: null, outOfRange: true })
  })
})

describe('placeViolinNote (custom configs)', () => {
  it('can discard out-of-range notes', () => {
    const config: ViolinConfig = {
      ...DEFAULT_VIOLIN_CONFIG,
      belowRange: 'discard',
      aboveRange: 'discard',
    }
    expect(placeViolinNote(G3 - 1, config)).toBeNull()
    expect(placeViolinNote(B5, config)).toBeNull()
  })

  it('can put high notes in a right lane', () => {
    const config: ViolinConfig = { ...DEFAULT_VIOLIN_CONFIG, aboveRange: 'lane' }
    expect(placeViolinNote(B5, config)).toMatchObject({ lane: 'above', outOfRange: true })
    expect(getViolinLanes(config)).toEqual(['below', 0, 1, 2, 3, 'above'])
  })

  it('prefers the open string when strings overlap', () => {
    const config: ViolinConfig = {
      ...DEFAULT_VIOLIN_CONFIG,
      strings: DEFAULT_VIOLIN_CONFIG.strings.map((s) => ({ ...s, maxSemitones: 7 })),
    }
    expect(placeViolinNote(D4, config)).toMatchObject({ stringIndex: 1, finger: 0 })
  })

  it('greys out notes that fall in a gap between strings', () => {
    const config: ViolinConfig = {
      ...DEFAULT_VIOLIN_CONFIG,
      strings: DEFAULT_VIOLIN_CONFIG.strings.map((s) => ({ ...s, maxSemitones: 5 })),
    }
    expect(placeViolinNote(CS4, config)).toMatchObject({ stringIndex: 0, outOfRange: true })
  })
})
