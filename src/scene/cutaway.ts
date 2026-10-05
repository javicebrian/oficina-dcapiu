import * as THREE from 'three'

// Cutaway for the selected room: the walls between the camera and the room
// disappear, so you see into it from any side while orbiting.
//
// A cone from the camera to the room: its axis runs to the room's centre and
// it is just wide enough to take in the whole room. Wall fragments inside the
// cone and nearer the camera than the room's centre (in plan) are dropped, so
// the walls on the far side of the room stay. Only the building takes part
// (walls, lintels, doors, windows, paint); furniture never does. Walls keep a
// low stub, which shows where they stand, and while it is on, the inside of a
// cut wall (the poché, dark for the section cut) takes the wall's colour, so a
// cut reads as solid wall.
//
// Only what is drawn changes: shadows are cast from unpatched depth materials,
// so the sun and the lamps still see every wall, and picking skips the same
// points (isCutAway), so clicks reach the room through what is gone.

export const WALL_STUB = 0.1 // m of wall left standing
const MARGIN = 0.5 // m added round the room when sizing the cone

const uniforms = {
  uCutOn: { value: 0 },
  uCutEye: { value: new THREE.Vector3() },
  uCutCentre: { value: new THREE.Vector3() },
  uCutCos: { value: 1 }, // cosine of the cone's half-angle
}
let radius = 0 // m: the room's reach from its centre, in plan, plus the margin

/** Turns the cutaway on round a room outline (scene metres, [x, z]) seen from `eye`, or off. */
export function setCutaway(room: [number, number][] | null, eye?: THREE.Vector3) {
  uniforms.uCutOn.value = room ? 1 : 0
  if (!room || !eye) return
  const xs = room.map((p) => p[0]), zs = room.map((p) => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2
  radius = Math.max(...room.map(([x, z]) => Math.hypot(x - cx, z - cz))) + MARGIN
  const c = uniforms.uCutCentre.value.set(cx, 1.2, cz)
  uniforms.uCutEye.value.copy(eye)
  const d = eye.distanceTo(c)
  uniforms.uCutCos.value = Math.cos(Math.atan2(radius, d))
}

const v = new THREE.Vector3()
const axis = new THREE.Vector3()
/** The same test as the shader, for picking. */
export function isCutAway(p: THREE.Vector3, stub = WALL_STUB) {
  if (!uniforms.uCutOn.value || p.y <= stub) return false
  const { uCutEye: e, uCutCentre: c, uCutCos: k } = uniforms
  v.subVectors(p, e.value)
  axis.subVectors(c.value, e.value)
  const inFront = Math.hypot(v.x, v.z) < Math.hypot(axis.x, axis.z)
  return inFront && v.normalize().dot(axis.normalize()) > k.value
}

const VERTEX = /* glsl */ `
varying vec3 vCutWorld;
`
const FRAGMENT = /* glsl */ `
varying vec3 vCutWorld;
uniform float uCutOn;
uniform float uCutStub;
uniform float uCutCos;
uniform vec3 uCutEye;
uniform vec3 uCutCentre;
`
const DISCARD = /* glsl */ `
if (uCutOn > 0.5 && vCutWorld.y > uCutStub) {
  vec3 cutV = vCutWorld - uCutEye, cutAxis = uCutCentre - uCutEye;
  if (length(cutV.xz) < length(cutAxis.xz) && dot(normalize(cutV), normalize(cutAxis)) > uCutCos) discard;
}
`

/**
 * Lets a building material take part in the cutaway. `stub`: height (m) below
 * which it always stays; `solid`: the colour it takes while the cutaway is on
 * (for the poché).
 */
export function patchCutaway<T extends THREE.Material>(m: T, stub = 0.005, solid?: THREE.Color): T {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, { uCutStub: { value: stub } })
    shader.vertexShader = VERTEX + shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\nvCutWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    )
    let frag = FRAGMENT + shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      '#include <clipping_planes_fragment>\n' + DISCARD,
    )
    if (solid) {
      frag = frag.replace(
        '#include <color_fragment>',
        `#include <color_fragment>\nif (uCutOn > 0.5) diffuseColor.rgb = vec3(${solid.r.toFixed(4)}, ${solid.g.toFixed(4)}, ${solid.b.toFixed(4)});`,
      )
    }
    shader.fragmentShader = frag
  }
  m.customProgramCacheKey = () => (solid ? 'cutaway-solid' : 'cutaway')
  return m
}
