// A central place for "golden data" to be used as templates across the app.

export const INITIAL_NURSERY_LOCATIONS = [
    'Greenhouse 1',
    'Greenhouse 2',
    'Greenhouse 3',
    'Greenhouse 4',
    'Greenhouse 5',
    'Shade House 1',
    'Shade House 2',
    'Propagation House',
    'Field A1',
    'Field A2',
    'Field A3',
    'Field B1',
    'Field B2',
    'Field C1',
    'Potting Area',
    'Sales Area - North',
    'Sales Area - South',
    'Sales Area - West',
    'Sales Area - East',
    'Holding Area 1',
    'Holding Area 2',
    'Quarantine Zone',
];

export const PLANT_SIZES_DATA = [
  { size: '286', type: 'Propagation' },
  { size: '273', type: 'Propagation' },
  { size: '150', type: 'Propagation' },
  { size: '104', type: 'Propagation' },
  { size: '336', type: 'Propagation' },
  { size: '54', type: 'Plugs/Liners' },
  { size: '35', type: 'Plugs/Liners' },
  { size: '77', type: 'Plugs/Liners' },
  { size: '28', type: 'Plugs/Liners' },
  { size: '50', type: 'Plugs/Liners' },
  { size: '100', type: 'Plugs/Liners' },
  { size: '24', type: 'Plugs/Liners' },
  { size: '9', type: 'Plugs/Liners' }, // Liner maps to Plugs/Liners
  { size: '10.5', type: 'Potted' },
  { size: '13', type: 'Potted' },
  { size: '15', type: 'Potted' },
  { size: '17', type: 'Potted' },
  { size: '19', type: 'Potted' },
];

export const INITIAL_PLANT_SIZES = PLANT_SIZES_DATA.map(item => item.size);

export const SIZE_TO_STATUS_MAP: Record<string, 'Propagation' | 'Plugs/Liners' | 'Potted'> = 
  PLANT_SIZES_DATA.reduce((acc, item) => {
    acc[item.size] = item.type as 'Propagation' | 'Plugs/Liners' | 'Potted';
    return acc;
  }, {} as Record<string, 'Propagation' | 'Plugs/Liners' | 'Potted'>);
