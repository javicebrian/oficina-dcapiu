import { CameraControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { FULL_HEIGHT, LEVELS, OUTLINE, TERRACE, px, rooms } from '../data/flat'
import { bounds, sh, sx, sz } from './geometry'
import { Compass } from './Compass'
import { setCutaway } from './cutaway'
import { Doors } from './Doors'
import { CabinetsContext, Furniture } from './Furniture'
import type { Cabinets } from './Furniture'
import { LightsContext } from './Lights'
import type { LightSwitches } from './Lights'
import { cutPlane } from './materials'
import { Model } from './Model'
import { EAST_ROAD, ROAD, SOUTH_ROAD, Surroundings, groundRef } from './Surroundings'
import { Rooms } from './Rooms'
import { Sun } from './Sun'

export type ViewName = 'aerial' | 'top' | 'kitchen' | 'terrace' | 'street'

// Scene point of a scan pixel at height h (cm).
const P = (x: number, y: number, h: number) => {
  const [a, b] = px(x, y)
  return [sx(a), sh(h), sz(b)] as const
}
// The middle of the flat and its terrace, in scene space.
const MZ = (sz(OUTLINE[1]) + sz(TERRACE[3])) / 2

// [camera xyz, target xyz]
const VIEWS: Record<ViewName, [number, number, number, number, number, number]> = {
  aerial: [9, 15, MZ + 15, 0, -1.5, MZ], // from the south-east, steep enough to see into the rooms and the drop to the street
  top: [0, 30, MZ, 0, 0, MZ], // straight down; orientation and height set by framed()
  kitchen: [...P(690, 1545, 650), ...P(840, 1200, 50)], // from over the salón, steep enough to clear the partition (render 1)
  terrace: [...P(640, 2350, 420), ...P(720, 1500, 100)], // from the south, over the terrace
  // standing in the crossing south-east of the flat, looking up at its corner
  street: [sx(EAST_ROAD + ROAD * 0.6), sh(LEVELS.street + 170), sz(SOUTH_ROAD + ROAD * 0.6), sx(OUTLINE[2] - 250), 1.2, sz(OUTLINE[3] - 400)],
}

export interface ViewRequest {
  view: ViewName | null
  room: string | null
  seq: number // bump to re-run the same request
}

interface Props {
  showCeiling: boolean
  cut: number // cm above the floor
  labels: boolean
  furniture: boolean
  selected: string | null
  focused: string | null // the framed room: orbited, its hiding walls cut away
  hovered: string | null
  request: ViewRequest
  doorsOpen: Record<string, boolean>
  sunAt: number // the instant whose sunlight to show (ms since epoch)
  lightsOn: LightSwitches['on']
  onToggleLight: LightSwitches['toggle']
  onLightHover: LightSwitches['hover']
  onSelect: (id: string | null) => void
  onHover: (update: (hovered: string | null) => string | null) => void
  onToggleDoor: (id: string) => void
  onDoorHover: (update: (hovered: string | null) => string | null) => void
}

const FOV = 35
// The flat in plan, with a margin: E–W and N–S (terrace included), metres.
const SPAN = { ew: (OUTLINE[2] - OUTLINE[0] + 150) / 100, ns: (TERRACE[3] - OUTLINE[1] + 150) / 100 }

/** Presets are framed for a landscape screen; back off on narrow ones. */
function framed(view: ViewName, aspect: number) {
  const [px, py, pz, tx, ty, tz] = VIEWS[view]
  if (view === 'top') {
    // Straight down, the flat's long side along the screen's: north up on a
    // portrait screen, east up on a landscape one. The tiny offset sets which
    // way is up; the height fits the flat to the screen.
    const t = 2 * Math.tan((FOV / 2) * (Math.PI / 180))
    const [up, across] = aspect < 1 ? [SPAN.ns, SPAN.ew] : [SPAN.ew, SPAN.ns]
    // +3 m: the walls' tops stand 2.6 m nearer the camera than the floor.
    const h = Math.max(up / t, across / (t * aspect)) + 3
    return aspect < 1 ? ([px, h, pz + 0.01, tx, ty, tz] as const) : ([px - 0.01, h, pz, tx, ty, tz] as const)
  }
  // Views from inside or below are placed exactly: backing off would go
  // through a wall or under the street.
  if (view === 'kitchen' || view === 'street') return VIEWS[view]
  const k = Math.min(2.4, Math.max(1, 1.5 / aspect))
  return [tx + (px - tx) * k, ty + (py - ty) * k, tz + (pz - tz) * k, tx, ty, tz] as const
}

function CameraRig({ request }: { request: ViewRequest }) {
  const ref = useRef<CameraControls>(null)
  const invalidate = useThree((s) => s.invalidate)
  const get = useThree((s) => s.get)
  const aspect = useThree((s) => s.size.width / s.size.height)
  // Read at request time only: resizing the window should not move the camera.
  const aspectRef = useRef(aspect)
  aspectRef.current = aspect
  // `#debug` in the URL exposes the camera, for scripted screenshots.
  useEffect(() => {
    if (!location.hash.includes('debug')) return
    const w = window as unknown as { __flat?: unknown }
    w.__flat = {
      lookAt: (...v: [number, number, number, number, number, number]) => {
        void ref.current?.setLookAt(...v, false)
        invalidate()
      },
      // Screen pixels of a scene point, e.g. to tap a lamp in a test.
      project: (x: number, y: number, z: number) => {
        const { camera, size } = get()
        const p = new THREE.Vector3(x, y, z).project(camera)
        return [((p.x + 1) / 2) * size.width, ((1 - p.y) / 2) * size.height]
      },
    }
  }, [invalidate, get])
  // The street stops the camera (effects run after the whole tree mounts).
  useEffect(() => {
    if (ref.current && groundRef.current) ref.current.colliderMeshes = [groundRef.current]
  }, [])
  useEffect(() => {
    const c = ref.current
    if (!c) return
    if (request.room) {
      const room = rooms.find((r) => r.id === request.room)
      if (!room) return
      const b = bounds(room.poly)
      const cx = sx((b.x0 + b.x1) / 2)
      const cz = sz((b.y0 + b.y1) / 2)
      const r = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 100
      // A three-quarter view from the south-east: the walls in the way are cut
      // away while the room is selected (RoomFocus), so it need not be steep.
      const d = Math.max(7, r * 2.6)
      const elev = (40 * Math.PI) / 180
      const [ux, uz] = [0.5, 0.866] // horizontal direction to the camera
      const h = d * Math.cos(elev)
      void c.setLookAt(cx + h * ux, d * Math.sin(elev), cz + h * uz, cx, 0.8, cz, true)
    } else if (request.view) {
      void c.setLookAt(...framed(request.view, aspectRef.current), request.seq > 0)
    }
  }, [request])
  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={2}
      maxDistance={120}
      // Below the horizontal too, for looking up from the street; the ground
      // plane is a collider, so the camera never goes under it.
      maxPolarAngle={Math.PI * 0.72}
      dollySpeed={0.6}
      smoothTime={0.35}
    />
  )
}

