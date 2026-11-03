import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Chess, type Square } from 'chess.js'
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowRight, BarChart3, BookOpen,
  Bot, Check, ChevronDown, ChevronFirst, ChevronLast, CircleHelp,
  Clock3, Copy, Flag, FlipHorizontal, FolderOpen, GraduationCap,
  History, Lightbulb, Menu, Moon, MoreHorizontal, Play, Plus, RotateCcw,
  Settings2, ShieldCheck, Sparkles, Sun, Swords, Target, Trophy, Upload,
  Volume2, X,
} from 'lucide-react'
import type { GameRecord, Palette, Page, PersistedSession, Preferences, Side, TimeChoice, EngineEvaluation } from './types'
import { DEFAULT_PREFS, LEVELS, TIME_OPTIONS } from './types'
import { advantage, describeResult, detectOpening, downloadText, formattedEval, getSafeStorage, materialCount, moveGroups, pvToSan } from './lib/chess-utils'
import { OpponentEngine, AnalysisEngine } from './lib/engine'
import { ChessBoard } from './components/ChessBoard'
import { ClockCard } from './components/ClockCard'
import { Dialog } from './components/Dialog'

const SESSION_KEY = 'chess-arena-session-v1'
const PREFS_KEY = 'chess-arena-prefs-v1'
const ARCHIVE_KEY = 'chess-arena-archive-v1'

function id() { return globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random()) }
function newGameState() {
  const restored = getSafeStorage<PersistedSession | null>(SESSION_KEY, null)
  const game = new Chess()
  if (restored?.pgn) {
    try { game.loadPgn(restored.pgn) } catch { return { game: new Chess(), side: 'w' as Side, time: 'rapid' as TimeChoice, clocks: { w: 600, b: 600 }, started: false, result: null as string | null, id: id() } }
  }
  if (restored && ['w', 'b'].includes(restored.side) && restored.clocks && TIME_OPTIONS[restored.time]) {
    return { game, side: restored.side, time: restored.time, clocks: restored.clocks,
      started: restored.started, result: restored.resultOverride, id: restored.id || id() }
  }
  return { game, side: 'w' as Side, time: 'rapid' as TimeChoice, clocks: { w: 600, b: 600 }, started: false, result: null as string | null, id: id() }
}

function Label({ children }: { children: ReactNode }) { return <span className="section-label">{children}</span> }
function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) { return <span className={`mini-badge tone-${tone}`}>{children}</span> }

