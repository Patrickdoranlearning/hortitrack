export function calcUnitsFromTrays(
  fullTrays: number,
  partialCells: number,
  sizeMultiple: number
) {
  if (partialCells >= sizeMultiple) {
    throw new Error("Partial cells must be less than size multiple");
  }
  return fullTrays * sizeMultiple + partialCells;
}

export function calcUnitsFromContainers(
  containers: number,
  sizeMultiple: number
) {
  return containers * sizeMultiple;
}
