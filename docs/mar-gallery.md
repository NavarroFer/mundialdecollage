# Museo MAR — provisional walk

Open it at `/museomar`. That address starts in MAR. `/galeria-3d` stays the Collage World Cup unless the address also says `?museo=mar` or `?museo=mundial`. Dimensions remain provisional. A local browser session drew the MAR plan on the minimap; the 3D pixels themselves stayed blank in that machine's software WebGL, so the frames are not proof of the picture.

A second public building in the 3D gallery, chosen next to the theme list (or with `?museo=mar`). The Collage World Cup rooms are unchanged. This is a first reconstruction from the plan, the three sections, the published sheet and the site photographs. It is not a measured survey. Every metre below is an estimate and lives in `components/gallery/world/mar/layout.ts`, so a later photo with one known dimension can move a wall without hunting through the meshes.

The daily obras are the same ones as the other gallery. They are rehung on MAR's walls in the browser. Nothing here reproduces the artworks visible in the reference photographs. The woven sea lion on the plaza is a temporary installation, but it is in every photograph of the front and dominates the plaza, so it is modelled (`SeaLion.tsx`) and can be deleted in one line when it is taken down.

## What the sheets and photos actually show

Observed, not measured:

- Four offset concrete boxes. From outside they read as closed masses; the public floor opens between them. The published sheet (Monoblock) gives the authors, the address Blvd. Marítimo Av. P. Camet y López de Gomara, Mar del Plata, the date printed on that sheet (2010) and a total area of 10.000 m². This model is only the public walk — plaza, entrance, hall, two exhibition rooms, auditorium — and does not add up to 10.000 m².
- The plan is a cluster of rectangles: a large west block (tables in one part, a dense grid in another), a north block filled with seating rows, a central open hall, and an east wing with an inner room and scattered tables outside it. Section marks A-A, B-B and C-C show stairs, a tall central space and a lower floor. The drawing's north is not labeled, so "south = sea side" below is a choice that makes the entrance, the sea glazing and the plaza agree with the photos. It is not a compass reading.
- Photos: cobblestone plaza; a rectangular basin beside the side facade; large concrete panels with regular joints; ground-floor glass under a concrete upper floor; the entrance is a bank of glass doors between a volume that projects toward you and a volume set further back with the letters MAR; inside, a double-height hall, a mezzanine with a glass balustrade, a pair of escalators, polished concrete, sea through one glass wall and trees through another. The bright white room and the dark room with a floor installation are exhibition fit-outs. The white partitions in the model are generic temporary walls, not that exhibition.

## The front, as the photographs show it

Facade fidelity was reworked from a second set of photographs (plaza, entrance, door close-ups, the sea lion). What is drawn, left to right from the plaza:

- **West volume (the café).** About 16 m, the tallest. Its upper floor overhangs the plaza on a thick slab edge with a recessed window band; ground glass sits under it, with the café's round emblem.
- **Volume over the doors.** About 13.4 m. Slab edge, a recessed window band, then blank concrete with the "Buenos Aires Provincia" relief mark. Under its soffit: a bank of black-framed glass with two transom rows, a black revolving door in a half-drum (blocks the way; only the swing doors are open), the two swing leaves pushed open, "SALIDA" signs and square downlights.
- **Glass slot** between that volume and the next: full-height glazing with a concrete cap.
- **Vinyl volume.** About 11 m. Its ground floor is set back behind a long printed vinyl; the floors above overhang it; a tall narrow window runs up its east end.
- **Tower** at the east end, about 16 m: a black door and a ground window at its foot, the louvred vent housing in front of them, and the sunken stair beside it (walled off; the shaft is drawn below the paving).
- **Plaza.** Granite setts in overlapping fans (`cobbleTexture`), a low granite kerb across it, an orange tactile pad, two concrete street lamps, and a deep-blue sky dome.
- **Sea lion.** On a low beige slab with white gravel, rocks and a stainless rail on angled brackets. About 10 m to the top of its head, 11 m long, from the photographs; not surveyed. The head and neck are a broad, nearly cylindrical column with a rounded top (the front photographs show no pointed muzzle), the body trails low behind it, and the front flippers are straight-edged plates with softened corners hanging from the chest. Its skin is a basket weave of pale straw strips (blocks of two, alternately across and along, about 5 cm wide) read off the close-up; the front flippers hang from the chest as flat panels. The slab is solid in the walk map and the plaza goes round it.

The concrete is board-formed: panels 2.4 × 1.2 m, rows not aligned, each panel its own shade, hairline joints, pin holes and water streaks. One texture repeat covers 4 × 4 panels.

## Upper floor (where the obras hang)

