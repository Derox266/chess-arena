import { Bot, Crown, Timer } from 'lucide-react'
import type { Side, TimeChoice } from '../types'
import { formatClock } from '../lib/chess-utils'

export function ClockCard({ side, player, active, name, subtitle, seconds, time, thinking }: {
  side: Side; player: boolean; active: boolean; name: string; subtitle: string;
  seconds: number; time: TimeChoice; thinking?: boolean
}) {
  return (
    <div className={`clock-card ${active ? 'clock-active' : ''}`}>
      <div className={`avatar ${player ? 'avatar-player' : 'avatar-bot'}`}>{player ? <Crown size={22} /> : <Bot size={25} />}</div>
      <div className="clock-person">
        <span className="clock-name">{name} <span className={`side-dot ${side}`} /></span>
        <span className="clock-subtitle">{thinking && !player ? 'Oblicza najlepszy ruch…' : subtitle}</span>
      </div>
      <div className={`clock-time ${seconds <= 20 && time !== 'classic' ? 'clock-low' : ''}`}>
        {time === 'classic' ? <Timer size={19} /> : formatClock(seconds)}
      </div>
    </div>
  )
}
