import type { Batch } from './types';

export const INITIAL_BATCHES: Batch[] = [
  {
    id: '1',
    batchNumber: '1-98765',
    plantType: 'Lavender',
    plantingDate: '2024-05-15',
    initialQuantity: 100,
    quantity: 100,
    status: 'Propagation',
    location: 'Greenhouse A',
    logHistory: [
      {
        date: '2024-05-15',
        action: 'Seeds sown in propagation trays.',
      },
      {
        date: '2024-05-25',
        action: 'Misted with water.',
      },
    ],
  },
  {
    id: '2',
    batchNumber: '2-54321',
    plantType: 'Rose',
    plantingDate: '2024-04-20',
    initialQuantity: 50,
    quantity: 50,
    status: 'Plugs/Liners',
    location: 'Greenhouse B',
    logHistory: [
      {
        date: '2024-04-20',
        action: 'Cuttings taken and planted.',
      },
      {
        date: '2024-05-10',
        action: 'Treated with rooting hormone.',
      },
    ],
  },
  {
    id: '3',
    batchNumber: '3-13579',
    plantType: 'Tulip',
    plantingDate: '2024-03-10',
    initialQuantity: 200,
    quantity: 200,
    status: 'Potted',
    location: 'Field 1',
    logHistory: [
      {
        date: '2024-03-10',
        action: 'Bulbs planted in pots.',
      },
      {
        date: '2024-04-01',
        action: 'Fertilized with bulb food.',
      },
    ],
    transplantedFrom: '2-54321',
  },
];
