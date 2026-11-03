import type { Square, Chess } from 'chess.js'
import type { Side, Palette } from '../types'
import { FILES, PIECES } from '../lib/chess-utils'

const NAMES: Record<string, string> = { p: 'pion', n: 'skoczek', b: 'goniec', r: 'wieża', q: 'hetman', k: 'król' }

interface BoardProps {
  game: Chess
  orientation: Side
  palette: Palette
  selected: Square | null
  legal: Square[]
  hint: Square[]
  disabled: boolean
  coordinates: boolean
  onSelect: (square: Square) => void
  onDropMove: (from: Square, to: Square) => void
}

export function ChessBoard({ game, orientation, palette, selected, legal, hint, disabled, coordinates, onSelect, onDropMove }: BoardProps) {
  const ranks = orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]
  const files = orientation === 'w' ? FILES.split('') : FILES.split('').reverse()
  const last = game.history({ verbose: true }).at(-1)
  const kingInCheck = game.isCheck() ? game.board().flat().find(piece => piece?.type === 'k' && piece.color === game.turn()) : null
  return (
    <div className={`chess-board board-${palette}`} role="grid" aria-label="Szachownica" aria-disabled={disabled}>
      {ranks.flatMap((rank, rowIndex) => files.map((file, fileIndex) => {
        const square = `${file}${rank}` as Square
        const piece = game.get(square)
        const light = (FILES.indexOf(file) + rank) % 2 === 0
        const target = legal.includes(square)
        const isLast = last?.from === square || last?.to === square
        const inCheck = !!kingInCheck && piece?.type === 'k' && piece.color === game.turn()
        return (
          <button
            type="button"
            role="gridcell"
            key={square}
            data-square={square}
            className={[
              'board-square', light ? 'square-light' : 'square-dark',
              isLast ? 'square-last' : '', selected === square ? 'square-selected' : '',
              inCheck ? 'square-check' : '', hint.includes(square) ? 'square-hint' : '',
            ].filter(Boolean).join(' ')}
            aria-label={`${square}${piece ? `, ${NAMES[piece.type]}, ${piece.color === 'w' ? 'białe' : 'czarne'}` : ', puste'}`}
            disabled={disabled}
            onClick={() => onSelect(square)}
            onDragOver={event => { if (!disabled) event.preventDefault() }}
            onDrop={event => {
              event.preventDefault()
              if (disabled) return
              const from = event.dataTransfer.getData('text/plain') as Square
              if (/^[a-h][1-8]$/.test(from)) onDropMove(from, square)
            }}
          >
            {coordinates && fileIndex === 0 && <span className="board-rank">{rank}</span>}
            {coordinates && rowIndex === 7 && <span className="board-file">{file}</span>}
            {target && <span className={`target-indicator${piece ? ' target-capture' : ''}`} />}
            {piece && <span
              className={`chess-piece piece-${piece.color}`}
              draggable={!disabled}
              onDragStart={event => {
                event.dataTransfer.setData('text/plain', square)
                event.dataTransfer.effectAllowed = 'move'
              }}
              aria-hidden="true"
            >{PIECES[piece.color][piece.type]}</span>}
            {hint.includes(square) && <span className="hint-marker" />}
          </button>
        )
      }))}
    </div>
  )
}
