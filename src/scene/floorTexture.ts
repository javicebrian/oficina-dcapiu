import * as THREE from 'three'

// Floors drawn on canvases. Wood-look planks for the dry rooms (the renders
// show a warm oak; the planks are 22 × 90 cm, staggered), large grey
// porcelain tiles in the bathrooms, and a matt outdoor tile on the terrace.
//
// The texture is a seamless patch of PATCH_W × PATCH_H cm. Floors are flat
// shapes whose UVs are plan metres, so the planks come out to scale and, with
// their length along the texture's v, run north–south.

const PLANK_W = 22
const PLANK_L = 90
const COLS = 8
const PATCH_W = PLANK_W * COLS // 176 cm
const PATCH_H = PLANK_L * 3 // 270 cm
const PX_PER_CM = 6

interface Tone { h: number; s: number; l: number; spread: number; grout: string }

/** Small seeded PRNG, so the floor looks the same on every load. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** `stagger`: joints offset column to column (inside), or aligned in rows (outside). */
function draw(tone: Tone, seed: number, stagger: boolean) {
  const W = PATCH_W * PX_PER_CM, H = PATCH_H * PX_PER_CM
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const rand = rng(seed)
  g.fillStyle = tone.grout
  g.fillRect(0, 0, W, H)

  const pw = PLANK_W * PX_PER_CM, pl = PLANK_L * PX_PER_CM
  const joint = 0.3 * PX_PER_CM // ~3 mm
  for (let col = 0; col < COLS; col++) {
    // Staggered: each column's joints start at a random third of a plank.
    // In rows: every column starts at 0, so the joints line up across.
    const third = Math.floor(rand() * 3)
    const offset = stagger ? third * (pl / 3) : 0
    for (let k = -1; k < 3; k++) {
      const y = offset + k * pl
      const x = col * pw
      const l = tone.l + (rand() - 0.5) * tone.spread
      const s = tone.s + (rand() - 0.5) * 8
      const h = tone.h + (rand() - 0.5) * 4
      // Draw the plank, and again one patch height up or down so it wraps.
      for (const dy of [0, -H, H]) {
        const py = y + dy
        if (py > H || py + pl < 0) continue
        g.save()
        g.beginPath()
        g.rect(x + joint / 2, py + joint / 2, pw - joint, pl - joint)
        g.clip()
        g.fillStyle = `hsl(${h} ${s}% ${l}%)`
        g.fillRect(x, py, pw, pl)
        // Grain: long, slightly wavy streaks along the plank.
        const r2 = rng(seed * 131 + col * 17 + k * 7)
        for (let i = 0; i < 38; i++) {
          const gx = x + r2() * pw
          const dark = r2() < 0.6
          // Kept soft: Tanzania Almond reads as a calm oak, not a striped one.
          g.strokeStyle = dark ? `hsla(${h - 4} ${s + 6}% ${l - 12}% / ${0.05 + r2() * 0.11})` : `hsla(${h + 3} ${s - 6}% ${l + 9}% / ${0.05 + r2() * 0.08})`
          g.lineWidth = 0.5 + r2() * 2.2
          g.beginPath()
          const amp = 1 + r2() * 4, freq = 0.004 + r2() * 0.01, ph = r2() * 6
          for (let t = 0; t <= pl; t += 12) g.lineTo(gx + Math.sin(ph + t * freq) * amp, py + t)
          g.stroke()
        }
        // An occasional knot.
        if (r2() < 0.25) {
          const kx = x + pw * (0.25 + r2() * 0.5), ky = py + pl * (0.2 + r2() * 0.6)
          const grad = g.createRadialGradient(kx, ky, 0, kx, ky, 9)
          grad.addColorStop(0, `hsla(${h - 6} ${s + 8}% ${l - 22}% / 0.55)`)
          grad.addColorStop(1, `hsla(${h} ${s}% ${l}% / 0)`)
          g.fillStyle = grad
          g.beginPath()
          g.ellipse(kx, ky, 6, 14, 0, 0, Math.PI * 2)
          g.fill()
        }
        g.restore()
      }
    }
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  // UVs are metres: one patch every PATCH_W × PATCH_H cm.
  tex.repeat.set(100 / PATCH_W, 100 / PATCH_H)
  return tex
}

/** Square tiles of `size` cm, a pale tone with a little per-tile variation. */
function tiles(size: number, tone: Tone, seed: number) {
  const N = 4 // tiles per side of the patch
  const W = size * N * 3 // 3 px per cm
  const c = document.createElement('canvas')
  c.width = c.height = W
  const g = c.getContext('2d')!
  const rand = rng(seed)
  g.fillStyle = tone.grout
  g.fillRect(0, 0, W, W)
  const p = size * 3, joint = 1.2
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const l = tone.l + (rand() - 0.5) * tone.spread
      g.fillStyle = `hsl(${tone.h} ${tone.s}% ${l}%)`
      g.fillRect(i * p + joint / 2, j * p + joint / 2, p - joint, p - joint)
      // a faint cloud, so a tile is not a flat colour
      for (let k = 0; k < 6; k++) {
        const x = i * p + rand() * p, y = j * p + rand() * p, r = p * (0.15 + rand() * 0.3)
        const grad = g.createRadialGradient(x, y, 0, x, y, r)
        grad.addColorStop(0, `hsla(${tone.h} ${tone.s}% ${l + (rand() < 0.5 ? -4 : 4)}% / 0.35)`)
        grad.addColorStop(1, `hsla(${tone.h} ${tone.s}% ${l}% / 0)`)
        g.save()
        g.beginPath()
        g.rect(i * p + joint / 2, j * p + joint / 2, p - joint, p - joint)
        g.clip()
        g.fillStyle = grad
        g.fillRect(x - r, y - r, 2 * r, 2 * r)
        g.restore()
      }
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  tex.repeat.set(100 / (size * N), 100 / (size * N))
  return tex
}

const cache = new Map<string, THREE.Texture>()
const once = (key: string, make: () => THREE.Texture) => {
  if (!cache.has(key)) cache.set(key, make())
  return cache.get(key)!
}

/** Oak-look planks, for every dry room. */
export const woodTexture = () => once('wood', () => draw({ h: 31, s: 40, l: 56, spread: 9, grout: '#9c8b76' }, 7, true))
/** 60 × 60 pale grey porcelain, for the bathrooms. */
export const tileTexture = () => once('tile', () => tiles(60, { h: 30, s: 6, l: 86, spread: 3, grout: '#c9c6c0' }, 3))
/** 40 × 40 warm grey stone, for the common corridor and landing. */
export const stoneTexture = () => once('stone', () => tiles(40, { h: 35, s: 8, l: 80, spread: 4, grout: '#b8b1a6' }, 9))
/** 45 × 45 matt outdoor tile, for the terrace. */
export const outdoorTexture = () => once('outdoor', () => tiles(45, { h: 28, s: 10, l: 72, spread: 5, grout: '#a49e94' }, 5))
