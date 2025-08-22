export type ChipTrackId = "sunny" | "night"

type PatternStep = number | null // frequency in Hz, null = rest

// Simple CC0 chiptune patterns (short loops)
const SUNNY_PATTERN: PatternStep[] = [
  523.25, 523.25, 392.0, 392.0, 440.0, 440.0, 392.0, null,
  349.23, 349.23, 329.63, 329.63, 293.66, 293.66, 261.63, null,
]
const NIGHT_PATTERN: PatternStep[] = [
  392.0, null, 392.0, null, 349.23, null, 349.23, null,
  329.63, null, 329.63, null, 293.66, null, 261.63, null,
]
const PATTERNS: Record<ChipTrackId, PatternStep[]> = {
  sunny: SUNNY_PATTERN,
  night: NIGHT_PATTERN,
}

export class ChipTune {
  private ctx: AudioContext | null = null
  private gain: GainNode | null = null
  private stepTimer: number | null = null
  private stepIndex = 0
  private bpm = 120
  private decay = 0.08
  private _enabled = true
  private _volume = 0.6
  private _current: ChipTrackId | null = null
  private _playing = false

  get isPlaying() { return this._playing }
  get currentTrack() { return this._current }

  ensureContext() {
    if (this.ctx) return
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    this.gain = this.ctx.createGain()
    this.gain.gain.value = this._enabled ? this._volume : 0
    this.gain.connect(this.ctx.destination)
  }

  setEnabled(v: boolean) {
    this._enabled = !!v
    if (this.gain && this.ctx) {
      const target = v ? this._volume : 0
      this.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.01)
    }
    if (!v) this.pause()
  }

  setVolume(v: number) {
    this._volume = Math.max(0, Math.min(1, v))
    if (this.gain && this.ctx && this._enabled) {
      this.gain.gain.setTargetAtTime(this._volume, this.ctx.currentTime, 0.01)
    }
  }

  async play(track: ChipTrackId) {
    this.ensureContext()
    if (!this.ctx || !this.gain) return
    if (this.ctx.state === "suspended") await this.ctx.resume()
    this.stopTimer()
    this._current = track
    this._playing = true
    this.stepIndex = 0
    const stepDur = 60 / this.bpm / 4 // 16th
    const loop = () => {
      const freq = PATTERNS[track][this.stepIndex % PATTERNS[track].length]
      if (freq && this.ctx) {
        const osc = this.ctx.createOscillator()
        osc.type = "square"
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime)
        const env = this.ctx.createGain()
        env.gain.setValueAtTime(0, this.ctx.currentTime)
        env.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 0.01)
        env.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + stepDur - this.decay)
        osc.connect(env).connect(this.gain!)
        osc.start()
        osc.stop(this.ctx.currentTime + stepDur)
      }
      this.stepIndex = (this.stepIndex + 1) % PATTERNS[track].length
      this.stepTimer = window.setTimeout(loop, stepDur * 1000)
    }
    this.stepTimer = window.setTimeout(loop, 0)
  }

  pause() {
    this._playing = false
    this.stopTimer()
  }

  private stopTimer() {
    if (this.stepTimer != null) {
      clearTimeout(this.stepTimer)
      this.stepTimer = null
    }
  }
}
