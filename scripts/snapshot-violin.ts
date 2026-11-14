/**
 * Renders still frames of the violin visualization to PNG files, without a browser.
 * Useful to check the view after changing the renderer or the string rules.
 *
 *   bun scripts/snapshot-violin.ts [song.mid] [--times 1,4.5,10] [--out snapshots]
 *                                  [--size 1280x720] [--labels none|alphabetical|fixed-do]
 *                                  [--transpose 0]
 *
 * Without a MIDI file it renders a built-in test pattern: the chromatic range of the violin
 * (G3 … A#5) plus a few notes below and above it.
 *
 * Requires the skia-canvas native binary:
 *   (cd node_modules/skia-canvas && node lib/prebuild.mjs download)
 */
import fs from 'fs'
import path from 'path'
import { parseMidi, parserInferHands } from '@/features/parsers'
import { render } from '@/features/SongVisualization/canvas-renderer'
import { PIXELS_PER_SECOND as pps } from '@/features/SongVisualization/utils'
import type { Song } from '@/types'
import { Midi } from '@tonejs/midi'
import { Canvas } from 'skia-canvas'

function getArg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function buildTestPattern(): Uint8Array {
  const midi = new Midi()
  midi.header.setTempo(120)
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] })
  const track = midi.addTrack()
  track.name = 'Violin'
  track.instrument.number = 40
  let t = 0
  const add = (midiNote: number, duration = 0.45) => {
    track.addNote({ midi: midiNote, time: t, duration: duration * 0.9 })
    t += duration
  }
  add(53) // F3, below the violin
  add(54) // F#3
  for (let n = 55; n <= 82; n++) add(n) // G3 … A#5
  add(83) // B5, above the range (4th finger on E)
  add(86, 0.9) // D6
  // A double stop (D4 + A4) and a long open G.
  track.addNote({ midi: 62, time: t, duration: 1.4 })
  track.addNote({ midi: 69, time: t, duration: 1.4 })
  t += 1.5
  add(55, 2)
  return midi.toArray()
}

async function main() {
  const positional = process.argv
    .slice(2)
    .filter((a, i, all) => !a.startsWith('--') && !all[i - 1]?.startsWith('--'))
  const file = positional[0]
  const outDir = getArg('out') ?? 'snapshots'
  const [width, height] = (getArg('size') ?? '1280x720').split('x').map(Number)
  const times = (getArg('times') ?? '0.5,3,7,12,15.5').split(',').map(Number)
  const noteLabels = (getArg('labels') ?? 'alphabetical') as any
  const transpose = Number(getArg('transpose') ?? 0)

  const bytes = file ? new Uint8Array(fs.readFileSync(file)) : buildTestPattern()
  const song: Song = parseMidi(bytes as Uint8Array<ArrayBuffer>)
  const { left, right } = parserInferHands(song)
  const hands: Record<number, { hand: 'left' | 'right' }> = {}
  for (const id of Object.keys(song.tracks)) {
    hands[+id] = { hand: +id === left ? 'left' : 'right' }
  }
  if (right !== undefined) hands[right] = { hand: 'right' }

  const canvas = new Canvas(width, height)
  const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D
  fs.mkdirSync(outDir, { recursive: true })
  const base = file ? path.basename(file, path.extname(file)) : 'test-pattern'

  for (const time of times) {
    render({
      time,
      visualization: 'violin',
      noteLabels,
      coloredNotes: false,
      transpose,
      windowWidth: width,
      height,
      pps,
      hand: 'both',
      hands,
      ctx,
      items: song.items,
      constrictView: true,
      keySignature: song.keySignature ?? 'C',
      timeSignature: song.timeSignature,
      canvasRect: { left: 0, top: 0 } as DOMRect,
      game: false,
      player: undefined as any,
    })
    const out = path.join(outDir, `${base}-${time}s.png`)
    fs.writeFileSync(out, canvas.toBufferSync('png'))
    console.log(out)
  }
}

main()
