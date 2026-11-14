/**
 * Violin visualization: notes fall onto the four strings (G, D, A, E) instead of piano keys.
 * Each falling block shows how many semitones above the open string to play (0 = open string),
 * and sharps/flats are drawn in a different color, like the black keys of a piano. Where a note goes is decided
 * by `@/features/violin` (see `DEFAULT_VIOLIN_CONFIG`), so the rules can change independently.
 */
import { line, roundRect } from '@/features/drawing'
import {
  getNoteName as getAbsoluteNoteName,
  getFixedDoNoteFromKey,
  getOctave,
  isBlack,
  transposeMidi,
} from '@/features/theory'
import {
  DEFAULT_VIOLIN_CONFIG,
  getBlockNumber,
  getViolinLanes,
  placeViolinNote,
  ViolinConfig,
  ViolinLane,
  ViolinPlacement,
} from '@/features/violin'
import type { SongMeasure, SongNote } from '@/types'
import { GivenState } from './canvas-renderer'
import { CanvasItem, getItemsInView, Viewport } from './utils'

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

const colors = {
  background: '#0f1014',
  stringLaneFill: 'rgba(255,255,255,0.025)',
  extraLaneFill: 'rgba(0,0,0,0.25)',
  laneBorder: 'rgba(255,255,255,0.05)',
  string: 'rgba(214,211,200,0.28)',
  stringActive: 'rgba(255,253,240,0.85)',
  measure: 'rgba(255,255,255,0.06)',
  measureText: 'rgb(130,130,130)',
  hitLine: 'rgba(255,253,240,0.55)',
  panel: '#16171d',
  panelBorder: '#0c0d12',
  panelText: 'rgba(255,255,255,0.75)',
  panelSubtext: 'rgba(255,255,255,0.38)',
  outOfRange: '#4b4e59',
  outOfRangeText: 'rgba(255,255,255,0.55)',
  noteBorder: 'rgba(20,20,24,0.9)',
  rangeSelectionFill: '#8b5cf6',
}

/** Block colors: open strings, natural notes and sharps/flats (like a piano's white/black keys). */
const NOTE_COLORS = {
  open: '#2fb3a3',
  natural: '#7b5ff0',
  accidental: '#f08a5b',
}

const MAX_AREA_WIDTH = 1100
/** Width of the extra (out-of-range) lanes relative to a string lane. */
const EXTRA_LANE_RATIO = 0.55
const STRING_THICKNESS = [3.2, 2.6, 2, 1.5]

type LaneGeometry = { lane: ViolinLane; left: number; width: number; center: number }

type State = GivenState & {
  config: ViolinConfig
  viewport: Viewport
  lanes: LaneGeometry[]
  areaLeft: number
  areaWidth: number
  noteHitY: number
  panelHeight: number
}

function laneKey(lane: ViolinLane): string {
  return String(lane)
}

function deriveState(given: GivenState, config: ViolinConfig): State {
  const laneIds = getViolinLanes(config)
  const units = laneIds.reduce<number>(
    (sum, l) => sum + (typeof l === 'number' ? 1 : EXTRA_LANE_RATIO),
    0,
  )
  const areaWidth = Math.min(given.windowWidth, MAX_AREA_WIDTH)
  const areaLeft = Math.floor((given.windowWidth - areaWidth) / 2)
  const unit = areaWidth / units

  let x = areaLeft
  const lanes: LaneGeometry[] = laneIds.map((lane) => {
    const width = typeof lane === 'number' ? unit : unit * EXTRA_LANE_RATIO
    const geometry = { lane, left: x, width, center: x + width / 2 }
    x += width
    return geometry
  })

  const panelHeight = Math.round(Math.min(Math.max(given.height * 0.13, 64), 120))
  return {
    ...given,
    config,
    viewport: { start: given.time * given.pps + given.height, end: given.time * given.pps },
    lanes,
    areaLeft,
    areaWidth,
    panelHeight,
    noteHitY: given.height - panelHeight,
  }
}

