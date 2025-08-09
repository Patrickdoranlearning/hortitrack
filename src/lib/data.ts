import type { Batch } from './types';

export const INITIAL_BATCHES: Batch[] = [
  {
    id: '1',
    plantType: 'Lavender',
    plantingDate: '2024-03-15',
    quantity: 150,
    status: 'Growing',
    location: 'Greenhouse A, Row 1',
    logHistory: [
      { date: '2024-04-01', action: 'Watered and applied root stimulant.' },
      { date: '2024-03-15', action: 'Seeded in trays.' },
    ],
  },
  {
    id: '2',
    plantType: 'Oak Sapling',
    plantingDate: '2023-10-20',
    quantity: 80,
    status: 'Ready for Sale',
    location: 'Field B2',
    logHistory: [
      { date: '2024-03-20', action: 'Pruned lower branches.' },
      { date: '2024-02-10', action: 'Applied slow-release fertilizer.' },
    ],
  },
  {
    id: '3',
    plantType: 'Tomato Seedlings',
    plantingDate: '2024-04-05',
    quantity: 500,
    status: 'Seeding',
    location: 'Propagation House',
    logHistory: [
      { date: '2024-04-05', action: 'Sowed seeds in starter pots.' },
    ],
  },
  {
    id: '4',
    plantType: 'Boxwood Hedge',
    plantingDate: '2024-01-10',
    quantity: 200,
    status: 'Growing',
    location: 'Container Yard C',
    logHistory: [
      { date: '2024-04-10', action: 'Treated for boxwood blight.' },
      { date: '2024-03-01', action: 'Shaped and trimmed.' },
    ],
  },
];
