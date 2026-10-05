import { useMemo } from 'react'
import * as THREE from 'three'
import { sunDirection, sunPosition } from './sun'

// Daylight at a given instant: a directional light where the real sun is,
// warmer and weaker near the horizon, gone at night, with the sky (the
// background and the hemisphere fill) following from day to dusk to night.

const DISTANCE = 30 // m from the flat's centre; only the direction matters
const RAD = Math.PI / 180

const DAY_SKY = new THREE.Color('#eef0f2')
const DUSK_SKY = new THREE.Color('#e9ddd0')
const NIGHT_SKY = new THREE.Color('#2a3140')
const NOON_SUN = new THREE.Color('#fff7ec')
const LOW_SUN = new THREE.Color('#ffb36e')

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

export function Sun({ at }: { at: number }) {
  const s = useMemo(() => {
    const pos = sunPosition(at)
    const deg = pos.altitude / RAD
    const [dx, dy, dz] = sunDirection(pos)
    const day = smooth(-6, 8, deg) // civil twilight to a low morning sun
    const high = smooth(2, 30, deg)
    const sky = NIGHT_SKY.clone().lerp(DUSK_SKY, day).lerp(DAY_SKY, high)
    return {
      position: [dx * DISTANCE, dy * DISTANCE, dz * DISTANCE] as [number, number, number],
      intensity: 2.4 * smooth(-0.5, 12, deg),
      color: LOW_SUN.clone().lerp(NOON_SUN, high),
      hemi: 0.6 + 1.0 * day, // dim at night, but the model stays readable
      sky: `#${sky.getHexString()}`,
    }
  }, [at])

  return (
    <>
      <color attach="background" args={[s.sky]} />
      <fog attach="fog" args={[s.sky, 100, 220]} />
      <hemisphereLight args={['#ffffff', '#c9c3b5', s.hemi]} />
      {/* Aimed at the plot centre (the light's default target, the origin).
          The shadow box covers the flat, its terrace and the street below it from
          any direction; the rest of the block falls outside, unshadowed. */}
      <directionalLight
        position={s.position}
        intensity={s.intensity}
        color={s.color}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-17}
        shadow-camera-right={17}
        shadow-camera-top={17}
        shadow-camera-bottom={-17}
        shadow-camera-near={1}
        shadow-camera-far={70}
      />
    </>
  )
}
