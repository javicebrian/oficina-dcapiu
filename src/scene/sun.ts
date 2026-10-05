import { SITE } from '../data/flat'

// Where the sun is, seen from the house, at a given instant. The instant is
// absolute (ms since epoch), so the answer does not depend on where the viewer
// is; clock times are read and written in the house's own time zone.
// Formulas after SunCalc (Vladimir Agafonkin), accurate to well under a degree.

const RAD = Math.PI / 180
const DAY = 86_400_000
const J2000 = 2451545
const OBLIQUITY = 23.4397 * RAD

export interface SunPosition {
  altitude: number // radians above the horizon
  azimuth: number // radians, compass bearing from true north, clockwise
}

export function sunPosition(t: number, lat = SITE.lat, lon = SITE.lon): SunPosition {
  const d = t / DAY - 0.5 + 2440588 - J2000
  const M = RAD * (357.5291 + 0.98560028 * d) // mean anomaly
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
  const L = M + C + RAD * 102.9372 + Math.PI // ecliptic longitude
  const dec = Math.asin(Math.sin(OBLIQUITY) * Math.sin(L))
  const ra = Math.atan2(Math.sin(L) * Math.cos(OBLIQUITY), Math.cos(L))
  const H = RAD * (280.16 + 360.9856235 * d) + RAD * lon - ra // hour angle
  const phi = RAD * lat
  const altitude = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H))
  // atan2 gives it from the south, positive westwards; turn it into a bearing.
  const fromSouth = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi))
  return { altitude, azimuth: (fromSouth + Math.PI) % (2 * Math.PI) }
}

/** Unit vector toward the sun in scene space (x east, y up, z south of the sheet). */
export function sunDirection({ altitude, azimuth }: SunPosition): [number, number, number] {
  const b = azimuth + SITE.trueNorth * RAD // bearing on the sheet
  return [Math.cos(altitude) * Math.sin(b), Math.sin(altitude), -Math.cos(altitude) * Math.cos(b)]
}

// --- The house's clock -------------------------------------------------------

const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: SITE.tz,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/** The house's wall clock at instant t: its date (YYYY-MM-DD) and minute of the day. */
export function houseClock(t: number): { date: string; minutes: number } {
  const p = Object.fromEntries(parts.formatToParts(t).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) }
}

/** The instant when the house's clock reads `minutes` past midnight on `date`. */
export function houseInstant(date: string, minutes: number): number {
  const [y, m, d] = date.split('-').map(Number)
  const wall = Date.UTC(y, m - 1, d, 0, minutes)
  // Shift by the zone's offset, then once more in case that crossed a DST change.
  let t = wall
  for (let i = 0; i < 2; i++) {
    const c = houseClock(t)
    const [cy, cm, cd] = c.date.split('-').map(Number)
    t += wall - Date.UTC(cy, cm - 1, cd, 0, c.minutes)
  }
  return t
}

/** Sunrise and sunset on the house's clock, in minutes past midnight (null if none). */
export function daylight(date: string): { rise: number | null; set: number | null } {
  const h0 = -0.833 * RAD // refraction and the sun's radius
  let rise: number | null = null, set: number | null = null
  let prev = sunPosition(houseInstant(date, 0)).altitude
  for (let min = 2; min <= 1440; min += 2) {
    const alt = sunPosition(houseInstant(date, min)).altitude
    if (prev < h0 && alt >= h0) rise ??= min
    if (prev >= h0 && alt < h0) set = min
    prev = alt
  }
  return { rise, set }
}

export const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
export const compassPoint = (azimuth: number) => POINTS[Math.round(azimuth / RAD / 45) % 8]