function getItemStartEnd(item: CanvasItem, state: State): { start: number; end: number } {
  const start = state.viewport.start - item.time * state.pps
  const duration = item.type === 'note' ? item.duration : 100
  return { start, end: start - duration * state.pps }
}

/** Y coordinate of the top of an item, so that its bottom reaches `noteHitY` when it starts. */
function getTopY(item: CanvasItem, state: State): number {
  return getItemStartEnd(item, state).end - (state.height - state.noteHitY)
}

function getItemsInViewport(state: State): CanvasItem[] {
  const startPred = (item: CanvasItem) => getItemStartEnd(item, state).end <= state.height
  const endPred = (item: CanvasItem) => getItemStartEnd(item, state).start < 0
  return getItemsInView(state, startPred, endPred)
}

function isPlaying(note: SongNote, state: State): boolean {
  const elapsed = state.time - note.time
  return elapsed > 0 && elapsed < note.duration
}

function getNoteName(midiNote: number, state: State, withOctave: boolean): string {
  const key = getAbsoluteNoteName(midiNote, state.keySignature)
  const name = state.noteLabels === 'fixed-do' ? getFixedDoNoteFromKey(key) : key
  return withOctave ? `${name}${getOctave(midiNote)}` : name
}

function getStringName(index: number, state: State): string {
  const string = state.config.strings[index]
  return state.noteLabels === 'fixed-do' ? getFixedDoNoteFromKey(string.id) : string.id
}

function getBlockColor(placement: ViolinPlacement, midi: number): string {
  if (placement.outOfRange) {
    return colors.outOfRange
  }
  if (placement.semitones === 0) {
    return NOTE_COLORS.open
  }
  return isBlack(midi) ? NOTE_COLORS.accidental : NOTE_COLORS.natural
}

export function renderViolinVis(
  given: GivenState,
  config: ViolinConfig = DEFAULT_VIOLIN_CONFIG,
): void {
  const state = deriveState(given, config)
  const { ctx } = state

  ctx.fillStyle = colors.background
  ctx.fillRect(0, 0, state.windowWidth, state.height)

  const items = getItemsInViewport(state)
  const notes: Array<{ note: SongNote; midi: number; placement: ViolinPlacement }> = []
  for (const item of items) {
    if (item.type !== 'note') continue
    const midi = transposeMidi(item.midiNote, state.transpose)
    const placement = placeViolinNote(midi, config)
    if (placement) {
      notes.push({ note: item, midi, placement })
    }
  }

  // Which note is sounding on each lane right now (the latest one wins).
  const active = new Map<string, { midi: number; placement: ViolinPlacement }>()
  for (const n of notes) {
    if (isPlaying(n.note, state)) {
      active.set(laneKey(n.placement.lane), n)
    }
  }

  renderLanes(state, active)
  for (const item of items) {
    if (item.type === 'measure') {
      renderMeasure(item, state)
    }
  }
  for (const n of notes) {
    renderFallingNote(n.note, n.midi, n.placement, state)
  }
  if (state.selectedRange) {
    renderRange(state)
  }
  renderPanel(state, active)
}

function renderLanes(state: State, active: Map<string, unknown>) {
  const { ctx, noteHitY } = state
  ctx.save()
  for (const lane of state.lanes) {
    const isString = typeof lane.lane === 'number'
    ctx.fillStyle = isString ? colors.stringLaneFill : colors.extraLaneFill
    ctx.fillRect(lane.left, 0, lane.width, noteHitY)
    ctx.strokeStyle = colors.laneBorder
    ctx.lineWidth = 1
    line(ctx, Math.round(lane.left) + 0.5, 0, Math.round(lane.left) + 0.5, noteHitY)

    if (typeof lane.lane === 'number') {
      const thickness = STRING_THICKNESS[lane.lane] ?? 1.5
      const isActive = active.has(laneKey(lane.lane))
      ctx.strokeStyle = isActive ? colors.stringActive : colors.string
      ctx.lineWidth = isActive ? thickness + 1 : thickness
      line(ctx, lane.center, 0, lane.center, noteHitY)
    }
  }
  const last = state.lanes[state.lanes.length - 1]
  if (last) {
    ctx.strokeStyle = colors.laneBorder
    const right = Math.round(last.left + last.width) - 0.5
    line(ctx, right, 0, right, noteHitY)
  }
  ctx.restore()
}

