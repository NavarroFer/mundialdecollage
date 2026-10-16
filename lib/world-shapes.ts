import type { Feature, GeoJsonObject, MultiPolygon, Position } from 'geojson'
import rawWorldTopology from '@/lib/data/world-countries-110m.json'
import rawMalvinas from '@/lib/data/malvinas-50m.json'
import { alpha2ForUnnumberedShape, isoNumericToAlpha2 } from '@/lib/iso-numeric-country-codes'

// The world as the site's maps draw it: the home's map, its explorer and the
// artists map in /admin/estadisticas.

// world-atlas ships this as a TopoJSON Topology, which react-simple-maps
// handles at runtime (it converts to GeoJSON via topojson-client), but its
// types only describe the GeoJSON shapes it accepts as input.
export const worldTopology = rawWorldTopology as unknown as GeoJsonObject

// The 110m map draws the Malvinas as one small blob. They come instead from
// world-atlas's 50m map (Gran Malvina, Soledad and the islets), drawn larger
// than life around their center so both islands read at this scale.
const MALVINAS_CENTER: Position = [-59.47, -51.79]
const MALVINAS_ZOOM = 2.5
const malvinas50m = rawMalvinas as unknown as Feature<MultiPolygon>
const malvinas: Feature<MultiPolygon> = {
  ...malvinas50m,
  geometry: {
    type: 'MultiPolygon',
    coordinates: malvinas50m.geometry.coordinates.map((polygon) =>
      polygon.map((ring) =>
        ring.map(([lon, lat]) => [
          MALVINAS_CENTER[0] + (lon - MALVINAS_CENTER[0]) * MALVINAS_ZOOM,
          MALVINAS_CENTER[1] + (lat - MALVINAS_CENTER[1]) * MALVINAS_ZOOM,
        ]),
      ),
    ),
  },
}

/** The Malvinas' shape in the 110m map, which `withMalvinas` swaps for the 50m islands. */
export const isMalvinas = (shape: { id?: unknown }) => String(shape.id) === '238'

/** A shape as the maps draw it: the 50m Malvinas in place of the 110m blob, anything else as given. */
export function withMalvinas<T extends { id?: unknown; rsmKey: string }>(shape: T, path: (feature: Feature) => string | null) {
  return isMalvinas(shape) ? { ...malvinas, rsmKey: shape.rsmKey, svgPath: path(malvinas) } : shape
}

/** The ISO 3166-1 alpha-2 code a shape stands for; the Malvinas are Argentina's. */
export function shapeCountryCode(shape: { id?: unknown; properties?: { name?: unknown } | null }): string | undefined {
  return isoNumericToAlpha2[String(shape.id)] ?? alpha2ForUnnumberedShape[String(shape.properties?.name)]
}
