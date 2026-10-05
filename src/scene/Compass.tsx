import { useMemo } from 'react'
import * as THREE from 'three'
import { LEVELS, OUTLINE, SITE, TERRACE } from '../data/flat'
import { sh, sx, sz } from './geometry'

// N, S, E, O painted on the table round the flat, in a quiet grey, so you
// always know which way you are looking. Letters are drawn on canvases (no
// font download) and lie flat with their tops to the north, like a map. The
// whole rose is turned to true north (SITE.trueNorth), about the flat's centre.

const SIZE = 1.4 // metres
const GAP = 1.8 // metres beyond the walls (and the terrace, on the south)

function letterTexture(ch: string) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#9e998e'
  g.font = '600 200px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(ch, 128, 140)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export function Compass() {
  const letters = useMemo(() => {
    const y = sh(-LEVELS.floorSlab) + 0.005
    const [x0, x1, z0, z1] = [sx(OUTLINE[0]), sx(OUTLINE[2]), sz(OUTLINE[1]), sz(TERRACE[3])]
    const [cx, cz] = [(x0 + x1) / 2, (z0 + z1) / 2]
    return [
      { ch: 'N', pos: [cx, y, z0 - GAP] },
      { ch: 'S', pos: [cx, y, z1 + GAP] },
      { ch: 'E', pos: [x1 + GAP, y, cz] },
      { ch: 'O', pos: [x0 - GAP, y, cz] },
    ].map((l) => ({
      ...l,
      material: new THREE.MeshBasicMaterial({ map: letterTexture(l.ch), transparent: true, opacity: 0.75, depthWrite: false }),
    }))
  }, [])
  return (
    <group rotation-y={(-SITE.trueNorth * Math.PI) / 180}>
      {letters.map((l) => (
        <mesh key={l.ch} position={l.pos as [number, number, number]} rotation-x={-Math.PI / 2} material={l.material} raycast={() => null}>
          <planeGeometry args={[SIZE, SIZE]} />
        </mesh>
      ))}
    </group>
  )
}
