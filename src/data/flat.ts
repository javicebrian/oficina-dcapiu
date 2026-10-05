// Hand-curated model of the flat, read off the scanned sales plan
// (docs/DOC160425-16042025135004.pdf, page 2: "Distribución Escalera 1,
// Vivienda 4124, Tipo D", the sheet with dimensions). The scan is a raster,
// so nothing is extracted: every line below was read by eye on the 200 dpi
// page image, in its pixels, and px() turns that into plan centimetres.
//
// Scale: the graphic bar runs 0–10 m over 1016 px, so 1 px = 0.985 cm. The
// written dimensions agree to within a couple of cm (master bedroom 3.97,
// en-suite 2.20, salón 5.92, 6.20 across the north rooms). The sheet itself
// says it is indicative ("orientativa"); so is this model.
//
// Plan frame: centimetres, x -> east, y -> south (page-down), origin at scan
// pixel (380, 320), just outside the flat's NW corner. Heights: cm above the
// finished floor.

export type Pt = [number, number]
export type Rect = [number, number, number, number] // x0, y0, x1, y1 (plan cm)

const K = 0.985 // cm per scan pixel, from the scale bar
const X0 = 380
const Y0 = 320
const r1 = (v: number) => Math.round(v * 10) / 10

/** A point read on the scan (pixels) in plan centimetres. */
export const px = (x: number, y: number): Pt => [r1((x - X0) * K), r1((y - Y0) * K)]
/** A rectangle read on the scan (pixels). */
export const pxRect = (x0: number, y0: number, x1: number, y1: number): Rect => [...px(x0, y0), ...px(x1, y1)]
/** A length read on the scan (pixels) in cm. */
export const pxLen = (d: number) => r1(d * K)

export const rectPts = ([x0, y0, x1, y1]: Rect): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

// --- Site ----------------------------------------------------------------------
// Bormujos (Sevilla), by the Hospital San Juan de Dios del Aljarafe: town
// coordinates only, never the building's. The plan's north arrow points
// straight up the sheet, taken as true north.
export const SITE = { lat: 37.37, lon: -6.07, tz: 'Europe/Madrid', trueNorth: 0 }

// --- Levels --------------------------------------------------------------------
export const LEVELS = {
  ceiling: 260, // not on the plan; a usual clear height for a new-build flat
  slabTop: 285, // the floor slab of the flat above
  floorSlab: 30, // the slab the flat stands on, drawn below 0
  doorHead: 210,
  windowHead: 215,
  railing: 100, // terrace balustrade
}
// Section-cut slider maximum: at this height nothing is clipped.
export const FULL_HEIGHT = LEVELS.slabTop

// The flat's outer outline (outside faces of the walls), and the terrace.
export const OUTLINE = pxRect(392, 337, 1075, 1690)
export const TERRACE = pxRect(440, 1690, 795, 1785)

// --- Walls -----------------------------------------------------------------------
// Rectangular solids, floor to ceiling, read as the double lines on the
// sheet. Openings are the gaps left between them; the pieces never overlap,
// so no two top faces fight. `pillar`s are the structure's columns, drawn
// boxed with a cross on the plan; they stand slightly proud of the walls.
export interface Wall {
  rect: Rect
  kind?: 'wall' | 'pillar' | 'shaft'
}

const w = (x0: number, y0: number, x1: number, y1: number, kind: Wall['kind'] = 'wall'): Wall => ({ rect: pxRect(x0, y0, x1, y1), kind })

