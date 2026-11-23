// Road types shown in the Studio's "Hide layers" panel.
//
// OSM `highway=*` values (Overpass) and OpenMapTiles `class` values (vector
// tiles) are grouped into a few kinds a user can recognise. The order is the
// priority: where two kinds overlap (a junction), the earlier one keeps the
// area, so hiding a minor kind never cuts a hole in a main road.

export type RoadKind = "motorway" | "major" | "local" | "service" | "pedestrian" | "path";

export const ROAD_KINDS: { key: RoadKind; label: string; main: boolean }[] = [
  { key: "motorway", label: "Motorways", main: true },
  { key: "major", label: "Main roads", main: true },
  { key: "local", label: "Local streets", main: false },
  { key: "service", label: "Service roads", main: false },
  { key: "pedestrian", label: "Pedestrian streets", main: false },
  { key: "path", label: "Footpaths & cycleways", main: false },
];

/** Kinds that "Optimize roads" hides — everything but the main road network. */
export const MINOR_ROAD_KINDS: RoadKind[] = ROAD_KINDS.filter((k) => !k.main).map((k) => k.key);

const KIND_OF: Record<string, RoadKind> = {
  // OSM highway=* and OpenMapTiles class
  motorway: "motorway",
  motorway_link: "motorway",
  trunk: "motorway",
  trunk_link: "motorway",
  primary: "major",
  primary_link: "major",
  secondary: "major",
  secondary_link: "major",
  tertiary: "major",
  tertiary_link: "major",
  residential: "local",
  unclassified: "local",
  living_street: "local",
  minor: "local",
  busway: "local",
  raceway: "local",
  service: "service",
  pedestrian: "pedestrian",
  footway: "path",
  path: "path",
  cycleway: "path",
  steps: "path",
  bridleway: "path",
  track: "path",
};

export function roadKind(highwayOrClass: string): RoadKind {
  return KIND_OF[highwayOrClass] ?? "local";
}

/** Model part key for a road kind's mesh, e.g. "roads-local". */
export const roadPartKey = (kind: RoadKind) => `roads-${kind}`;
