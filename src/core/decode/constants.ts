/** Tunable decoder constants. Tuned against `__tests__/decoder.pbt.test.ts`. */

// --- Fiducial search ---------------------------------------------------------
/** Half-width of the local-mean window, as a fraction of the longer image side. */
export const LOCAL_WINDOW_FRAC = 0.06;
/** A pixel is "dark" when it is below this fraction of its local mean. */
export const DARK_RATIO = 0.72;
/** Components smaller than this many pixels are ignored (noise). */
export const MIN_COMPONENT_AREA = 6;
/** Outer ring area / centre blob area. Ideal for the 7:5:3 pattern is 24/9 = 2.67. */
export const RING_BLOB_AREA_RATIO: [number, number] = [1.8, 4.2];
/** Max distance between ring and blob centroids, as a fraction of sqrt(ring area). */
export const CONCENTRIC_TOLERANCE = 0.25;
/** A fiducial's equivalent diameter may not exceed this fraction of the shorter image side. */
export const MAX_FIDUCIAL_FRAC = 0.3;
/** Largest allowed size ratio between the biggest and smallest of the four fiducials. */
export const MAX_FIDUCIAL_SIZE_SPREAD = 2.2;
/** The card's top edge must point within this angle of "right" in the image (degrees). */
export const MAX_TILT_DEG = 45;
/** Solid centre blob: area / bounding-box area must be at least this. */
export const MIN_BLOB_SOLIDITY = 0.4;

// --- Homography ----------------------------------------------------------------
/** Pivot below which the 8x8 system is treated as singular. */
export const HOMOGRAPHY_PIVOT_EPS = 1e-9;
/** Smallest allowed quad area, as a fraction of image area. */
export const MIN_QUAD_AREA_FRAC = 0.02;

// --- Bubble classification -----------------------------------------------------
/** Inner sampling disc, as a fraction of the bubble radius. Excludes the printed outline. */
export const INNER_DISC_FRAC = 0.6;
/** Paper reference annulus, as fractions of the bubble radius. Excludes the outline and mark. */
export const BG_ANNULUS_FRAC: [number, number] = [1.45, 1.75];
/** Percentile of annulus samples used as the local paper level. Ignores neighbouring marks. */
export const BG_PERCENTILE = 0.75;
/** fill >= this is "filled". */
export const FILLED_MIN = 0.4;
/** fill <= this is "blank". Between BLANK_MAX and FILLED_MIN is "ambiguous". */
export const BLANK_MAX = 0.2;
/** Guards against division by zero on a fully black frame. */
export const EPS = 1e-6;
/** The small card-ID bubbles are read with one threshold halfway between blank and filled. */
export const ID_FILL_MID = (FILLED_MIN + BLANK_MAX) / 2;
