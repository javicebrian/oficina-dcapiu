import { AREAS } from '../data/flat'
import { m2 } from './format'

/** Title block at the top of the sidebar. */
export function HouseSummary() {
  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight">Piso Tipo D</h1>
      <p className="text-xs text-muted">Bormujos · planta segunda · 3 dormitorios, 2 baños</p>
      <dl className="mt-2 flex gap-4 text-xs">
        <div>
          <dt className="text-muted">Útil (aprox.)</dt>
          <dd className="font-medium tabular-nums">{m2(AREAS.useful)}</dd>
        </div>
        <div>
          <dt className="text-muted">Terraza</dt>
          <dd className="font-medium tabular-nums">{m2(AREAS.terrace)}</dd>
        </div>
      </dl>
      <p className="mt-2 hidden text-[11px] leading-snug text-muted sm:block">
        Arrastra para girar · botón derecho para desplazar · rueda para acercar · clic en una estancia
      </p>
    </div>
  )
}
