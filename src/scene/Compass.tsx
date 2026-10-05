import { useMemo } from 'react'
import * as THREE from 'three'
import { LEVELS, OUTLINE, SITE } from '../data/flat'
import { sh, sx, sz } from './geometry'

// N, S, E, O round the flat: N and O on the neighbours' roof, E and S
// down on the two streets, in a quiet grey, so you
// always know which way you are looking. Letters are drawn on canvases (no
// font download) and lie flat with their tops to the north, like a map. The
// whole rose is turned to true north (SITE.trueNorth), about the flat's centre.

const SIZE = 1.6 // metres
const GAP = 2.2 // metres beyond the flat's walls, on the roof next door

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
    const roof = sh(LEVELS.slabTop) + 0.005
    const street = sh(LEVELS.street) + 0.01
    const [x0, x1, z0, z1] = [sx(OUTLINE[0]), sx(OUTLINE[2]), sz(OUTLINE[1]), sz(OUTLINE[3])]
    const [cx, cz] = [(x0 + x1) / 2, (z0 + z1) / 2]
    // the middle of each street's far lane (Surroundings.tsx: 4.5 m and 5 m out, 8 m wide)
    return [
      { ch: 'N', pos: [cx, roof, z0 - GAP] },
      { ch: 'S', pos: [cx, street, z1 + 5 + 6] },
      { ch: 'E', pos: [x1 + 4.5 + 6, street, cz] },
      { ch: 'O', pos: [x0 - GAP - 4.5, roof, cz + 3] }, // clear of the landing
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
