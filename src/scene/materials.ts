import * as THREE from 'three'
import { WALL_STUB, patchCutaway } from './cutaway'

// One horizontal clipping plane shared by everything built: it keeps what lies
// below `constant` metres. Materials hold a reference, so moving the plane
// needs no material updates.
export const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100)
const clip = [cutPlane]

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, clippingPlanes: clip, ...extra })

export const M = {
  wall: std('#f4f2ee'),
  // Back faces of the wall solids. Once the cut plane opens a wall's top, you
  // look into it and see these: it reads as the dark poché of a plan section.
  // Pushed back in depth: where a lintel butts against a wall end the faces
  // are coplanar, and without the offset the poché bleeds through as seams.
  poche: new THREE.MeshBasicMaterial({
    color: '#2d2f33', side: THREE.BackSide, clippingPlanes: clip,
    polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 8,
  }),
  pillar: std('#ecebe7'),
  slab: std('#d9d6cf'),
  ceiling: std('#f7f6f3'),
  glass: new THREE.MeshStandardMaterial({
    color: '#a9cfe0', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35,
    depthWrite: false, side: THREE.DoubleSide, clippingPlanes: clip,
  }),
  winFrame: std('#f4f4f1', { roughness: 0.5 }), // white PVC, as in the renders
  door: std('#7a5a40', { roughness: 0.6 }), // the front door: a dark wood security door
  leaf: std('#faf8f3', { roughness: 0.6 }), // interior doors, lacquered white
  frame: std('#3b3f45', { roughness: 0.6 }), // dark metal: handles
  // Metals stay low on metalness: there is no environment map to reflect, and
  // a truly metallic surface would render near black.
  chrome: std('#cfd4d8', { roughness: 0.25, metalness: 0.4 }),
  railing: std('#4a4d52', { roughness: 0.5, metalness: 0.2 }),

  // Furniture
  ceramic: std('#fbfbf9', { roughness: 0.25 }),
  mirror: std('#d6e4ea', { roughness: 0.05, metalness: 0.3 }),
  front: std('#f6f6f4', { roughness: 0.35 }), // kitchen fronts: matt white, as in the renders
  carcass: std('#ecebe7', { roughness: 0.6 }),
  worktop: std('#eeedea', { roughness: 0.3 }), // light quartz
  splash: std('#e4e1dc', { roughness: 0.35 }), // the porcelain backsplash, a soft veined grey
  steel: std('#c8ccd0', { roughness: 0.35, metalness: 0.3 }), // fridge, sink, microwave frame
  black: std('#1c1d1f', { roughness: 0.25 }), // oven door, hob, screens off
  white: std('#fbfbfa', { roughness: 0.4 }), // appliances
  oak: std('#c69a63', { roughness: 0.6 }),
  walnut: std('#5a3f2c', { roughness: 0.6 }),
  linen: std('#f4f1ea', { roughness: 0.95 }), // sheets and pillows
  throwBlue: std('#5f7891', { roughness: 0.95 }), // bedspread, master
  throwSand: std('#c9b79a', { roughness: 0.95 }), // bedspreads, the other rooms
  sofa: std('#8e8a83', { roughness: 0.95 }), // warm grey fabric
  rug: std('#d8d0c2', { roughness: 1 }),
  // The children's rooms: navy, teal and mustard for the boy's, coral,
  // lilac and blush for the girl's.
  navy: std('#2f4a6d', { roughness: 0.9 }),
  teal: std('#3f8f8a', { roughness: 0.8 }),
  mustard: std('#e0b54a', { roughness: 0.8 }),
  coral: std('#e98a7a', { roughness: 0.8 }),
  lilac: std('#b9a6d6', { roughness: 0.9 }),
  blush: std('#f2c9c4', { roughness: 0.95 }),
  plant: std('#5d7d4a', { roughness: 0.8 }),
  pot: std('#c7b8a3', { roughness: 0.8 }),
  wardrobe: std('#f2f1ee', { roughness: 0.5 }),
  screen: std('#1f2731', { roughness: 0.15 }),
  led: new THREE.MeshBasicMaterial({ color: '#fff8e6', clippingPlanes: clip }), // a bulb or LED that is on
  ledOff: std('#e4e1da', { roughness: 0.3 }), // the same, off: frosted white
  termo: std('#f7f7f5', { roughness: 0.3 }),
  termoBlue: std('#2f6fb3', { roughness: 0.4 }),
}

// The same materials without the section cut, for furniture: cutting the
// flat at 1.2 m shows the rooms with their furniture standing whole.
function unclipped<T extends THREE.Material>(m: T): T {
  const c = m.clone() as T
  c.clippingPlanes = null
  return c
}
export const F = Object.fromEntries(Object.entries(M).map(([k, m]) => [k, unclipped(m)])) as typeof M

// The building takes part in the selected room's cutaway (cutaway.ts):
// walls, lintels, doors, windows. The slab does not, nor furniture (F), nor
// the building round the flat (Surroundings.tsx, its own materials).
// Walls keep a stub, and their poché turns wall-coloured, so a cut looks solid.
const GROUND: THREE.Material[] = [M.slab]
const WALL_INSIDE = new THREE.Color('#e9e6e0') // the wall colour, a touch shaded
for (const m of Object.values(M)) {
  if (GROUND.includes(m)) continue
  if (m === M.poche) patchCutaway(m, WALL_STUB, WALL_INSIDE)
  else patchCutaway(m, m === M.wall || m === M.pillar ? WALL_STUB : undefined)
}

export const SELECT_TINT = '#ffb877' // multiplies the floor texture of the selected room
