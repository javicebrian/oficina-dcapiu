import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BUILDING, COMMON, LEVELS, LIFT, NEIGHBOURS, OUTLINE, STAIR, rectPts } from '../data/flat'
import type { Pt } from '../data/flat'
import { prism, sh, sx, sz } from './geometry'
import { blocker } from './picking'

// The rest of the block and the street round it, kept plain so the flat
// stays the subject: the two storeys below as a solid with rows of windows,
// the neighbours on this floor as volumes up to the ceiling (the block is
// cut there, like a model) with the common corridor and landing left open,
// the lift and the stair on the landing, pavements, two streets and trees. None of
// it is clipped by the section cut nor takes part in the cutaway; it only
// blocks clicks.

const mat = (color: string, roughness = 0.95) => new THREE.MeshStandardMaterial({ color, roughness })
const S = {
  facade: mat('#efe9df'),
  plinth: mat('#d8cdbd'), // ground floor
  roof: mat('#d3cfc7'),
  glass: mat('#5a6773', 0.3),
  ground: mat('#dedad1'),
  pavement: mat('#cdc8be'),
  asphalt: mat('#86888b'),
  paint: mat('#f2f2ee', 0.8),
  grass: mat('#a9b88d'),
  trunk: mat('#6b5442'),
  leaves: mat('#ffffff', 0.9), // tinted per tree
  stone: mat('#dcd6cb', 0.7), // stair treads
  steel: mat('#b9bec3', 0.4), // lift doors
}

const STREET = LEVELS.street
const KERB = 15 // cm, pavement over the road
const [FX0, FY0, FX1, FY1] = OUTLINE
export const ROAD = 800 // cm wide
export const EAST_ROAD = FX1 + 450 // its west kerb, 4.5 m out from the façade
export const SOUTH_ROAD = FY1 + 500 // its north kerb, 5 m out (the terrace juts 1 m)
const FAR = { x0: -6000, y0: -7000, x1: EAST_ROAD + ROAD + 3000, y1: SOUTH_ROAD + ROAD + 3000 }

function inside([x, y]: Pt, poly: Pt[]) {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

/**
 * Window panes on every outside face of `poly`, one storey: about one every
 * 3.5 m, 1.4 × 1.4 m, sill 0.95 above `floor` (cm). Faces that look into
 * one of `indoors` (the flat, the common corridor) are not façades and get
 * none. Returns one merged geometry.
 */
function windows(poly: Pt[], floor: number, indoors: Pt[][] = []) {
  const parts: THREE.BufferGeometry[] = []
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length]
    const L = Math.hypot(b[0] - a[0], b[1] - a[1])
    const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L
    let nx = -uy, ny = ux
    const mid: Pt = [(a[0] + b[0]) / 2 + nx * 20, (a[1] + b[1]) / 2 + ny * 20]
    if (inside(mid, poly)) [nx, ny] = [-nx, -ny]
    const out: Pt = [(a[0] + b[0]) / 2 + nx * 30, (a[1] + b[1]) / 2 + ny * 30]
    if (indoors.some((q) => inside(out, q))) return
    const n = Math.floor(L / 350)
    for (let k = 0; k < n; k++) {
      const s = (L / n) * (k + 0.5)
      const g = new THREE.BoxGeometry(1.4, 1.4, 0.06)
      g.rotateY(-Math.atan2(uy, ux))
      g.translate(sx(a[0] + ux * s + nx * 2), sh(floor + 95 + 70), sz(a[1] + uy * s + ny * 2))
      parts.push(g)
    }
  })
  return mergeGeometries(parts)
}

const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

/** A flat slab over a plan rectangle, from h0 to h1 (cm). */
function Slab({ r, h0, h1, m }: { r: Pt[]; h0: number; h1: number; m: THREE.Material }) {
  const geometry = useMemo(() => prism(r, h0, h1), [r, h0, h1])
  return <mesh geometry={geometry} material={m} receiveShadow />
}

// Trees: street trees along both pavements, but none in front of the flat's
// own façades, so it is seen whole from the street; a few in the courtyard.
// [x, y] in plan cm, then a size factor.
function treeSpots(): [number, number, number][] {
  const out: [number, number, number][] = []
  const size = (i: number) => 0.85 + ((i * 37) % 10) / 30
  const clear = 250 // cm either side of the flat
  for (let y = BUILDING[0][1] + 400, i = 0; y < SOUTH_ROAD - 200; y += 650, i++) {
    if (y < FY0 - clear || y > FY1 + clear) out.push([FX1 + 250, y, size(i)])
  }
  for (let x = BUILDING[3][0] + 300, i = 0; x < EAST_ROAD; x += 650, i++) {
    if (x < FX0 - clear || x > FX1 + clear) out.push([x, SOUTH_ROAD - 160, size(i + 3)])
  }
  // the courtyard, open to the west
  const [cx0, cy0, cx1, cy1] = [BUILDING[7][0], BUILDING[7][1], BUILDING[6][0], FY0]
  ;[[0.3, 0.3], [0.7, 0.5], [0.4, 0.75], [0.15, 0.8]].forEach(([u, v], i) => out.push([cx0 + (cx1 - cx0) * u, cy0 + (cy1 - cy0) * v, size(i + 7) * 1.1]))
  return out
}

