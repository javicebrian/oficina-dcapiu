import type { ViewName } from './scene/Viewer'

// The opening state can be sent in the link, e.g.
//   ?vista=planta&techo=si&rotulos=si&mobiliario=no&controles=no
// and the address bar keeps up as things change, so copying it shares the
// current state. Only values that differ from the defaults are written.
// `controles` (the sidebar open or folded) defaults by screen: open on wide
// ones, folded on phones; it is written only when it differs from that.

export interface UrlState {
  view: ViewName
  ceiling: boolean
  labels: boolean
  furniture: boolean
  panel: boolean // the controls sidebar open
}

// Opening view: from above, ceiling off, room labels on.
export const DEFAULTS: UrlState = {
  view: 'aerial',
  ceiling: false,
  labels: true,
  furniture: true,
  // The scene needs the room on a phone.
  panel: matchMedia('(min-width: 640px)').matches,
}

const VIEW_PARAM: Record<ViewName, string> = { aerial: 'aerea', top: 'planta', kitchen: 'cocina', terrace: 'terraza', street: 'calle' }
const FLAGS = { ceiling: 'techo', labels: 'rotulos', furniture: 'mobiliario', panel: 'controles' } as const

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function flag(v: string | null): boolean | undefined {
  if (v == null) return undefined
  const s = fold(v)
  if (['1', 'si', 'on', 'true'].includes(s)) return true
  if (['0', 'no', 'off', 'false'].includes(s)) return false
  return undefined
}

export function readUrlState(): UrlState {
  const q = new URLSearchParams(location.search)
  const vista = fold(q.get('vista') ?? '')
  const view = (Object.keys(VIEW_PARAM) as ViewName[]).find((k) => VIEW_PARAM[k] === vista) ?? DEFAULTS.view
  const out: UrlState = { ...DEFAULTS, view }
  for (const [key, param] of Object.entries(FLAGS) as [keyof typeof FLAGS, string][]) out[key] = flag(q.get(param)) ?? DEFAULTS[key]
  return out
}

/** Mirror the state into the address bar, without adding history entries. */
export function writeUrlState(s: Partial<UrlState>) {
  const q = new URLSearchParams(location.search)
  if (s.view && s.view !== DEFAULTS.view) q.set('vista', VIEW_PARAM[s.view])
  else q.delete('vista')
  for (const [key, param] of Object.entries(FLAGS) as [keyof typeof FLAGS, string][]) {
    const v = s[key]
    if (v === undefined || v === DEFAULTS[key]) q.delete(param)
    else q.set(param, v ? 'si' : 'no')
  }
  const search = q.toString()
  const url = `${location.pathname}${search ? `?${search}` : ''}${location.hash}`
  try {
    if (url !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(history.state, '', url)
  } catch {
    // a document without an address of its own (an embedding iframe)
  }
}
