import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import type { ReactNode } from 'react'
import { FULL_HEIGHT, LEVELS, areaM2, rooms } from '../data/flat'
import type { SunSetting } from '../App'
import { compassPoint, daylight, hhmm, houseClock, sunPosition } from '../scene/sun'
import type { ViewName } from '../scene/Viewer'
import { m2 } from './format'
import { HouseSummary } from './HouseSummary'
import { RoomDetails } from './RoomCard'

interface Props {
  ceiling: boolean
  setCeiling: (v: boolean) => void
  cut: number
  setCut: (v: number) => void
  labels: boolean
  setLabels: (v: boolean) => void
  furniture: boolean
  setFurniture: (v: boolean) => void
  selected: string | null
  onRoom: (id: string) => void
  onDeselect: () => void
  frameOnClick: boolean
  setFrameOnClick: (v: boolean) => void
  view: ViewName | null // last preset chosen; null after focusing a room or orbiting
  onView: (v: ViewName) => void
  onAllDoors: (open: boolean) => void
  onAllLights: (on: boolean) => void
  furnitureShown: boolean // the lamps are furniture
  sun: SunSetting
  sunAt: number
  setSun: (v: SunSetting) => void
  open: boolean
  setOpen: (v: boolean) => void
}

const VIEWS: [ViewName, string][] = [
  ['aerial', 'Aérea'],
  ['top', 'Planta'],
  ['kitchen', 'Cocina'],
  ['terrace', 'Terraza'],
  ['street', 'Calle'],
]

function Section({ title, children, collapsible = false, defaultOpen = true, extra }: {
  title: string
  children: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  extra?: ReactNode // shown next to the title, e.g. a count while collapsed
}) {
  const [open, setOpen] = useState(defaultOpen)
  const heading = <h3 className="text-[11px] font-medium tracking-wide text-muted uppercase">{title}</h3>
  return (
    <section className="border-t border-line px-4 py-3.5 first:border-t-0">
      {collapsible ? (
        <button className="-my-1 flex w-full items-center justify-between rounded-full py-1" onClick={() => setOpen(!open)} aria-expanded={open}>
          {heading}
          <span className="flex items-center gap-2 text-xs text-muted">
            {extra}
            <svg viewBox="0 0 12 12" className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
              <path d="M2 4.5 6 8l4-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      ) : (
        <div className="mb-2">{heading}</div>
      )}
      {(!collapsible || open) && <div className={collapsible ? 'mt-2' : ''}>{children}</div>}
    </section>
  )
}

