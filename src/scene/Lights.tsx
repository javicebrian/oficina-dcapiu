import { useFrame, useThree } from '@react-three/fiber'
import { createContext, useContext, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import * as THREE from 'three'
import type { LightId } from '../data/furniture'
import { F as M } from './materials'
import { isFrontmost } from './picking'

// Switchable light fittings. A fitting is wrapped in <Switch>, which makes it
// (and an invisible hit volume round it) clickable; its bulb takes
// bulbMaterial(on), and a <Glow> is the light it gives off.
//
// Each glow is a point light with its own shadows, so it stays in its room
// and its shade shapes it (the dining pendant throws its light down). Small
// fills (the kitchen's LED strip) skip shadows. Shadows only while on: three recompiles
// the shaders when that count changes, a brief hitch on a click rather than
// a cost on every frame. Point shadows are six renders each, so they are not
// redrawn every frame: only when the light changes or a door moves
// (refreshLightShadows), since nothing else in the flat moves.

export interface LightSwitches {
  on: Partial<Record<LightId, boolean>>
  toggle: (id: LightId) => void
  hover: (update: (hovered: string | null) => string | null) => void
  cut: number // m, for picking
}

export const LightsContext = createContext<LightSwitches>({ on: {}, toggle: () => {}, hover: () => {}, cut: 100 })

export const useLightOn = (id: LightId) => !!useContext(LightsContext).on[id]
export const bulbMaterial = (on: boolean) => (on ? M.led : M.ledOff)

const shadowed = new Set<THREE.PointLight>()
/** Point-light shadow maps are frozen; call this when something that casts them moves. */
export function refreshLightShadows() {
  for (const l of shadowed) l.shadow.needsUpdate = true
}

const hitMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })

// The hit volume never shrinks below a finger's reach on screen: from far
// away (the plan view on a phone) a lamp is a few pixels across, and a tap on
// it would select the room underneath. Capped, so it never covers a room.
const MIN_PX = 44
const MAX_M = 1.6
const at = new THREE.Vector3()

/** Makes a fitting clickable. `hit`: an invisible box [w, h, d] in m at `hitAt`, easier to catch than a cord. */
export function Switch({ id, hit, hitAt, children }: { id: LightId; hit: [number, number, number]; hitAt: [number, number, number]; children: ReactNode }) {
  const s = useContext(LightsContext)
  const box = useRef<THREE.Mesh>(null)
  useFrame(({ camera, size }) => {
    const m = box.current
    if (!m || !(camera instanceof THREE.PerspectiveCamera)) return
    const d = camera.position.distanceTo(m.getWorldPosition(at))
    const perPx = (2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / size.height
    const want = Math.min(MAX_M, MIN_PX * perPx)
    m.scale.set(Math.max(1, want / hit[0]), Math.max(1, want / hit[1]), Math.max(1, want / hit[2]))
  })
  return (
    <group
      onClick={(e) => {
        if (!isFrontmost(e, s.cut)) return
        e.stopPropagation()
        s.toggle(id)
      }}
      onPointerMove={(e) => {
        const front = isFrontmost(e, s.cut)
        s.hover((h) => (front ? id : h === id ? null : h))
      }}
      onPointerOut={() => s.hover((h) => (h === id ? null : h))}
    >
      <mesh ref={box} position={hitAt} material={hitMaterial}>
        <boxGeometry args={hit} />
      </mesh>
      {children}
    </group>
  )
}

/** The light a fitting gives off while on. `intensity` in candela; reach in m. */
export function Glow({ id, position, intensity = 8, reach = 7, shadow = true }: {
  id: LightId; position: [number, number, number]; intensity?: number; reach?: number
  shadow?: boolean // off for small fill lights (an LED strip), which would cost a cube map each
}) {
  const on = useLightOn(id)
  const ref = useRef<THREE.PointLight>(null)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const l = ref.current
    if (!l || !shadow) return
    l.shadow.autoUpdate = false
    l.shadow.needsUpdate = true
    shadowed.add(l)
    invalidate()
    return () => void shadowed.delete(l)
  }, [on, shadow, invalidate])
  return (
    <pointLight
      ref={ref}
      position={position}
      color="#ffd8a6" // warm white, ~2700 K
      intensity={on ? intensity : 0}
      distance={reach}
      decay={2}
      castShadow={on && shadow}
      shadow-mapSize={[512, 512]}
      shadow-bias={-0.004}
      shadow-normalBias={0.02}
      shadow-camera-near={0.05}
      shadow-camera-far={reach}
    />
  )
}
