import { KEY_SIGNATURE, NOTE_LABELS } from '@/features/theory'
import { Hand, HandSettings, VisualizationMode } from '@/types'
import { Player } from '../player'
import { renderFallingVis, resetPianoHitArea } from './falling-notes'
import { renderSheetVis } from './sheet'
import { CanvasItem } from './utils'
import { renderViolinVis } from './violin'

export type GivenState = {
  time: number
  noteLabels: NOTE_LABELS
  coloredNotes: boolean
  visualization: VisualizationMode
  transpose: number
  windowWidth: number
  height: number
  pps: number // pixels per second
  hand: Hand
  hands: HandSettings
  ctx: CanvasRenderingContext2D
  items: CanvasItem[]
  constrictView?: boolean
  keySignature: KEY_SIGNATURE
  displayKeySignature?: KEY_SIGNATURE
  timeSignature?: { numerator: number; denominator: number }
  canvasRect: DOMRect
  // TODO: snap to measures
  selectedRange?: { start: number; end: number }
  game: boolean
  player: Player
}

export function render(state: Readonly<GivenState>) {
  if (state.visualization === 'falling-notes') {
    renderFallingVis(state)
    return
  }
  // Only the piano view has a keyboard that should capture pointer presses.
  resetPianoHitArea()
  if (state.visualization === 'violin') {
    renderViolinVis(state)
  } else {
    renderSheetVis(state)
  }
}
