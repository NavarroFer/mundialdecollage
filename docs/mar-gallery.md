# Museo MAR — provisional walk

Open it at `/museomar`. That address starts in MAR. `/galeria-3d` stays the Collage World Cup unless the address also says `?museo=mar` or `?museo=mundial`. Dimensions remain provisional. A local browser session drew the MAR plan on the minimap; the 3D pixels themselves stayed blank in that machine's software WebGL, so the frames are not proof of the picture.

A second public building in the 3D gallery, chosen next to the theme list (or with `?museo=mar`). The Collage World Cup rooms are unchanged. This is a first reconstruction from the plan, the three sections, the published sheet and the site photographs. It is not a measured survey. Every metre below is an estimate and lives in `components/gallery/world/mar/layout.ts`, so a later photo with one known dimension can move a wall without hunting through the meshes.

The daily obras are the same ones as the other gallery. They are rehung on MAR's walls in the browser. Nothing here reproduces the artworks visible in the reference photographs, and the sea-lion sculpture on the plaza is a temporary installation, so it is not in the model.

## What the sheets and photos actually show

Observed, not measured:

- Four offset concrete boxes. From outside they read as closed masses; the public floor opens between them. The published sheet (Monoblock) gives the authors, the address Blvd. Marítimo Av. P. Camet y López de Gomara, Mar del Plata, the date printed on that sheet (2010) and a total area of 10.000 m². This model is only the public walk — plaza, entrance, hall, two exhibition rooms, auditorium — and does not add up to 10.000 m².
- The plan is a cluster of rectangles: a large west block (tables in one part, a dense grid in another), a north block filled with seating rows, a central open hall, and an east wing with an inner room and scattered tables outside it. Section marks A-A, B-B and C-C show stairs, a tall central space and a lower floor. The drawing's north is not labeled, so "south = sea side" below is a choice that makes the entrance, the sea glazing and the plaza agree with the photos. It is not a compass reading.
- Photos: cobblestone plaza; a rectangular basin beside the side facade; large concrete panels with regular joints; ground-floor glass under a concrete upper floor; the entrance is a bank of glass doors between a volume that projects toward you and a volume set further back with the letters MAR; inside, a double-height hall, a mezzanine with a glass balustrade, a pair of escalators, polished concrete, sea through one glass wall and trees through another. The bright white room and the dark room with a floor installation are exhibition fit-outs. The white partitions in the model are generic temporary walls, not that exhibition.

## Estimated dimensions

One unit is one metre. Y is up. The plaza is +Z; the entrance faces the plaza; yaw 0 looks toward −Z. Spawn is `(0, 16)`, on the cobbles, looking at the door.

| Quantity | Value | Why it is only a guess |
| --- | ---: | --- |
| Facade panel | 2.4 × 1.2 m | Joints are visible; no dimension is readable |
| Cobble module | 1.5 m | The paving pattern, not a counted paver |
| Wall thickness | 0.28 m | Reads as a solid concrete wall at eye height |
| Entrance clear width | 5.2 m | A bank of doors, wider than a single leaf. The photographed steps are omitted: the floor is flush so the walk does not stop on a lip |
| Door head | 3.2 m | Glass continues above the doors to the hall ceiling |
| Hall, floor to ceiling | 9.0 m | The interior photo is about two stories |
| Mezzanine walk surface | 4.45 m | About halfway up that photo |
| Escalator run | 7.05 m horizontal, 4.45 m rise (~32°) | Placed on the east side of the hall, where the photo shows the pair. A real escalator is usually 30° |
| West room clear height | 5.2 m | Bright gallery photograph |
| West volume exterior | 11.4 m | Taller box, upper window band, cantilever over the plaza |
| East room clear height | 5.6 m | Darker room, lighting rails just under the ceiling |
| East volume / MAR letters | 8.6 m | The right-hand box in the frontal photo |
| Auditorium clear height | 7.4 m | Section, not a counted seat riser |
| Site edge | x −36..40, z −42..32 | The modeled plot, not the real property line |

Footprints (interior side of the walls):

- Hall: x −12..14, z −20..0
- West exhibition room: x −30..−12, z −12..8, glazed to the plaza at ground level
- East exhibition room: x 14..32, z −18..−8
- Auditorium: x −8..16, z −38..−20, entered from the hall. Seat banks are solid blocks with aisles, not a seat count
- Right-hand plaza volume (MAR letters): x 8..28, z 0.15..5.6
- Basin: about x −28..−16, z 12..20, rim 0.42 m so you walk around it

Doors, all open in both the mesh and the walk map: entrance x −2.6..2.6 at z = 0; west room z −3.45..−0.35 at x = −12; east room z −13.6..−10.4 at x = 14; auditorium x −1.6..2.4 at z = −20.

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
