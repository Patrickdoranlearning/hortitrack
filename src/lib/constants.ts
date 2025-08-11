
import type { PlantSize } from "./types";

export const INITIAL_PLANT_SIZES: PlantSize[] = [
    { id: 'size-1', size: '54', type: 'Tray', area: 0.16, shelfQuantity: 10, multiple: 54 },
    { id: 'size-2', size: '35', type: 'Tray', area: 0.16, shelfQuantity: 10, multiple: 35 },
    { id: 'size-3', size: '77', type: 'Tray', area: 0.16, shelfQuantity: 10, multiple: 77 },
    { id: 'size-4', size: '28', type: 'Tray', area: 0.16, shelfQuantity: 10, multiple: 28 },
    { id: 'size-5', size: '9', type: 'Pot', area: 0.01, shelfQuantity: 100, multiple: 1 },
    { id: 'size-6', size: '10.5', type: 'Pot', area: 0.01, shelfQuantity: 80, multiple: 1 },
    { id: 'size-7', size: '13', type: 'Pot', area: 0.02, shelfQuantity: 50, multiple: 1 },
    { id: 'size-8', size: '15', type: 'Pot', area: 0.02, shelfQuantity: 40, multiple: 1 },
    { id: 'size-9', size: '17', type: 'Pot', area: 0.03, shelfQuantity: 30, multiple: 1 },
    { id: 'size-10', size: '19', type: 'Pot', area: 0.03, shelfQuantity: 25, multiple: 1 },
    { id: 'size-11', size: '286', type: 'Tray', area: 0.16, shelfQuantity: 10, multiple: 286 },
    { id: 'size-12', size: '273', type: 'Tray', area: 0.16, shelfQuantity: 10, multiple: 273 },
    { id: 'size-13', size: '150', type: 'Tray', area: 0.16, shelfQuantity: 10, multiple: 150 },
    { id: 'size-14', size: '104', type: 'Tray', area: 0.16, shelfQuantity: 10, multiple: 104 },
    { id: 'size-15', size: '336', type: 'Tray', area: 0.16, shelfQuantity: 10, multiple: 336 },
    { id: 'size-16', size: '50', type: 'Pot', area: 0.05, shelfQuantity: 20, multiple: 1 },
    { id: 'size-17', size: '100', type: 'Pot', area: 0.08, shelfQuantity: 15, multiple: 1 },
    { id: 'size-18', size: '24', type: 'Pot', area: 0.04, shelfQuantity: 25, multiple: 1 },
    { id: 'size-19', size: 'Bareroot', type: 'Bareroot', area: 0, shelfQuantity: 500, multiple: 1 },
];


export const SIZE_TYPE_TO_STATUS_MAP: Record<PlantSize['type'], 'Propagation' | 'Potted' | 'Plugs/Liners'> = {
    'Tray': 'Plugs/Liners',
    'Pot': 'Potted',
    'Bareroot': 'Propagation',
};