function renderMeasure(measure: SongMeasure, state: State): void {
  const { ctx } = state
  const posY = getItemStartEnd(measure, state).start - (state.height - state.noteHitY)
  if (posY > state.noteHitY) {
    return
  }
  ctx.save()
  ctx.strokeStyle = colors.measure
  ctx.lineWidth = 2
  line(ctx, state.areaLeft, posY, state.areaLeft + state.areaWidth, posY)
  ctx.fillStyle = colors.measureText
  ctx.font = `14px ${FONT}`
  ctx.textBaseline = 'bottom'
  ctx.fillText(measure.number.toString(), Math.max(state.areaLeft - 28, 6), Math.floor(posY - 4))
  ctx.restore()
}

function renderFallingNote(
  note: SongNote,
  midi: number,
  placement: ViolinPlacement,
  state: State,
): void {
  const lane = state.lanes.find((l) => l.lane === placement.lane)
  if (!lane) {
    return
  }
  const { ctx, pps } = state
  const isString = typeof placement.lane === 'number'
  const width = Math.round(Math.min(lane.width * (isString ? 0.52 : 0.72), 140))
  const posX = Math.round(lane.center - width / 2)
  const topY = getTopY(note, state)
  const minLength = Math.min(36, width)
  const length = Math.max(note.duration * pps, minLength)
  const posYTop = topY + note.duration * pps - length // keep the bottom edge on time
  // Don't draw below the hit line; the panel covers it anyway.
  if (posYTop > state.noteHitY) {
    return
  }

  ctx.save()
  ctx.fillStyle = getBlockColor(placement, midi)
  ctx.strokeStyle = colors.noteBorder
  ctx.lineWidth = 1
  roundRect(ctx, posX, posYTop, width, length, { topRadius: 6, bottomRadius: 6 })

  // Label at the bottom of the block: the number (big) and, optionally, the note name.
  // While a long note crosses the hit line, the label sticks just above the line.
  const bottom = Math.min(posYTop + length, state.noteHitY)
  const visibleLength = bottom - posYTop
  const showName = state.noteLabels !== 'none'
  const blockNumber = getBlockNumber(placement, state.config)
  const fingerText = blockNumber !== null ? String(blockNumber) : ''
  const nameText =
    showName || !fingerText ? getNoteName(midi, state, !isString || placement.outOfRange) : ''

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = placement.outOfRange ? colors.outOfRangeText : 'white'
  const fingerPx = Math.max(12, Math.min(Math.floor(width * 0.42), 28))
  const namePx = Math.max(10, Math.min(Math.floor(width * 0.22), 15))

  let textY = bottom - 6
  if (fingerText && visibleLength >= fingerPx + 6) {
    ctx.font = `700 ${fingerPx}px ${FONT}`
    ctx.fillText(fingerText, posX + width / 2, textY)
    textY -= fingerPx + 2
  }
  if (nameText && visibleLength >= (fingerText ? fingerPx + namePx + 14 : namePx + 8)) {
    ctx.font = `500 ${namePx}px ${FONT}`
    ctx.globalAlpha = 0.85
    ctx.fillText(nameText, posX + width / 2, textY)
  }
  ctx.restore()
}

function renderRange(state: State) {
  const { ctx, noteHitY, pps, areaLeft, areaWidth } = state
  if (!state.selectedRange) {
    return
  }
  const { start, end } = state.selectedRange
  const duration = end - start
  const bottomY =
    getItemStartEnd({ type: 'note', time: start, duration } as CanvasItem, state).start -
    (state.height - noteHitY)
  const height = duration * pps
  const lineWidth = Math.max(Math.floor(areaWidth / 120), 4)
  const lineHeight = Math.max(Math.floor(lineWidth / 4), 2)

  ctx.save()
  ctx.fillStyle = colors.rangeSelectionFill
  ctx.globalAlpha = 0.5
  ctx.fillRect(areaLeft, bottomY, areaWidth, lineHeight)
  ctx.fillRect(areaLeft, bottomY - height, lineWidth, height)
  ctx.fillRect(areaLeft, bottomY - height - lineHeight, areaWidth, lineHeight)
  ctx.restore()
}

