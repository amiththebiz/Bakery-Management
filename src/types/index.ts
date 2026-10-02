export type RawMaterial = {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  buffer_stock: number;
  unit_cost: number;
  category: string;
  created_at: string;
  updated_at: string;
};

export type Good = {
  id: string;
  code: string;
  name: string;
  base_type: 'Flour Base' | 'Biscuit Curb Base';
  packets_per_batch: number;
  created_at: string;
};

export type Recipe = {
  id: string;
  good_id: string;
  raw_material_id: string;
  quantity_per_batch: number;
  created_at: string;
  raw_material?: RawMaterial;
  good?: Good;
};

export type BatchStatus = 'PLANNED' | 'IN_PRODUCTION' | 'PACKAGING' | 'COMPLETED';

export type BatchCard = {
  id: string;
  batch_number: string;
  good_id: string;
  status: BatchStatus;
  planned_quantity: number;
  actual_output_quantity: number | null;
  damaged_quantity: number;
  packaging_wastage: number;
  production_start_time: string | null;
  production_end_time: string | null;
  packaging_start_time: string | null;
  packaging_end_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  good?: Good;
};
