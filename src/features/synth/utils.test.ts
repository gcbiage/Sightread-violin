import { extractMidiJsSoundfontJson } from './utils'

const header = 'if (typeof(MIDI) === "undefined") var MIDI = {};\nMIDI.Soundfont.violin = '

describe('extractMidiJsSoundfontJson', () => {
  it('parses files without a trailing comma (GitHub release soundfonts)', () => {
    const text = `${header}{\n  "A0": "data:audio/mp3;base64,AAA",\n  "B0": "data:audio/mp3;base64,BBB"\n};\n`
    expect(extractMidiJsSoundfontJson(text)).toEqual({
      A0: 'data:audio/mp3;base64,AAA',
      B0: 'data:audio/mp3;base64,BBB',
    })
  })

  it('parses files with a trailing comma (original MIDI.js soundfonts)', () => {
    const text = `${header}{\n  "A0": "data:audio/mp3;base64,AAA",\n}\n`
    expect(extractMidiJsSoundfontJson(text)).toEqual({ A0: 'data:audio/mp3;base64,AAA' })
  })

  it('rejects files that are not MIDI.js soundfonts', () => {
    expect(() => extractMidiJsSoundfontJson('<!doctype html>')).toThrow()
  })
})
