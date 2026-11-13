# MAR sea lion — photo reconstruction, 13 November 2026

The user supplied three views of MAR’s gold sea lion, a view of the original stone sea lion to clarify the face, and close-ups of the covering and individual alfajor wrappers. Geometry is inferred from photographs, not a scan or measured survey. The generated texture is an approximation of the photographed material, not an extracted photograph.

## Implemented

- Continuous horizontal body sections preserve the broad chest and descending back without the old tube’s pinched shoulder or submerged belly.
- Curved planted foreflippers, flattened rear flippers, a raised nose, separate lower jaw, small lateral eyes and restrained neck folds.
- Individual rectangular gold wrappers, concave at the centre, with sealed ends and printed dots. The first ribbon-weave interpretation was replaced after the user’s close-ups.
- Physical metallic material, local outdoor reflections, aligned relief/roughness maps, and world-space triplanar projection. No emissive gold.
- 760 pale stones in one instanced draw, low rail, and the existing plaque and solid platform.
- Tests cover all parts staying in the platform footprint and above its top, finite geometry, outward normals and chest/neck proportions. Browser renders inspected from the front, side, three-quarter view and near the face.

## Texture asset and provenance

`public/mar/sea-lion-wrappers-v1.webp` (1024 × 1024) was generated with the built-in imagegen tool from the two material reference photographs supplied by the user. It was converted to WebP for delivery. The Welcome Argentina watermark was explicitly excluded. No external media dependency or API is used at runtime.

Final generation prompt:

> Use case: photorealistic-natural. Asset type: square seamless tile texture for a 3D reconstruction of the Museo MAR golden sea lion. These two input photographs are MATERIAL REFERENCES ONLY. Make a new texture matching EXACTLY these individual rectangular concave gold alfajor wrappers. Output ONLY a perfectly front-facing orthographic square flat sheet of densely tessellated individual GOLD PACKAGING RECTANGLES: approximately 16 columns by 8 rows, each rectangle twice as tall as wide, all upright. They are NOT basket weave, NOT interwoven strips, NOT braided, NOT straw. Each little wrapper is shaped like a pinched pillow/hourglass: straight sealed horizontal flanged top and bottom edges that flare outward, concave center depression, slightly outward curved side edges and raised folded corners, metallic pale champagne-gold. Tiny dark pinprick dots printed over the face and tiny faint brown center marks, as in the reference. Fine handling creases and minute irregularities, realistic metallic packaging. Rectangles aligned edge-to-edge in tight rows and columns with tiny dark separations. Diffuse uniform neutral illumination across the whole image, NO large highlights, no perspective, no curvature of the whole sheet, no vignette. Seamless all edges. Exclude the welcome argentina watermark/logo completely; no watermark, no captions, no labels, no background or sculpture visible. Match the reference's fine perforation-like dots and concave packet profiles, never use the previous interwoven foil pattern. 1024x1024 square texture.

The approximation does not reproduce the sculptor’s signature or claim photogrammetric fidelity. Wrapper dimensions (approximately 10 × 20 cm) and the overall scale remain adjustable estimates.
