import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { advantage, describeResult, detectOpening, formatClock, moveGroups, pvToSan } from './chess-utils'

describe('Pomocnicze funkcje Chess Arena', () => {
  it('rozpoznaje klasyczny debiut hiszpański', () => {
    expect(detectOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']).name).toBe('Partia hiszpańska')
  })
  it('poprawnie formatowane zegary', () => {
    expect(formatClock(61)).toBe('01:01')
    expect(formatClock(-10)).toBe('00:00')
  })
  it('grupuje ruchy na pary białe/czarne', () => {
    const game = new Chess()
    game.move('e4'); game.move('e5'); game.move('Nf3')
    expect(moveGroups(game.history({ verbose: true })).map(x => x.number)).toEqual([1, 2])
  })
  it('wykrywa szach-mat oraz zwycięzcę', () => {
    const game = new Chess()
    for (const san of ['f3', 'e5', 'g4', 'Qh4#']) game.move(san)
    expect(describeResult(game, null, 'b')).toMatchObject({ label: 'Szach-mat', outcome: 'win', finished: true })
  })
  it('tłumaczy legalną linię UCI na notację SAN', () => {
    expect(pvToSan(new Chess().fen(), ['e2e4', 'e7e5', 'g1f3'])).toBe('e4 e5 Nf3')
  })
  it('ogranicza pasek przewagi do bezpiecznego przedziału', () => {
    expect(advantage({cp:12000,mate:null,depth:10,pv:[],time:0})).toBeLessThanOrEqual(95)
  })
})
