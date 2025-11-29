
import type { PlantSize } from "./types";

export const INITIAL_PLANT_SIZES: PlantSize[] = [
    { id: 'size-1', name: '54 Tray', containerType: 'tray', area: 0.16, shelfQuantity: 10, cellMultiple: 54 },
    { id: 'size-2', name: '35 Tray', containerType: 'tray', area: 0.16, shelfQuantity: 10, cellMultiple: 35 },
    { id: 'size-3', name: '77 Tray', containerType: 'tray', area: 0.16, shelfQuantity: 10, cellMultiple: 77 },
    { id: 'size-4', name: '28 Tray', containerType: 'tray', area: 0.16, shelfQuantity: 10, cellMultiple: 28 },
    { id: 'size-5', name: 'P9', containerType: 'pot', area: 0.01, shelfQuantity: 100, cellMultiple: 1 },
    { id: 'size-6', name: '10.5cm Pot', containerType: 'pot', area: 0.01, shelfQuantity: 80, cellMultiple: 1 },
    { id: 'size-7', name: '13cm Pot', containerType: 'pot', area: 0.02, shelfQuantity: 50, cellMultiple: 1 },
    { id: 'size-8', name: '15cm Pot', containerType: 'pot', area: 0.02, shelfQuantity: 40, cellMultiple: 1 },
    { id: 'size-9', name: '17cm Pot', containerType: 'pot', area: 0.03, shelfQuantity: 30, cellMultiple: 1 },
    { id: 'size-10', name: '19cm Pot', containerType: 'pot', area: 0.03, shelfQuantity: 25, cellMultiple: 1 },
    { id: 'size-11', name: '286 Tray', containerType: 'tray', area: 0.16, shelfQuantity: 10, cellMultiple: 286 },
    { id: 'size-12', name: '273 Tray', containerType: 'tray', area: 0.16, shelfQuantity: 10, cellMultiple: 273 },
    { id: 'size-13', name: '150 Tray', containerType: 'tray', area: 0.16, shelfQuantity: 10, cellMultiple: 150 },
    { id: 'size-14', name: '104 Tray', containerType: 'tray', area: 0.16, shelfQuantity: 10, cellMultiple: 104 },
    { id: 'size-15', name: '336 Tray', containerType: 'tray', area: 0.16, shelfQuantity: 10, cellMultiple: 336 },
    { id: 'size-16', name: '5L Pot', containerType: 'pot', area: 0.05, shelfQuantity: 20, cellMultiple: 1 },
    { id: 'size-17', name: '7.5L Pot', containerType: 'pot', area: 0.08, shelfQuantity: 15, cellMultiple: 1 },
    { id: 'size-18', name: '9L Pot', containerType: 'pot', area: 0.04, shelfQuantity: 25, cellMultiple: 1 },
    { id: 'size-19', name: 'Bareroot Bundle', containerType: 'bareroot', area: 0, shelfQuantity: 500, cellMultiple: 1 },
];


export const SIZE_TYPE_TO_STATUS_MAP: Record<PlantSize['containerType'], 'Propagation' | 'Potted' | 'Plugs/Liners'> = {
    'tray': 'Plugs/Liners',
    'pot': 'Potted',
    'bareroot': 'Propagation',
};