function Trees() {
  const spots = useMemo(treeSpots, [])
  const trunks = useRef<THREE.InstancedMesh>(null)
  const crowns = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const greens = ['#7f9a5f', '#6f8d55', '#8aa36a', '#738f5b'].map((c) => new THREE.Color(c))
    spots.forEach(([x, y, k], i) => {
      const base = sh(STREET + KERB)
      m.compose(new THREE.Vector3(sx(x), base + 1.3 * k, sz(y)), new THREE.Quaternion(), new THREE.Vector3(k, k, k))
      trunks.current?.setMatrixAt(i, m)
      m.compose(new THREE.Vector3(sx(x), base + 3.7 * k, sz(y)), new THREE.Quaternion(), new THREE.Vector3(k, 1.15 * k, k))
      crowns.current?.setMatrixAt(i, m)
      crowns.current?.setColorAt(i, greens[i % greens.length])
    })
    for (const r of [trunks, crowns]) {
      if (!r.current) continue
      r.current.instanceMatrix.needsUpdate = true
      if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true
      r.current.computeBoundingSphere()
    }
  }, [spots])
  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, S.trunk, spots.length]} castShadow>
        <cylinderGeometry args={[0.1, 0.15, 2.6, 8]} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, S.leaves, spots.length]} castShadow receiveShadow>
        <icosahedronGeometry args={[1.6, 1]} />
      </instancedMesh>
    </>
  )
}

/** Dashed centre line along a road, from a to b (plan cm). */
function CentreLine({ a, b }: { a: Pt; b: Pt }) {
  const geometry = useMemo(() => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1])
    const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L
    const parts: THREE.BufferGeometry[] = []
    for (let s = 0; s + 300 < L; s += 900) {
      const g = new THREE.BoxGeometry(3, 0.01, 0.12)
      g.rotateY(-Math.atan2(uy, ux))
      g.translate(sx(a[0] + ux * (s + 150)), sh(STREET) + 0.006, sz(a[1] + uy * (s + 150)))
      parts.push(g)
    }
    return mergeGeometries(parts)
  }, [a, b])
  return <mesh geometry={geometry} material={S.paint} />
}

/** The lift: a shaft up to the cut, two brushed-steel doors to the landing. */
function Lift() {
  const [, y0, x1, y1] = LIFT
  const geometry = useMemo(() => prism(rectPts(LIFT), 0, LEVELS.slabTop), [])
  const cy = (y0 + y1) / 2
  return (
    <>
      <mesh geometry={geometry} material={[S.roof, S.facade]} castShadow receiveShadow />
      <mesh position={[sx(x1) + 0.012, sh(105), sz(cy)]} material={S.steel}>
        <boxGeometry args={[0.02, 2.1, 0.9]} />
      </mesh>
      <mesh position={[sx(x1) + 0.024, sh(105), sz(cy)]} material={S.glass}>
        <boxGeometry args={[0.004, 2.1, 0.01]} />
      </mesh>
      <mesh position={[sx(x1) + 0.02, sh(110), sz(cy - 70)]} material={S.glass}>
        <boxGeometry args={[0.02, 0.12, 0.06]} />
      </mesh>
    </>
  )
}

/**
 * The stair, going up: the first flight rises southwards on the east side
 * to a half-landing, the second comes back north on the west side, cut at
 * the ceiling like the rest of the block; a wall between the flights.
 * (Laid out the other way round, then turned 180° about the stairwell's
 * centre, owner's call.)
 */
function Stair() {
  const g = useMemo(() => {
    const { x0, x1, y0, y1, run, rise } = STAIR
    const mid = (x0 + x1) / 2
    const n = Math.floor((y1 - y0 - 110) / run) // steps per flight; ~1.1 m of half-landing
    const parts: THREE.BufferGeometry[] = []
    // half a turn about the stairwell's centre
    const turn = ([a, b, c, d]: [number, number, number, number]): [number, number, number, number] => [x0 + x1 - c, y0 + y1 - d, x0 + x1 - a, y0 + y1 - b]
    const box = (r: [number, number, number, number], h0: number, h1: number) => parts.push(prism(rectPts(turn(r)), h0, h1))
    for (let i = 0; i < n; i++) box([x0, y1 - (i + 1) * run, mid - 5, y1 - i * run], 0, (i + 1) * rise)
    const top = n * rise
    box([x0, y0, x1, y1 - n * run], top - 20, top) // half-landing
    for (let i = 0; i < n; i++) {
      const h = top + (i + 1) * rise
      if (h > LEVELS.slabTop) break
      box([mid + 5, y1 - n * run + i * run, x1, y1 - n * run + (i + 1) * run], h - 20, h)
    }
    return { treads: mergeGeometries(parts), wall: prism(rectPts(turn([mid - 5, y1 - n * run, mid + 5, y1])), 0, LEVELS.slabTop) }
  }, [])
  return (
    <>
      <mesh geometry={g.treads} material={S.stone} castShadow receiveShadow />
      <mesh geometry={g.wall} material={[S.roof, S.facade]} castShadow receiveShadow />
    </>
  )
}

