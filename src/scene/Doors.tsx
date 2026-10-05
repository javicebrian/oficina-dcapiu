import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { ReactNode } from 'react'
import * as THREE from 'three'
import { openings } from '../data/flat'
import type { Finish, Opening } from '../data/flat'
import { toScene } from './geometry'
import { M } from './materials'
import { refreshLightShadows } from './Lights'
import { isFrontmost } from './picking'

// Every door and window: they all open and close on a click.
export const doors = openings

const cm = (v: number) => v / 100
const LEAF_T = 4 // cm
const SPEED = 1.4 // full travel per second

/**
 * Local frame of an opening: origin on the wall centreline at `a`, x along
 * a→b, y up from the floor, z towards the `side: 1` direction. All leaf
 * geometry below is written in this frame.
 */
function frame(o: Opening) {
  const [ax, az] = toScene(o.a)
  const [bx, bz] = toScene(o.b)
  return {
    position: [ax, 0, az] as const,
    rotationY: -Math.atan2(bz - az, bx - ax),
    len: Math.hypot(bx - ax, bz - az) * 100,
  }
}

/** A flat leaf from x=0..w, y=0..h (cm), centred on z=0, in the given finish. */
function LeafBody({ w, h, finish, t = LEAF_T, handleAt }: { w: number; h: number; finish: Finish; t?: number; handleAt?: number }) {
  const box = (x0: number, x1: number, y0: number, y1: number, tt: number, mat: THREE.Material, key?: string | number, seeThrough = false) => (
    <mesh
      key={key}
      position={[cm((x0 + x1) / 2), cm((y0 + y1) / 2), 0]}
      material={mat}
      castShadow={!seeThrough}
      userData={{ seeThrough }}
    >
      <boxGeometry args={[cm(x1 - x0), cm(y1 - y0), cm(tt)]} />
    </mesh>
  )
  if (finish === 'glass') {
    const f = 5 // frame width
    return (
      <>
        {box(0, w, 0, f, t, M.winFrame, 'b')}
        {box(0, w, h - f, h, t, M.winFrame, 't')}
        {box(0, f, f, h - f, t, M.winFrame, 'l')}
        {box(w - f, w, f, h - f, t, M.winFrame, 'r')}
        {box(f, w - f, f, h - f, 1.5, M.glass, 'g', true)}
      </>
    )
  }
  const mat = finish === 'wood' ? M.door : M.leaf
  return (
    <>
      {box(0, w, 0, h, t, mat, 'leaf')}
      {handleAt !== undefined && box(handleAt - 6, handleAt + 6, 100, 103, t + 5, finish === 'wood' ? M.chrome : M.frame, 'handle')}
    </>
  )
}

/** Eases `open` towards its target and keeps requesting frames until it gets there. */
export function useTravel(open: boolean) {
  const v = useRef(open ? 1 : 0)
  const eased = useRef(v.current)
  useFrame((state, dt) => {
    const target = open ? 1 : 0
    if (v.current === target) return
    const step = Math.min(dt, 0.05) * SPEED
    v.current = target > v.current ? Math.min(target, v.current + step) : Math.max(target, v.current - step)
    eased.current = v.current * v.current * (3 - 2 * v.current) // smoothstep
    refreshLightShadows() // lamp light through a moving door
    state.invalidate()
  })
  return eased
}

function Leaves({ o, open }: { o: Opening; open: boolean }) {
  const t = useTravel(open)
  const { len } = frame(o)
  const h = o.head - o.sill - 1
  const { leaf, finish } = o.door
  const refs = useRef<(THREE.Object3D | null)[]>([])
  const set = (i: number) => (el: THREE.Object3D | null) => void (refs.current[i] = el)

  // Each moving part registers how it moves; useFrame applies the eased value.
  const moves: ((obj: THREE.Object3D, k: number) => void)[] = []
  const parts: ReactNode[] = []

  if (leaf.op === 'swing') {
    // A hinge on a stays at x=0 with the leaf along +x; on b, at x=len along -x.
    // Rotating by α about y sends local x to (cos α, -sin α), so the leaf's
    // free end reaches z = side when α = ∓side·90°.
    const fromA = leaf.hinge === 'a'
    const w = len - 2
    const zOff = leaf.side * Math.max(0, o.t / 2 - 3 - LEAF_T / 2)
    parts.push(
      <group key="s" ref={set(0)} position={[cm(fromA ? 1 : len - 1), cm(o.sill), cm(zOff)]}>
        <group position={[fromA ? 0 : -cm(w), 0, 0]}>
          <LeafBody w={w} h={h} finish={finish} handleAt={fromA ? w - 8 : 8} t={finish === 'wood' ? 6 : LEAF_T} />
        </group>
      </group>,
    )
    const dir = (fromA ? -1 : 1) * leaf.side
    moves.push((obj, k) => void (obj.rotation.y = (dir * k * Math.PI) / 2))
  } else {
    // Two sashes on two tracks, 6 cm apart: the one at a slides over the one at b.
    const pw = len / 2
    for (let i = 0; i < 2; i++) {
      parts.push(
        <group key={i} ref={set(i)} position={[cm(i * pw), cm(o.sill), cm(i === 0 ? -3 : 3)]}>
          <LeafBody w={pw} h={h} finish={finish} />
        </group>,
      )
    }
    moves[0] = (obj, k) => void (obj.position.x = cm(pw * 0.92 * k))
  }

  useFrame(() => {
    moves.forEach((m, i) => {
      const obj = refs.current[i]
      if (m && obj) m(obj, t.current)
    })
  })

  return <>{parts}</>
}

const hitMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })

export function Doors({ open, cut, onToggle, onHover }: {
  open: Record<string, boolean>
  cut: number // metres
  onToggle: (id: string) => void
  onHover: (update: (hovered: string | null) => string | null) => void
}) {
  return (
    <>
      {doors.map((o) => {
        const f = frame(o)
        const id = o.door.id
        return (
          <group
            key={id}
            position={f.position}
            rotation-y={f.rotationY}
            onClick={(e) => {
              if (!isFrontmost(e, cut)) return
              e.stopPropagation()
              onToggle(id)
            }}
            onPointerMove={(e) => {
              const front = isFrontmost(e, cut)
              onHover((h) => (front ? id : h === id ? null : h))
            }}
            onPointerOut={() => onHover((h) => (h === id ? null : h))}
          >
            {/* invisible box filling the opening, so the opening itself is the click target */}
            <mesh position={[cm(f.len / 2), cm((o.sill + o.head) / 2), 0]} material={hitMaterial}>
              <boxGeometry args={[cm(f.len), cm(o.head - o.sill), cm(Math.max(o.t, 10))]} />
            </mesh>
            <Leaves o={o} open={!!open[id]} />
          </group>
        )
      })}
    </>
  )
}
