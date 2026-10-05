import { areaM2, rooms } from '../data/flat'
import type { RoomUse } from '../data/flat'
import { bounds } from '../scene/geometry'
import { m, m2 } from './format'

const USE: Record<RoomUse, string> = {
  day: 'Zona de día',
  night: 'Zona de noche',
  wet: 'Zona húmeda',
  hall: 'Distribuidor',
  outdoor: 'Exterior',
}

interface Props {
  id: string
  onClose: () => void
  onFocus: () => void
}

/** The selected room's data: inside the sidebar, or floating when it is folded. */
export function RoomDetails({ id, onClose, onFocus }: Props) {
  const room = rooms.find((r) => r.id === id)
  if (!room) return null
  const b = bounds(room.poly)
  const rect = room.poly.length === 4
  return (
    <div aria-live="polite">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] tracking-wide text-muted uppercase">{USE[room.use]}</p>
          <h2 className="text-base font-semibold">{room.name}</h2>
        </div>
        <button className="glass-btn -mr-1 flex size-7 items-center justify-center p-0 text-xs" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">Superficie</dt>
        <dd className="text-right font-medium tabular-nums">{m2(areaM2(room.poly))}</dd>
        <dt className="text-muted">{rect ? 'Medidas' : 'Envolvente'}</dt>
        <dd className="text-right tabular-nums">
          {m(b.x1 - b.x0)} × {m(b.y1 - b.y0)}
        </dd>
      </dl>
      <p className="mt-2 text-[11px] leading-snug text-muted">
        Calculadas sobre el plano comercial, que es orientativo: a cara interior de muro, redondeadas.
      </p>
      <button className="glass-btn mt-3 w-full text-sm font-medium" onClick={onFocus}>
        Encuadrar
      </button>
    </div>
  )
}

export function RoomCard(p: Props) {
  return (
    <section className="glass pointer-events-auto absolute z-10 bottom-4 left-4 w-[calc(100%-2rem)] px-4 py-3 sm:w-72">
      <RoomDetails {...p} />
    </section>
  )
}
