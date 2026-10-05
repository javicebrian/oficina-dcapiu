import { useFrame } from '@react-three/fiber'
import { createContext, useContext, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import * as THREE from 'three'
import { LEVELS, px, pxLen, pxRect } from '../data/flat'
import type { Rect } from '../data/flat'
import type { LightId } from '../data/furniture'
import { sh, sx, sz } from './geometry'
import { useTravel } from './Doors'
import { Glow, Switch, bulbMaterial, useLightOn } from './Lights'
import { F } from './materials'
import { isFrontmost } from './picking'

// The furniture. The sales plan draws beds, sofa, dining table, bathroom
// fittings and a kitchen run; the kitchen as modelled follows the three
// renders instead (an L with the washer under the window, a tall column
// hiding the water heater, a peninsula with drawers). Everything else, and
// all the sizes the plan does not give, is ours.
//
// Footprints are read off the scan like the walls (pxRect, scan pixels);
// heights are cm. Furniture uses the unclipped materials (F), so the section
// cut opens the walls and leaves every piece whole. It carries no event
// handlers, so clicks fall through to the room floor, except the light
// fittings (Switch) and the water-heater column, which opens.

type Side = 'n' | 's' | 'e' | 'w'
type V3 = [number, number, number]
const c = (v: number) => v / 100
const CEIL = LEVELS.ceiling

/** Scene position of a scan pixel at height h (cm). */
const at = (x: number, y: number, h: number): V3 => {
  const [px_, py_] = px(x, y)
  return [sx(px_), sh(h), sz(py_)]
}

/** A box over a plan rectangle (cm), between heights h0 and h1 (cm). */
function Blk({ r, h0, h1, m, shadow = true }: { r: Rect; h0: number; h1: number; m: THREE.Material; shadow?: boolean }) {
  const [x0, y0, x1, y1] = r
  return (
    <mesh position={[sx((x0 + x1) / 2), sh((h0 + h1) / 2), sz((y0 + y1) / 2)]} material={m} castShadow={shadow} receiveShadow>
      <boxGeometry args={[c(x1 - x0), c(h1 - h0), c(y1 - y0)]} />
    </mesh>
  )
}
/** The same, with the footprint read on the scan. */
const P = (x0: number, y0: number, x1: number, y1: number, h0: number, h1: number, m: THREE.Material, shadow = true) => (
  <Blk r={pxRect(x0, y0, x1, y1)} h0={h0} h1={h1} m={m} shadow={shadow} />
)

/** A box in a local frame (cm): x across, y up, z out from the wall. */
function LB({ x, y, z, m, shadow = true }: { x: [number, number]; y: [number, number]; z: [number, number]; m: THREE.Material; shadow?: boolean }) {
  return (
    <mesh position={[c((x[0] + x[1]) / 2), c((y[0] + y[1]) / 2), c((z[0] + z[1]) / 2)]} material={m} castShadow={shadow} receiveShadow>
      <boxGeometry args={[c(x[1] - x[0]), c(y[1] - y[0]), c(z[1] - z[0])]} />
    </mesh>
  )
}

/** An upright cylinder in a local frame (cm); `sz` stretches it along z. */
function LC({ x, z, y, r, m, r2, stretch = 1, seg = 28 }: {
  x: number; z: number; y: [number, number]; r: number; m: THREE.Material; r2?: number; stretch?: number; seg?: number
}) {
  return (
    <mesh position={[c(x), c((y[0] + y[1]) / 2), c(z)]} scale={[1, 1, stretch]} material={m} castShadow receiveShadow>
      <cylinderGeometry args={[c(r2 ?? r), c(r), c(y[1] - y[0]), seg]} />
    </mesh>
  )
}

/**
 * A local frame for a piece standing against a wall: origin on the wall at
 * the middle of the footprint, x along the wall, z out into the room.
 * `children` gets the footprint's width (along the wall) and depth, in cm.
 */
function Against({ r, wall, children }: { r: Rect; wall: Side; children: (w: number, d: number) => ReactNode }) {
  const [x0, y0, x1, y1] = r
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  const f = {
    n: { o: [cx, y0], rot: 0, w: x1 - x0, d: y1 - y0 },
    s: { o: [cx, y1], rot: Math.PI, w: x1 - x0, d: y1 - y0 },
    w: { o: [x0, cy], rot: Math.PI / 2, w: y1 - y0, d: x1 - x0 },
    e: { o: [x1, cy], rot: -Math.PI / 2, w: y1 - y0, d: x1 - x0 },
  }[wall]
  return (
    <group position={[sx(f.o[0]), 0, sz(f.o[1])]} rotation-y={f.rot}>
      {children(f.w, f.d)}
    </group>
  )
}
const A = (x0: number, y0: number, x1: number, y1: number, wall: Side, children: (w: number, d: number) => ReactNode) => (
  <Against r={pxRect(x0, y0, x1, y1)} wall={wall}>{children}</Against>
)

// --- Bathrooms ---------------------------------------------------------------

function Toilet({ d, bidet = false }: { d: number; bidet?: boolean }) {
  const bowlZ = d - 24
  return (
    <>
      {!bidet && <LB x={[-18, 18]} y={[38, 78]} z={[0, 16]} m={F.ceramic} />}
      <LB x={[-12, 12]} y={[0, 36]} z={[bidet ? 0 : 14, bowlZ]} m={F.ceramic} />
      <LC x={0} z={bowlZ} y={[0, 40]} r={17} r2={18} stretch={1.3} m={F.ceramic} />
      {bidet ? (
        <LC x={0} z={10} y={[40, 46]} r={1.5} m={F.chrome} />
      ) : (
        <LC x={0} z={bowlZ - 2} y={[40, 42.5]} r={18.5} stretch={1.32} m={F.ceramic} />
      )}
    </>
  )
}

/** Wall-hung vanity in oak with a round vessel basin, and a mirror over it. */
function Vanity({ w, d }: { w: number; d: number }) {
  const r = Math.min(w, d) / 2 - 7
  return (
    <>
      <LB x={[-w / 2, w / 2]} y={[50, 80]} z={[0, d - 1]} m={F.oak} />
      <LB x={[-w / 2, w / 2]} y={[80, 83]} z={[0, d]} m={F.ceramic} />
      <LC x={0} z={d / 2 + 3} y={[83, 96]} r={r - 2} r2={r} m={F.ceramic} />
      <LC x={0} z={6} y={[83, 108]} r={1.3} m={F.chrome} />
      <LB x={[-1, 1]} y={[105, 108]} z={[6, 16]} m={F.chrome} />
      <LB x={[-w / 2 + 4, w / 2 - 4]} y={[105, 180]} z={[0, 1.2]} m={F.mirror} />
    </>
  )
}

function Bathroom1() {
  return (
    <>
      {/* shower: tray, a fixed glass panel on the open side, the head on the north wall */}
      {P(412, 358, 500, 522, 0, 4, F.ceramic)}
      {P(499, 358, 501, 470, 4, 200, F.glass, false)}
      {A(445, 357, 465, 380, 'n', () => (
        <>
          <LC x={0} z={2} y={[100, 205]} r={1.2} m={F.chrome} />
          <LC x={0} z={14} y={[203, 205]} r={11} m={F.chrome} />
          <LB x={[-1, 1]} y={[203, 205]} z={[2, 14]} m={F.chrome} />
        </>
      ))}
      {A(505, 357, 578, 410, 'n', (w, d) => <Vanity w={w} d={d} />)}
      {A(603, 360, 640, 432, 'n', (_, d) => <Toilet d={d} />)}
      {A(603, 470, 640, 535, 's', (_, d) => <Toilet d={d} bidet />)}
    </>
  )
}

function Bathroom2() {
  // Bathtub between the north and south walls, a glass flap at its head.
  const tub = { x0: 712, y0: 815, x1: 790, y1: 1005 }
  const rim = 7
  return (
    <>
      {P(tub.x0, tub.y0, tub.x1, tub.y0 + rim, 0, 55, F.ceramic)}
      {P(tub.x0, tub.y1 - rim, tub.x1, tub.y1, 0, 55, F.ceramic)}
      {P(tub.x0, tub.y0 + rim, tub.x0 + rim, tub.y1 - rim, 0, 55, F.ceramic)}
      {P(tub.x1 - rim, tub.y0 + rim, tub.x1, tub.y1 - rim, 0, 55, F.ceramic)}
      {P(tub.x0 + rim, tub.y0 + rim, tub.x1 - rim, tub.y1 - rim, 0, 15, F.ceramic)}
      {P(tub.x0 + 3, tub.y0 + 4, tub.x0 + 4, tub.y0 + 85, 55, 195, F.glass, false)}
      {A(750, 815, 770, 830, 'n', () => (
        <>
          <LB x={[-6, 6]} y={[70, 76]} z={[0, 7]} m={F.chrome} />
          <LC x={4} z={3} y={[76, 195]} r={1.1} m={F.chrome} />
          <LC x={4} z={13} y={[193, 195]} r={9} m={F.chrome} />
          <LB x={[3, 5]} y={[193, 195]} z={[3, 13]} m={F.chrome} />
        </>
      ))}
      {A(655, 815, 690, 882, 'n', (_, d) => <Toilet d={d} />)}
      {A(545, 945, 618, 1005, 's', (w, d) => <Vanity w={w} d={d} />)}
      {A(640, 940, 690, 1005, 's', (_, d) => <Toilet d={d} bidet />)}
    </>
  )
}

// --- Bedrooms ------------------------------------------------------------------

function Bed({ w, d, double = false, cover, head }: { w: number; d: number; double?: boolean; cover: THREE.Material; head?: THREE.Material }) {
  const pillows = double ? [-w / 4, w / 4] : [0]
  const pw = double ? w / 2 - 10 : w - 18
  return (
    <>
      <LB x={[-w / 2 - (double ? 6 : 0), w / 2 + (double ? 6 : 0)]} y={[0, double ? 115 : 95]} z={[0, 7]} m={head ?? (double ? F.sofa : F.oak)} />
      <LB x={[-w / 2, w / 2]} y={[10, 32]} z={[7, d]} m={double ? F.sofa : F.oak} />
      <LB x={[-w / 2 + 1, w / 2 - 1]} y={[32, 54]} z={[8, d - 1]} m={F.linen} />
      <LB x={[-w / 2 - 1.5, w / 2 + 1.5]} y={[28, 57]} z={[d * 0.3, d + 1.5]} m={cover} />
      {pillows.map((x) => <LB key={x} x={[x - pw / 2, x + pw / 2]} y={[54, 66]} z={[12, 42]} m={F.linen} />)}
    </>
  )
}

/** Bedside table with a lamp; the lamp is switched with its neighbour (`id`). */
function Nightstand({ w, d, lamp }: { w: number; d: number; lamp?: boolean }) {
  const on = useLightOn('mesillas')
  return (
    <>
      <LB x={[-w / 2 + 2, w / 2 - 2]} y={[0, 48]} z={[1, d - 1]} m={F.oak} />
      <LB x={[-w / 2 + 4, w / 2 - 4]} y={[30, 30.6]} z={[d - 1, d - 0.7]} m={F.walnut} shadow={false} />
      {lamp && (
        <>
          <LC x={0} z={d / 2} y={[48, 50]} r={6} m={F.walnut} />
          <LC x={0} z={d / 2} y={[50, 70]} r={0.8} m={F.walnut} />
          <mesh position={[0, c(70), c(d / 2)]} material={bulbMaterial(on)}>
            <sphereGeometry args={[c(4), 16, 12]} />
          </mesh>
          <LC x={0} z={d / 2} y={[64, 84]} r={13} r2={10} m={F.linen} />
        </>
      )}
    </>
  )
}

function Wardrobe({ w, d, doors }: { w: number; d: number; doors: number }) {
  const dw = w / doors
  return (
    <>
      <LB x={[-w / 2, w / 2]} y={[0, 240]} z={[0, d]} m={F.wardrobe} />
      {Array.from({ length: doors - 1 }, (_, i) => -w / 2 + (i + 1) * dw).map((x) => (
        <LB key={x} x={[x - 0.3, x + 0.3]} y={[2, 238]} z={[d, d + 0.2]} m={F.carcass} shadow={false} />
      ))}
      {Array.from({ length: doors }, (_, i) => -w / 2 + i * dw + (i % 2 ? 5 : dw - 5)).map((x) => (
        <LB key={x} x={[x - 0.8, x + 0.8]} y={[85, 145]} z={[d, d + 2]} m={F.chrome} />
      ))}
    </>
  )
}

/** Chair with its back to the frame's wall, facing out. */
function Chair({ shell = F.white }: { shell?: THREE.Material }) {
  return (
    <>
      <LB x={[-21, 21]} y={[43, 47]} z={[4, 46]} m={shell} />
      <LB x={[-21, 21]} y={[47, 86]} z={[2, 6]} m={shell} />
      {[[-18, 7], [18, 7], [-18, 43], [18, 43]].map(([x, z]) => <LC key={`${x},${z}`} x={x} z={z} y={[0, 43]} r={1.3} m={F.oak} seg={10} />)}
    </>
  )
}

// --- Children's rooms ------------------------------------------------------------

interface Palette { cover: THREE.Material; accent: THREE.Material; wood: THREE.Material; rug: THREE.Material }

/** A single bed with a painted headboard, a coloured cover, a cushion and a soft toy. */
function KidBed({ w, d, p }: { w: number; d: number; p: Palette }) {
  return (
    <>
      <Bed w={w} d={d} cover={p.cover} head={p.wood} />
      <LB x={[-w / 2 + 12, -w / 2 + 40]} y={[56, 80]} z={[38, 48]} m={p.accent} />
      <mesh position={[c(w / 4), c(64), c(48)]} material={F.throwSand} castShadow>
        <sphereGeometry args={[c(9), 14, 10]} />
      </mesh>
      <mesh position={[c(w / 4), c(78), c(46)]} material={F.throwSand} castShadow>
        <sphereGeometry args={[c(6.5), 14, 10]} />
      </mesh>
    </>
  )
}

/** Desk against a wall: white top on coloured legs, a drawer unit, a lamp, books, two shelves above. */
function Desk({ w, d, p }: { w: number; d: number; p: Palette }) {
  const legs = [[-w / 2 + 3, 3], [w / 2 - 3, 3], [-w / 2 + 3, d - 3], [w / 2 - 3, d - 3]]
  const books = (x0: number, h: number, n: number) =>
    Array.from({ length: n }, (_, i) => (
      <LB key={i} x={[x0 + i * 3.4, x0 + i * 3.4 + 3]} y={[h, h + 18 + (i % 3) * 3]} z={[2, 18]} m={[p.accent, F.white, p.cover, p.wood][i % 4]} />
    ))
  return (
    <>
      <LB x={[-w / 2, w / 2]} y={[72, 75]} z={[0, d]} m={F.white} />
      {legs.map(([x, z]) => <LC key={`${x},${z}`} x={x} z={z} y={[0, 72]} r={1.6} m={p.wood} seg={10} />)}
      <LB x={[w / 2 - 40, w / 2 - 4]} y={[2, 70]} z={[2, d - 6]} m={F.white} />
      {[20, 42].map((h) => <LB key={h} x={[w / 2 - 38, w / 2 - 6]} y={[h, h + 18]} z={[d - 6, d - 5]} m={p.accent} />)}
      {/* lamp: base, arm, head */}
      <LC x={-w / 2 + 14} z={12} y={[75, 77]} r={7} m={p.wood} />
      <LC x={-w / 2 + 14} z={12} y={[77, 112]} r={0.8} m={p.wood} seg={8} />
      <LC x={-w / 2 + 14} z={18} y={[106, 116]} r={4} r2={7} m={p.wood} />
      {/* a closed laptop and a pile of notebooks */}
      <LB x={[-14, 18]} y={[75, 77]} z={[12, 34]} m={F.steel} />
      <LB x={[24, 46]} y={[75, 81]} z={[10, 40]} m={p.accent} />
      {/* two wall shelves with books */}
      {[118, 152].map((h) => <LB key={h} x={[-w / 2 + 6, w / 2 - 6]} y={[h - 2, h]} z={[0, 20]} m={F.white} />)}
      {books(-w / 2 + 10, 118, 9)}
      {books(w / 2 - 50, 152, 6)}
    </>
  )
}

/** Low bookcase with coloured storage boxes in its cubbies. */
function LowShelf({ w, d, p }: { w: number; d: number; p: Palette }) {
  const n = Math.max(2, Math.round(w / 35))
  const cw = w / n
  return (
    <>
      <LB x={[-w / 2, w / 2]} y={[0, 78]} z={[0, d]} m={F.white} />
      {Array.from({ length: n }, (_, i) => -w / 2 + i * cw).flatMap((x0, i) => [
        <LB key={`a${i}`} x={[x0 + 2, x0 + cw - 2]} y={[4, 36]} z={[d, d + 0.6]} m={[p.accent, p.wood, p.cover][i % 3]} />,
        <LB key={`b${i}`} x={[x0 + 2, x0 + cw - 2]} y={[41, 74]} z={[d, d + 0.6]} m={[p.cover, p.accent, p.wood][i % 3]} />,
      ])}
      <mesh position={[c(-w / 4), c(88), c(d / 2)]} material={p.accent} castShadow>
        <sphereGeometry args={[c(9), 16, 12]} />
      </mesh>
    </>
  )
}

function Beanbag({ x, y, m }: { x: number; y: number; m: THREE.Material }) {
  const p = at(x, y, 0)
  return (
    <mesh position={[p[0], 0.2, p[2]]} scale={[1, 0.62, 1]} material={m} castShadow receiveShadow>
      <sphereGeometry args={[0.36, 24, 16]} />
    </mesh>
  )
}

/** A child's bedroom: bed, desk and chair, round rug, and a low bookcase if it fits. Footprints in scan pixels. */
function KidRoom({ palette: p, wall, bed, desk, chair, shelf, rug }: {
  palette: Palette
  wall: 'n' | 's' // the wall the bed's head and the desk stand against
  bed: [number, number, number, number]
  desk: [number, number, number, number]
  chair: [number, number, number, number] // facing the desk
  shelf?: [number, number, number, number, Side]
  rug: [number, number, number] // centre and radius
}) {
  const r = at(rug[0], rug[1], 0)
  return (
    <>
      {A(...bed, wall, (w, d) => <KidBed w={w} d={d} p={p} />)}
      {A(...desk, wall, (w, d) => <Desk w={w} d={d} p={p} />)}
      {A(...chair, wall === 'n' ? 's' : 'n', () => <Chair shell={p.accent} />)}
      {shelf && A(...shelf, (w, d) => <LowShelf w={w} d={d} p={p} />)}
      <mesh position={[r[0], 0.008, r[2]]} material={p.rug} receiveShadow>
        <cylinderGeometry args={[c(pxLen(rug[2])), c(pxLen(rug[2])), 0.008, 40]} />
      </mesh>
    </>
  )
}

function Bedrooms() {
  return (
    <>
      {/* Dormitorio principal: double bed against the north wall, wardrobe on the west */}
      {A(822, 357, 975, 572, 'n', (w, d) => <Bed w={w} d={d} double cover={F.throwBlue} />)}
      {A(768, 358, 822, 397, 'n', (w, d) => <Nightstand w={w} d={d} lamp />)}
      {A(975, 358, 1029, 397, 'n', (w, d) => <Nightstand w={w} d={d} lamp />)}
      {A(645, 357, 705, 545, 'w', (w, d) => <Wardrobe w={w} d={d} doors={3} />)}
      {P(790, 455, 1010, 615, 0.4, 1.2, F.rug, false)}

      {/* Dormitorio 2, the boy's: the girl's room mirrored across the wall they
          share, so bed and desk stand against that wall, back to back with hers */}
      <KidRoom
        palette={{ cover: F.navy, accent: F.mustard, wood: F.teal, rug: F.teal }}
        wall="s"
        bed={[948, 685, 1040, 880]}
        desk={[805, 820, 935, 880]}
        chair={[848, 773, 893, 818]}
        shelf={[810, 648, 935, 683, 'n']}
        rug={[868, 738, 48]}
      />
      {A(548, 745, 750, 805, 's', (w, d) => <Wardrobe w={w} d={d} doors={3} />)}

      {/* Dormitorio 3, the girl's: the same, mirrored in colour; a beanbag in the strip by the door */}
      <KidRoom
        palette={{ cover: F.lilac, accent: F.coral, wood: F.coral, rug: F.blush }}
        wall="n"
        bed={[948, 892, 1040, 1087]}
        desk={[805, 892, 935, 952]}
        chair={[848, 955, 893, 1000]}
        rug={[870, 1065, 50]}
      />
      {A(552, 1012, 695, 1062, 'n', (w, d) => <Wardrobe w={w} d={d} doors={2} />)}
      <Beanbag x={735} y={1088} m={F.lilac} />
    </>
  )
}

// --- Kitchen -------------------------------------------------------------------

export interface Cabinets {
  open: Record<string, boolean>
  toggle: (id: string) => void
  hover: (update: (hovered: string | null) => string | null) => void
  cut: number // m, for picking
}
export const CabinetsContext = createContext<Cabinets>({ open: {}, toggle: () => {}, hover: () => {}, cut: 100 })

/**
 * The tall column at the west end of the run (renders 1 and 3): two doors,
 * no handles; inside, the electric water heater. A click opens both doors.
 */
function TermoColumn({ w, d }: { w: number; d: number }) {
  const s = useContext(CabinetsContext)
  const open = !!s.open.termo
  const t = useTravel(open)
  const left = useRef<THREE.Group>(null)
  const right = useRef<THREE.Group>(null)
  useFrame(() => {
    const a = t.current * 1.75 // about 100°
    if (left.current) left.current.rotation.y = -a
    if (right.current) right.current.rotation.y = a
  })
  const lw = w / 2 - 0.3
  const H = 225
  return (
    <group
      onClick={(e) => {
        if (!isFrontmost(e, s.cut)) return
        e.stopPropagation()
        s.toggle('termo')
      }}
      onPointerMove={(e) => {
        const front = isFrontmost(e, s.cut)
        s.hover((h) => (front ? 'termo' : h === 'termo' ? null : h))
      }}
      onPointerOut={() => s.hover((h) => (h === 'termo' ? null : h))}
    >
      {/* carcass: sides, back, bottom, top, a shelf over the heater */}
      <LB x={[-w / 2, -w / 2 + 2]} y={[0, H]} z={[0, d - 2]} m={F.front} />
      <LB x={[w / 2 - 2, w / 2]} y={[0, H]} z={[0, d - 2]} m={F.front} />
      <LB x={[-w / 2 + 2, w / 2 - 2]} y={[0, H]} z={[0, 1.5]} m={F.carcass} />
      <LB x={[-w / 2 + 2, w / 2 - 2]} y={[0, 10]} z={[1.5, d - 2]} m={F.carcass} />
      <LB x={[-w / 2 + 2, w / 2 - 2]} y={[H - 2, H]} z={[1.5, d - 2]} m={F.front} />
      <LB x={[-w / 2 + 2, w / 2 - 2]} y={[188, 190]} z={[1.5, d - 2]} m={F.carcass} />
      {/* the water heater: a white cylinder with the maker's blue badge and its pipes */}
      <LC x={0} z={d / 2 - 1} y={[28, 180]} r={23} m={F.termo} seg={36} />
      <LC x={0} z={d / 2 - 1} y={[180, 186]} r={23} r2={18} m={F.termo} seg={36} />
      <mesh position={[0, c(158), c(d / 2 + 22.3)]} rotation-x={Math.PI / 2} material={F.termoBlue}>
        <cylinderGeometry args={[c(5), c(5), c(0.6), 24]} />
      </mesh>
      <LB x={[-4, 4]} y={[45, 60]} z={[d / 2 + 21, d / 2 + 24]} m={F.carcass} />
      {[-8, 8].map((x) => <LC key={x} x={x} z={d / 2} y={[10, 28]} r={1.2} m={F.chrome} seg={10} />)}
      {/* doors, hinged at the outer edges */}
      <group ref={left} position={[c(-w / 2), 0, c(d - 1)]}>
        <LB x={[0, lw]} y={[10, H]} z={[-1, 1]} m={F.front} />
      </group>
      <group ref={right} position={[c(w / 2), 0, c(d - 1)]}>
        <LB x={[-lw, 0]} y={[10, H]} z={[-1, 1]} m={F.front} />
      </group>
    </group>
  )
}

/** Matt white fronts in a row, with hairline gaps, on the local front plane z = d. */
function Fronts({ xs, y, d }: { xs: number[]; y: [number, number]; d: number }) {
  return (
    <>
      {xs.slice(0, -1).map((x, i) => <LB key={x} x={[x + 0.2, xs[i + 1] - 0.2]} y={y} z={[d, d + 1.8]} m={F.front} />)}
    </>
  )
}

function Kitchen() {
  const strip = useLightOn('cocina-led')
  return (
    <>
      {A(620, 1163, 700, 1224, 'n', (w, d) => <TermoColumn w={w} d={d} />)}

      {/* fridge-freezer, free-standing, stainless; a cupboard over it */}
      {A(702, 1163, 762, 1226, 'n', (w, d) => (
        <>
          <LB x={[-w / 2, w / 2]} y={[0, 201]} z={[2, d]} m={F.steel} />
          <LB x={[-w / 2 + 0.5, w / 2 - 0.5]} y={[128, 128.6]} z={[d, d + 0.2]} m={F.black} shadow={false} />
          <LB x={[w / 2 - 6, w / 2 - 4]} y={[140, 185]} z={[d, d + 3]} m={F.frame} />
          <LB x={[w / 2 - 6, w / 2 - 4]} y={[80, 122]} z={[d, d + 3]} m={F.frame} />
          <LB x={[-w / 2 - 1, w / 2 + 1]} y={[205, 225]} z={[0, d - 2]} m={F.carcass} />
          <LB x={[-w / 2 - 1, w / 2 + 1]} y={[205.2, 224.8]} z={[d - 2, d]} m={F.front} />
        </>
      ))}

      {/* base run along the north wall: oven under the hob, dishwasher, sink, corner */}
      {A(764, 1163, 1045, 1223, 'n', (w, d) => {
        const x = (v: number) => pxLen(v - 764) - w / 2 // a scan x along the run, in local cm
        return (
          <>
            <LB x={[-w / 2, w / 2]} y={[0, 10]} z={[0, d - 6]} m={F.carcass} />
            <LB x={[-w / 2, w / 2]} y={[10, 86]} z={[0, d]} m={F.carcass} />
            <LB x={[-w / 2, w / 2 + 2]} y={[86, 90]} z={[0, d + 3]} m={F.worktop} />
            <LB x={[-w / 2, w / 2]} y={[90, 145]} z={[0, 1.2]} m={F.splash} />
            {/* oven: black glass door, steel control band */}
            <LB x={[x(765), x(823)]} y={[14, 70]} z={[d, d + 2]} m={F.black} />
            <LB x={[x(765), x(823)]} y={[70, 85]} z={[d, d + 2]} m={F.steel} />
            <LB x={[x(772), x(816)]} y={[64, 66]} z={[d + 2, d + 4]} m={F.steel} />
            {/* hob: black glass flush in the worktop */}
            <LB x={[x(768), x(820)]} y={[90, 90.6]} z={[6, 52]} m={F.black} shadow={false} />
            {/* dishwasher: white, display along the top */}
            <LB x={[x(824.3), x(883.7)]} y={[11, 85]} z={[d, d + 2]} m={F.white} />
            <LB x={[x(824.3), x(883.7)]} y={[78, 85]} z={[d + 2, d + 2.4]} m={F.steel} shadow={false} />
            <Fronts xs={[x(884), x(924), x(964), x(1004), x(1045)]} y={[11, 85]} d={d} />
            {/* undermount sink and tap */}
            <LB x={[x(900), x(948)]} y={[89, 90.2]} z={[12, 50]} m={F.steel} shadow={false} />
            <LC x={x(924)} z={6} y={[90, 118]} r={1.4} m={F.chrome} />
            <LB x={[x(923), x(925)]} y={[115, 118]} z={[6, 22]} m={F.chrome} />
          </>
        )
      })}

      {/* return along the east wall, under the window: a cupboard, then the washer */}
      {A(985, 1223, 1045, 1325, 'e', (w, d) => (
        <>
          <LB x={[-w / 2, w / 2]} y={[0, 86]} z={[0, d - 2]} m={F.carcass} />
          <LB x={[-w / 2 + 4, w / 2]} y={[86, 90]} z={[0, d + 3]} m={F.worktop} />
          {/* local x runs north to south here (the frame looks west) */}
          <LB x={[-w / 2 + 0.2, -w / 2 + 38]} y={[11, 85]} z={[d - 2, d]} m={F.front} />
          <LB x={[-w / 2 + 39, w / 2 - 1]} y={[1, 84]} z={[2, d]} m={F.white} />
          <mesh position={[c((-w / 2 + 39 + w / 2 - 1) / 2), c(42), c(d + 0.2)]} rotation-x={Math.PI / 2} material={F.frame}>
            <cylinderGeometry args={[c(16), c(16), c(1), 32]} />
          </mesh>
          <mesh position={[c((-w / 2 + 39 + w / 2 - 1) / 2), c(42), c(d + 0.6)]} material={F.chrome}>
            <torusGeometry args={[c(17), c(1.6), 10, 32]} />
          </mesh>
          <LB x={[-w / 2 + 41, w / 2 - 3]} y={[74, 82]} z={[d, d + 0.4]} m={F.steel} shadow={false} />
        </>
      ))}

      {/* wall cupboards, the microwave in a tower between them; extractor under the first */}
      {A(764, 1163, 1045, 1198, 'n', (w, d) => {
        const x = (v: number) => pxLen(v - 764) - w / 2
        return (
          <>
            <LB x={[-w / 2, w / 2]} y={[145, 225]} z={[0, d - 2]} m={F.carcass} />
            <Fronts xs={[x(764), x(824), x(884)]} y={[145.5, 224.5]} d={d - 2} />
            <Fronts xs={[x(944), x(994), x(1045)]} y={[145.5, 224.5]} d={d - 2} />
            <Fronts xs={[x(884), x(944)]} y={[200, 224.5]} d={d - 2} />
            <Fronts xs={[x(884), x(944)]} y={[145.5, 158]} d={d - 2} />
            <LB x={[x(885), x(943)]} y={[159, 199]} z={[d - 2, d]} m={F.steel} />
            <LB x={[x(888), x(930)]} y={[163, 195]} z={[d, d + 0.4]} m={F.black} shadow={false} />
            <LB x={[x(768), x(820)]} y={[140, 145]} z={[2, d + 4]} m={F.steel} />
            <LB x={[-w / 2 + 2, w / 2 - 2]} y={[144.2, 145]} z={[d - 12, d - 8]} m={bulbMaterial(strip)} shadow={false} />
          </>
        )
      })}

      {/* peninsula: drawers to the kitchen, plain to the salón */}
      {A(545, 1325, 728, 1385, 'n', (w, d) => (
        <>
          <LB x={[-w / 2 + 3, w / 2 - 3]} y={[0, 10]} z={[3, d - 3]} m={F.carcass} />
          <LB x={[-w / 2, w / 2]} y={[10, 100]} z={[0, d]} m={F.front} />
          <LB x={[-w / 2 - 2, w / 2 + 2]} y={[100, 104]} z={[-2, d + 2]} m={F.worktop} />
          {[40, 70].map((h) => <LB key={h} x={[-w / 2 + 0.5, w / 2 - 0.5]} y={[h, h + 2]} z={[-0.4, 0]} m={F.steel} shadow={false} />)}
          <LB x={[-0.3, 0.3]} y={[10, 98]} z={[-0.4, 0]} m={F.steel} shadow={false} />
          <LB x={[-w / 2 + 0.5, w / 2 - 0.5]} y={[98, 100]} z={[-0.4, 0]} m={F.steel} shadow={false} />
        </>
      ))}
    </>
  )
}

// --- Salón, comedor, terraza ------------------------------------------------------

function Plant({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const [px_, py_] = px(x, y)
  return (
    <group position={[sx(px_), 0, sz(py_)]} scale={s}>
      <LC x={0} z={0} y={[0, 38]} r={16} r2={19} m={F.pot} />
      {[[0, 78, 0, 26], [-12, 98, 6, 18], [10, 104, -6, 20], [2, 122, 4, 15]].map(([dx, h, dz, r], i) => (
        <mesh key={i} position={[c(dx), c(h), c(dz)]} material={F.plant} castShadow>
          <sphereGeometry args={[c(r), 14, 10]} />
        </mesh>
      ))}
      <LC x={0} z={0} y={[38, 70]} r={1.5} m={F.walnut} seg={8} />
    </group>
  )
}

function Living() {
  const legs = (x0: number, y0: number, x1: number, y1: number, h: number, m = F.oak) =>
    [[x0, y0], [x1 - 4, y0], [x0, y1 - 4], [x1 - 4, y1 - 4]].map(([x, y]) => <group key={`${x},${y}`}>{P(x, y, x + 4, y + 4, 0, h, m)}</group>)
  return (
    <>
      {/* dining table for six */}
      {P(498, 1500, 637, 1592, 72, 75, F.oak)}
      {legs(502, 1504, 633, 1588, 72)}
      {A(518, 1462, 563, 1507, 'n', () => <Chair />)}
      {A(573, 1462, 618, 1507, 'n', () => <Chair />)}
      {A(518, 1585, 563, 1630, 's', () => <Chair />)}
      {A(573, 1585, 618, 1630, 's', () => <Chair />)}
      {A(462, 1524, 507, 1569, 'w', () => <Chair />)}
      {A(628, 1524, 673, 1569, 'e', () => <Chair />)}

      {/* L-shaped sofa facing north, the chaise along the east wall */}
      {P(778, 1562, 1040, 1644, 0, 12, F.black)}
      {P(974, 1476, 1024, 1562, 0, 12, F.black)}
      {P(788, 1557, 970, 1622, 12, 44, F.sofa)}
      {P(970, 1472, 1028, 1622, 12, 44, F.sofa)}
      {P(773, 1622, 1045, 1648, 12, 84, F.sofa)}
      {P(773, 1560, 790, 1622, 12, 62, F.sofa)}
      {P(1028, 1560, 1045, 1622, 12, 62, F.sofa)}
      {P(850, 1557.5, 851, 1622, 30, 44.2, F.carcass, false)}
      {P(910, 1557.5, 911, 1622, 30, 44.2, F.carcass, false)}
      {P(796, 1606, 836, 1620, 44, 80, F.throwBlue)}
      {P(940, 1606, 980, 1620, 44, 80, F.throwSand)}
      {P(805, 1430, 1000, 1600, 0.4, 1.2, F.rug, false)}
      {P(840, 1467, 932, 1515, 36, 40, F.oak)}
      {legs(843, 1470, 929, 1512, 36, F.black)}

      {/* TV on a low unit against the kitchen partition */}
      {P(820, 1335, 1042, 1377, 8, 48, F.walnut)}
      {P(822, 1376, 930, 1377.6, 10, 46, F.white)}
      {P(932, 1376, 1040, 1377.6, 10, 46, F.white)}
      {legs(824, 1338, 1038, 1374, 8, F.black)}
      {P(915, 1345, 947, 1362, 48, 52, F.black)}
      {P(929, 1349, 933, 1352, 52, 64, F.black)}
      {P(859, 1349, 1003, 1352, 62, 145, F.screen)}

      <Plant x={472} y={1632} />

      {/* terrace: a small round table, two chairs, a plant, the AC's outdoor unit */}
      {A(747, 1756, 795, 1785, 's', (w, d) => (
        <>
          <LB x={[-w / 2, w / 2]} y={[5, 62]} z={[0, d]} m={F.white} />
          <mesh position={[c(-w / 2 + 18), c(34), c(d + 0.3)]} rotation-x={Math.PI / 2} material={F.frame}>
            <cylinderGeometry args={[c(14), c(14), c(0.6), 24]} />
          </mesh>
        </>
      ))}
      {(() => {
        const [x, y] = px(578, 1738)
        return (
          <group position={[sx(x), 0, sz(y)]}>
            <LC x={0} z={0} y={[70, 72]} r={30} m={F.white} />
            <LC x={0} z={0} y={[2, 70]} r={2} m={F.railing} seg={10} />
            <LC x={0} z={0} y={[0, 2]} r={20} m={F.railing} />
          </group>
        )
      })()}
      {A(510, 1718, 548, 1758, 'w', () => <Chair shell={F.railing} />)}
      {A(608, 1718, 646, 1758, 'e', () => <Chair shell={F.railing} />)}
      <Plant x={465} y={1762} s={0.8} />
    </>
  )
}

// --- Lights --------------------------------------------------------------------------

/** Recessed downlights, flush with the ceiling. */
function Downlights({ id, spots, glows, intensity = 7 }: {
  id: LightId; spots: [number, number][]; glows: [number, number][]; intensity?: number
}) {
  const on = useLightOn(id)
  const xs = spots.map(([x]) => x), ys = spots.map(([, y]) => y)
  const mid = at((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, CEIL - 3)
  const span: V3 = [c(Math.max(...xs) - Math.min(...xs)) + 0.3, 0.12, c(Math.max(...ys) - Math.min(...ys)) + 0.3]
  return (
    <Switch id={id} hit={span} hitAt={mid}>
      {spots.map(([x, y]) => (
        <group key={`${x},${y}`} position={at(x, y, CEIL)}>
          <mesh position={[0, -0.006, 0]} material={F.chrome}>
            <cylinderGeometry args={[0.055, 0.055, 0.008, 24]} />
          </mesh>
          <mesh position={[0, -0.012, 0]} material={bulbMaterial(on)}>
            <cylinderGeometry args={[0.04, 0.04, 0.006, 24]} />
          </mesh>
        </group>
      ))}
      {glows.map(([x, y]) => <Glow key={`${x},${y}`} id={id} position={at(x, y, CEIL - 15)} intensity={intensity / glows.length * 1.4} reach={6} />)}
    </Switch>
  )
}

/** A round ceiling light (plafón), its diffuser glowing when on. */
function Plafon({ id, x, y, r = 17 }: { id: LightId; x: number; y: number; r?: number }) {
  const on = useLightOn(id)
  const p = at(x, y, CEIL)
  return (
    <Switch id={id} hit={[c(2 * r), 0.1, c(2 * r)]} hitAt={[p[0], p[1] - 0.05, p[2]]}>
      <group position={p}>
        <mesh position={[0, -0.015, 0]} material={F.white}>
          <cylinderGeometry args={[c(r), c(r), 0.03, 36]} />
        </mesh>
        <mesh position={[0, -0.04, 0]} material={bulbMaterial(on)}>
          <cylinderGeometry args={[c(r - 2), c(r), 0.02, 36]} />
        </mesh>
      </group>
      <Glow id={id} position={[p[0], p[1] - 0.2, p[2]]} intensity={9} reach={7} />
    </Switch>
  )
}

function Lamps() {
  const comedor = useLightOn('comedor')
  const pie = useLightOn('pie')
  const terraza = useLightOn('terraza')
  const pend = at(567, 1546, 0)
  const lamp = at(752, 1632, 0)
  const sconce = at(740, 1690, 205)
  return (
    <>
      <Plafon id="salon" x={905} y={1520} r={20} />
      <Plafon id="dorm1" x={843} y={495} />
      <Plafon id="dorm2" x={790} y={745} />
      <Plafon id="dorm3" x={900} y={1020} />
      <Downlights id="cocina" spots={[[680, 1275], [820, 1275], [960, 1275]]} glows={[[820, 1270]]} />
      <Downlights id="pasillo" spots={[[463, 700], [463, 830], [475, 960], [493, 1110]]} glows={[[463, 760], [480, 1040]]} />
      <Downlights id="bano1" spots={[[460, 445], [570, 465]]} glows={[[520, 450]]} intensity={5} />
      <Downlights id="bano2" spots={[[600, 880], [700, 930]]} glows={[[650, 905]]} intensity={5} />

      {/* LED strip under the wall cupboards (drawn with them, in Kitchen) */}
      <Switch id="cocina-led" hit={[2.8, 0.06, 0.25]} hitAt={at(905, 1190, 144)}>
        <Glow id="cocina-led" position={at(905, 1205, 138)} intensity={2.2} reach={2.6} shadow={false} />
      </Switch>

      {/* bedside lamps (drawn with the nightstands), one switch for both */}
      <Switch id="mesillas" hit={[2.4, 0.4, 0.45]} hitAt={at(898, 377, 74)}>
        <Glow id="mesillas" position={at(795, 377, 72)} intensity={1.6} reach={4} shadow={false} />
        <Glow id="mesillas" position={at(1002, 377, 72)} intensity={1.6} reach={4} shadow={false} />
      </Switch>

      {/* dining pendant: a black metal cone on a cord */}
      <Switch id="comedor" hit={[0.5, 0.3, 0.5]} hitAt={[pend[0], sh(189), pend[2]]}>
        <group position={pend}>
          <mesh position={[0, sh((198 + CEIL) / 2), 0]} material={F.black}>
            <cylinderGeometry args={[0.003, 0.003, c(CEIL - 198), 6]} />
          </mesh>
          <mesh position={[0, sh(189), 0]} material={F.black} castShadow>
            <cylinderGeometry args={[c(5), c(21), c(18), 32, 1, true]} />
          </mesh>
          <mesh position={[0, sh(183), 0]} material={bulbMaterial(comedor)}>
            <sphereGeometry args={[c(5), 16, 12]} />
          </mesh>
        </group>
        <Glow id="comedor" position={[pend[0], sh(176), pend[2]]} intensity={6} reach={6} />
      </Switch>

      {/* floor lamp by the sofa */}
      <Switch id="pie" hit={[0.45, 1.7, 0.45]} hitAt={[lamp[0], 0.85, lamp[2]]}>
        <group position={lamp}>
          <mesh position={[0, 0.01, 0]} material={F.black} castShadow>
            <cylinderGeometry args={[0.15, 0.15, 0.02, 24]} />
          </mesh>
          <mesh position={[0, 0.8, 0]} material={F.black} castShadow>
            <cylinderGeometry args={[0.012, 0.012, 1.58, 8]} />
          </mesh>
          <mesh position={[0, 1.5, 0]} material={F.linen} castShadow>
            <cylinderGeometry args={[0.17, 0.21, 0.28, 32, 1, true]} />
          </mesh>
          <mesh position={[0, 1.46, 0]} material={bulbMaterial(pie)}>
            <sphereGeometry args={[0.04, 16, 12]} />
          </mesh>
        </group>
        <Glow id="pie" position={[lamp[0], 1.35, lamp[2]]} intensity={3.5} reach={5} />
      </Switch>

      {/* terrace wall light, on the façade by the sliding door */}
      <Switch id="terraza" hit={[0.3, 0.3, 0.3]} hitAt={[sconce[0], sconce[1], sconce[2] + 0.08]}>
        <mesh position={[sconce[0], sconce[1], sconce[2] + 0.04]} material={F.railing}>
          <boxGeometry args={[0.14, 0.14, 0.08]} />
        </mesh>
        <mesh position={[sconce[0], sconce[1] - 0.06, sconce[2] + 0.04]} material={bulbMaterial(terraza)}>
          <boxGeometry args={[0.12, 0.01, 0.06]} />
        </mesh>
        <Glow id="terraza" position={[sconce[0], sconce[1] - 0.15, sconce[2] + 0.25]} intensity={3} reach={5} />
      </Switch>
    </>
  )
}

export function Furniture() {
  // Built once: none of this depends on props, only on the contexts.
  const body = useMemo(
    () => (
      <>
        <Bathroom1 />
        <Bathroom2 />
        <Bedrooms />
        <Kitchen />
        <Living />
      </>
    ),
    [],
  )
  return (
    <group>
      {body}
      <Lamps />
    </group>
  )
}
