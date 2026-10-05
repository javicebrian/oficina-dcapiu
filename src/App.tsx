import { useCallback, useEffect, useRef, useState } from 'react'
import { FULL_HEIGHT, LEVELS } from './data/flat'
import { cabinets, lights } from './data/furniture'
import type { LightId } from './data/furniture'
import { doors } from './scene/Doors'
import { houseInstant } from './scene/sun'
import { Viewer } from './scene/Viewer'
import type { ViewName, ViewRequest } from './scene/Viewer'
import { RoomCard } from './ui/RoomCard'
import { readUrlState, writeUrlState } from './urlState'
import { Sidebar } from './ui/Sidebar'

export type SunSetting = { live: true } | { live: false; date: string; minutes: number }

// The opening state can come in the link (see urlState.ts).
const initial = readUrlState()
const FRAME_ON_CLICK = 'oficina-dcapiu.frameOnClick'

export default function App() {
  const [ceiling, setCeiling] = useState(initial.ceiling)
  const [cut, setCut] = useState(FULL_HEIGHT)
  const [panelOpen, setPanelOpen] = useState(initial.panel)
  const [labels, setLabels] = useState(initial.labels)
  const [furniture, setFurniture] = useState(initial.furniture)
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [doorsOpen, setDoorsOpen] = useState<Record<string, boolean>>({})
  const [doorHovered, setDoorHovered] = useState<string | null>(null)
  const toggleDoor = useCallback((id: string) => setDoorsOpen((d) => ({ ...d, [id]: !d[id] })), [])
  const setAllDoors = useCallback(
    (open: boolean) => setDoorsOpen(Object.fromEntries([...doors.map((o) => o.door.id), ...cabinets.map((k) => k.id)].map((id) => [id, open]))),
    [],
  )
  // Sunlight: live (the house's current time) or a chosen date and time on the house's clock.
  const [sun, setSun] = useState<SunSetting>({ live: true })
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!sun.live) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [sun.live])
  const sunAt = sun.live ? now : houseInstant(sun.date, sun.minutes)
  const [lightsOn, setLightsOn] = useState<Partial<Record<LightId, boolean>>>({})
  const [lightHovered, setLightHovered] = useState<string | null>(null)
  const toggleLight = useCallback((id: LightId) => setLightsOn((l) => ({ ...l, [id]: !l[id] })), [])
  const setAllLights = useCallback((on: boolean) => setLightsOn(Object.fromEntries(lights.map((l) => [l.id, on]))), [])
  const [request, setRequest] = useState<ViewRequest>({ view: initial.view, room: null, seq: 0 })

  // What the ceiling switch shows: it reads off while the flat is cut.
  const ceilingShown = ceiling && cut > LEVELS.ceiling
  // After focusing a room there is no preset view; the link keeps the last one.
  const lastView = useRef(initial.view)
  if (request.view) lastView.current = request.view
  useEffect(() => {
    writeUrlState({ view: lastView.current, ceiling: ceilingShown, labels, furniture, panel: panelOpen })
  }, [request.view, ceilingShown, labels, furniture, panelOpen])

  const goView = useCallback((view: ViewName) => setRequest((r) => ({ view, room: null, seq: r.seq + 1 })), [])
  // The room being framed: the camera turns round it and the walls in the way
  // are cut away (RoomFocus). Selecting without framing leaves the camera be.
  const [focused, setFocused] = useState<string | null>(null)
  const focusRoom = useCallback((room: string) => {
    setSelected(room)
    setFocused(room)
    setRequest((r) => ({ view: null, room, seq: r.seq + 1 }))
  }, [])
  const deselect = useCallback(() => {
    setSelected(null)
    setFocused(null)
  }, [])

  // Whether clicking a room in the model frames it (a menu option, off by
  // default, remembered in this browser). The room list and the card's button
  // always frame.
  const [frameOnClick, setFrameOnClickState] = useState(() => {
    try {
      return localStorage.getItem(FRAME_ON_CLICK) === '1'
    } catch {
      return false
    }
  })
  const setFrameOnClick = useCallback((v: boolean) => {
    setFrameOnClickState(v)
    try {
      localStorage.setItem(FRAME_ON_CLICK, v ? '1' : '0')
    } catch {
      // private mode or blocked storage: it just isn't remembered
    }
  }, [])

  // Looking into a room with the ceiling on shows nothing, so open the flat up.
  const selectRoom = useCallback((id: string | null) => {
    if (!id) return deselect()
    if (ceiling && cut >= FULL_HEIGHT) setCeiling(false)
    if (frameOnClick) focusRoom(id)
    else {
      setSelected(id)
      setFocused((f) => (f === id ? f : null))
    }
  }, [ceiling, cut, frameOnClick, focusRoom, deselect])

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-canvas text-ink">
      <div className={`absolute inset-0 ${hovered || doorHovered || lightHovered ? 'cursor-pointer' : ''}`}>
        <Viewer
          showCeiling={ceiling}
          cut={cut}
          labels={labels}
          furniture={furniture}
          selected={selected}
          focused={focused}
          hovered={hovered}
          request={request}
          doorsOpen={doorsOpen}
          sunAt={sunAt}
          lightsOn={lightsOn}
          onToggleLight={toggleLight}
          onLightHover={setLightHovered}
          onSelect={selectRoom}
          onHover={setHovered}
          onToggleDoor={toggleDoor}
          onDoorHover={setDoorHovered}
        />
      </div>
      <Sidebar
        ceiling={ceiling}
        setCeiling={setCeiling}
        cut={cut}
        setCut={setCut}
        labels={labels}
        setLabels={setLabels}
        furniture={furniture}
        setFurniture={setFurniture}
        selected={selected}
        onDeselect={deselect}
        frameOnClick={frameOnClick}
        setFrameOnClick={setFrameOnClick}
        onRoom={(id) => {
          if (ceiling && cut >= FULL_HEIGHT) setCeiling(false)
          focusRoom(id)
        }}
        view={request.view}
        onView={goView}
        onAllDoors={setAllDoors}
        onAllLights={setAllLights}
        furnitureShown={furniture}
        sun={sun}
        sunAt={sunAt}
        setSun={setSun}
        open={panelOpen}
        setOpen={setPanelOpen}
      />
      {selected && !panelOpen && <RoomCard id={selected} onClose={deselect} onFocus={() => focusRoom(selected)} />}
    </div>
  )
}
