
export const INITIAL_NURSERY_LOCATIONS = [
    'Greenhouse 1',
    'Greenhouse 2',
    'Greenhouse 3',
    'Greenhouse 4',
    'Greenhouse 5',
    'Field A1',
    'Field A2',
    'Field B1',
    'Field B2',
    'Shade House 1',
    'Shade House 2',
    'Potting Area',
];
  
export const INITIAL_PLANT_SIZES = [
    '54',
    '35',
    '77',
    '28',
    '9',
    '10.5',
    '13',
    '15',
    '17',
    '19',
    '286',
    '273',
    '150',
    '104',
    '336',
    '50',
    '100',
    '24',
    'Bareroot'
];

export const SIZE_TO_STATUS_MAP: Record<string, 'Propagation' | 'Potted' | 'Plugs/Liners'> = {
    '286': 'Propagation',
    '273': 'Propagation',
    '150': 'Propagation',
    '104': 'Propagation',
    '336': 'Propagation',
    '100': 'Propagation',
    '54': 'Plugs/Liners',
    '35': 'Plugs/Liners',
    '77': 'Plugs/Liners',
    '28': 'Plugs/Liners',
    '9': 'Plugs/Liners',
    '10.5': 'Potted',
    '13': 'Potted',
    '15': 'Potted',
    '17': 'Potted',
    '19': 'Potted',
    '50': 'Potted',
    '24': 'Potted',
    'Bareroot': 'Potted'
};