export default function App() {
  const initial = useRef<ReturnType<typeof newGameState> | null>(null)
  if (!initial.current) initial.current = newGameState()
  const gameRef = useRef(initial.current.game)
  const [revision, setRevision] = useState(0)
  const [prefs, setPrefs] = useState<Preferences>(() => ({ ...DEFAULT_PREFS, ...getSafeStorage<Partial<Preferences>>(PREFS_KEY, {}) }))
  const [side, setSide] = useState<Side>(initial.current.side)
  const [timeMode, setTimeMode] = useState<TimeChoice>(initial.current.time)
  const [clocks, setClocks] = useState<Record<Side, number>>(initial.current.clocks)
  const clocksRef = useRef(clocks)
  const [started, setStarted] = useState(initial.current.started)
  const [resultOverride, setResultOverride] = useState<string | null>(initial.current.result)
  const [sessionId, setSessionId] = useState(initial.current.id)
  const [records, setRecords] = useState<GameRecord[]>(() => getSafeStorage<GameRecord[]>(ARCHIVE_KEY, []))
  const [page, setPage] = useState<Page>('play')
  const [openedRecord, setOpenedRecord] = useState<GameRecord | null>(null)
  const [reviewIndex, setReviewIndex] = useState<number | null>(null)
  const [selected, setSelected] = useState<Square | null>(null)
  const [hint, setHint] = useState<Square[]>([])
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null)
  const [orientation, setOrientation] = useState<Side>(initial.current.side)
  const [thinking, setThinking] = useState(false)
  const [evaluation, setEvaluation] = useState<EngineEvaluation | null>(null)
  const [engineError, setEngineError] = useState<string | null>(null)
  const [engineEpoch, setEngineEpoch] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [toast, setToast] = useState('')
  const [rightTab, setRightTab] = useState<'moves' | 'insights'>('moves')
  const opponentRef = useRef<OpponentEngine | null>(null)
  const analysisRef = useRef<AnalysisEngine | null>(null)
  const archivedIds = useRef(new Set(records.map(record => record.id)))
  const scrollEnd = useRef<HTMLDivElement | null>(null)

  const live = gameRef.current
  const liveMoves = live.history({ verbose: true })
  const liveFen = live.fen()
  const status = describeResult(live, resultOverride, side)
  const finished = status.finished
  const turn = live.turn()
  const opponentSide = side === 'w' ? 'b' : 'w'
  const difficulty = LEVELS.find(level => level.level === prefs.level) || LEVELS[3]

  const archivedGame = useMemo(() => {
    if (!openedRecord) return null
    try {
      const g = new Chess()
      g.loadPgn(openedRecord.pgn)
      return g
    } catch { return null }
  }, [openedRecord])
  const sourceGame = archivedGame || live
  const sourceMoves = sourceGame.history({ verbose: true })
  const displayedIndex = Math.max(0, Math.min(reviewIndex ?? sourceMoves.length, sourceMoves.length))
  const reviewing = !!openedRecord || displayedIndex < sourceMoves.length
  const displayedGame = useMemo(() => {
    if (displayedIndex >= sourceMoves.length) return sourceGame
    const replay = new Chess()
    try { replay.loadPgn(sourceGame.pgn()) } catch { return sourceGame }
    for (let i = sourceMoves.length; i > displayedIndex; i--) replay.undo()
    return replay
    // revision is intentional: chess.js instance is mutated through gameRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, sourceGame, displayedIndex, openedRecord])
  const displayedFen = displayedGame.fen()
  const opening = detectOpening(displayedGame.history())
  const material = materialCount(displayedGame)
  const legalSquares: Square[] = useMemo(() => {
    if (!selected || reviewing || finished || thinking || live.turn() !== side) return []
    try { return live.moves({ square: selected, verbose: true }).map(move => move.to) } catch { return [] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, revision, reviewing, finished, thinking, side])

  const notify = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(current => current === message ? '' : current), 3200)
  }, [])

  const sound = useCallback((kind: 'move' | 'capture' | 'check') => {
    if (!prefs.sound) return
    try {
      const context = new AudioContext()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = kind === 'capture' ? 'triangle' : 'sine'
      oscillator.frequency.value = kind === 'check' ? 740 : kind === 'capture' ? 370 : 520
      gain.gain.setValueAtTime(0.045, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.075)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(); oscillator.stop(context.currentTime + 0.08)
      oscillator.onended = () => void context.close()
    } catch { /* Audio disabled in this browser */ }
  }, [prefs.sound])

  const resetEngines = useCallback(() => {
    opponentRef.current?.dispose(); opponentRef.current = null
    analysisRef.current?.dispose(); analysisRef.current = null
    setThinking(false); setEvaluation(null); setEngineError(null)
    setEngineEpoch(value => value + 1)
  }, [])

  const commitMove = useCallback((from: Square, to: Square, promoting?: 'q' | 'r' | 'b' | 'n'): boolean => {
    const game = gameRef.current
    const movingSide = game.turn()
    try {
      const move = game.move(promoting ? { from, to, promotion: promoting } : { from, to })
      const increment = TIME_OPTIONS[timeMode].increment
      if (timeMode !== 'classic') {
        setClocks(current => ({ ...current, [movingSide]: current[movingSide] + increment }))
        clocksRef.current = { ...clocksRef.current, [movingSide]: clocksRef.current[movingSide] + increment }
      }
      setRevision(n => n + 1)
      setSelected(null); setHint([]); setPromotion(null); setReviewIndex(null)
      setStarted(true)
      sound(move.san.includes('+') || move.san.includes('#') ? 'check' : move.isCapture() ? 'capture' : 'move')
      return true
    } catch { return false }
  }, [timeMode, sound])

  const tryHumanMove = useCallback((from: Square, to: Square) => {
    const board = gameRef.current
    if (finished || thinking || openedRecord || reviewing || board.turn() !== side) return
    const moves = board.moves({ square: from, verbose: true }).filter(move => move.to === to)
    if (!moves.length) { setSelected(board.get(to)?.color === side ? to : null); return }
    if (moves.some(move => move.isPromotion())) {
      setPromotion({ from, to }); return
    }
    commitMove(from, to)
  }, [finished, thinking, openedRecord, reviewing, side, commitMove])

  const selectSquare = useCallback((square: Square) => {
    if (finished || reviewing || thinking || openedRecord || live.turn() !== side) return
    if (selected && selected !== square && legalSquares.includes(square)) {
      tryHumanMove(selected, square); return
    }
    if (selected === square) { setSelected(null); return }
    setHint([])
    setSelected(live.get(square)?.color === side ? square : null)
  }, [finished, reviewing, thinking, openedRecord, live, side, selected, legalSquares, tryHumanMove])

  const buildRecord = useCallback((outcome: GameRecord['outcome'], label: string): GameRecord => ({
    id: sessionId, date: new Date().toISOString(), opponent: 'Stockfish 19 Lite',
    level: prefs.level, side, time: timeMode, result: label, outcome,
    moves: gameRef.current.history().length,
    pgn: gameRef.current.pgn() || '*', finalFen: gameRef.current.fen(),
  }), [sessionId, prefs.level, side, timeMode])

  const addRecord = useCallback((record: GameRecord) => {
    if (archivedIds.current.has(record.id)) return
    archivedIds.current.add(record.id)
    setRecords(current => [record, ...current].slice(0, 40))
  }, [])

  const newGame = useCallback(() => {
    if (!finished && gameRef.current.history().length) addRecord(buildRecord('unfinished', 'Niedokończona'))
    resetEngines()
    const newSide: Side = prefs.color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : prefs.color
    gameRef.current = new Chess()
    const seconds = TIME_OPTIONS[prefs.time].seconds
    const newClocks = { w: seconds, b: seconds }
    clocksRef.current = newClocks
    setClocks(newClocks); setTimeMode(prefs.time)
    setSide(newSide); setOrientation(newSide)
    setStarted(true); setSessionId(id()); setResultOverride(null)
    setRevision(n => n + 1)
    setSelected(null); setHint([]); setPromotion(null); setOpenedRecord(null); setReviewIndex(null)
    setPage('play'); setSettingsOpen(false)
    notify('Nowa partia rozpoczęta. Powodzenia!')
  }, [prefs, finished, addRecord, buildRecord, resetEngines, notify])

  const undo = useCallback(() => {
    if (openedRecord || reviewing || liveMoves.length === 0 || finished) return
    resetEngines()
    if (gameRef.current.turn() === side) {
      gameRef.current.undo()
      if (gameRef.current.history().length) gameRef.current.undo()
    } else {
      gameRef.current.undo()
    }
    setRevision(n => n + 1)
    setSelected(null); setHint([])
    notify('Cofnięto ostatni ruch.')
  }, [openedRecord, reviewing, liveMoves.length, finished, side, resetEngines, notify])

  const showHint = useCallback(() => {
    if (finished || thinking || reviewing || openedRecord || live.turn() !== side) return
    const next = evaluation?.pv[0]
    if (!next || evaluation?.time == null || displayedFen !== liveFen) {
      notify('Silnik jeszcze analizuje tę pozycję. Spróbuj za chwilę.')
      return
    }
    const from = next.slice(0, 2) as Square
    const to = next.slice(2, 4) as Square
    if (!live.moves({ square: from, verbose: true }).some(move => move.to === to)) {
      notify('Odśwież analizę i spróbuj ponownie.'); return
    }
    setHint([from, to]); notify('Zielone pola pokazują proponowany ruch.')
  }, [evaluation, live, liveFen, displayedFen, finished, thinking, reviewing, openedRecord, side, notify])

  const loadRecord = useCallback((record: GameRecord) => {
    setOpenedRecord(record); setReviewIndex(record.moves)
    setPage('analysis'); setSelected(null); setHint([])
    setMobileNavOpen(false)
  }, [])

  const returnToGame = useCallback(() => {
    setOpenedRecord(null); setReviewIndex(null); setSelected(null)
    setPage('play')
  }, [])

  const importPosition = useCallback(() => {
    const input = importText.trim()
    if (!input) return setImportError('Wklej najpierw zapis FEN lub PGN.')
    const game = new Chess()
    try {
      if (/^\S+\s+[wb]\s+[-KQkq]+\s+[-a-h1-8]+\s+\d+\s+\d+$/.test(input)) {
        game.load(input)
      } else game.loadPgn(input)
      if (!finished && liveMoves.length) addRecord(buildRecord('unfinished', 'Niedokończona'))
      resetEngines()
      gameRef.current = game
      const seconds = TIME_OPTIONS[prefs.time].seconds
      const fresh = { w: seconds, b: seconds }
      clocksRef.current = fresh
      setClocks(fresh); setSide(game.turn()); setOrientation(game.turn())
      setTimeMode(prefs.time); setStarted(false); setResultOverride(null); setSessionId(id())
      setOpenedRecord(null); setReviewIndex(null); setSelected(null); setRevision(n => n + 1)
      setImportOpen(false); setImportError(''); setImportText(''); setPage('analysis')
      notify('Pozycja została zaimportowana. Możesz ją analizować lub kontynuować grę.')
    } catch { setImportError('Niepoprawny zapis FEN lub PGN. Sprawdź format i spróbuj ponownie.') }
  }, [importText, finished, liveMoves.length, addRecord, buildRecord, resetEngines, prefs, notify])

  // Clock, autosave and completed game archive.
  useEffect(() => { clocksRef.current = clocks }, [clocks])
  useEffect(() => {
    if (!started || finished || timeMode === 'classic') return
    let previous = performance.now()
    const interval = window.setInterval(() => {
      const now = performance.now()
      const diff = (now - previous) / 1000
      previous = now
      if (diff <= 0 || diff > 10) return
      const remaining = Math.max(0, clocksRef.current[turn] - diff)
      clocksRef.current = { ...clocksRef.current, [turn]: remaining }
      setClocks(clocksRef.current)
      if (remaining <= 0) setResultOverride(`${turn === 'w' ? 'b' : 'w'}:time`)
    }, 150)
    return () => window.clearInterval(interval)
  }, [started, finished, timeMode, turn])

  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* storage may be blocked */ }
    document.documentElement.dataset.theme = prefs.theme
  }, [prefs])
  useEffect(() => {
    try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(records)) } catch { /* storage may be blocked */ }
  }, [records])
  useEffect(() => {
    const session: PersistedSession = { pgn: gameRef.current.pgn(), side, time: timeMode,
      clocks, started, resultOverride, id: sessionId }
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)) } catch { /* storage may be blocked */ }
  }, [revision, side, timeMode, clocks, started, resultOverride, sessionId])
  useEffect(() => {
    if (finished) addRecord(buildRecord(status.outcome, status.label))
  }, [finished, status.outcome, status.label, buildRecord, addRecord])

  // Opponent has a dedicated worker; it never uses the UI thread.
  useEffect(() => {
    if (finished || openedRecord || reviewing || turn === side || !started) {
      setThinking(false)
      return
    }
    let cancelled = false
    const engine = opponentRef.current || new OpponentEngine()
    opponentRef.current = engine
    setThinking(true)
    engine.bestMove(liveFen, prefs.level).then(uci => {
      if (cancelled || gameRef.current.fen() !== liveFen || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return
      if (!commitMove(uci.slice(0, 2) as Square, uci.slice(2, 4) as Square, uci[4] as 'q' | 'r' | 'b' | 'n' | undefined)) {
        setEngineError('Silnik przesłał nieprawidłowy ruch. Spróbuj rozpocząć nową partię.')
      }
    }).catch(error => {
      if (!cancelled) setEngineError(error instanceof Error ? error.message : 'Problem z silnikiem.')
    }).finally(() => { if (!cancelled) setThinking(false) })
    return () => {
      cancelled = true
      if (opponentRef.current === engine) { engine.dispose(); opponentRef.current = null }
    }
  }, [finished, openedRecord, reviewing, turn, side, started, liveFen, prefs.level, commitMove, sessionId, engineEpoch])

  // A second worker runs independent position analysis and hints.
  useEffect(() => {
    if (!prefs.evaluations) {
      analysisRef.current?.dispose(); analysisRef.current = null
      setEvaluation(null)
      return
    }
    let alive = true
    setEvaluation(null)
    const engine = analysisRef.current || new AnalysisEngine(info => setEvaluation(info))
    analysisRef.current = engine
    engine.analyze(displayedFen).catch(error => {
      if (alive && analysisRef.current === engine) setEngineError(error instanceof Error ? error.message : 'Analiza niedostępna.')
    })
    return () => { alive = false }
  }, [prefs.evaluations, displayedFen, sessionId, engineEpoch])
  useEffect(() => () => {
    opponentRef.current?.dispose(); opponentRef.current = null
    analysisRef.current?.dispose(); analysisRef.current = null
  }, [])

  useEffect(() => {
    if (page !== 'play') return
    scrollEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [revision, page])
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (settingsOpen || importOpen || helpOpen || promotion) return
      const element = event.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element?.tagName)) return
      if (event.key === 'ArrowLeft') { event.preventDefault(); setReviewIndex(index => Math.max(0, (index ?? sourceMoves.length) - 1)) }
      if (event.key === 'ArrowRight') { event.preventDefault(); setReviewIndex(index => Math.min(sourceMoves.length, (index ?? sourceMoves.length) + 1)) }
      if (event.key.toLowerCase() === 'f') setOrientation(current => current === 'w' ? 'b' : 'w')
      if (event.key === 'Escape' && !openedRecord) setReviewIndex(null)
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [settingsOpen, importOpen, helpOpen, promotion, sourceMoves.length, openedRecord])

  const levelStats = records.filter(record => record.outcome !== 'unfinished')
  const winCount = levelStats.filter(record => record.outcome === 'win').length
  const drawCount = levelStats.filter(record => record.outcome === 'draw').length
  const winPercent = levelStats.length ? Math.round((winCount / levelStats.length) * 100) : 0
  const playerTop = orientation === side ? false : true
  const topSide: Side = orientation === 'w' ? 'b' : 'w'
  const bottomSide: Side = orientation
  const boardDisabled = finished || reviewing || thinking || live.turn() !== side || !!openedRecord
  const gameTitle = openedRecord ? 'Archiwalna rozgrywka' : page === 'analysis' ? 'Laboratorium analizy' : 'Twoja arena. Twój ruch.'

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <div className="brand"><span className="brand-symbol">♞</span><div className="brand-lockup"><strong>CHESS<span>ARENA</span></strong><small>GRANDMASTER EDITION</small></div></div>
        <div className="sidebar-group"><Label>MENU GŁÓWNE</Label>
          <button className={`nav-item ${page === 'play' ? 'nav-active' : ''}`} onClick={() => { returnToGame(); setMobileNavOpen(false) }}><Swords size={19} /> Rozgrywka <span className="nav-arrow">›</span></button>
          <button className={`nav-item ${page === 'analysis' ? 'nav-active' : ''}`} onClick={() => { setPage('analysis'); setMobileNavOpen(false) }}><BarChart3 size={19} /> Analiza partii <span className="nav-arrow">›</span></button>
          <button className={`nav-item ${page === 'library' ? 'nav-active' : ''}`} onClick={() => { setPage('library'); setMobileNavOpen(false) }}><FolderOpen size={19} /> Moje partie <Badge>{records.length}</Badge></button>
        </div>
        <div className="sidebar-group sidebar-training"><Label>TRENING</Label>
          <div className="training-widget"><div className="training-icon"><Target size={21} /></div><strong>Trening czyni mistrza.</strong><p>Regularne partie i analiza pomagają rozwijać myślenie strategiczne.</p><button onClick={() => { setPage('analysis'); setMobileNavOpen(false) }}>Przejdź do analizy <ArrowRight size={15}/></button></div>
        </div>
        <div className="sidebar-bottom"><div className="engine-pill"><span className={`status-indicator ${engineError ? 'status-error' : ''}`} /><div><strong>Stockfish 19 Lite</strong><small>{engineError ? 'Wymaga uwagi' : 'Silnik lokalny · WASM'}</small></div><ShieldCheck size={16} /></div><button className="sidebar-settings" onClick={() => setSettingsOpen(true)}><Settings2 size={18}/> Ustawienia <ChevronDown size={16}/></button></div>
      </aside>
      {mobileNavOpen && <div className="mobile-shade" onClick={() => setMobileNavOpen(false)} />}

      <main className="main-content">
        <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" onClick={() => setMobileNavOpen(true)} aria-label="Otwórz menu"><Menu size={21}/></button><span className="breadcrumb">Chess Arena <span>/</span> {page === 'play' ? 'Rozgrywka' : page === 'analysis' ? 'Analiza' : 'Moje partie'}</span></div><div className="topbar-right"><span className="online-badge"><span className="status-indicator" /> Silnik lokalny</span><button className="icon-button" onClick={() => setHelpOpen(true)} aria-label="Pomoc"><CircleHelp size={19}/></button><button className="icon-button" onClick={() => setPrefs(current => ({ ...current, theme: current.theme === 'dark' ? 'light' : 'dark' }))} aria-label="Zmień motyw">{prefs.theme === 'dark' ? <Sun size={19}/> : <Moon size={19}/>}</button><span className="profile-avatar">G</span></div></header>
        <div className="page-wrap">
          {page === 'library' ? (
            <section className="library-page">
              <div className="hero"><div><div className="eyebrow"><span /> TWOJE ARCHIWUM</div><h1>Historia <em>rozgrywek.</em></h1><p>Każda partia to kolejna lekcja. Przeglądaj wyniki, wracaj do pozycji i analizuj swoje decyzje.</p></div><button className="button primary" onClick={newGame}><Plus size={18}/> Nowa partia</button></div>
              <div className="stats-grid"><div className="stat-card"><span>Łącznie rozegranych</span><strong>{levelStats.length}</strong><small>ukończonych partii</small></div><div className="stat-card"><span>Zwycięstwa</span><strong>{winCount}</strong><small>wygranych rozgrywek</small></div><div className="stat-card"><span>Skuteczność</span><strong>{winPercent}%</strong><small>procent zwycięstw</small></div><div className="stat-card"><span>Remisy</span><strong>{drawCount}</strong><small>zremisowanych partii</small></div></div>
              <div className="panel library-table"><div className="panel-title"><div><h2>Ostatnie partie</h2><p>Zapisywane automatycznie w przeglądarce</p></div><History size={19}/></div>
                {records.length === 0 ? <div className="empty-state"><span>♙</span><h3>Twoja historia zaczyna się tutaj.</h3><p>Rozegraj pierwszą partię, aby zobaczyć wyniki i historię ruchów.</p><button className="button primary" onClick={newGame}><Play size={17}/> Zacznij grać</button></div> : <div className="record-list">{records.map(record => <button key={record.id} className="record-item" onClick={() => loadRecord(record)}><span className={`record-icon result-${record.outcome}`}><Trophy size={19}/></span><span className="record-main"><strong>{record.outcome === 'win' ? 'Zwycięstwo' : record.outcome === 'loss' ? 'Porażka' : record.outcome === 'draw' ? 'Remis' : 'Niedokończona'}</strong><small>Stockfish 19 · poziom {record.level} · {TIME_OPTIONS[record.time]?.short || '∞'}</small></span><span className="record-date">{new Date(record.date).toLocaleDateString('pl-PL')}<small>{record.moves} półruchów</small></span><ArrowRight size={18}/></button>)}</div>}
              </div><p className="library-note">Dane są przechowywane wyłącznie w lokalnej pamięci tej przeglądarki. Wyczyszczenie danych witryny może usunąć historię — eksportuj ważne partie do PGN.</p>
            </section>
          ) : (
            <>
              <div className="hero"><div><div className="eyebrow"><span /> {openedRecord ? 'PRZEGLĄD ARCHIWUM' : 'CHESS ARENA / SINGLE PLAYER'}</div><h1>{gameTitle.split(' ')[0]} <em>{gameTitle.substring(gameTitle.indexOf(' ') + 1)}</em></h1><p>{openedRecord ? 'Analizuj zapisane ruchy i sprawdzaj inne warianty.' : 'Zmierz się z inteligentnym przeciwnikiem. Analizuj, rozwijaj strategię i graj coraz lepiej.'}</p></div><div className="hero-buttons">{openedRecord && <button className="button secondary" onClick={returnToGame}><ArrowLeft size={17}/> Aktualna partia</button>}<button className="button secondary hero-import" onClick={() => setImportOpen(true)}><Upload size={17}/> Import</button><button className="button primary" onClick={newGame}><Plus size={19}/> Nowa partia</button></div></div>
              {engineError && <div className="error-banner"><span><strong>Problem z silnikiem:</strong> {engineError}</span><button onClick={() => { resetEngines(); setRevision(n => n + 1) }}><RotateCcw size={16}/> Ponów</button></div>}
              <div className="play-layout">
                <section className="game-column">
                  <div className="game-heading"><div><span className="game-live"><span className="pulsing-dot"/> {openedRecord ? 'ZAPISANA PARTIA' : finished ? 'PARTIA ZAKOŃCZONA' : 'ROZGRYWKA NA ŻYWO'}</span><h2>{opening.name} <span>{opening.eco}</span></h2></div><div className="game-heading-actions"><button className="icon-button" title="Obróć szachownicę" onClick={() => setOrientation(value => value === 'w' ? 'b' : 'w')}><FlipHorizontal size={19}/></button><button className="icon-button" title="Ustawienia" onClick={() => setSettingsOpen(true)}><MoreHorizontal size={20}/></button></div></div>
                  <ClockCard side={topSide} player={playerTop} active={!finished && !reviewing && turn === topSide} name={playerTop ? 'Ty · Gracz' : 'Stockfish 19'} subtitle={playerTop ? 'Twój profil' : `Poziom ${prefs.level} · ${difficulty.name}`} seconds={clocks[topSide]} time={timeMode} thinking={thinking && topSide !== side}/>
                  <div className="board-composition"><div className="eval-rail" title="Orientacyjna przewaga na podstawie oceny silnika"><div className="eval-light" style={{height: `${prefs.evaluations ? advantage(evaluation) : 50}%`}} /><span className="eval-rail-label">{prefs.evaluations ? formattedEval(evaluation) : '—'}</span></div><ChessBoard game={displayedGame} orientation={orientation} palette={prefs.palette} selected={selected} legal={prefs.legalMoves ? legalSquares : []} hint={hint} disabled={boardDisabled} coordinates={prefs.coordinates} onSelect={selectSquare} onDropMove={tryHumanMove}/></div>
                  <ClockCard side={bottomSide} player={!playerTop} active={!finished && !reviewing && turn === bottomSide} name={!playerTop ? 'Ty · Gracz' : 'Stockfish 19'} subtitle={!playerTop ? 'Twój profil' : `Poziom ${prefs.level} · ${difficulty.name}`} seconds={clocks[bottomSide]} time={timeMode} thinking={thinking && bottomSide !== side}/>
                  <div className="game-toolbar"><div><button onClick={undo} disabled={finished || !liveMoves.length || reviewing} title="Cofnij pełną turę"><RotateCcw size={17}/> Cofnij</button><button onClick={showHint} disabled={finished || reviewing || thinking || !prefs.evaluations}><Lightbulb size={18}/> Podpowiedź</button><button onClick={() => setOrientation(value => value === 'w' ? 'b' : 'w')}><FlipHorizontal size={18}/> Obróć</button></div><div><button className="danger-button" disabled={finished || !!openedRecord || liveMoves.length === 0} onClick={() => { if (window.confirm('Czy na pewno chcesz poddać partię?')) setResultOverride(`${opponentSide}:resign`) }}><Flag size={18}/> Poddaj</button></div></div>
                  {(finished || reviewing || openedRecord) && <div className={`result-notice ${finished ? 'result-final' : ''}`}><div><strong>{openedRecord ? openedRecord.result : finished ? `${status.label} · ${status.outcome === 'win' ? 'Zwycięstwo!' : status.outcome === 'loss' ? 'Przegrana' : 'Remis'}` : 'Tryb przeglądania pozycji'}</strong><small>{openedRecord ? 'Wróć do aktualnej partii, aby kontynuować grę.' : finished ? 'Możesz rozpocząć nową grę lub przeanalizować przebieg.' : 'Wybierz ostatni ruch, aby wrócić do rozgrywki.'}</small></div><button className="button secondary" onClick={openedRecord ? returnToGame : finished ? newGame : () => setReviewIndex(null)}>{openedRecord ? 'Powrót' : finished ? 'Nowa partia' : 'Do gry'}</button></div>}
                  <div className="below-board"><span><ShieldCheck size={15}/> Wszystkie ruchy zgodne z regułami FIDE</span><span><Bot size={15}/> Stockfish 19 · WebAssembly</span></div>
                </section>

                <aside className="info-column">
                  <div className="panel engine-card"><div className="panel-title"><div><Label>TWÓJ PRZECIWNIK</Label><h2>Stockfish <span>19</span></h2></div><div className="bot-emblem"><Bot size={29}/></div></div><p className="muted">Zaawansowany silnik szachowy działający bezpośrednio w Twojej przeglądarce.</p><div className="engine-rating"><div><span>POZIOM TRUDNOŚCI</span><strong>{difficulty.name}</strong><small>Cel siły gry: ok. {difficulty.elo} ELO*</small></div><span className="rating-icon"><Activity size={21}/></span></div><div className="level-track">{LEVELS.map(level => <span className={level.level <= prefs.level ? 'level-filled' : ''} key={level.level}/>)}</div><button className="engine-adjust" onClick={() => setSettingsOpen(true)}><Settings2 size={16}/> Dostosuj przeciwnika <ArrowRight size={16}/></button><small className="engine-disclaimer">*Orientacyjna wartość UCI Elo, nie oficjalny ranking.</small></div>
                  <div className="panel moves-card"><div className="tab-header"><button className={rightTab === 'moves' ? 'tab-active' : ''} onClick={() => setRightTab('moves')}><History size={17}/> Ruchy</button><button className={rightTab === 'insights' ? 'tab-active' : ''} onClick={() => setRightTab('insights')}><Activity size={17}/> Analiza</button></div>
                    {rightTab === 'moves' ? <><div className="move-head"><span>NR</span><span>BIAŁE</span><span>CZARNE</span></div><div className="move-scroll">{sourceMoves.length === 0 ? <div className="moves-empty"><span>♘</span><p>Historia ruchów pojawi się tutaj po rozpoczęciu partii.</p></div> : moveGroups(sourceMoves).map(row => <div className="move-row" key={row.number}><span>{row.number}.</span><button className={displayedIndex === (row.number - 1) * 2 + 1 ? 'move-current' : ''} onClick={() => setReviewIndex((row.number - 1) * 2 + 1)}>{row.white?.san || '—'}</button><button className={displayedIndex === row.number * 2 ? 'move-current' : ''} onClick={() => row.black && setReviewIndex(row.number * 2)}>{row.black?.san || '—'}</button></div>)}<div ref={scrollEnd}/></div><div className="replay-bar"><button title="Na początek" onClick={() => setReviewIndex(0)}><ChevronFirst size={19}/></button><button title="Poprzedni ruch" onClick={() => setReviewIndex(Math.max(0, displayedIndex - 1))}><ArrowLeft size={18}/></button><span>{displayedIndex} / {sourceMoves.length}</span><button title="Następny ruch" onClick={() => setReviewIndex(Math.min(sourceMoves.length, displayedIndex + 1))}><ArrowRight size={18}/></button><button title="Na koniec" onClick={() => setReviewIndex(null)}><ChevronLast size={19}/></button></div></> : <div className="insights-pane"><Label>OCENA POZYCJI</Label><div className="insights-eval"><strong>{prefs.evaluations ? formattedEval(evaluation) : '—'}</strong><span>{evaluation ? `Głębokość ${evaluation.depth}` : 'Oczekiwanie na analizę'}</span></div><div className="advantage-meter"><span style={{ width: `${prefs.evaluations ? advantage(evaluation) : 50}%` }}/></div><p>Wartość dodatnia oznacza przewagę białych, ujemna — czarnych.</p><Label>NAJLEPSZY WARIANT</Label><div className="variation">{evaluation?.pv.length ? pvToSan(displayedFen, evaluation.pv) : 'Silnik analizuje pozycję…'}</div><Label>MATERIAŁ NA SZACHOWNICY</Label><div className="material-row"><span>Białe</span><strong>{material.w} pkt</strong></div><div className="material-row"><span>Czarne</span><strong>{material.b} pkt</strong></div></div>}
                  </div>
                  <div className="panel quick-card"><div className="panel-title"><div><Label>AKCJE PARTII</Label><h2>Zapis i udostępnianie</h2></div><BookOpen size={19}/></div><div className="quick-grid"><button onClick={() => { if (!navigator.clipboard) { notify('Schowek jest niedostępny w tej przeglądarce.'); return } void navigator.clipboard.writeText(displayedFen).then(() => notify('FEN skopiowany do schowka.')).catch(() => notify('Przeglądarka zablokowała schowek.')) }}><Copy size={17}/> Kopiuj FEN</button><button onClick={() => downloadText('chess-arena-partia.pgn', sourceGame.pgn() || '*')}><ArrowDownToLine size={17}/> Eksport PGN</button></div></div>
                  <div className="tip-strip"><Sparkles size={19}/><div><strong>Wskazówka trenera</strong><p>{opening.name === 'Pozycja niestandardowa' ? 'Rozwijaj figury i walcz o kontrolę centrum.' : `Rozgrywasz: ${opening.name}. Zwracaj uwagę na rozwój figur i bezpieczeństwo króla.`}</p></div></div>
                </aside>
              </div>
            </>
          )}
          <footer className="site-footer"><span>© 2026 Chess Arena · Projekt edukacyjny</span><span>Silnik Stockfish 19 • Reguły chess.js • GPL-3.0</span></footer>
        </div>
      </main>

      {toast && <div className="toast"><Check size={17}/> {toast}<button onClick={() => setToast('')} aria-label="Zamknij"><X size={14}/></button></div>}
      {promotion && <Dialog title="Promocja pionka" subtitle="Wybierz figurę, w którą chcesz zamienić pionka." onClose={() => setPromotion(null)}><div className="promotion-choices">{(['q', 'r', 'b', 'n'] as const).map(piece => <button key={piece} onClick={() => commitMove(promotion.from, promotion.to, piece)}><span>{({ q:'♕', r:'♖', b:'♗', n:'♘' })[piece]}</span>{({ q:'Hetman', r:'Wieża', b:'Goniec', n:'Skoczek' })[piece]}</button>)}</div></Dialog>}
      {settingsOpen && <Dialog title="Ustawienia rozgrywki" subtitle="Dopasuj doświadczenie do swojego stylu gry." onClose={() => setSettingsOpen(false)} wide><div className="settings-content"><div className="setting-section"><Label>SIŁA PRZECIWNIKA</Label><div className="difficulty-grid">{LEVELS.map(level => <button key={level.level} className={`difficulty-choice ${prefs.level === level.level ? 'choice-active' : ''}`} onClick={() => setPrefs(p => ({ ...p, level: level.level }))}><strong>{level.level}. {level.name}</strong><small>~{level.elo} Elo · {level.subtitle}</small></button>)}</div></div><div className="setting-section"><Label>KOLOR FIGUR</Label><div className="option-group">{([['w','Białe ♙'], ['b','Czarne ♟'], ['random','Losowo ⇄']] as const).map(([value,label]) => <button key={value} className={prefs.color === value ? 'option-selected' : ''} onClick={() => setPrefs(p => ({...p, color:value}))}>{label}</button>)}</div></div><div className="setting-section"><Label>TEMPO GRY</Label><div className="option-group">{(Object.keys(TIME_OPTIONS) as TimeChoice[]).map(value => <button key={value} className={prefs.time === value ? 'option-selected' : ''} onClick={() => setPrefs(p => ({...p, time:value}))}>{TIME_OPTIONS[value].short}</button>)}</div></div><div className="setting-section"><Label>WYGLĄD SZACHOWNICY</Label><div className="palette-group">{([['forest','Leśna'], ['walnut','Orzech'], ['ocean','Ocean']] as [Palette,string][]).map(([value,label]) => <button key={value} className={prefs.palette === value ? 'palette-selected' : ''} onClick={() => setPrefs(p => ({...p, palette:value}))}><span className={`palette-preview board-${value}`}/>{label}</button>)}</div></div><div className="setting-section"><Label>PREFERENCJE</Label><div className="toggle-list">{([{key:'sound',name:'Dźwięki ruchów',icon:Volume2}, {key:'legalMoves',name:'Podświetlanie legalnych ruchów',icon:Target}, {key:'evaluations',name:'Analiza silnika i podpowiedzi',icon:Activity}, {key:'coordinates',name:'Współrzędne szachownicy',icon:GraduationCap}] as const).map(({key,name,icon:Icon}) => <label key={key} className="toggle-row"><span><Icon size={17}/> {name}</span><input type="checkbox" checked={prefs[key]} onChange={event => setPrefs(p => ({...p,[key]:event.target.checked}))}/><span className="toggle-control"/></label>)}</div></div><div className="modal-actions"><button className="button secondary" onClick={() => setSettingsOpen(false)}>Zachowaj obecną partię</button><button className="button primary" onClick={newGame}><Play size={17}/> Zapisz i rozpocznij nową</button></div></div></Dialog>}
      {importOpen && <Dialog title="Import partii lub pozycji" subtitle="Wklej PGN całej partii albo FEN konkretnej pozycji." onClose={() => { setImportOpen(false); setImportError('') }}><textarea className="import-textarea" placeholder={'Przykładowy FEN:\nrnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'} value={importText} onChange={event => setImportText(event.target.value)} rows={6}/>{importError && <p className="input-error">{importError}</p>}<div className="modal-actions"><button className="button secondary" onClick={() => setImportOpen(false)}>Anuluj</button><button className="button primary" onClick={importPosition}><Upload size={17}/> Importuj</button></div></Dialog>}
      {helpOpen && <Dialog title="Jak grać?" subtitle="Szybki przewodnik po Chess Arena." onClose={() => setHelpOpen(false)}><div className="help-list"><div><Swords size={20}/><p><strong>Rozgrywka</strong>Kliknij figurę, a następnie wybrane pole. Na komputerze możesz także przeciągać figury.</p></div><div><Lightbulb size={20}/><p><strong>Podpowiedzi</strong>Silnik wskazuje proponowany ruch. Podpowiedź działa po uzyskaniu pierwszego wyniku analizy.</p></div><div><History size={20}/><p><strong>Przeglądanie ruchów</strong>Użyj strzałek ← / → na klawiaturze lub przycisków pod historią. Klawisz F obraca szachownicę.</p></div><div><Clock3 size={20}/><p><strong>Zegary</strong>Wybierz tempo w ustawieniach. Bonus sekund naliczany jest po każdym wykonanym ruchu.</p></div><div><BookOpen size={20}/><p><strong>Archiwum</strong>Partie zapisują się lokalnie. Eksport PGN pozwala zachować je na stałe.</p></div></div><button className="button primary full-width" onClick={() => setHelpOpen(false)}><Check size={16}/> Rozumiem</button></Dialog>}
    </div>
  )
}
