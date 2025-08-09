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

export const INITIAL_PLANT_SIZES = [
  '9',
  '10.5',
  '13',
  '15',
  '17',
  '19',
  '24',
  '28',
  '35',
  '50',
  '54',
  '77',
  '100',
  '104',
  '150',
  '273',
  '286',
  '336',
  'Bareroot',
];

// Placeholder for future logic
export const SIZE_TO_STATUS_MAP: Record<string, 'Propagation' | 'Plugs/Liners' | 'Potted'> = {};
