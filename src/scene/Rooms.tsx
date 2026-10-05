import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { areaM2, rooms } from '../data/flat'
import type { Room } from '../data/flat'
import { centroid, flat, sx, sz } from './geometry'
import { outdoorTexture, tileTexture, woodTexture } from './floorTexture'
import { SELECT_TINT } from './materials'
import { isFrontmost } from './picking'
import { m2 } from '../ui/format'

interface Props {
  selected: string | null
  hovered: string | null
  labels: boolean
  cut: number // metres; hits above it are on clipped-away geometry
  onSelect: (id: string) => void
  onHover: (update: (hovered: string | null) => string | null) => void
}

function RoomFloor({ room, state, cut, onSelect, onHover }: {
  room: Room; state: 'idle' | 'hover' | 'selected'; cut: number
  onSelect: Props['onSelect']; onHover: Props['onHover']
}) {
  const geometry = useMemo(() => flat(room.poly, 0.5), [room])
  // Oak in the dry rooms, porcelain tiles in the bathrooms and on the
  // terrace; selection tints it.
  const map = room.floor === 'tile' ? tileTexture() : room.floor === 'outdoor' ? outdoorTexture() : woodTexture()
  const color = state === 'selected' ? SELECT_TINT : '#ffffff'
  return (
    <mesh
      geometry={geometry}
      receiveShadow
      onClick={(e) => {
        if (!isFrontmost(e, cut)) return
        e.stopPropagation()
        onSelect(room.id)
      }}
      onPointerMove={(e) => {
        // Losing the front (a wall now in the way) counts as leaving.
        const front = isFrontmost(e, cut)
        onHover((h) => (front ? room.id : h === room.id ? null : h))
      }}
      onPointerOut={() => onHover((h) => (h === room.id ? null : h))}
    >
      <meshStandardMaterial map={map} color={color} roughness={room.floor === 'wood' ? 0.5 : 0.35} emissive={state === 'hover' ? '#ffffff' : '#000000'} emissiveIntensity={0.12} />
    </mesh>
  )
}

export function Rooms({ selected, hovered, labels, cut, onSelect, onHover }: Props) {
  // drei's <Html> mounts into the element the canvas events are connected to,
  // but before that happens it falls back to the canvas's parent, and later
  // unmounts from the wrong one (a removeChild error when labels start on,
  // e.g. ?rotulos=si). Wait for the connection.
  const connected = useThree((s) => !!s.events.connected)
  return (
    <group>
      {rooms.map((room) => {
        const state = room.id === selected ? 'selected' : room.id === hovered ? 'hover' : 'idle'
        const [cx, cy] = room.label ?? centroid(room.poly)
        return (
          <group key={room.id}>
            <RoomFloor room={room} state={state} cut={cut} onSelect={onSelect} onHover={onHover} />
            {labels && connected && (
              <Html position={[sx(cx), 0.05, sz(cy)]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
                <div className={`room-label ${state}`}>
                  <span className="name">{room.name}</span>
                  <span className="area">{m2(areaM2(room.poly))}</span>
                </div>
              </Html>
            )}
          </group>
        )
      })}
    </group>
  )
}
