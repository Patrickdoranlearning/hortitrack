export type LogEntry = {
  date: string;
  action: string;
};

export type Batch = {
  id: string;
  batchNumber: string;
  plantType: string;
  plantingDate: string;
  quantity: number;
  status: 'Propagation' | 'Plugs/Liners' | 'Potted' | 'Ready for Sale';
  location: string;
  logHistory: LogEntry[];
  transplantedFrom?: string;
};
