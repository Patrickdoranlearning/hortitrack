export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TableDefinition<Row extends Record<string, unknown>> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: never[];
};

export interface Database {
  public: {
    Tables: {
      batches: TableDefinition<{
        id: string;
        org_id: string;
        batch_number: string;
        phase: string | null;
        plant_variety_id: string | null;
        size_id: string | null;
        initial_quantity: number | null;
        quantity: number | null;
        location_id: string | null;
        supplier_id: string | null;
        status: string | null;
        planted_at: string | null;
        created_at: string | null;
        updated_at: string | null;
        current_passport_id: string | null;
      }>;
      batch_passports: TableDefinition<{
        id: string;
        batch_id: string;
        org_id: string;
        passport_type: string;
        botanical_name: string | null;
        operator_reg_no: string | null;
        traceability_code: string | null;
        origin_country: string | null;
        pz_codes: string | null;
        issuer_name: string | null;
        issue_date: string | null;
        raw_label_text: string | null;
        raw_barcode_text: string | null;
        images: string | null;
        created_at: string | null;
        created_by_user_id: string | null;
      }>;
      batch_events: TableDefinition<{
        id: string;
        batch_id: string;
        org_id: string;
        type: string;
        at: string;
        by_user_id: string | null;
        payload: string | null;
        created_at: string | null;
      }>;
      plant_varieties: TableDefinition<{
        id: string;
        org_id: string | null;
        name: string;
        family: string | null;
        genus: string | null;
        species: string | null;
        created_at: string | null;
      }>;
      plant_sizes: TableDefinition<{
        id: string;
        org_id: string | null;
        name: string;
        container_type: string | null;
        cell_multiple: number | null;
        created_at: string | null;
      }>;
      nursery_locations: TableDefinition<{
        id: string;
        org_id: string;
        name: string;
        created_at: string | null;
      }>;
      suppliers: TableDefinition<{
        id: string;
        org_id: string;
        name: string;
        producer_code: string | null;
        country_code: string | null;
        created_at: string | null;
      }>;
      profiles: TableDefinition<{
        id: string;
        active_org_id: string | null;
        avatar_url: string | null;
        full_name: string | null;
        email: string | null;
        created_at: string | null;
      }>;
      org_memberships: TableDefinition<{
        id: string;
        org_id: string;
        user_id: string;
        role: string | null;
        created_at: string | null;
      }>;
      organizations: TableDefinition<{
        id: string;
        name: string;
        created_at: string | null;
      }>;
      orders: TableDefinition<{
        id: string;
        customer_id: string | null;
        status: string | null;
        created_at: string | null;
        updated_at: string | null;
      }>;
      customers: TableDefinition<{
        id: string;
        name: string;
        created_at: string | null;
      }>;
    };
    Views: {
      v_batch_search: {
        Row: Record<string, Json>;
      };
      v_sku_available: {
        Row: {
          sku_code: string | null;
          description: string | null;
          available_qty: number | null;
        };
      };
    };
    Functions: {
      increment_counter: {
        Args: {
          p_org_id: string;
          p_key: string;
        };
        Returns: number;
      };
      decrement_batch_quantity: {
        Args: {
          p_org_id: string;
          p_batch_id: string;
          p_units: number;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

