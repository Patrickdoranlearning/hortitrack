export type LogEntry = {
  date: string;
  action: string;
};

export type Batch = {
  id: string;
  plantType: string;
  plantingDate: string;
  quantity: number;
  status: 'Seeding' | 'Growing' | 'Ready for Sale';
  location: string;
  logHistory: LogEntry[];
};
