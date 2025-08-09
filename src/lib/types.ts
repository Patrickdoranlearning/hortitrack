export type LogEntry = {
  date: string;
  action: string;
};

export type Batch = {
  id: string;
  batchNumber: string;
  plantFamily: string;
  plantVariety: string;
  plantingDate: string;
  initialQuantity: number;
  quantity: number;
  status: 'Propagation' | 'Plugs/Liners' | 'Potted' | 'Ready for Sale' | 'Looking Good' | 'Archived';
  location: string;
  size: string;
  logHistory: LogEntry[];
  transplantedFrom?: string;
  supplier?: string;
};

export type TransplantFormData = Omit<Batch, 'id' | 'initialQuantity'> & {
    initialQuantity: number;
};
