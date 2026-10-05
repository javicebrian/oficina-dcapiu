import { useMemo } from 'react'
import * as THREE from 'three'
import { LEVELS, OUTLINE, TERRACE, openings, rectPts, walls } from '../data/flat'
import type { Opening, Pt } from '../data/flat'
import { prism, segmentBox, sh } from './geometry'
import { M } from './materials'
import { blocker } from './picking'

/** A solid seen with its poché: front faces lit, back faces flat dark. */
function Solid({ geometry, material = M.wall }: { geometry: THREE.BufferGeometry; material?: THREE.Material }) {
  return (
    <group>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
      <mesh geometry={geometry} material={M.poche} />
    </group>
  )
}

function Box({ a, b, t, h0, h1, material, poche = true }: {
  a: Pt; b: Pt; t: number; h0: number; h1: number; material: THREE.Material; poche?: boolean
}) {
  const { position, rotation, size } = segmentBox(a, b, t, h0, h1)
  return (
    <group position={position} rotation={rotation}>
      <mesh material={material} castShadow receiveShadow>
        <boxGeometry args={size} />
      </mesh>
      {poche && (
        <mesh material={M.poche}>
          <boxGeometry args={size} />
        </mesh>
      )}
    </group>
  )
}

/** What does not move in an opening: the wall under the sill and over the head. */
function OpeningFill({ o }: { o: Opening }) {
  const top = LEVELS.ceiling
  return (
    <>
      {o.sill > 0 && <Box a={o.a} b={o.b} t={o.t} h0={0} h1={o.sill} material={M.wall} />}
      {o.head < top && <Box a={o.a} b={o.b} t={o.t} h0={o.head} h1={top} material={M.wall} />}
    </>
  )
}

/** The terrace's balustrade: a dark metal top rail and posts, glass between. */
function Railing() {
  const [x0, y0, x1, y1] = TERRACE
  const h = LEVELS.railing
  const runs: [Pt, Pt][] = [
    [[x0 + 2, y0], [x0 + 2, y1 - 2]],
    [[x0 + 2, y1 - 2], [x1 - 2, y1 - 2]],
    [[x1 - 2, y1 - 2], [x1 - 2, y0]],
  ]
  return (
    <>
      {runs.map(([a, b], i) => {
        const L = Math.hypot(b[0] - a[0], b[1] - a[1])
        const n = Math.max(1, Math.round(L / 110))
        const posts = Array.from({ length: n + 1 }, (_, k): Pt => [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n])
        return (
          <group key={i}>
            <Box a={a} b={b} t={5} h0={h - 4} h1={h} material={M.railing} poche={false} />
            <Box a={a} b={b} t={1.2} h0={8} h1={h - 4} material={M.glass} poche={false} />
            {posts.map((p, k) => (
              <Box key={k} a={[p[0] - 2, p[1]]} b={[p[0] + 2, p[1]]} t={4} h0={0} h1={h} material={M.railing} poche={false} />
            ))}
          </group>
        )
      })}
    </>
  )
}

const SHADOW_ONLY = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })

export function Model({ showCeiling }: { showCeiling: boolean }) {
  const geo = useMemo(() => {
    const slab = LEVELS.floorSlab
    return {
      walls: walls.map((w) => ({ geometry: prism(rectPts(w.rect), 0, LEVELS.ceiling), kind: w.kind })),
      floorSlab: prism(rectPts(OUTLINE), -slab, 0),
      terraceSlab: prism(rectPts(TERRACE), -slab, 0),
      ceiling: prism(rectPts(OUTLINE), LEVELS.ceiling, LEVELS.slabTop),
    }
  }, [])

  return (
    <group {...blocker}>
      {/* the table the model stands on */}
      <mesh rotation-x={-Math.PI / 2} position={[0, sh(-LEVELS.floorSlab) - 0.01, 0]} material={M.world} receiveShadow>
        <planeGeometry args={[200, 200]} />
      </mesh>
      <Solid geometry={geo.floorSlab} material={M.slab} />
      <Solid geometry={geo.terraceSlab} material={M.slab} />

      {geo.walls.map((w, i) => <Solid key={i} geometry={w.geometry} material={w.kind === 'pillar' ? M.pillar : M.wall} />)}
      {openings.map((o, i) => <OpeningFill key={i} o={o} />)}
      <Railing />

      {showCeiling ? (
        <Solid geometry={geo.ceiling} material={M.ceiling} />
      ) : (
        // Ceiling off: still there for the sun, so the rooms stay in its
        // shadow and light only comes in through the windows. Invisible
        // (draws nothing) and not clickable, but it renders into the shadow map.
        <mesh geometry={geo.ceiling} material={SHADOW_ONLY} castShadow raycast={() => null} />
      )}
    </group>
  )
}