const ORBIT_SPEED = (2 * Math.PI) / 45 // rad/s: a turn every 45 s
const SETTLE = 1.4 // s after framing before the turn starts
const IDLE = 3 // s after the user lets go before it resumes

/**
 * While a room is selected: the camera slowly turns round it, and whatever
 * stands between the camera and the room is cut away. Both stop on deselect.
 * Renders continuously meanwhile (the scene is otherwise drawn on demand).
 */
function RoomFocus({ room }: { room: string | null }) {
  const controls = useThree((s) => s.controls) as CameraControls | null
  const invalidate = useThree((s) => s.invalidate)
  const resumeAt = useRef(0)
  const box = useMemo(() => {
    const r = rooms.find((x) => x.id === room)
    return r ? r.poly.map(([x, y]) => [sx(x), sz(y)] as [number, number]) : null
  }, [room])

  useEffect(() => {
    resumeAt.current = performance.now() / 1000 + SETTLE
    if (!box) setCutaway(null)
    invalidate()
  }, [box, invalidate])

  // Hold the turn while the user drags or zooms, and a little after.
  useEffect(() => {
    if (!controls) return
    const hold = () => void (resumeAt.current = Infinity)
    const release = () => void (resumeAt.current = performance.now() / 1000 + IDLE)
    controls.addEventListener('controlstart', hold)
    controls.addEventListener('controlend', release)
    return () => {
      controls.removeEventListener('controlstart', hold)
      controls.removeEventListener('controlend', release)
    }
  }, [controls])

  useFrame((state, dt) => {
    if (!box) return
    setCutaway(box, state.camera.position)
    if (controls && performance.now() / 1000 > resumeAt.current) void controls.rotate(ORBIT_SPEED * Math.min(dt, 0.1), 0, false)
    state.invalidate()
  })
  return null
}

/** Moves the shared clipping plane. It keeps what lies below it, in metres. */
function Cut({ cm }: { cm: number }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    // At full height, park the plane well clear: sitting exactly on the
    // ceiling slab's top face would clip it by rounding and show the poché.
    cutPlane.constant = cm >= FULL_HEIGHT ? 1000 : cm / 100
    invalidate()
  }, [cm, invalidate])
  return null
}

export function Viewer(p: Props) {
  const cutM = p.cut >= FULL_HEIGHT ? 100 : p.cut / 100
  const lights = useMemo<LightSwitches>(
    () => ({ on: p.lightsOn, toggle: p.onToggleLight, hover: p.onLightHover, cut: cutM }),
    [p.lightsOn, p.onToggleLight, p.onLightHover, cutM],
  )
  // The water-heater column opens like a door, from the same state.
  const cabinets = useMemo<Cabinets>(
    () => ({ open: p.doorsOpen, toggle: p.onToggleDoor, hover: p.onDoorHover, cut: cutM }),
    [p.doorsOpen, p.onToggleDoor, p.onDoorHover, cutM],
  )
  const ceiling = p.showCeiling && p.cut > LEVELS.ceiling
  return (
    <Canvas
      shadows
      // Render on demand: the model is static, so frames are only drawn while
      // the camera moves or something changes. Saves battery and fans.
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ localClippingEnabled: true, antialias: true }}
      camera={{ fov: FOV, near: 0.1, far: 500, position: VIEWS.aerial.slice(0, 3) as [number, number, number] }}
      onPointerMissed={() => p.onSelect(null)}
    >
      <Sun at={p.sunAt} />
      <Cut cm={p.cut} />
      <CameraRig request={p.request} />
      <RoomFocus room={p.focused} />
      <Model showCeiling={ceiling} />
      <Surroundings />
      <Rooms
        selected={p.selected}
        hovered={p.hovered}
        // Labels are DOM overlays and would float over a closed ceiling.
        labels={p.labels && !ceiling}
        cut={cutM}
        onSelect={p.onSelect}
        onHover={p.onHover}
      />
      <Compass />
      <LightsContext.Provider value={lights}>
        <CabinetsContext.Provider value={cabinets}>{p.furniture && <Furniture />}</CabinetsContext.Provider>
      </LightsContext.Provider>
      <Doors open={p.doorsOpen} cut={cutM} onToggle={p.onToggleDoor} onHover={p.onDoorHover} />
    </Canvas>
  )
}
