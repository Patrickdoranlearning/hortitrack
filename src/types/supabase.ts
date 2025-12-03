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
      price_lists: TableDefinition<{
        id: string;
        org_id: string;
        name: string;
        currency: string;
        is_default: boolean | null;
        valid_from: string | null;
        valid_to: string | null;
        created_at: string | null;
        updated_at: string | null;
      }>;
      skus: TableDefinition<{
        id: string;
        org_id: string;
        code: string;
        display_name: string;
        sku_type: string | null;
        plant_variety_id: string | null;
        size_id: string | null;
        description: string | null;
        barcode: string | null;
        default_vat_rate: number;
        created_at: string | null;
        updated_at: string | null;
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
      products: TableDefinition<{
        id: string;
        org_id: string;
        sku_id: string;
        name: string;
        description: string | null;
        default_status: string | null;
        hero_image_url: string | null;
        is_active: boolean | null;
        created_at: string | null;
        updated_at: string | null;
      }>;
      orders: TableDefinition<{
        id: string;
        org_id: string;
        order_number: string;
        customer_id: string;
        ship_to_address_id: string | null;
        status: string;
        payment_status: string | null;
        requested_delivery_date: string | null;
        notes: string | null;
        subtotal_ex_vat: number;
        vat_amount: number;
        total_inc_vat: number;
        trolleys_estimated: number | null;
        created_at: string | null;
        updated_at: string | null;
      }>;
      order_items: TableDefinition<{
        id: string;
        order_id: string;
        product_id: string | null;
        sku_id: string;
        description: string | null;
        quantity: number;
        unit_price_ex_vat: number;
        vat_rate: number;
        discount_pct: number | null;
        line_total_ex_vat: number;
        line_vat_amount: number;
        created_at: string | null;
        updated_at: string | null;
      }>;
      product_batches: TableDefinition<{
        id: string;
        org_id: string;
        product_id: string;
        batch_id: string;
        available_quantity_override: number | null;
        created_at: string | null;
        updated_at: string | null;
      }>;
      product_prices: TableDefinition<{
        id: string;
        org_id: string;
        product_id: string;
        price_list_id: string;
        unit_price_ex_vat: number;
        currency: string;
        valid_from: string | null;
        valid_to: string | null;
        min_qty: number;
        created_at: string | null;
        updated_at: string | null;
      }>;
      price_list_customers: TableDefinition<{
        id: string;
        org_id: string;
        price_list_id: string;
        customer_id: string;
        valid_from: string | null;
        valid_to: string | null;
        created_at: string | null;
      }>;
      product_aliases: TableDefinition<{
        id: string;
        org_id: string;
        product_id: string;
        customer_id: string | null;
        alias_name: string;
        customer_sku_code: string | null;
        customer_barcode: string | null;
        unit_price_ex_vat: number | null;
        price_list_id: string | null;
        is_active: boolean | null;
        notes: string | null;
        created_at: string | null;
        updated_at: string | null;
      }>;
      invoices: TableDefinition<{
        id: string;
        org_id: string;
        customer_id: string;
        invoice_number: string;
        status: string;
        issue_date: string;
        due_date: string | null;
        subtotal_ex_vat: number;
        vat_amount: number;
        total_inc_vat: number;
        created_at: string | null;
        updated_at: string | null;
      }>;
      credit_notes: TableDefinition<{
        id: string;
        org_id: string;
        customer_id: string;
        credit_number: string;
        status: string;
        issue_date: string;
        subtotal_ex_vat: number;
        vat_amount: number;
        total_inc_vat: number;
        created_at: string | null;
        updated_at: string | null;
      }>;
      customers: TableDefinition<{
        id: string;
        org_id: string;
        name: string;
        email: string | null;
        phone: string | null;
        vat_number: string | null;
        notes: string | null;
        default_price_list_id: string | null;
        created_at: string | null;
      }>;
      order_events: TableDefinition<{
        id: string;
        org_id: string;
        order_id: string;
        event_type: string;
        description: string | null;
        metadata: Json | null;
        created_by: string | null;
        created_at: string | null;
      }>;
      order_exceptions: TableDefinition<{
        id: string;
        org_id: string;
        order_id: string;
        order_item_id: string | null;
        exception_type: string;
        status: string;
        notes: string | null;
        raised_by: string | null;
        resolved_by: string | null;
        resolved_notes: string | null;
        created_at: string | null;
        resolved_at: string | null;
        metadata: Json | null;
      }>;
      pick_orders: TableDefinition<{
        id: string;
        order_item_id: string;
        picker_id: string | null;
        status: string;
        picked_qty: number | null;
        notes: string | null;
        created_at: string | null;
        updated_at: string | null;
      }>;
      dispatch_events: TableDefinition<{
        id: string;
        order_id: string;
        batch_id: string | null;
        dispatched_at: string | null;
        carrier: string | null;
        tracking_number: string | null;
        created_at: string | null;
      }>;
      sales_qc: TableDefinition<{
        id: string;
        pick_order_id: string;
        batch_id: string | null;
        issue_type: string | null;
        notes: string | null;
        resolved: boolean | null;
        created_at: string | null;
        updated_at: string | null;
      }>;
    };
    Views: {
      v_batch_search: {
        Row: {
          id: string;
          org_id: string;
          batch_number: string;
          status: string | null;
          phase: string | null;
          quantity: number | null;
          initial_quantity: number | null;
          ready_at: string | null;
          created_at: string | null;
          planted_at: string | null;
          variety_name: string | null;
          variety_family: string | null;
          variety_category: string | null;
          size_name: string | null;
          container_type: string | null;
          location_name: string | null;
          supplier_name: string | null;
          plant_variety_id: string | null;
          size_id: string | null;
          location_id: string | null;
          supplier_id: string | null;
        };
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
      perform_transplant: {
        Args: {
          p_org_id: string;
          p_parent_batch_id: string;
          p_size_id: string;
          p_location_id: string;
          p_containers: number;
          p_user_id: string;
          p_planted_at?: string | null;
          p_notes?: string | null;
          p_archive_parent_if_empty?: boolean;
        };
        Returns: {
          request_id: string;
          child_batch: {
            id: string;
            batch_number: string;
            quantity: number;
            phase: string;
          };
          parent_new_quantity: number;
        };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