export const walls: Wall[] = [
  // North: party wall with the next flat, no openings.
  w(392, 337, 1075, 357),
  // East façade, gaps for five windows; three pillars in it.
  w(1045, 357, 1075, 432),
  w(1045, 555, 1075, 618),
  w(1028, 618, 1075, 660, 'pillar'),
  w(1045, 660, 1075, 707),
  w(1045, 828, 1075, 965),
  w(1045, 1098, 1075, 1153),
  w(1035, 1153, 1075, 1205, 'pillar'),
  w(1045, 1315, 1075, 1430),
  w(1045, 1555, 1075, 1645),
  w(1025, 1645, 1075, 1690, 'pillar'),
  // South façade: the sliding door to the terrace between 497 and 700.
  w(420, 1665, 497, 1690),
  w(700, 1665, 1025, 1690),
  // West: the en-suite (window to the light well), the hall with the front
  // door to the landing, the jog where the stair core steps in, the salón.
  w(392, 357, 410, 430),
  w(392, 525, 410, 545),
  w(400, 545, 418, 925),
  w(400, 1008, 418, 1040),
  w(400, 1040, 442, 1062),
  w(420, 1062, 442, 1665),

  // En-suite: east wall, south wall with its door (515–590).
  w(630, 357, 642, 535),
  w(410, 535, 515, 545),
  w(590, 535, 642, 545),
  // Master bedroom to dormitorio 2, door at the west end (418–500).
  w(500, 630, 510, 648),
  w(510, 625, 555, 668, 'pillar'),
  w(555, 630, 1028, 648),
  // Corridor's east side: doors to dormitorio 2 (668–740) and baño 2 (838–905).
  w(508, 740, 520, 838),
  w(508, 905, 520, 1012),
  // Baño 2: north, east and south walls.
  w(520, 805, 800, 815),
  w(790, 815, 800, 1012),
  w(520, 1005, 790, 1012),
  // Dormitorio 2 to dormitorio 3.
  w(800, 880, 1045, 890),
  // Dormitorio 3's west wall to the hall, door 1062–1135, and the shaft
  // next to its wardrobe.
  w(545, 1012, 552, 1062),
  w(545, 1135, 552, 1150),
  w(695, 1012, 745, 1058, 'shaft'),
  // Dormitorio 3 to the kitchen.
  w(545, 1150, 1035, 1163),
  // Kitchen's west end: a pillar and a services shaft, boxed in together.
  w(545, 1163, 620, 1237, 'shaft'),
  // Kitchen to salón: a partition from the east wall to the peninsula.
  w(728, 1325, 1045, 1333),
]

// --- Openings ------------------------------------------------------------------
// `a`–`b` runs along the wall's centreline across the gap, `t` is the wall
// thickness. sill/head are not on the plan: doors to 210, windows 90–215
// (kitchen 105, over the worktop; en-suite 110).

// How a door's leaves move. `side` is the side of a→b the leaf ends up on
// when open: +1 is the direction (−dy, dx) for a→b = (dx, dy) on the plan
// (y down), i.e. south of an eastward a→b, west of a southward one.
export type Leaf =
  | { op: 'swing'; hinge: 'a' | 'b'; side: 1 | -1 }
  | { op: 'slide'; panes: 2 } // two sashes, one slides over the other

export type Finish = 'white' | 'wood' | 'glass'

export interface DoorSpec {
  id: string
  name: string
  leaf: Leaf
  finish: Finish
}

export interface Opening {
  a: Pt
  b: Pt
  t: number
  kind: 'door' | 'window'
  sill: number
  head: number
  door: DoorSpec
}

const H = LEVELS.windowHead
const door = (id: string, name: string, a: Pt, b: Pt, t: number, leaf: Leaf, finish: Finish = 'white'): Opening =>
  ({ a, b, t, kind: 'door', sill: 0, head: LEVELS.doorHead, door: { id, name, leaf, finish } })
const eastWindow = (id: string, name: string, y0: number, y1: number, sill = 90): Opening =>
  ({ a: px(1060, y0), b: px(1060, y1), t: pxLen(30), kind: 'window', sill, head: H, door: { id, name, leaf: { op: 'slide', panes: 2 }, finish: 'glass' } })

