import type { ThreeEvent } from '@react-three/fiber'
import type * as THREE from 'three'
import { isCutAway } from './cutaway'

// R3F only raycasts objects that carry event handlers, and hands an event to
// every one of them under the pointer, nearest first. Two consequences:
//  - anything that should block the pointer (walls, roof, ground) must carry
//    a handler too, even a no-op one: see `blocker` below;
//  - a target must check that it is the nearest *visible* hit itself. The
//    raycaster knows nothing of the section cut or the selected room's
//    cutaway, and glass should let clicks through to whatever is behind it.

type AnyEvent = ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>

function seeThrough(o: THREE.Object3D | null) {
  for (; o; o = o.parent) if (o.userData.seeThrough) return true
  return false
}

/** True when the nearest visible thing under the pointer belongs to the handler's object. */
export function isFrontmost(e: AnyEvent, cut: number) {
  const hit = e.intersections.find((i) => i.point.y <= cut + 1e-3 && !seeThrough(i.object) && !isCutAway(i.point))
  for (let o: THREE.Object3D | null = hit?.object ?? null; o; o = o.parent) if (o === e.eventObject) return true
  return false
}

const noop = () => {}
/** Spread onto a group so its meshes stop clicks and hovers reaching what is behind. */
export const blocker = { onClick: noop, onPointerMove: noop }
