import type { EngineEvaluation, Level } from '../types'
import { LEVELS } from '../types'

const WORKER_PATH = `${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`
const TIMEOUT = 25000

type EngineMessage = (line: string) => void

class UciWorker {
  protected worker: Worker | null = null
  protected ready = false
  protected disposed = false
  private readyPromise: Promise<void> | null = null
  private rejectReady: ((err: Error) => void) | null = null
  private resolveReady: (() => void) | null = null
  protected onLine: EngineMessage = () => {}

  init(): Promise<void> {
    if (this.readyPromise) return this.readyPromise
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve
      this.rejectReady = reject
      try {
        this.worker = new Worker(WORKER_PATH)
        this.worker.onmessage = event => {
          for (const line of String(event.data).split(/\r?\n/)) {
            if (line.includes('uciok')) this.send('isready')
            if (line.includes('readyok') && !this.ready) {
              this.ready = true
              this.resolveReady?.()
            }
            this.onLine(line.trim())
          }
        }
        this.worker.onerror = () => {
          const error = new Error('Silnik Stockfish nie może zostać uruchomiony. Sprawdź instalację plików WASM.')
          this.rejectReady?.(error)
        }
        this.send('uci')
        setTimeout(() => {
          if (!this.ready && !this.disposed) this.rejectReady?.(new Error('Przekroczono czas uruchamiania silnika.'))
        }, TIMEOUT)
      } catch (error) { reject(error instanceof Error ? error : new Error(String(error))) }
    })
    return this.readyPromise
  }

  protected send(command: string) {
    if (!this.disposed) this.worker?.postMessage(command)
  }

  dispose() {
    this.disposed = true
    this.worker?.terminate()
    this.worker = null
    this.rejectReady?.(new Error('Silnik zatrzymany'))
  }
}

export class OpponentEngine extends UciWorker {
  private pending: ((move: string) => void) | null = null
  private rejectPending: ((error: Error) => void) | null = null

  constructor() {
    super()
    this.onLine = line => {
      if (line.startsWith('bestmove ') && this.pending) {
        const move = line.split(/\s+/)[1]
        this.pending(move)
        this.pending = null
        this.rejectPending = null
      }
    }
  }

  async bestMove(fen: string, level: Level): Promise<string> {
    await this.init()
    if (this.disposed) throw new Error('Silnik został zatrzymany')
    if (this.pending) throw new Error('Silnik już analizuje ruch przeciwnika')
    const difficulty = LEVELS.find(item => item.level === level) ?? LEVELS[3]
    this.send('setoption name UCI_LimitStrength value true')
    this.send(`setoption name UCI_Elo value ${difficulty.elo}`)
    this.send(`setoption name Skill Level value ${difficulty.skill}`)
    this.send(`position fen ${fen}`)
    return new Promise((resolve, reject) => {
      this.pending = resolve
      this.rejectPending = reject
      this.send(`go movetime ${difficulty.think}`)
    })
  }

  override dispose() {
    this.rejectPending?.(new Error('Anulowano poprzednią partię'))
    this.pending = null
    this.rejectPending = null
    super.dispose()
  }
}

export class AnalysisEngine extends UciWorker {
  private targetFen = ''
  private activeFen = ''
  private searching = false
  private stopping = false
  private callback: (value: EngineEvaluation) => void

  constructor(callback: (value: EngineEvaluation) => void) {
    super()
    this.callback = callback
    this.onLine = line => {
      if (line.startsWith('bestmove ')) {
        this.searching = false
        this.stopping = false
        if (this.targetFen && this.targetFen !== this.activeFen) this.run()
        return
      }
      if (!line.startsWith('info ') || this.stopping || this.targetFen !== this.activeFen) return
      const depth = Number(line.match(/\bdepth (\d+)/)?.[1] ?? 0)
      const score = line.match(/\bscore (cp|mate) (-?\d+)/)
      if (!score || depth < 1 || (line.includes(' multipv ') && !line.includes(' multipv 1 '))) return
      const pv = line.split(' pv ')[1]?.trim().split(' ') ?? []
      const perspective = this.activeFen.split(' ')[1] === 'w' ? 1 : -1
      const amount = Number(score[2]) * perspective
      this.callback({ cp: score[1] === 'cp' ? amount : null, mate: score[1] === 'mate' ? amount : null, depth, pv, time: Date.now() })
    }
  }

  async analyze(fen: string): Promise<void> {
    this.targetFen = fen
    await this.init()
    if (this.disposed || fen !== this.targetFen) return
    if (this.searching) {
      if (!this.stopping) {
        this.stopping = true
        this.send('stop')
      }
    } else this.run()
  }

  private run() {
    if (this.disposed || !this.ready) return
    this.activeFen = this.targetFen
    this.searching = true
    this.stopping = false
    this.send(`position fen ${this.activeFen}`)
    this.send('go depth 17')
  }
}
