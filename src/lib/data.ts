import type { Batch } from './types';

export const INITIAL_BATCHES: Batch[] = [
  {
    id: '1',
    batchNumber: '1-000001',
    plantFamily: 'Lavender',
    plantVariety: 'Hidcote',
    plantingDate: '2024-03-15',
    initialQuantity: 100,
    quantity: 95,
    status: 'Propagation',
    location: 'Greenhouse 1',
    size: '286',
    supplier: 'Doran Nurseries',
    logHistory: [
      { date: '2024-03-15', action: 'Batch created.' },
      { date: '2024-03-20', action: 'Adjusted quantity by -5. Reason: Quality control.' }
    ],
  },
  {
    id: '2',
    batchNumber: '2-000002',
    plantFamily: 'Rose',
    plantVariety: 'Peace',
    plantingDate: '2024-04-01',
    initialQuantity: 250,
    quantity: 250,
    status: 'Plugs/Liners',
    location: 'Greenhouse 3',
    size: '54',
    supplier: 'External Supplier',
    logHistory: [{ date: '2024-04-01', action: 'Batch created.' }],
  },
  {
    id: '3',
    batchNumber: '3-000003',
    plantFamily: 'Hydrangea',
    plantVariety: 'Annabelle',
    plantingDate: '2024-02-10',
    initialQuantity: 50,
    quantity: 48,
    status: 'Potted',
    location: 'Field A1',
    size: '13',
    supplier: 'Doran Nurseries',
    logHistory: [
        { date: '2024-02-10', action: 'Batch created.' },
        { date: '2024-05-01', action: 'Transplanted 2 units to new batch.' }
    ],
    transplantedFrom: '1-000001',
  },
    {
    id: '4',
    batchNumber: '4-000004',
    plantFamily: 'Boxwood',
    plantVariety: 'Winter Gem',
    plantingDate: '2023-09-01',
    initialQuantity: 200,
    quantity: 200,
    status: 'Ready for Sale',
    location: 'Shade House 1',
    size: '15',
    supplier: 'Doran Nurseries',
    logHistory: [
        { date: '2023-09-01', action: 'Batch created.' },
        { date: '2024-04-01', action: 'Batch Trimmed' },
        { date: '2024-05-15', action: 'Moved to Ready for Sale' }
    ],
  },
];