In the real museum the obras are on the upper floor, so the daily obras now hang there and nothing hangs on the ground floor. The mezzanine round the hall's void is at 5.2 m (it was 4.45 m; the escalator now rises 5.2 m over the same run, about 36°, steeper than before). Walking onto either escalator lifts you to it, and click-to-walk takes the same ride.

- **Entrance to the gallery** (last photograph): a portal in the hall's west wall at the mezzanine, 3 m wide and 3.6 m high, with a roll-up banner at its foot. Past it, a **30 × 30 m room** (x −42.18..−12.18, z −22..8, 6 m clear) with a cream resin floor, white walls, light strips in the roof and track lights. It sits over the café and spreads out past it to the west and north, so the west volume is bigger than the café below it: solid concrete under the part that sticks out, a concrete skin up to 16 m, and the site grows to x −48. There are no photographs of the room itself: its size is what was asked for and its look is the entrance's.
- **Five freestanding partitions** (3.4 m high, 24 m long) with 5 m aisles between them and 3 m at each end. With the four walls that makes 37 hanging spots (the daily exhibition's wall count), in the main gallery's frame sizes, with at least half a metre of bare wall between frames (tested).
- **Lounge on the landing:** two lettered display cases ("Lobo Marino de Alfajores, Marta Minujin — Material de archivo") and two white leather lounge chairs, from the photographs of that corner.
- **Not modelled:** the open void's far side and the upper floors of the other volumes; the tall cloth lettering on the hall's walls ("EN ESTE…", "ESCRIT…"), which is a fabric-letter installation.

### Escalators, mezzanine and wall text

In the photographs the escalators stand **left of the entrance** (you enter facing −Z, so −X), well inside the hall with open floor between their foot and the front wall. They are at x −8.9..−5.75, feet at z −5, heads at z −12.05. The mezzanine is a deck across the hall's north end where they land; the portal into the gallery is in the hall's west wall at its north end (z −18..−15), a few steps from the landing. The glass slot of the lounge (display cases, white chairs) is on the east end of that deck. The hall flag hangs east of the escalators.

Each obra in MAR has a wall label beside its frame: title in italics (up to three lines), the artist, the flag and the year, on a 0.5 m plate. The main gallery keeps its single line under the frame (the artist's name): `Artworks` takes a `placard` prop and only MAR turns it on.

### Two floors in the walk map

A point (x, z) does not say which floor you mean, so the lower floor's template carries an optional `upper` (its own template, its height, and the escalator's entry and exit). `walkable` also honours `floors`, rectangles an upper floor is limited to. `navigation/levels.ts` picks the floor from a height (the player's, an obra's, or the surface a click hit) and `planRoute` joins two walks with the escalator ride. A click on a high wall keeps you on your floor.

## Ground floor, from the interior photographs

No obras hang here any more (see above), so the café and the shop can use the whole room.

- **Floor:** dark polished concrete, glossy; a drain grate along the hall's north wall.
- **Hall:** deep concrete beams with a glowing skylight between them (the sun throws their shadows on the walls); stainless escalators with glass balustrades and black handrails that follow the slope; a blue glass box and a black reception counter by the west corner; a marble table on gold legs; a fire hose cabinet; two roll-up banners by the door.
- **West room = café, shop and lab:** expanded-metal ceiling in white frames with fluorescent tubes and two crystal chandeliers; four café tables with wire chairs; **Tienda FINDE** (lettered black fascia, black counters, board-formed backdrop, shelves and goods); the **Espacio Laboratorio** as a 4.2 m black wall with white lettering ; La Isla as a carpet, a pale blue bench and surfboards at the SW glass corner; a track with spots on the north wall; a louvred band over the door to the hall.
- Where each thing stands is an arrangement chosen to fit the hanging strips, not read off a plan.

### The flag in the hall

The tall cloth hanging in the hall (white cloth) is printed with a **mosaic of every published obra**. `HallFlag.tsx` reads `/api/obras` (the CDN-cached list the homepage search uses) and draws each obra's 96 px thumbnail from `/api/img` into one canvas, a few at a time, so the cloth fills in as they arrive. It starts from the day's obras and widens to all of them; cells beyond the last obra stay white. Cloth is plain white; pictures load 16 at a time in a shuffled order (so the whole cloth fills at once, not top to bottom) and the canvas goes to the GPU at most every 350 ms. At most 600 are drawn (`MOSAIC_LIMIT`, sampled evenly past that). The grid logic is pure and tested in `mosaic.ts`. No new server work: the list and the 96 px thumbnails are already CDN-cached.

## Banners are slots

Posters and vinyl are `MAR_BANNERS` in `layout.ts`: a centre, a width and a height on the wall, and an optional `image`. Without `image` a stand-in drawn in `decals.ts` shows (the exhibition posters and the Noé vinyl in the photographs). The two roll-up banners in the hall (`standee-a`, `standee-b`) are slots too. To print a Collage World Cup banner, put the file under `public/` and set `image: '/mar/banner-a.jpg'` on that slot. Nothing else needs to move. Keep the picture's aspect ratio equal to the slot's width ÷ height or it stretches.

## Estimated dimensions

One unit is one metre. Y is up. The plaza is +Z; the entrance faces the plaza; yaw 0 looks toward −Z. Spawn is `(0, 16)`, on the cobbles, looking at the door.

| Quantity | Value | Why it is only a guess |
| --- | ---: | --- |
| Facade panel | 2.4 × 1.2 m | Joints are visible; no dimension is readable |
| Paving repeat | 3 m, setts 0.1 m | The fan pattern, not a counted paver |
| Wall thickness | 0.28 m | Reads as a solid concrete wall at eye height |
| Entrance clear width | 5.2 m | Still the walkable door bank. Concrete returns now stop about 1.6 m from each jamb, so the slot reads like the frontal photo. Steps stay flush so the walk does not catch a lip |
| Door head | 3.2 m | Glass continues above the doors to the hall ceiling |
| Hall, floor to ceiling | 9.0 m | The interior photo is about two stories |
| Mezzanine walk surface | 4.45 m | About halfway up that photo |
| Escalator run | 7.05 m horizontal, 4.45 m rise (~32°) | Placed on the east side of the hall, where the photo shows the pair. A real escalator is usually 30° |
| West room clear height | 5.2 m | Bright gallery photograph |
| West volume exterior | 16 m | Counted from panel rows in the photographs, 1.2 m a row |
| Volume over the doors | 13.4 m | Lower than the west volume in the same frame |
| Tower | 16 m | Same panel-row count |
| Soffit over the doors | 4.6 m | Door head 2.6 m plus two transom rows |
| Sea lion | 9.7 m high, 11 m long | Against the 20 m box behind it in the front photograph |
| East room clear height | 5.6 m | Darker room, lighting rails just under the ceiling |
| Vinyl volume | 11 m | The right-hand box in the frontal photo |
| Auditorium clear height | 7.4 m | Section, not a counted seat riser |
| Site edge | x −36..40, z −42..32 | The modeled plot, not the real property line |

Footprints (interior side of the walls):

- Hall: x −12..14, z −20..0
- West exhibition room: x −30..−12, z −12..8, glazed to the plaza at ground level
- East exhibition room: x 14..32, z −18..−8
- Auditorium: x −8..16, z −38..−20, entered from the hall. Seat banks are solid blocks with aisles, not a seat count
- Vinyl volume: x 7.2..20, z 0.15..3.4 (ground floor set back to z 2.0); tower x 20..34
- Basin: about x −28..−16, z 12..20, rim 0.42 m so you walk around it

Doors, all open in both the mesh and the walk map: entrance (the swing doors) x −2.6..2.6 at z = 0; west room z −3.45..−0.35 at x = −12; east room z −13.6..−10.4 at x = 14; auditorium x −1.6..2.4 at z = −20.

## What this visit can and cannot do

You start outdoors. The entrance is a gap, not a hidden wall. From the hall you can walk into the west room, the east room and the auditorium aisle. Click-to-walk stays on the ground and goes around the escalators; walking onto an escalator lifts you to the mezzanine, which has a glass rail so you don't step into the void. The upper floors of the boxes, the services, and the lower level suggested by section C-C are not interiors you can enter.

The Collage World Cup's vinyl console, arcade and collective collage stay in that building. MAR has its own presence channel so avatars are not shared between the two.

## Photo checklist

One known length is enough to scale the rest: a door leaf, a panel, a floor-to-floor, or the entrance opening, with the tape or a person whose height you note in the same frame.

1. Facades and corners. Each outside corner of the four boxes, far enough back to see two faces, plus a closer frame of the panel joint at that corner. Include the cantilever's underside and the upper window band.
2. Approach and entry. A sequence from the plaza, through the doors, to the first view of the hall, without cutting. Note which side the basin is on, and whether the threshold is a step, a ramp or flush.
3. Hall junctions. Standing in the hall, one photo down each opening (west room, east room, auditorium, any stair) so the hinge between spaces is in frame. The sea window and the tree window in one frame if you can.
4. Stairs, escalators, levels. The escalator pair from below and from the landing; any public stair the sections imply; a vertical shot that shows floor, mezzanine rail and ceiling together. A person in frame gives the scale.
5. Concrete, glass, paving. One straight-on panel bay with a joint crossing a corner; the glass mullion at the entrance; cobbles with something of known size; the basin edge.
6. The known dimension. Photograph the tape (or the door, panel or floor height you measured) so the number and the thing are in the same picture. Write the number down. That single figure replaces the matching constant in `layout.ts`.
