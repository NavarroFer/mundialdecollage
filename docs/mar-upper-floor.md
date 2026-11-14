# MAR upper hall — reference update, 14 November 2026

## Evidence and interpretation

The user supplied three upper-hall photographs and `IMG_3972.HEIC`. The photographs establish glass balustrades around the central void, both escalator heads at the same level, tall exposed-concrete walls and two exhibition entrances to the right when looking away from the building front. People are used as scale references. The airplanes, suspended figure and Welcome Argentina overlay are not reproduced.

The HEIC shows a full-height plaza window, a metal/glazed overhead structure and the existing gallery entrance beside it, with a black curtain. The user explicitly confirmed that this is the artwork gallery entrance already mapped, and that it should move toward the front. The model retains the 30 × 30 m gallery over the west wing and relocates its portal along the same wall to z −3.5..−0.5, beside the front window. The previous portal at z −18..−15 is sealed. All 37 artworks remain upstairs; the five works previously assigned to the now-short east-wall segment move to the long segment on the other side of the doorway.

## Implementation

- Continuous upper circulation on four sides of the void, with openings at both escalator heads. The down escalator joins the front walkway instead of an isolated longitudinal strip through the atrium.
- Steel caps, lower channels and fine panel seams on the glass balustrades. Pale grey slab flooring with fine joints replaces the beige finish. The temporary display cases and lounge chairs are removed.
- The front window no longer has an opaque backing block. Its sill is lowered to upper-floor height, a floor extends into its recessed reveal, and its glass is a physical/navigation barrier. A browser view confirms that the outdoor sea lion is visible through it.
- Gathered black curtain panels sit beside the relocated gallery opening, leaving its centre open. The ground-floor café lintel is capped at the mezzanine so it cannot visually obscure that upper entrance.
- Two framed, dark recessed exhibition thresholds and a smaller closed service door on the rear wall. The room interiors are not visible in the references and are not reconstructed or accessible. The service function and exact positions remain inferred; the door has no invented label.
- The hall roof is provisionally raised from 9 to 11.8 m. At the unchanged 5.2 m upper floor, its beam undersides leave approximately 5 m clear, closer to the human scale in the supplied photographs. This is a proportion adjustment, not a surveyed dimension.

The exact window/gallery angle and metallic overhead glazing of the HEIC still require architectural refinement; the current front opening uses the existing facade volume and window band. Materials and surroundings remain a rendered approximation, not a photographic scan. No crowd or exhibition objects were added.

## Verification

38 MAR tests pass, including reachability around the upper perimeter, both escalator heads, the relocated portal and every artwork; the void and plaza glazing remain impassable. A regression assertion also checks that no decorative concrete box covers the upper doorway at eye height. TypeScript and ESLint pass. Local Chrome renders inspect the rear entries, gallery entrance, sea-lion view and escalators from below.
