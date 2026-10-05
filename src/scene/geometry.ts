import * as THREE from 'three'
import type { Pt } from '../data/flat'
import { OUTLINE } from '../data/flat'

// Scene space: metres, y up. Plan x -> scene x, plan y (south) -> scene z, so
// north is -z. The flat (without its terrace) is centred on the origin.
const OX = (OUTLINE[0] + OUTLINE[2]) / 2
const OZ = (OUTLINE[1] + OUTLINE[3]) / 2

export const sx = (x: number) => (x - OX) / 100
export const sz = (y: number) => (y - OZ) / 100
export const sh = (h: number) => h / 100
export const toScene = ([x, y]: Pt): [number, number] => [sx(x), sz(y)]

function shapeOf(pts: Pt[]) {
  // Shape lives in the XY plane and is later rotated flat; its y is -z so the
  // rotation below lands plan-south on +z.
  const s = new THREE.Shape()
  pts.forEach(([x, y], i) => (i ? s.lineTo(sx(x), -sz(y)) : s.moveTo(sx(x), -sz(y))))
  return s
}

/** Vertical prism over a plan polygon, from h0 to h1 (cm above FFL). */
export function prism(pts: Pt[], h0: number, h1: number, holes: Pt[][] = []) {
  const shape = shapeOf(pts)
  for (const h of holes) shape.holes.push(shapeOf(h))
  const g = new THREE.ExtrudeGeometry(shape, { depth: sh(h1 - h0), bevelEnabled: false })
  g.rotateX(-Math.PI / 2)
  g.translate(0, sh(h0), 0)
  return g
}

/** Flat polygon at height h (cm), facing up. */
export function flat(pts: Pt[], h: number) {
  const g = new THREE.ShapeGeometry(shapeOf(pts))
  g.rotateX(-Math.PI / 2)
  g.translate(0, sh(h), 0)
  return g
}

/** Placement of a box running from a to b (plan), t thick, between h0 and h1. */
export function segmentBox(a: Pt, b: Pt, t: number, h0: number, h1: number) {
  const [ax, az] = toScene(a)
  const [bx, bz] = toScene(b)
  return {
    position: [(ax + bx) / 2, sh((h0 + h1) / 2), (az + bz) / 2] as [number, number, number],
    rotation: [0, -Math.atan2(bz - az, bx - ax), 0] as [number, number, number],
    size: [Math.hypot(bx - ax, bz - az), sh(h1 - h0), sh(t)] as [number, number, number],
  }
}

export function centroid(pts: Pt[]): Pt {
  // Area-weighted, so L-shaped rooms put their label inside the bulk.
  let a = 0, cx = 0, cy = 0
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]
    const k = p[0] * q[1] - q[0] * p[1]
    a += k
    cx += (p[0] + q[0]) * k
    cy += (p[1] + q[1]) * k
  })
  return [cx / (3 * a), cy / (3 * a)]
}

export function bounds(pts: Pt[]) {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

