import { getKeySignatures, getNoteName } from './key-signature'

const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

function pitchClassOf(name: string): number {
  const base = PITCH_CLASS[name[0]]
  const accidental = name.slice(1)
  const offset = accidental === '#' ? 1 : accidental === '♭' ? -1 : 0
  return (base + offset + 12) % 12
}

describe('getNoteName', () => {
  it('names every note with its real pitch in every key signature', () => {
    for (const key of getKeySignatures()) {
      for (let midi = 21; midi <= 108; midi++) {
        expect(pitchClassOf(getNoteName(midi, key))).toBe(midi % 12)
      }
    }
  })

  it('keeps the sharp on F# in sharp keys (G and D major)', () => {
    expect(getNoteName(78, 'G')).toBe('F#') // F#5
    expect(getNoteName(78, 'D')).toBe('F#')
    expect(getNoteName(77, 'G')).toBe('F') // F5 natural
  })

  it('uses flats in flat keys', () => {
    expect(getNoteName(70, 'F')).toBe('B♭')
    expect(getNoteName(70, 'C')).toBe('A#')
  })
})