export const openings: Opening[] = [
  door('entrada', 'Puerta de entrada', px(409, 925), px(409, 1008), pxLen(18), { op: 'swing', hinge: 'a', side: -1 }, 'wood'),
  door('p-dorm1', 'Puerta del dormitorio principal', px(418, 639), px(500, 639), pxLen(18), { op: 'swing', hinge: 'a', side: -1 }),
  door('p-bano1', 'Puerta del baño principal', px(515, 540), px(590, 540), pxLen(10), { op: 'swing', hinge: 'a', side: -1 }),
  door('p-dorm2', 'Puerta del dormitorio 2', px(514, 668), px(514, 740), pxLen(12), { op: 'swing', hinge: 'b', side: -1 }),
  door('p-bano2', 'Puerta del baño 2', px(514, 838), px(514, 905), pxLen(12), { op: 'swing', hinge: 'a', side: -1 }),
  door('p-dorm3', 'Puerta del dormitorio 3', px(548.5, 1062), px(548.5, 1135), pxLen(7), { op: 'swing', hinge: 'b', side: -1 }),
  {
    a: px(497, 1677.5), b: px(700, 1677.5), t: pxLen(25), kind: 'door', sill: 0, head: H,
    door: { id: 'terraza', name: 'Corredera de la terraza', leaf: { op: 'slide', panes: 2 }, finish: 'glass' },
  },
  eastWindow('v-dorm1', 'Ventana del dormitorio principal', 432, 555),
  eastWindow('v-dorm2', 'Ventana del dormitorio 2', 707, 828),
  eastWindow('v-dorm3', 'Ventana del dormitorio 3', 965, 1098),
  eastWindow('v-cocina', 'Ventana de la cocina', 1205, 1315, 105),
  eastWindow('v-salon', 'Ventana del salón', 1430, 1555),
  {
    a: px(401, 430), b: px(401, 525), t: pxLen(18), kind: 'window', sill: 110, head: H,
    door: { id: 'v-bano1', name: 'Ventana del baño principal', leaf: { op: 'slide', panes: 2 }, finish: 'glass' },
  },
]

// --- Rooms ---------------------------------------------------------------------
// Inside faces. Areas are worked out from these outlines; the sales sheet
// gives none.
export type RoomUse = 'day' | 'night' | 'wet' | 'hall' | 'outdoor'
export type FloorKind = 'wood' | 'tile' | 'outdoor'

export interface Room {
  id: string
  name: string
  use: RoomUse
  floor: FloorKind
  poly: Pt[]
  label?: Pt // where to put the label, if the centroid is a poor spot
}

const poly = (...pts: [number, number][]) => pts.map(([x, y]) => px(x, y))

export const rooms: Room[] = [
  { id: 'salon', name: 'Salón-comedor', use: 'day', floor: 'wood', poly: poly([442, 1062], [545, 1062], [545, 1325], [1045, 1325], [1045, 1665], [442, 1665]), label: px(740, 1450) },
  { id: 'cocina', name: 'Cocina', use: 'day', floor: 'wood', poly: poly([620, 1163], [1045, 1163], [1045, 1325], [545, 1325], [545, 1237], [620, 1237]) },
  { id: 'dorm1', name: 'Dormitorio principal', use: 'night', floor: 'wood', poly: poly([642, 357], [1045, 357], [1045, 630], [418, 630], [418, 545], [642, 545]), label: px(860, 500) },
  { id: 'bano1', name: 'Baño principal', use: 'wet', floor: 'tile', poly: poly([410, 357], [630, 357], [630, 535], [410, 535]) },
  { id: 'dorm2', name: 'Dormitorio 2', use: 'night', floor: 'wood', poly: poly([520, 648], [1045, 648], [1045, 880], [800, 880], [800, 805], [520, 805]), label: px(860, 760) },
  { id: 'bano2', name: 'Baño 2', use: 'wet', floor: 'tile', poly: poly([520, 815], [790, 815], [790, 1005], [520, 1005]) },
  { id: 'dorm3', name: 'Dormitorio 3', use: 'night', floor: 'wood', poly: poly([800, 890], [1045, 890], [1045, 1150], [552, 1150], [552, 1012], [800, 1012]), label: px(900, 1030) },
  { id: 'pasillo', name: 'Recibidor y pasillo', use: 'hall', floor: 'wood', poly: poly([418, 648], [508, 648], [508, 1012], [545, 1012], [545, 1062], [442, 1062], [442, 1040], [418, 1040]), label: px(470, 900) },
  { id: 'terraza', name: 'Terraza', use: 'outdoor', floor: 'outdoor', poly: poly([440, 1690], [795, 1690], [795, 1785], [440, 1785]) },
]

/** Shoelace area of an outline, in m². */
export function areaM2(pts: Pt[]) {
  let a = 0
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]
    a += p[0] * q[1] - q[0] * p[1]
  })
  return Math.abs(a) / 2 / 10_000
}

export const AREAS = {
  useful: rooms.filter((r) => r.use !== 'outdoor').reduce((s, r) => s + areaM2(r.poly), 0),
  terrace: areaM2(rooms.find((r) => r.id === 'terraza')!.poly),
}