/** The ground plane: the camera stops at it (Viewer passes it to the controls as a collider). */
export const groundRef: { current: THREE.Mesh | null } = { current: null }

export function Surroundings() {
  const geo = useMemo(() => {
    const top = -LEVELS.floorSlab // underside of this floor's slab
    const ground = STREET + LEVELS.storey
    const indoors = [rectPts(OUTLINE), COMMON]
    return {
      groundFloor: prism(BUILDING, STREET, ground),
      firstFloor: prism(BUILDING, ground, top),
      neighbours: NEIGHBOURS.map((n) => prism(n, top, LEVELS.slabTop)),
      commonSlab: prism(COMMON, top, 0),
      windows: mergeGeometries([windows(BUILDING, STREET), windows(BUILDING, ground), ...NEIGHBOURS.map((n) => windows(n, 0, indoors))]),
    }
  }, [])
  const roads = useMemo(() => ({
    east: rect(EAST_ROAD, FAR.y0, EAST_ROAD + ROAD, FAR.y1),
    south: rect(FAR.x0, SOUTH_ROAD, EAST_ROAD, SOUTH_ROAD + ROAD),
    // pavement under the whole block, out to both kerbs
    pavement: rect(FAR.x0, FAR.y0, EAST_ROAD, SOUTH_ROAD),
    pavementFar: rect(EAST_ROAD + ROAD, FAR.y0, FAR.x1, FAR.y1),
    pavementSouth: rect(FAR.x0, SOUTH_ROAD + ROAD, EAST_ROAD, FAR.y1),
    courtyard: rect(BUILDING[7][0], BUILDING[7][1], BUILDING[6][0], FY0),
    park: rect(FAR.x0 + 400, FAR.y0 + 400, BUILDING[0][0] - 500, SOUTH_ROAD - 400),
  }), [])
  // ExtrudeGeometry's groups: 0 the caps, 1 the sides.
  const massing = [S.roof, S.facade]
  return (
    <group {...blocker}>
      <mesh
        ref={(m) => void (groundRef.current = m)}
        rotation-x={-Math.PI / 2}
        position={[sx((FAR.x0 + FAR.x1) / 2), sh(STREET) - 0.01, sz((FAR.y0 + FAR.y1) / 2)]}
        material={S.ground}
        receiveShadow
      >
        <planeGeometry args={[600, 600]} />
      </mesh>
      <Slab r={roads.east} h0={STREET - 1} h1={STREET} m={S.asphalt} />
      <Slab r={roads.south} h0={STREET - 1} h1={STREET} m={S.asphalt} />
      <CentreLine a={[EAST_ROAD + ROAD / 2, FAR.y0]} b={[EAST_ROAD + ROAD / 2, FAR.y1]} />
      <CentreLine a={[FAR.x0, SOUTH_ROAD + ROAD / 2]} b={[EAST_ROAD, SOUTH_ROAD + ROAD / 2]} />
      <Slab r={roads.pavement} h0={STREET} h1={STREET + KERB} m={S.pavement} />
      <Slab r={roads.pavementFar} h0={STREET} h1={STREET + KERB} m={S.pavement} />
      <Slab r={roads.pavementSouth} h0={STREET} h1={STREET + KERB} m={S.pavement} />
      <Slab r={roads.courtyard} h0={STREET + KERB} h1={STREET + KERB + 1} m={S.grass} />
      <Slab r={roads.park} h0={STREET + KERB} h1={STREET + KERB + 1} m={S.grass} />

      <mesh geometry={geo.groundFloor} material={[S.roof, S.plinth]} castShadow receiveShadow />
      <mesh geometry={geo.firstFloor} material={massing} castShadow receiveShadow />
      {geo.neighbours.map((g, i) => <mesh key={i} geometry={g} material={massing} castShadow receiveShadow />)}
      <mesh geometry={geo.commonSlab} material={S.roof} receiveShadow />
      <Lift />
      <Stair />
      <mesh geometry={geo.windows} material={S.glass} />
      <Trees />
    </group>
  )
}