/** Bottom panel: one box per lane with the string name, lit with the number while a note plays. */
function renderPanel(
  state: State,
  active: Map<string, { midi: number; placement: ViolinPlacement }>,
) {
  const { ctx, noteHitY, panelHeight } = state
  ctx.save()
  ctx.fillStyle = colors.panel
  ctx.fillRect(0, noteHitY, state.windowWidth, panelHeight)
  ctx.strokeStyle = colors.panelBorder
  ctx.lineWidth = 1
  line(ctx, 0, noteHitY + 0.5, state.windowWidth, noteHitY + 0.5)

  // Hit line where the notes "arrive".
  ctx.strokeStyle = colors.hitLine
  ctx.lineWidth = 2
  line(ctx, state.areaLeft, noteHitY - 1, state.areaLeft + state.areaWidth, noteHitY - 1)

  const pad = 6
  for (const lane of state.lanes) {
    const isString = typeof lane.lane === 'number'
    const boxX = lane.left + pad
    const boxY = noteHitY + pad
    const boxW = lane.width - pad * 2
    const boxH = panelHeight - pad * 2
    const playing = active.get(laneKey(lane.lane))

    ctx.fillStyle = playing
      ? getBlockColor(playing.placement, playing.midi)
      : 'rgba(255,255,255,0.04)'
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    roundRect(ctx, boxX, boxY, boxW, boxH, { topRadius: 8, bottomRadius: 8 })

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const cx = lane.center

    if (isString) {
      const index = lane.lane as number
      const string = state.config.strings[index]
      const titlePx = Math.max(12, Math.min(Math.floor(boxH * 0.3), 26))
      const subPx = Math.max(9, Math.min(Math.floor(boxH * 0.16), 13))
      if (playing) {
        const blockNumber = getBlockNumber(playing.placement, state.config)
        ctx.fillStyle = 'white'
        ctx.font = `700 ${Math.floor(titlePx * 1.25)}px ${FONT}`
        ctx.fillText(blockNumber !== null ? String(blockNumber) : '–', cx, boxY + boxH * 0.4)
        ctx.font = `500 ${subPx}px ${FONT}`
        ctx.globalAlpha = 0.85
        ctx.fillText(
          `${getStringName(index, state)} · ${getNoteName(playing.midi, state, true)}`,
          cx,
          boxY + boxH * 0.78,
        )
        ctx.globalAlpha = 1
      } else {
        ctx.fillStyle = colors.panelText
        ctx.font = `700 ${titlePx}px ${FONT}`
        ctx.fillText(getStringName(index, state), cx, boxY + boxH * 0.42)
        ctx.fillStyle = colors.panelSubtext
        ctx.font = `500 ${subPx}px ${FONT}`
        ctx.fillText(getNoteName(string.openMidi, state, true), cx, boxY + boxH * 0.76)
      }
    } else {
      const label =
        lane.lane === 'below' ? `< ${lowestNoteName(state)}` : `> ${highestNoteName(state)}`
      const px = Math.max(9, Math.min(Math.floor(boxW * 0.2), 13))
      ctx.fillStyle = playing ? 'white' : colors.panelSubtext
      ctx.font = `500 ${px}px ${FONT}`
      ctx.fillText(playing ? getNoteName(playing.midi, state, true) : label, cx, boxY + boxH / 2)
    }
  }
  ctx.restore()
}

function lowestNoteName(state: State): string {
  const lowest = Math.min(...state.config.strings.map((s) => s.openMidi))
  return getNoteName(lowest, state, true)
}

function highestNoteName(state: State): string {
  const highest = Math.max(...state.config.strings.map((s) => s.openMidi + s.maxSemitones))
  return getNoteName(highest, state, true)
}
