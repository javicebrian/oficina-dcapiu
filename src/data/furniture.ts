// The switchable lights, one entry per switch. Where they hang and what they
// look like is in scene/Furniture.tsx; this list feeds the "all lights"
// buttons. None of them are on the sales plan: the kitchen's downlights and
// LED strip follow the renders, the rest is ours.

export const lights = [
  { id: 'salon', name: 'Salón' },
  { id: 'pie', name: 'Lámpara de pie' },
  { id: 'comedor', name: 'Comedor' },
  { id: 'cocina', name: 'Cocina' },
  { id: 'cocina-led', name: 'Tira LED de la cocina' },
  { id: 'pasillo', name: 'Pasillo' },
  { id: 'dorm1', name: 'Dormitorio principal' },
  { id: 'mesillas', name: 'Mesillas' },
  { id: 'dorm2', name: 'Dormitorio 2' },
  { id: 'dorm3', name: 'Dormitorio 3' },
  { id: 'bano1', name: 'Baño principal' },
  { id: 'bano2', name: 'Baño 2' },
  { id: 'terraza', name: 'Terraza' },
] as const

export type LightId = (typeof lights)[number]['id']

// Cupboards that open on a click, sharing the doors' open/closed state.
export const cabinets = [{ id: 'termo', name: 'Columna del termo' }] as const
