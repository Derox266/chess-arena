import { Chess, type Move, type PieceSymbol } from 'chess.js'
import type { EngineEvaluation, GameRecord, Side } from '../types'

export const FILES = 'abcdefgh'
export const PIECES: Record<Side, Record<PieceSymbol, string>> = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
}

const OPENINGS: { moves: string; name: string; eco: string }[] = [
  { moves: 'e4 e5 Nf3 Nc6 Bb5', name: 'Partia hiszpańska', eco: 'C60' },
  { moves: 'e4 e5 Nf3 Nc6 Bc4', name: 'Partia włoska', eco: 'C50' },
  { moves: 'e4 e5 Nf3 Nc6 d4', name: 'Partia szkocka', eco: 'C45' },
  { moves: 'e4 e5 Nf3 Nf6', name: 'Obrona rosyjska', eco: 'C42' },
  { moves: 'e4 e5 f4', name: 'Gambit królewski', eco: 'C30' },
  { moves: 'e4 c5 Nf3 d6', name: 'Obrona sycylijska: Najdorf / klasyczna', eco: 'B50' },
  { moves: 'e4 c5', name: 'Obrona sycylijska', eco: 'B20' },
  { moves: 'e4 e6', name: 'Obrona francuska', eco: 'C00' },
  { moves: 'e4 c6', name: 'Obrona Caro-Kann', eco: 'B10' },
  { moves: 'e4 d5', name: 'Obrona skandynawska', eco: 'B01' },
  { moves: 'e4 d6', name: 'Obrona Pirca', eco: 'B07' },
  { moves: 'e4 Nf6', name: 'Obrona Alechina', eco: 'B02' },
  { moves: 'e4 e5 Nf3 Nc6', name: 'Partia otwarta', eco: 'C44' },
  { moves: 'd4 d5 c4 e6', name: 'Gambit hetmański odrzucony', eco: 'D30' },
  { moves: 'd4 d5 c4 dxc4', name: 'Gambit hetmański przyjęty', eco: 'D20' },
  { moves: 'd4 d5 c4 c6', name: 'Obrona słowiańska', eco: 'D10' },
  { moves: 'd4 Nf6 c4 g6 Nc3 Bg7', name: 'Obrona królewsko-indyjska', eco: 'E60' },
  { moves: 'd4 Nf6 c4 e6 Nc3 Bb4', name: 'Obrona Nimzowitscha', eco: 'E20' },
  { moves: 'd4 Nf6 c4 e6 Nf3 b6', name: 'Obrona hetmańsko-indyjska', eco: 'E12' },
  { moves: 'd4 Nf6 c4 g6 Nc3 d5', name: 'Obrona Grünfelda', eco: 'D80' },
  { moves: 'd4 d5 c4', name: 'Gambit hetmański', eco: 'D06' },
  { moves: 'd4 Nf6', name: 'Obrona indyjska', eco: 'A45' },
  { moves: 'c4 e5', name: 'Partia angielska: odwrócona sycylijska', eco: 'A20' },
  { moves: 'c4', name: 'Partia angielska', eco: 'A10' },
  { moves: 'Nf3', name: 'Otwarcie Rétiego', eco: 'A04' },
  { moves: 'b3', name: 'Otwarcie Larsena', eco: 'A01' },
  { moves: 'd4', name: 'Debiut pionem hetmańskim', eco: 'A40' },
  { moves: 'e4', name: 'Debiut pionem królewskim', eco: 'B00' },
]

export function detectOpening(history: string[]): { name: string; eco: string } {
  const sequence = history.join(' ')
  const matched = [...OPENINGS].sort((a, b) => b.moves.length - a.moves.length)
    .find(item => sequence === item.moves || sequence.startsWith(item.moves + ' '))
  return matched ? { name: matched.name, eco: matched.eco } : { name: 'Pozycja niestandardowa', eco: '—' }
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds))
  const mm = Math.floor(safe / 60).toString().padStart(2, '0')
  const ss = (safe % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

export function moveGroups(moves: Move[]) {
  const result: { number: number; white?: Move; black?: Move }[] = []
  for (let i = 0; i < moves.length; i += 2) {
    result.push({ number: Math.floor(i / 2) + 1, white: moves[i], black: moves[i + 1] })
  }
  return result
}

export function describeResult(game: Chess, override: string | null, side: Side): {
  label: string; outcome: GameRecord['outcome']; finished: boolean
} {
  if (override) {
    const match = override.match(/^(w|b):(time|resign)$/)
    if (match) {
      const winner = match[1] as Side
      return { label: match[2] === 'time' ? 'Koniec czasu' : 'Poddanie partii', outcome: winner === side ? 'win' : 'loss', finished: true }
    }
    if (override === 'draw') return { label: 'Remis za porozumieniem', outcome: 'draw', finished: true }
  }
  if (game.isCheckmate()) return {
    label: 'Szach-mat', outcome: game.turn() !== side ? 'win' : 'loss', finished: true,
  }
  if (game.isStalemate()) return { label: 'Pat — remis', outcome: 'draw', finished: true }
  if (game.isThreefoldRepetition()) return { label: 'Trzykrotne powtórzenie', outcome: 'draw', finished: true }
  if (game.isInsufficientMaterial()) return { label: 'Brak materiału do mata', outcome: 'draw', finished: true }
  if (game.isDraw()) return { label: 'Remis', outcome: 'draw', finished: true }
  if (game.isCheck()) return { label: 'Szach!', outcome: 'unfinished', finished: false }
  return { label: game.turn() === side ? 'Twój ruch' : 'Ruch komputera', outcome: 'unfinished', finished: false }
}

export function formattedEval(info: EngineEvaluation | null): string {
  if (!info) return '0.0'
  if (info.mate != null) return `${info.mate > 0 ? '+' : '−'}M${Math.abs(info.mate)}`
  const value = (info.cp ?? 0) / 100
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`
}

export function advantage(info: EngineEvaluation | null): number {
  if (!info) return 50
  if (info.mate !== null) return info.mate > 0 ? 98 : 2
  return Math.max(5, Math.min(95, 50 + 45 * (2 / (1 + Math.exp(-((info.cp ?? 0) / 100) * 0.5)) - 1)))
}

export function pvToSan(fen: string, moves: string[], limit = 6): string {
  const board = new Chess(fen)
  const sans: string[] = []
  for (const uci of moves.slice(0, limit)) {
    try {
      const from = uci.slice(0, 2) as import('chess.js').Square
      const to = uci.slice(2, 4) as import('chess.js').Square
      const promotion = uci[4] as PieceSymbol | undefined
      const moved = board.move(promotion ? { from, to, promotion } : { from, to })
      sans.push(moved.san)
    } catch { break }
  }
  return sans.join(' ')
}

export function materialCount(game: Chess): { w: number; b: number } {
  const values: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
  const counts = { w: 0, b: 0 }
  for (const row of game.board()) for (const piece of row) if (piece) counts[piece.color] += values[piece.type]
  return counts
}

export function downloadText(name: string, content: string) {
  const blob = new Blob([content], { type: 'application/x-chess-pgn;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function getSafeStorage<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) as T : fallback
  } catch { return fallback }
}
