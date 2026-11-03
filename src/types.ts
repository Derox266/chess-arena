export type Side = 'w' | 'b'
export type Page = 'play' | 'analysis' | 'library'
export type Palette = 'forest' | 'walnut' | 'ocean'
export type ColorChoice = Side | 'random'
export type Level = 1 | 2 | 3 | 4 | 5 | 6
export type TimeChoice = 'bullet' | 'blitz' | 'rapid' | 'classic'

export interface Preferences {
  level: Level
  color: ColorChoice
  time: TimeChoice
  palette: Palette
  theme: 'dark' | 'light'
  sound: boolean
  legalMoves: boolean
  evaluations: boolean
  coordinates: boolean
}

export interface GameRecord {
  id: string
  date: string
  opponent: string
  level: Level
  side: Side
  time: TimeChoice
  result: string
  outcome: 'win' | 'loss' | 'draw' | 'unfinished'
  moves: number
  pgn: string
  finalFen: string
}

export interface EngineEvaluation {
  cp: number | null
  mate: number | null
  depth: number
  pv: string[]
  time: number
}

export interface PersistedSession {
  pgn: string
  side: Side
  time: TimeChoice
  clocks: Record<Side, number>
  started: boolean
  resultOverride: string | null
  id: string
}

export const DEFAULT_PREFS: Preferences = {
  level: 4, color: 'w', time: 'rapid', palette: 'forest', theme: 'dark',
  sound: true, legalMoves: true, evaluations: true, coordinates: true,
}

export const LEVELS: { level: Level; name: string; elo: number; skill: number; think: number; subtitle: string }[] = [
  { level: 1, name: 'Początkujący', elo: 1350, skill: 0, think: 350, subtitle: 'Pierwsze kroki' },
  { level: 2, name: 'Amator', elo: 1550, skill: 3, think: 550, subtitle: 'Spokojna rozgrywka' },
  { level: 3, name: 'Klubowy', elo: 1850, skill: 7, think: 850, subtitle: 'Solidny rywal' },
  { level: 4, name: 'Ekspert', elo: 2200, skill: 12, think: 1250, subtitle: 'Taktyczna precyzja' },
  { level: 5, name: 'Mistrz', elo: 2600, skill: 17, think: 2000, subtitle: 'Bardzo wymagający' },
  { level: 6, name: 'Arcymistrz', elo: 3100, skill: 20, think: 3200, subtitle: 'Maksymalna moc' },
]

export const TIME_OPTIONS: Record<TimeChoice, { label: string; short: string; seconds: number; increment: number }> = {
  bullet: { label: '3 min + 2 s', short: '3+2', seconds: 180, increment: 2 },
  blitz: { label: '5 min + 3 s', short: '5+3', seconds: 300, increment: 3 },
  rapid: { label: '10 min', short: '10+0', seconds: 600, increment: 0 },
  classic: { label: 'Bez limitu', short: '∞', seconds: 0, increment: 0 },
}
