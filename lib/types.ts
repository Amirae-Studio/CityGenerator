/** One printable layer of a generated model (a blob: URL to a GLB/STL). */
export type ModelFile = {
  name: string;
  url: string;
  ext?: string;
  layer: string;
  isSubPart: boolean;
  partName?: string;
  partKey?: string;
  colorHint?: string | null;
};
