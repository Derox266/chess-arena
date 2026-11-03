import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Dialog({ title, subtitle, onClose, children, wide = false }: {
  title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className={`modal-card ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-heading">
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button type="button" className="icon-button" aria-label="Zamknij" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
