import type { Batch } from './types';

export const INITIAL_BATCHES: Batch[] = [
  {
    id: '1',
    batchNumber: '1-98765',
    plantFamily: 'Lavender',
    plantVariety: 'Hidcote',
    plantingDate: '2024-05-15',
    initialQuantity: 100,
    quantity: 100,
    status: 'Propagation',
    location: 'Greenhouse A',
    size: '286',
    supplier: 'Doran Nurseries',
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
    plantFamily: 'Rose',
    plantVariety: 'David Austin',
    plantingDate: '2024-04-20',
    initialQuantity: 50,
    quantity: 50,
    status: 'Plugs/Liners',
    location: 'Greenhouse B',
    size: '54',
    supplier: 'External Supplier Inc.',
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
    plantFamily: 'Tulip',
    plantVariety: 'Queen of Night',
    plantingDate: '2024-03-10',
    initialQuantity: 200,
    quantity: 200,
    status: 'Potted',
    location: 'Field 1',
    size: '10.5',
    supplier: 'Doran Nurseries',
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