function Range({ value, min, max, step, onChange, track }: {
  value: number; min: number; max: number; step: number; onChange: (v: number) => void
  track?: string // a background for the track instead of the tinted fill
}) {
  const fill = `${((value - min) / (max - min)) * 100}%`
  return (
    <input
      type="range"
      className="range mt-1"
      style={{ '--fill': fill, ...(track && { '--track': track }) } as React.CSSProperties}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-sm">
      {label}
      <input type="checkbox" className="switch" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

const dayLabel = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** Sunlight controls. Times are always the flat's (Spain), wherever the viewer is. */
function SunControls({ sun, at, setSun }: { sun: SunSetting; at: number; setSun: (v: SunSetting) => void }) {
  const clock = houseClock(at)
  const { rise, set } = useMemo(() => daylight(clock.date), [clock.date])
  const pos = sunPosition(at)
  const [y, mo, d] = clock.date.split('-').map(Number)
  const pct = (min: number | null, fallback: number) => `${(((min ?? fallback) / 1440) * 100).toFixed(2)}%`
  // The track shows the day: night grey, daylight amber, between sunrise and sunset.
  const track = `linear-gradient(90deg, rgb(60 70 90 / 0.35) ${pct(rise, 0)}, #f5b85a ${pct(rise, 0)} ${pct(set, 1440)}, rgb(60 70 90 / 0.35) ${pct(set, 1440)})`
  const alt = Math.round((pos.altitude * 180) / Math.PI)
  const az = Math.round((pos.azimuth * 180) / Math.PI)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-semibold tabular-nums">{hhmm(clock.minutes)}</span>
        <span className="text-xs text-muted">{dayLabel.format(Date.UTC(y, mo - 1, d))}</span>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted">
        {sun.live && <span className="size-1.5 rounded-full bg-on" aria-hidden />}
        {sun.live ? 'Ahora en Bormujos' : 'Hora en Bormujos'} (España peninsular)
      </p>
      <Range value={clock.minutes} min={0} max={1435} step={5} track={track}
        onChange={(v) => setSun({ live: false, date: clock.date, minutes: v })} />
      <div className="flex justify-between text-[11px] text-muted tabular-nums">
        <span>Amanece {rise == null ? '—' : hhmm(rise)}</span>
        <span>Anochece {set == null ? '—' : hhmm(set)}</span>
      </div>
      <div className="mt-2 flex gap-2">
        <input
          type="date"
          aria-label="Fecha"
          className="glass-btn min-w-0 flex-1 py-1.5 text-xs tabular-nums"
          value={clock.date}
          onChange={(e) => e.target.value && setSun({ live: false, date: e.target.value, minutes: clock.minutes })}
        />
        <button className="glass-btn text-xs font-medium disabled:opacity-50" disabled={sun.live} onClick={() => setSun({ live: true })}>
          Ahora
        </button>
      </div>
      <div className="seg mt-2">
        <button aria-pressed={!sun.live && clock.minutes === 13 * 60} onClick={() => setSun({ live: false, date: clock.date, minutes: 13 * 60 })}>Día</button>
        <button aria-pressed={!sun.live && clock.minutes === 22 * 60 + 30} onClick={() => setSun({ live: false, date: clock.date, minutes: 22 * 60 + 30 })}>Noche</button>
      </div>
      <p className="mt-2 text-xs text-muted">
        {alt > 0 ? `Sol a ${alt}° de altura, rumbo ${az}° (${compassPoint(pos.azimuth)}).` : 'De noche: enciende las luces para ver el piso.'}
      </p>
    </div>
  )
}

const foldIcon = (
  <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
    <path d="M10 3.5 5.5 8 10 12.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** Everything in one glass bar on the left, folding down to a capsule. */
export function Sidebar(p: Props) {
  const { open, setOpen } = p
  // The selected room's card sits at the top: bring it into view on selection.
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (p.selected) scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [p.selected])
  const cutLabel = p.cut >= FULL_HEIGHT ? 'sin corte' : `${(p.cut / 100).toFixed(2).replace('.', ',')} m`

  return (
    <div className="pointer-events-none absolute z-10 top-4 bottom-4 left-4 flex w-[min(20rem,calc(100%-2rem))] flex-col items-start">
      <div className={`flex items-center gap-2 ${open ? 'hidden' : ''}`}>
        <button
          className="glass glass-btn pointer-events-auto flex items-center gap-2 py-2 pr-3 pl-4 text-sm font-semibold"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-label="Mostrar controles"
        >
          Piso Tipo D
          <svg viewBox="0 0 16 16" className="size-4 text-muted" aria-hidden>
            <path d="M2 4.5h7M12 4.5h2M2 11.5h2M7 11.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="10.5" cy="4.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="5.5" cy="11.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
      {/* Hidden rather than unmounted, so sections keep their folded state.
          The glass (and its rim) is the outer box; only the inside scrolls. */}
      <aside className={`glass pointer-events-auto flex max-h-full min-h-0 w-full flex-col overflow-hidden ${open ? '' : 'hidden'}`}>
        <div className="flex items-start justify-between gap-2 border-b border-line px-4 pt-4 pb-3">
          <HouseSummary />
          <button
            className="glass-btn -mt-1 -mr-1 flex size-8 flex-none items-center justify-center p-0"
            onClick={() => setOpen(false)}
            aria-expanded={true}
            aria-label="Plegar controles"
          >
            {foldIcon}
          </button>
        </div>
        <div ref={scroller} className="glass-scroll min-h-0 overflow-y-auto">
          {p.selected && (
            <Section title="Estancia seleccionada">
              <RoomDetails id={p.selected} onClose={p.onDeselect} onFocus={() => p.onRoom(p.selected!)} />
            </Section>
          )}

          <Section title="Vista">
            <div className="seg">
              {VIEWS.map(([id, label]) => (
                <button key={id} aria-pressed={p.view === id} onClick={() => p.onView(id)}>
                  {label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Sol">
            <SunControls sun={p.sun} at={p.sunAt} setSun={p.setSun} />
          </Section>

          <Section title="Maqueta">
            <Toggle label="Techo" value={p.ceiling && p.cut > LEVELS.ceiling} onChange={(v) => {
              p.setCeiling(v)
              if (v) p.setCut(FULL_HEIGHT)
            }} />
            <Toggle label="Rótulos de estancias" value={p.labels} onChange={p.setLabels} />
            <Toggle label="Mobiliario" value={p.furniture} onChange={p.setFurniture} />
            <Toggle label="Encuadrar al pinchar una estancia" value={p.frameOnClick} onChange={p.setFrameOnClick} />
            <label className="mt-3 block text-sm">
              <span className="flex justify-between">
                Altura de corte <span className="text-muted tabular-nums">{cutLabel}</span>
              </span>
              <Range value={p.cut} min={30} max={FULL_HEIGHT} step={5} onChange={p.setCut} />
            </label>
            <div className="seg mt-2">
              <button aria-pressed={p.cut === 120} onClick={() => p.setCut(120)}>Corte a 1,20 m</button>
              <button aria-pressed={p.cut >= FULL_HEIGHT} onClick={() => p.setCut(FULL_HEIGHT)}>Sin corte</button>
            </div>
          </Section>

          <Section title="Puertas">
            <p className="mb-2 text-xs text-muted">
              Haz clic en una puerta o ventana para abrirla o cerrarla. La columna alta de la cocina también se abre: dentro está el termo.
            </p>
            <div className="flex gap-2">
              <button className="glass-btn flex-1 text-xs" onClick={() => p.onAllDoors(true)}>Abrir todas</button>
              <button className="glass-btn flex-1 text-xs" onClick={() => p.onAllDoors(false)}>Cerrar todas</button>
            </div>
          </Section>

          <Section title="Luces">
            <p className="mb-2 text-xs text-muted">
              {p.furnitureShown
                ? 'Haz clic en una lámpara o en los focos del techo para encenderlos o apagarlos. Se nota más de noche.'
                : 'Las lámparas son parte del mobiliario: actívalo para verlas.'}
            </p>
            <div className="flex gap-2">
              <button className="glass-btn flex-1 text-xs disabled:opacity-50" disabled={!p.furnitureShown} onClick={() => p.onAllLights(true)}>Encender todas</button>
              <button className="glass-btn flex-1 text-xs disabled:opacity-50" disabled={!p.furnitureShown} onClick={() => p.onAllLights(false)}>Apagar todas</button>
            </div>
          </Section>

          <Section title="Estancias" collapsible defaultOpen={false} extra={<span className="tabular-nums">{rooms.length}</span>}>
            <ul className="-mx-2 text-sm">
              {[...rooms].sort((a, b) => a.name.localeCompare(b.name, 'es')).map((r) => (
                <li key={r.id}>
                  <button
                    className={`flex w-full justify-between rounded-xl px-2.5 py-1.5 text-left transition-colors hover:bg-hover ${p.selected === r.id ? 'bg-white/75 font-medium shadow-sm' : ''}`}
                    onClick={() => p.onRoom(r.id)}
                  >
                    <span>{r.name}</span>
                    <span className="text-muted tabular-nums">{m2(areaM2(r.poly))}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </aside>
    </div>
  )
}
