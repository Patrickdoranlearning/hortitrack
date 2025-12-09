export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      attribute_options: {
        Row: {
          attribute_key: string
          behavior: string | null
          color: string | null
          created_at: string
          display_label: string
          id: string
          is_active: boolean
          org_id: string
          sort_order: number
          system_code: string
          updated_at: string
        }
        Insert: {
          attribute_key: string
          behavior?: string | null
          color?: string | null
          created_at?: string
          display_label: string
          id?: string
          is_active?: boolean
          org_id: string
          sort_order?: number
          system_code: string
          updated_at?: string
        }
        Update: {
          attribute_key?: string
          behavior?: string | null
          color?: string | null
          created_at?: string
          display_label?: string
          id?: string
          is_active?: boolean
          org_id?: string
          sort_order?: number
          system_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attribute_options_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_allocations: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          note: string | null
          order_item_id: string
          org_id: string
          quantity: number
          status: Database["public"]["Enums"]["allocation_status"] | null
          updated_at: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          note?: string | null
          order_item_id: string
          org_id: string
          quantity: number
          status?: Database["public"]["Enums"]["allocation_status"] | null
          updated_at?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          note?: string | null
          order_item_id?: string
          org_id?: string
          quantity?: number
          status?: Database["public"]["Enums"]["allocation_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_allocations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_allocations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_allocations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "batch_allocations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_allocations_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_allocations_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_lines"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "batch_allocations_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "v_order_picklist"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "batch_allocations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_ancestry: {
        Row: {
          child_batch_id: string
          id: string
          org_id: string
          parent_batch_id: string
          proportion: number | null
        }
        Insert: {
          child_batch_id: string
          id?: string
          org_id: string
          parent_batch_id: string
          proportion?: number | null
        }
        Update: {
          child_batch_id?: string
          id?: string
          org_id?: string
          parent_batch_id?: string
          proportion?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_ancestry_child_batch_id_fkey"
            columns: ["child_batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_ancestry_child_batch_id_fkey"
            columns: ["child_batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_ancestry_child_batch_id_fkey"
            columns: ["child_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "batch_ancestry_child_batch_id_fkey"
            columns: ["child_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_ancestry_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_ancestry_parent_batch_id_fkey"
            columns: ["parent_batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_ancestry_parent_batch_id_fkey"
            columns: ["parent_batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_ancestry_parent_batch_id_fkey"
            columns: ["parent_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "batch_ancestry_parent_batch_id_fkey"
            columns: ["parent_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_events: {
        Row: {
          at: string
          batch_id: string
          by_user_id: string | null
          created_at: string
          id: string
          org_id: string
          payload: Json | null
          request_id: string | null
          type: string
        }
        Insert: {
          at?: string
          batch_id: string
          by_user_id?: string | null
          created_at?: string
          id?: string
          org_id: string
          payload?: Json | null
          request_id?: string | null
          type: string
        }
        Update: {
          at?: string
          batch_id?: string
          by_user_id?: string | null
          created_at?: string
          id?: string
          org_id?: string
          payload?: Json | null
          request_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "batch_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_logs: {
        Row: {
          actor_id: string | null
          batch_id: string
          created_at: string
          id: string
          note: string | null
          occurred_at: string
          org_id: string
          qty_change: number | null
          type: string
        }
        Insert: {
          actor_id?: string | null
          batch_id: string
          created_at?: string
          id?: string
          note?: string | null
          occurred_at?: string
          org_id: string
          qty_change?: number | null
          type: string
        }
        Update: {
          actor_id?: string | null
          batch_id?: string
          created_at?: string
          id?: string
          note?: string | null
          occurred_at?: string
          org_id?: string
          qty_change?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "batch_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_passports: {
        Row: {
          batch_id: string
          botanical_name: string | null
          created_at: string
          created_by_user_id: string | null
          id: string
          images: Json | null
          issue_date: string | null
          issuer_name: string | null
          operator_reg_no: string | null
          org_id: string
          origin_country: string | null
          passport_type: string
          pz_codes: Json | null
          raw_barcode_text: string | null
          raw_label_text: string | null
          request_id: string | null
          traceability_code: string | null
        }
        Insert: {
          batch_id: string
          botanical_name?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          images?: Json | null
          issue_date?: string | null
          issuer_name?: string | null
          operator_reg_no?: string | null
          org_id: string
          origin_country?: string | null
          passport_type: string
          pz_codes?: Json | null
          raw_barcode_text?: string | null
          raw_label_text?: string | null
          request_id?: string | null
          traceability_code?: string | null
        }
        Update: {
          batch_id?: string
          botanical_name?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          images?: Json | null
          issue_date?: string | null
          issuer_name?: string | null
          operator_reg_no?: string | null
          org_id?: string
          origin_country?: string | null
          passport_type?: string
          pz_codes?: Json | null
          raw_barcode_text?: string | null
          raw_label_text?: string | null
          request_id?: string | null
          traceability_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_passports_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_passports_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_passports_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "batch_passports_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_passports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_photos: {
        Row: {
          batch_id: string
          created_at: string
          created_by: string | null
          created_by_role: string | null
          id: string
          org_id: string
          storage_path: string | null
          type: string
          url: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_by?: string | null
          created_by_role?: string | null
          id?: string
          org_id: string
          storage_path?: string | null
          type: string
          url: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_by?: string | null
          created_by_role?: string | null
          id?: string
          org_id?: string
          storage_path?: string | null
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_photos_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_photos_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_photos_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "batch_photos_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_photos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          archived_at: string | null
          batch_number: string
          created_at: string
          dispatched_at: string | null
          grower_photo_url: string | null
          growing_status: string | null
          id: string
          initial_quantity: number | null
          location_id: string
          log_history: Json
          org_id: string
          parent_batch_id: string | null
          passport_override_a: string | null
          passport_override_b: string | null
          passport_override_c: string | null
          passport_override_d: string | null
          phase: string
          plant_variety_id: string
          planted_at: string | null
          protocol_id: string | null
          qr_code: string | null
          qr_image_url: string | null
          quantity: number
          quantity_produced: number | null
          ready_at: string | null
          reserved_quantity: number
          sales_photo_url: string | null
          sales_status: string | null
          size_id: string
          status: string
          status_id: string
          supplier_batch_number: string
          supplier_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          batch_number: string
          created_at?: string
          dispatched_at?: string | null
          grower_photo_url?: string | null
          growing_status?: string | null
          id?: string
          initial_quantity?: number | null
          location_id: string
          log_history?: Json
          org_id: string
          parent_batch_id?: string | null
          passport_override_a?: string | null
          passport_override_b?: string | null
          passport_override_c?: string | null
          passport_override_d?: string | null
          phase?: string
          plant_variety_id: string
          planted_at?: string | null
          protocol_id?: string | null
          qr_code?: string | null
          qr_image_url?: string | null
          quantity?: number
          quantity_produced?: number | null
          ready_at?: string | null
          reserved_quantity?: number
          sales_photo_url?: string | null
          sales_status?: string | null
          size_id: string
          status?: string
          status_id: string
          supplier_batch_number?: string
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          batch_number?: string
          created_at?: string
          dispatched_at?: string | null
          grower_photo_url?: string | null
          growing_status?: string | null
          id?: string
          initial_quantity?: number | null
          location_id?: string
          log_history?: Json
          org_id?: string
          parent_batch_id?: string | null
          passport_override_a?: string | null
          passport_override_b?: string | null
          passport_override_c?: string | null
          passport_override_d?: string | null
          phase?: string
          plant_variety_id?: string
          planted_at?: string | null
          protocol_id?: string | null
          qr_code?: string | null
          qr_image_url?: string | null
          quantity?: number
          quantity_produced?: number | null
          ready_at?: string | null
          reserved_quantity?: number
          sales_photo_url?: string | null
          sales_status?: string | null
          size_id?: string
          status?: string
          status_id?: string
          supplier_batch_number?: string
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "lookup_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "nursery_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_parent_batch_id_fkey"
            columns: ["parent_batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_parent_batch_id_fkey"
            columns: ["parent_batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_parent_batch_id_fkey"
            columns: ["parent_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "batches_parent_batch_id_fkey"
            columns: ["parent_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_plant_variety_id_fkey"
            columns: ["plant_variety_id"]
            isOneToOne: false
            referencedRelation: "lookup_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_plant_variety_id_fkey"
            columns: ["plant_variety_id"]
            isOneToOne: false
            referencedRelation: "plant_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_plant_variety_id_fkey"
            columns: ["plant_variety_id"]
            isOneToOne: false
            referencedRelation: "plant_varieties_compat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_plant_variety_id_fkey"
            columns: ["plant_variety_id"]
            isOneToOne: false
            referencedRelation: "v_plant_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "lookup_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "plant_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "attribute_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "lookup_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_allocations: {
        Row: {
          amount: number
          created_at: string
          credit_note_id: string
          id: string
          invoice_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          credit_note_id: string
          id?: string
          invoice_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          credit_note_id?: string
          id?: string
          invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_allocations_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_allocations_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "v_credit_note_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_note_items: {
        Row: {
          created_at: string
          credit_note_id: string
          description: string | null
          id: string
          line_total_ex_vat: number
          line_vat_amount: number
          quantity: number
          sku_id: string | null
          unit_price_ex_vat: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          created_at?: string
          credit_note_id: string
          description?: string | null
          id?: string
          line_total_ex_vat?: number
          line_vat_amount?: number
          quantity: number
          sku_id?: string | null
          unit_price_ex_vat: number
          updated_at?: string
          vat_rate: number
        }
        Update: {
          created_at?: string
          credit_note_id?: string
          description?: string | null
          id?: string
          line_total_ex_vat?: number
          line_vat_amount?: number
          quantity?: number
          sku_id?: string | null
          unit_price_ex_vat?: number
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_items_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_items_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "v_credit_note_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          created_at: string
          credit_number: string
          currency: string
          customer_id: string
          id: string
          issue_date: string
          notes: string | null
          org_id: string
          status: Database["public"]["Enums"]["credit_status"]
          subtotal_ex_vat: number
          total_inc_vat: number
          updated_at: string
          vat_amount: number
        }
        Insert: {
          created_at?: string
          credit_number: string
          currency?: string
          customer_id: string
          id?: string
          issue_date?: string
          notes?: string | null
          org_id: string
          status?: Database["public"]["Enums"]["credit_status"]
          subtotal_ex_vat?: number
          total_inc_vat?: number
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          created_at?: string
          credit_number?: string
          currency?: string
          customer_id?: string
          id?: string
          issue_date?: string
          notes?: string | null
          org_id?: string
          status?: Database["public"]["Enums"]["credit_status"]
          subtotal_ex_vat?: number
          total_inc_vat?: number
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_vat_treatment"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_trolley_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "credit_notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country_code: string
          county: string | null
          created_at: string
          customer_id: string
          eircode: string | null
          id: string
          is_default_billing: boolean
          is_default_shipping: boolean
          label: string
          line1: string
          line2: string | null
          store_name: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country_code?: string
          county?: string | null
          created_at?: string
          customer_id: string
          eircode?: string | null
          id?: string
          is_default_billing?: boolean
          is_default_shipping?: boolean
          label: string
          line1: string
          line2?: string | null
          store_name?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country_code?: string
          county?: string | null
          created_at?: string
          customer_id?: string
          eircode?: string | null
          id?: string
          is_default_billing?: boolean
          is_default_shipping?: boolean
          label?: string
          line1?: string
          line2?: string | null
          store_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_vat_treatment"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_trolley_summary"
            referencedColumns: ["customer_id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          created_at: string
          customer_id: string
          email: string | null
          id: string
          is_primary: boolean
          mobile: string | null
          name: string
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          email?: string | null
          id?: string
          is_primary?: boolean
          mobile?: string | null
          name: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          mobile?: string | null
          name?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_vat_treatment"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_trolley_summary"
            referencedColumns: ["customer_id"]
          },
        ]
      }
      customer_favorite_products: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          org_id: string
          product_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          org_id: string
          product_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          org_id?: string
          product_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_favorite_products_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_vat_treatment"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_favorite_products_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_favorite_products_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_trolley_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_favorite_products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_favorite_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_impersonation_sessions: {
        Row: {
          created_at: string
          customer_id: string
          ended_at: string | null
          id: string
          notes: string | null
          org_id: string
          staff_user_id: string
          started_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          org_id: string
          staff_user_id: string
          started_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          staff_user_id?: string
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_impersonation_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_vat_treatment"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_impersonation_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_impersonation_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_trolley_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_impersonation_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_resources: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          file_size_bytes: number | null
          file_url: string | null
          id: string
          is_active: boolean
          mime_type: string | null
          org_id: string
          resource_type: string
          sort_order: number
          storage_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          is_active?: boolean
          mime_type?: string | null
          org_id: string
          resource_type: string
          sort_order?: number
          storage_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          is_active?: boolean
          mime_type?: string | null
          org_id?: string
          resource_type?: string
          sort_order?: number
          storage_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_resources_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_trolley_balance: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          last_delivery_date: string | null
          last_return_date: string | null
          org_id: string
          reminder_count: number
          reminder_sent_at: string | null
          trolleys_out: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          last_delivery_date?: string | null
          last_return_date?: string | null
          org_id: string
          reminder_count?: number
          reminder_sent_at?: string | null
          trolleys_out?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          last_delivery_date?: string | null
          last_return_date?: string | null
          org_id?: string
          reminder_count?: number
          reminder_sent_at?: string | null
          trolleys_out?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_trolley_balance_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_vat_treatment"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_trolley_balance_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_trolley_balance_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_trolley_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_trolley_balance_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          account_code: string | null
          accounts_email: string | null
          code: string | null
          country_code: string
          created_at: string
          credit_limit: number | null
          currency: string
          default_price_list_id: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          org_id: string
          payment_terms_days: number
          phone: string | null
          pricing_tier: string | null
          store: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          account_code?: string | null
          accounts_email?: string | null
          code?: string | null
          country_code?: string
          created_at?: string
          credit_limit?: number | null
          currency?: string
          default_price_list_id?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          org_id: string
          payment_terms_days?: number
          phone?: string | null
          pricing_tier?: string | null
          store?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          account_code?: string | null
          accounts_email?: string | null
          code?: string | null
          country_code?: string
          created_at?: string
          credit_limit?: number | null
          currency?: string
          default_price_list_id?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          payment_terms_days?: number
          phone?: string | null
          pricing_tier?: string | null
          store?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customers_price_list"
            columns: ["default_price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          cost_estimate: number | null
          created_at: string
          delivered_at: string | null
          departed_at: string | null
          id: string
          method: string | null
          notes: string | null
          order_id: string
          org_id: string
          scheduled_date: string | null
          status: Database["public"]["Enums"]["delivery_status"]
          trolley_count: number | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          cost_estimate?: number | null
          created_at?: string
          delivered_at?: string | null
          departed_at?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          order_id: string
          org_id: string
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          trolley_count?: number | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          cost_estimate?: number | null
          created_at?: string
          delivered_at?: string | null
          departed_at?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          order_id?: string
          org_id?: string
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          trolley_count?: number | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_header"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_ready_for_dispatch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_items: {
        Row: {
          actual_delivery_time: string | null
          created_at: string
          delivery_notes: string | null
          delivery_photo_url: string | null
          delivery_run_id: string
          delivery_window_end: string | null
          delivery_window_start: string | null
          estimated_delivery_time: string | null
          failure_reason: string | null
          id: string
          order_id: string
          org_id: string
          recipient_name: string | null
          recipient_signature_url: string | null
          rescheduled_to: string | null
          sequence_number: number
          status: Database["public"]["Enums"]["delivery_item_status"]
          trolleys_delivered: number
          trolleys_outstanding: number | null
          trolleys_returned: number
          updated_at: string
        }
        Insert: {
          actual_delivery_time?: string | null
          created_at?: string
          delivery_notes?: string | null
          delivery_photo_url?: string | null
          delivery_run_id: string
          delivery_window_end?: string | null
          delivery_window_start?: string | null
          estimated_delivery_time?: string | null
          failure_reason?: string | null
          id?: string
          order_id: string
          org_id: string
          recipient_name?: string | null
          recipient_signature_url?: string | null
          rescheduled_to?: string | null
          sequence_number: number
          status?: Database["public"]["Enums"]["delivery_item_status"]
          trolleys_delivered?: number
          trolleys_outstanding?: number | null
          trolleys_returned?: number
          updated_at?: string
        }
        Update: {
          actual_delivery_time?: string | null
          created_at?: string
          delivery_notes?: string | null
          delivery_photo_url?: string | null
          delivery_run_id?: string
          delivery_window_end?: string | null
          delivery_window_start?: string | null
          estimated_delivery_time?: string | null
          failure_reason?: string | null
          id?: string
          order_id?: string
          org_id?: string
          recipient_name?: string | null
          recipient_signature_url?: string | null
          rescheduled_to?: string | null
          sequence_number?: number
          status?: Database["public"]["Enums"]["delivery_item_status"]
          trolleys_delivered?: number
          trolleys_outstanding?: number | null
          trolleys_returned?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_delivery_run_id_fkey"
            columns: ["delivery_run_id"]
            isOneToOne: false
            referencedRelation: "delivery_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_run_id_fkey"
            columns: ["delivery_run_id"]
            isOneToOne: false
            referencedRelation: "v_active_delivery_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_header"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "delivery_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_ready_for_dispatch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_runs: {
        Row: {
          actual_departure_time: string | null
          actual_return_time: string | null
          created_at: string
          created_by: string | null
          driver_name: string | null
          estimated_return_time: string | null
          haulier_id: string | null
          id: string
          org_id: string
          planned_departure_time: string | null
          route_notes: string | null
          run_date: string
          run_number: string
          status: Database["public"]["Enums"]["delivery_run_status"]
          trolleys_loaded: number
          trolleys_returned: number
          updated_at: string
          vehicle_registration: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Insert: {
          actual_departure_time?: string | null
          actual_return_time?: string | null
          created_at?: string
          created_by?: string | null
          driver_name?: string | null
          estimated_return_time?: string | null
          haulier_id?: string | null
          id?: string
          org_id: string
          planned_departure_time?: string | null
          route_notes?: string | null
          run_date: string
          run_number: string
          status?: Database["public"]["Enums"]["delivery_run_status"]
          trolleys_loaded?: number
          trolleys_returned?: number
          updated_at?: string
          vehicle_registration?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Update: {
          actual_departure_time?: string | null
          actual_return_time?: string | null
          created_at?: string
          created_by?: string | null
          driver_name?: string | null
          estimated_return_time?: string | null
          haulier_id?: string | null
          id?: string
          org_id?: string
          planned_departure_time?: string | null
          route_notes?: string | null
          run_date?: string
          run_number?: string
          status?: Database["public"]["Enums"]["delivery_run_status"]
          trolleys_loaded?: number
          trolleys_returned?: number
          updated_at?: string
          vehicle_registration?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_events: {
        Row: {
          batch_id: string | null
          carrier: string | null
          created_at: string | null
          dispatched_at: string | null
          id: string
          order_id: string
          tracking_number: string | null
        }
        Insert: {
          batch_id?: string | null
          carrier?: string | null
          created_at?: string | null
          dispatched_at?: string | null
          id?: string
          order_id: string
          tracking_number?: string | null
        }
        Update: {
          batch_id?: string | null
          carrier?: string | null
          created_at?: string | null
          dispatched_at?: string | null
          id?: string
          order_id?: string
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "dispatch_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_header"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "dispatch_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_ready_for_dispatch"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_types: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      hauliers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hauliers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string | null
          discount_pct: number
          id: string
          invoice_id: string
          line_total_ex_vat: number
          line_vat_amount: number
          order_item_id: string | null
          quantity: number
          sku_id: string | null
          unit_price_ex_vat: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          invoice_id: string
          line_total_ex_vat?: number
          line_vat_amount?: number
          order_item_id?: string | null
          quantity: number
          sku_id?: string | null
          unit_price_ex_vat: number
          updated_at?: string
          vat_rate: number
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          invoice_id?: string
          line_total_ex_vat?: number
          line_vat_amount?: number
          order_item_id?: string | null
          quantity?: number
          sku_id?: string | null
          unit_price_ex_vat?: number
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_lines"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "invoice_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "v_order_picklist"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "invoice_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_credited: number
          balance_due: number
          created_at: string
          currency: string
          customer_id: string
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          order_id: string | null
          org_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal_ex_vat: number
          total_inc_vat: number
          updated_at: string
          vat_amount: number
        }
        Insert: {
          amount_credited?: number
          balance_due?: number
          created_at?: string
          currency?: string
          customer_id: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          order_id?: string | null
          org_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_ex_vat?: number
          total_inc_vat?: number
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          amount_credited?: number
          balance_due?: number
          created_at?: string
          currency?: string
          customer_id?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          order_id?: string | null
          org_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_ex_vat?: number
          total_inc_vat?: number
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_vat_treatment"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_trolley_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_header"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_ready_for_dispatch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      label_templates: {
        Row: {
          created_at: string | null
          description: string | null
          dpi: number | null
          height_mm: number
          id: string
          is_active: boolean | null
          is_default: boolean | null
          label_type: string
          layout: Json | null
          margin_mm: number | null
          name: string
          org_id: string
          updated_at: string | null
          width_mm: number
          zpl_template: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          dpi?: number | null
          height_mm: number
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          label_type?: string
          layout?: Json | null
          margin_mm?: number | null
          name: string
          org_id: string
          updated_at?: string | null
          width_mm: number
          zpl_template?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          dpi?: number | null
          height_mm?: number
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          label_type?: string
          layout?: Json | null
          margin_mm?: number | null
          name?: string
          org_id?: string
          updated_at?: string | null
          width_mm?: number
          zpl_template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "label_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      media_attachments: {
        Row: {
          badge_type: string | null
          caption: string | null
          created_at: string | null
          display_order: number | null
          entity_id: string
          entity_type: string
          id: string
          is_hero: boolean | null
          media_id: string
          org_id: string
        }
        Insert: {
          badge_type?: string | null
          caption?: string | null
          created_at?: string | null
          display_order?: number | null
          entity_id: string
          entity_type: string
          id?: string
          is_hero?: boolean | null
          media_id: string
          org_id: string
        }
        Update: {
          badge_type?: string | null
          caption?: string | null
          created_at?: string | null
          display_order?: number | null
          entity_id?: string
          entity_type?: string
          id?: string
          is_hero?: boolean | null
          media_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_attachments_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_attachments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      media_library: {
        Row: {
          file_path: string
          id: string
          media_type: string | null
          org_id: string
          storage_path: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          file_path: string
          id?: string
          media_type?: string | null
          org_id: string
          storage_path?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          file_path?: string
          id?: string
          media_type?: string | null
          org_id?: string
          storage_path?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_library_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nursery_locations: {
        Row: {
          area: number | null
          covered: boolean
          created_at: string
          id: string
          name: string
          nursery_site: string
          org_id: string
          site_id: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          area?: number | null
          covered?: boolean
          created_at?: string
          id?: string
          name: string
          nursery_site: string
          org_id: string
          site_id?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          area?: number | null
          covered?: boolean
          created_at?: string
          id?: string
          name?: string
          nursery_site?: string
          org_id?: string
          site_id?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nursery_locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nursery_locations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          event_type: string
          id: string
          metadata: Json
          order_id: string
          org_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json
          order_id: string
          org_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          order_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_header"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_ready_for_dispatch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_exceptions: {
        Row: {
          created_at: string
          exception_type: string
          id: string
          metadata: Json
          notes: string | null
          order_id: string
          order_item_id: string | null
          org_id: string
          raised_by: string | null
          resolved_at: string | null
          resolved_by: string | null
          resolved_notes: string | null
          status: string
        }
        Insert: {
          created_at?: string
          exception_type: string
          id?: string
          metadata?: Json
          notes?: string | null
          order_id: string
          order_item_id?: string | null
          org_id: string
          raised_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_notes?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          exception_type?: string
          id?: string
          metadata?: Json
          notes?: string | null
          order_id?: string
          order_item_id?: string | null
          org_id?: string
          raised_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_exceptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_exceptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_header"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_exceptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_exceptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_ready_for_dispatch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_exceptions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_exceptions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_lines"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "order_exceptions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "v_order_picklist"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "order_exceptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_substitutions: {
        Row: {
          applied_at: string | null
          created_at: string
          decided_at: string | null
          decision_notes: string | null
          id: string
          order_id: string
          order_item_id: string
          org_id: string
          proposed_sku_id: string
          reason_text: string | null
          requested_by: string | null
          requested_qty: number
          reviewed_by: string | null
          status: Database["public"]["Enums"]["substitution_status"]
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          decided_at?: string | null
          decision_notes?: string | null
          id?: string
          order_id: string
          order_item_id: string
          org_id: string
          proposed_sku_id: string
          reason_text?: string | null
          requested_by?: string | null
          requested_qty: number
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["substitution_status"]
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          decided_at?: string | null
          decision_notes?: string | null
          id?: string
          order_id?: string
          order_item_id?: string
          org_id?: string
          proposed_sku_id?: string
          reason_text?: string | null
          requested_by?: string | null
          requested_qty?: number
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["substitution_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_item_substitutions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_substitutions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_header"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_item_substitutions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_substitutions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_ready_for_dispatch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_substitutions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_substitutions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_lines"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "order_item_substitutions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "v_order_picklist"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "order_item_substitutions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_substitutions_proposed_sku_id_fkey"
            columns: ["proposed_sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          description: string | null
          discount_pct: number
          id: string
          line_total_ex_vat: number
          line_vat_amount: number
          multibuy_price_2: number | null
          multibuy_price_3: number | null
          multibuy_qty_2: number | null
          multibuy_qty_3: number | null
          order_id: string
          product_id: string | null
          quantity: number
          required_batch_id: string | null
          required_variety_id: string | null
          rrp: number | null
          sku_id: string
          unit_price_ex_vat: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          line_total_ex_vat?: number
          line_vat_amount?: number
          multibuy_price_2?: number | null
          multibuy_price_3?: number | null
          multibuy_qty_2?: number | null
          multibuy_qty_3?: number | null
          order_id: string
          product_id?: string | null
          quantity: number
          required_batch_id?: string | null
          required_variety_id?: string | null
          rrp?: number | null
          sku_id: string
          unit_price_ex_vat: number
          updated_at?: string
          vat_rate: number
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          line_total_ex_vat?: number
          line_vat_amount?: number
          multibuy_price_2?: number | null
          multibuy_price_3?: number | null
          multibuy_qty_2?: number | null
          multibuy_qty_3?: number | null
          order_id?: string
          product_id?: string | null
          quantity?: number
          required_batch_id?: string | null
          required_variety_id?: string | null
          rrp?: number | null
          sku_id?: string
          unit_price_ex_vat?: number
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_header"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_ready_for_dispatch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_required_batch_id_fkey"
            columns: ["required_batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_required_batch_id_fkey"
            columns: ["required_batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_required_batch_id_fkey"
            columns: ["required_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "order_items_required_batch_id_fkey"
            columns: ["required_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_required_variety_id_fkey"
            columns: ["required_variety_id"]
            isOneToOne: false
            referencedRelation: "lookup_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_required_variety_id_fkey"
            columns: ["required_variety_id"]
            isOneToOne: false
            referencedRelation: "plant_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_required_variety_id_fkey"
            columns: ["required_variety_id"]
            isOneToOne: false
            referencedRelation: "plant_varieties_compat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_required_variety_id_fkey"
            columns: ["required_variety_id"]
            isOneToOne: false
            referencedRelation: "v_plant_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      order_packing: {
        Row: {
          created_at: string
          id: string
          order_id: string
          org_id: string
          packing_completed_at: string | null
          packing_notes: string | null
          packing_started_at: string | null
          special_instructions: string | null
          status: Database["public"]["Enums"]["packing_status"]
          total_units: number | null
          trolleys_used: number
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          org_id: string
          packing_completed_at?: string | null
          packing_notes?: string | null
          packing_started_at?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["packing_status"]
          total_units?: number | null
          trolleys_used?: number
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          org_id?: string
          packing_completed_at?: string | null
          packing_notes?: string | null
          packing_started_at?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["packing_status"]
          total_units?: number | null
          trolleys_used?: number
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_packing_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_packing_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_delivery_note_header"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_packing_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_packing_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_orders_ready_for_dispatch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_packing_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_updates: {
        Row: {
          created_at: string
          created_by: string | null
          customer_notified_at: string | null
          delivery_item_id: string | null
          id: string
          message: string | null
          order_id: string
          org_id: string
          status_type: string
          title: string
          visible_to_customer: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_notified_at?: string | null
          delivery_item_id?: string | null
          id?: string
          message?: string | null
          order_id: string
          org_id: string
          status_type: string
          title: string
          visible_to_customer?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_notified_at?: string | null
          delivery_item_id?: string | null
          id?: string
          message?: string | null
          order_id?: string
          org_id?: string
          status_type?: string
          title?: string
          visible_to_customer?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "order_status_updates_delivery_item_id_fkey"
            columns: ["delivery_item_id"]
            isOneToOne: false
            referencedRelation: "delivery_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_updates_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_updates_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_header"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_status_updates_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_updates_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_ready_for_dispatch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_updates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          created_by_staff_id: string | null
          customer_id: string
          id: string
          notes: string | null
          order_number: string
          org_id: string
          payment_status: string | null
          requested_delivery_date: string | null
          ship_to_address_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_ex_vat: number
          total_inc_vat: number
          trolleys_estimated: number | null
          updated_at: string
          vat_amount: number
        }
        Insert: {
          created_at?: string
          created_by_staff_id?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          order_number: string
          org_id: string
          payment_status?: string | null
          requested_delivery_date?: string | null
          ship_to_address_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_ex_vat?: number
          total_inc_vat?: number
          trolleys_estimated?: number | null
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          created_at?: string
          created_by_staff_id?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          order_number?: string
          org_id?: string
          payment_status?: string | null
          requested_delivery_date?: string | null
          ship_to_address_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_ex_vat?: number
          total_inc_vat?: number
          trolleys_estimated?: number | null
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_vat_treatment"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_trolley_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_ship_to_address_id_fkey"
            columns: ["ship_to_address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      org_counters: {
        Row: {
          key: string
          org_id: string
          value: number
        }
        Insert: {
          key: string
          org_id: string
          value?: number
        }
        Update: {
          key?: string
          org_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_counters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_memberships: {
        Row: {
          created_at: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_memberships_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          country_code: string
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          producer_code: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          country_code?: string
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          producer_code?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          country_code?: string
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          producer_code?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      pick_items: {
        Row: {
          created_at: string
          id: string
          location_hint: string | null
          notes: string | null
          order_item_id: string
          original_batch_id: string | null
          pick_list_id: string
          picked_at: string | null
          picked_batch_id: string | null
          picked_by: string | null
          picked_qty: number
          status: Database["public"]["Enums"]["pick_item_status"]
          substitution_reason: string | null
          target_qty: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_hint?: string | null
          notes?: string | null
          order_item_id: string
          original_batch_id?: string | null
          pick_list_id: string
          picked_at?: string | null
          picked_batch_id?: string | null
          picked_by?: string | null
          picked_qty?: number
          status?: Database["public"]["Enums"]["pick_item_status"]
          substitution_reason?: string | null
          target_qty: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location_hint?: string | null
          notes?: string | null
          order_item_id?: string
          original_batch_id?: string | null
          pick_list_id?: string
          picked_at?: string | null
          picked_batch_id?: string | null
          picked_by?: string | null
          picked_qty?: number
          status?: Database["public"]["Enums"]["pick_item_status"]
          substitution_reason?: string | null
          target_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_lines"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "pick_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "v_order_picklist"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "pick_items_original_batch_fkey"
            columns: ["original_batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_items_original_batch_fkey"
            columns: ["original_batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_items_original_batch_fkey"
            columns: ["original_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "pick_items_original_batch_fkey"
            columns: ["original_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_items_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "pick_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_items_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "v_pick_lists_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_items_picked_batch_fkey"
            columns: ["picked_batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_items_picked_batch_fkey"
            columns: ["picked_batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_items_picked_batch_fkey"
            columns: ["picked_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "pick_items_picked_batch_fkey"
            columns: ["picked_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_list_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          event_type: string
          id: string
          metadata: Json
          org_id: string
          pick_item_id: string | null
          pick_list_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json
          org_id: string
          pick_item_id?: string | null
          pick_list_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          org_id?: string
          pick_item_id?: string | null
          pick_list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_list_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_events_pick_item_id_fkey"
            columns: ["pick_item_id"]
            isOneToOne: false
            referencedRelation: "pick_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_events_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "pick_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_events_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "v_pick_lists_detail"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_lists: {
        Row: {
          assigned_team_id: string | null
          assigned_user_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          notes: string | null
          order_id: string
          org_id: string
          sequence: number
          started_at: string | null
          started_by: string | null
          status: Database["public"]["Enums"]["pick_list_status"]
          updated_at: string
        }
        Insert: {
          assigned_team_id?: string | null
          assigned_user_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          org_id: string
          sequence?: number
          started_at?: string | null
          started_by?: string | null
          status?: Database["public"]["Enums"]["pick_list_status"]
          updated_at?: string
        }
        Update: {
          assigned_team_id?: string | null
          assigned_user_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          org_id?: string
          sequence?: number
          started_at?: string | null
          started_by?: string | null
          status?: Database["public"]["Enums"]["pick_list_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_lists_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_delivery_note_header"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "pick_lists_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_orders_ready_for_dispatch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_team_id_fkey"
            columns: ["assigned_team_id"]
            isOneToOne: false
            referencedRelation: "picking_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_team_id_fkey"
            columns: ["assigned_team_id"]
            isOneToOne: false
            referencedRelation: "v_picking_team_workload"
            referencedColumns: ["team_id"]
          },
        ]
      }
      pick_orders: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          order_item_id: string
          picked_qty: number | null
          picker_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_item_id: string
          picked_qty?: number | null
          picker_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_item_id?: string
          picked_qty?: number | null
          picker_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pick_orders_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_orders_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_lines"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "pick_orders_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "v_order_picklist"
            referencedColumns: ["order_item_id"]
          },
        ]
      }
      picking_feedback: {
        Row: {
          allocation_id: string | null
          batch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          message: string | null
          order_id: string
          order_item_id: string | null
          org_id: string
          photo_urls: Json
          resolution_note: string | null
          resolution_status: Database["public"]["Enums"]["resolution_status"]
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["feedback_severity"]
          type: Database["public"]["Enums"]["feedback_type"]
        }
        Insert: {
          allocation_id?: string | null
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          order_id: string
          order_item_id?: string | null
          org_id: string
          photo_urls?: Json
          resolution_note?: string | null
          resolution_status?: Database["public"]["Enums"]["resolution_status"]
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["feedback_severity"]
          type: Database["public"]["Enums"]["feedback_type"]
        }
        Update: {
          allocation_id?: string | null
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          order_id?: string
          order_item_id?: string | null
          org_id?: string
          photo_urls?: Json
          resolution_note?: string | null
          resolution_status?: Database["public"]["Enums"]["resolution_status"]
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["feedback_severity"]
          type?: Database["public"]["Enums"]["feedback_type"]
        }
        Relationships: [
          {
            foreignKeyName: "picking_feedback_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "batch_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_feedback_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_feedback_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_feedback_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "picking_feedback_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_header"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "picking_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_ready_for_dispatch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_feedback_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_feedback_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_lines"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "picking_feedback_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "v_order_picklist"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "picking_feedback_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      picking_team_members: {
        Row: {
          created_at: string
          id: string
          is_lead: boolean
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_lead?: boolean
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_lead?: boolean
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "picking_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "picking_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_picking_team_workload"
            referencedColumns: ["team_id"]
          },
        ]
      }
      picking_teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "picking_teams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plant_health_logs: {
        Row: {
          batch_id: string | null
          created_at: string
          event_at: string
          event_type: Database["public"]["Enums"]["health_event_type"]
          id: string
          location_id: string | null
          measurements: Json | null
          notes: string | null
          org_id: string
          photos: string[] | null
          recorded_by: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          event_at?: string
          event_type: Database["public"]["Enums"]["health_event_type"]
          id?: string
          location_id?: string | null
          measurements?: Json | null
          notes?: string | null
          org_id: string
          photos?: string[] | null
          recorded_by?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          event_at?: string
          event_type?: Database["public"]["Enums"]["health_event_type"]
          id?: string
          location_id?: string | null
          measurements?: Json | null
          notes?: string | null
          org_id?: string
          photos?: string[] | null
          recorded_by?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plant_health_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_health_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_health_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "plant_health_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_health_logs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "lookup_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_health_logs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "nursery_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_health_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plant_sizes: {
        Row: {
          area: number | null
          cell_diameter_mm: number | null
          cell_length_mm: number | null
          cell_multiple: number
          cell_shape: string | null
          cell_volume_l: number | null
          cell_width_mm: number | null
          container_type: Database["public"]["Enums"]["size_container_type"]
          created_at: string
          id: string
          name: string
          shelf_quantity: number | null
          updated_at: string
        }
        Insert: {
          area?: number | null
          cell_diameter_mm?: number | null
          cell_length_mm?: number | null
          cell_multiple?: number
          cell_shape?: string | null
          cell_volume_l?: number | null
          cell_width_mm?: number | null
          container_type?: Database["public"]["Enums"]["size_container_type"]
          created_at?: string
          id?: string
          name: string
          shelf_quantity?: number | null
          updated_at?: string
        }
        Update: {
          area?: number | null
          cell_diameter_mm?: number | null
          cell_length_mm?: number | null
          cell_multiple?: number
          cell_shape?: string | null
          cell_volume_l?: number | null
          cell_width_mm?: number | null
          container_type?: Database["public"]["Enums"]["size_container_type"]
          created_at?: string
          id?: string
          name?: string
          shelf_quantity?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      plant_varieties: {
        Row: {
          category: string | null
          Category: Database["public"]["Enums"]["variety_category"] | null
          colour: string | null
          common_name: string | null
          created_at: string | null
          evergreen: boolean | null
          family: string | null
          flower_colour: string | null
          flowering_period: string | null
          genus: string | null
          id: string
          name: string
          org_id: string
          plant_breeders_rights: boolean | null
          rating: number | null
          species: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          Category?: Database["public"]["Enums"]["variety_category"] | null
          colour?: string | null
          common_name?: string | null
          created_at?: string | null
          evergreen?: boolean | null
          family?: string | null
          flower_colour?: string | null
          flowering_period?: string | null
          genus?: string | null
          id?: string
          name: string
          org_id: string
          plant_breeders_rights?: boolean | null
          rating?: number | null
          species?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          Category?: Database["public"]["Enums"]["variety_category"] | null
          colour?: string | null
          common_name?: string | null
          created_at?: string | null
          evergreen?: boolean | null
          family?: string | null
          flower_colour?: string | null
          flowering_period?: string | null
          genus?: string | null
          id?: string
          name?: string
          org_id?: string
          plant_breeders_rights?: boolean | null
          rating?: number | null
          species?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plant_varieties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_customers: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          org_id: string
          price_list_id: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          org_id: string
          price_list_id: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          org_id?: string
          price_list_id?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_list_customers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_vat_treatment"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "price_list_customers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_customers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_trolley_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "price_list_customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_customers_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_items: {
        Row: {
          created_at: string
          id: string
          price_list_id: string
          sku_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          price_list_id: string
          sku_id: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          price_list_id?: string
          sku_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_items_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          created_at: string
          currency: string
          id: string
          is_default: boolean
          name: string
          org_id: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          is_default?: boolean
          name: string
          org_id: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          is_default?: boolean
          name?: string
          org_id?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_lists_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      printers: {
        Row: {
          connection_type: string
          created_at: string | null
          dpi: number | null
          host: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          notes: string | null
          org_id: string
          port: number | null
          type: string
          updated_at: string | null
        }
        Insert: {
          connection_type?: string
          created_at?: string | null
          dpi?: number | null
          host?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          notes?: string | null
          org_id: string
          port?: number | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          connection_type?: string
          created_at?: string | null
          dpi?: number | null
          host?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          notes?: string | null
          org_id?: string
          port?: number | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "printers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_aliases: {
        Row: {
          alias_name: string
          created_at: string
          customer_barcode: string | null
          customer_id: string | null
          customer_sku_code: string | null
          id: string
          is_active: boolean
          notes: string | null
          org_id: string
          price_list_id: string | null
          product_id: string | null
          rrp: number | null
          unit_price_ex_vat: number | null
          updated_at: string
          variety_id: string | null
        }
        Insert: {
          alias_name: string
          created_at?: string
          customer_barcode?: string | null
          customer_id?: string | null
          customer_sku_code?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          org_id: string
          price_list_id?: string | null
          product_id?: string | null
          rrp?: number | null
          unit_price_ex_vat?: number | null
          updated_at?: string
          variety_id?: string | null
        }
        Update: {
          alias_name?: string
          created_at?: string
          customer_barcode?: string | null
          customer_id?: string | null
          customer_sku_code?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          org_id?: string
          price_list_id?: string | null
          product_id?: string | null
          rrp?: number | null
          unit_price_ex_vat?: number | null
          updated_at?: string
          variety_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_aliases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_vat_treatment"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "product_aliases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_aliases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_trolley_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "product_aliases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_aliases_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_aliases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_aliases_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "lookup_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_aliases_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "plant_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_aliases_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "plant_varieties_compat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_aliases_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "v_plant_varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      product_batches: {
        Row: {
          available_quantity_override: number | null
          batch_id: string
          created_at: string
          id: string
          org_id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          available_quantity_override?: number | null
          batch_id: string
          created_at?: string
          id?: string
          org_id: string
          product_id: string
          updated_at?: string
        }
        Update: {
          available_quantity_override?: number | null
          batch_id?: string
          created_at?: string
          id?: string
          org_id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "product_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_mapping_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          match_category: string | null
          match_family: string | null
          match_genus: string | null
          match_location_id: string | null
          match_size_id: string | null
          match_status_ids: string[] | null
          max_age_weeks: number | null
          min_age_weeks: number | null
          name: string
          org_id: string
          priority: number
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          match_category?: string | null
          match_family?: string | null
          match_genus?: string | null
          match_location_id?: string | null
          match_size_id?: string | null
          match_status_ids?: string[] | null
          max_age_weeks?: number | null
          min_age_weeks?: number | null
          name: string
          org_id: string
          priority?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          match_category?: string | null
          match_family?: string | null
          match_genus?: string | null
          match_location_id?: string | null
          match_size_id?: string | null
          match_status_ids?: string[] | null
          max_age_weeks?: number | null
          min_age_weeks?: number | null
          name?: string
          org_id?: string
          priority?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_mapping_rules_match_location_id_fkey"
            columns: ["match_location_id"]
            isOneToOne: false
            referencedRelation: "lookup_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_mapping_rules_match_location_id_fkey"
            columns: ["match_location_id"]
            isOneToOne: false
            referencedRelation: "nursery_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_mapping_rules_match_size_id_fkey"
            columns: ["match_size_id"]
            isOneToOne: false
            referencedRelation: "lookup_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_mapping_rules_match_size_id_fkey"
            columns: ["match_size_id"]
            isOneToOne: false
            referencedRelation: "plant_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_mapping_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_mapping_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prices: {
        Row: {
          created_at: string
          currency: string
          id: string
          min_qty: number
          org_id: string
          price_list_id: string
          product_id: string
          unit_price_ex_vat: number
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          min_qty?: number
          org_id: string
          price_list_id: string
          product_id: string
          unit_price_ex_vat: number
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          min_qty?: number
          org_id?: string
          price_list_id?: string
          product_id?: string
          unit_price_ex_vat?: number
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          default_status: string | null
          description: string | null
          hero_image_url: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          sku_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_status?: string | null
          description?: string | null
          hero_image_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          sku_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_status?: string | null
          description?: string | null
          hero_image_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          sku_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_org_id: string | null
          created_at: string | null
          customer_id: string | null
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          portal_role: string | null
          updated_at: string | null
        }
        Insert: {
          active_org_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          portal_role?: string | null
          updated_at?: string | null
        }
        Update: {
          active_org_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          portal_role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_org_id_fkey"
            columns: ["active_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_vat_treatment"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "profiles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_trolley_summary"
            referencedColumns: ["customer_id"]
          },
        ]
      }
      protocols: {
        Row: {
          created_at: string
          definition: Json
          description: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          route: Json
          target_size_id: string | null
          target_variety_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          definition?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          route?: Json
          target_size_id?: string | null
          target_variety_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          definition?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          route?: Json
          target_size_id?: string | null
          target_variety_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocols_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocols_target_size_id_fkey"
            columns: ["target_size_id"]
            isOneToOne: false
            referencedRelation: "lookup_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocols_target_size_id_fkey"
            columns: ["target_size_id"]
            isOneToOne: false
            referencedRelation: "plant_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocols_target_variety_id_fkey"
            columns: ["target_variety_id"]
            isOneToOne: false
            referencedRelation: "lookup_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocols_target_variety_id_fkey"
            columns: ["target_variety_id"]
            isOneToOne: false
            referencedRelation: "plant_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocols_target_variety_id_fkey"
            columns: ["target_variety_id"]
            isOneToOne: false
            referencedRelation: "plant_varieties_compat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocols_target_variety_id_fkey"
            columns: ["target_variety_id"]
            isOneToOne: false
            referencedRelation: "v_plant_varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_qc: {
        Row: {
          batch_id: string | null
          created_at: string | null
          id: string
          issue_type: string | null
          notes: string | null
          pick_order_id: string
          resolved: boolean | null
          updated_at: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string | null
          id?: string
          issue_type?: string | null
          notes?: string | null
          pick_order_id: string
          resolved?: boolean | null
          updated_at?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string | null
          id?: string
          issue_type?: string | null
          notes?: string | null
          pick_order_id?: string
          resolved?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_qc_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_qc_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_qc_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "sales_qc_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_qc_pick_order_id_fkey"
            columns: ["pick_order_id"]
            isOneToOne: false
            referencedRelation: "pick_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      skus: {
        Row: {
          barcode: string | null
          code: string
          created_at: string
          default_vat_rate: number
          description: string | null
          display_name: string
          id: string
          org_id: string
          plant_variety_id: string | null
          size_id: string | null
          sku_type: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          code: string
          created_at?: string
          default_vat_rate?: number
          description?: string | null
          display_name?: string
          id?: string
          org_id: string
          plant_variety_id?: string | null
          size_id?: string | null
          sku_type?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          code?: string
          created_at?: string
          default_vat_rate?: number
          description?: string | null
          display_name?: string
          id?: string
          org_id?: string
          plant_variety_id?: string | null
          size_id?: string | null
          sku_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skus_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skus_plant_variety_id_fkey"
            columns: ["plant_variety_id"]
            isOneToOne: false
            referencedRelation: "lookup_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skus_plant_variety_id_fkey"
            columns: ["plant_variety_id"]
            isOneToOne: false
            referencedRelation: "plant_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skus_plant_variety_id_fkey"
            columns: ["plant_variety_id"]
            isOneToOne: false
            referencedRelation: "plant_varieties_compat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skus_plant_variety_id_fkey"
            columns: ["plant_variety_id"]
            isOneToOne: false
            referencedRelation: "v_plant_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skus_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "lookup_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skus_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "plant_sizes"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          country_code: string
          created_at: string
          eircode: string | null
          email: string | null
          id: string
          name: string
          org_id: string
          phone: string | null
          producer_code: string | null
          supplier_type: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          country_code?: string
          created_at?: string
          eircode?: string | null
          email?: string | null
          id?: string
          name: string
          org_id: string
          phone?: string | null
          producer_code?: string | null
          supplier_type?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          country_code?: string
          created_at?: string
          eircode?: string | null
          email?: string | null
          id?: string
          name?: string
          org_id?: string
          phone?: string | null
          producer_code?: string | null
          supplier_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_employees: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          is_lead: boolean
          team_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          is_lead?: boolean
          team_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          is_lead?: boolean
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_employees_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "picking_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_employees_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_picking_team_workload"
            referencedColumns: ["team_id"]
          },
        ]
      }
      trolley_transactions: {
        Row: {
          created_at: string
          customer_id: string | null
          delivery_item_id: string | null
          delivery_run_id: string | null
          id: string
          notes: string | null
          org_id: string
          quantity: number
          recorded_by: string | null
          transaction_date: string
          transaction_type: string
          trolley_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          delivery_item_id?: string | null
          delivery_run_id?: string | null
          id?: string
          notes?: string | null
          org_id: string
          quantity?: number
          recorded_by?: string | null
          transaction_date?: string
          transaction_type: string
          trolley_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          delivery_item_id?: string | null
          delivery_run_id?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          quantity?: number
          recorded_by?: string | null
          transaction_date?: string
          transaction_type?: string
          trolley_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trolley_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_vat_treatment"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "trolley_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trolley_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_trolley_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "trolley_transactions_delivery_item_id_fkey"
            columns: ["delivery_item_id"]
            isOneToOne: false
            referencedRelation: "delivery_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trolley_transactions_delivery_run_id_fkey"
            columns: ["delivery_run_id"]
            isOneToOne: false
            referencedRelation: "delivery_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trolley_transactions_delivery_run_id_fkey"
            columns: ["delivery_run_id"]
            isOneToOne: false
            referencedRelation: "v_active_delivery_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trolley_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trolley_transactions_trolley_id_fkey"
            columns: ["trolley_id"]
            isOneToOne: false
            referencedRelation: "trolleys"
            referencedColumns: ["id"]
          },
        ]
      }
      trolleys: {
        Row: {
          condition_notes: string | null
          created_at: string
          current_location: string | null
          customer_id: string | null
          delivery_run_id: string | null
          id: string
          last_inspection_date: string | null
          org_id: string
          status: Database["public"]["Enums"]["trolley_status"]
          trolley_number: string
          trolley_type: string | null
          updated_at: string
        }
        Insert: {
          condition_notes?: string | null
          created_at?: string
          current_location?: string | null
          customer_id?: string | null
          delivery_run_id?: string | null
          id?: string
          last_inspection_date?: string | null
          org_id: string
          status?: Database["public"]["Enums"]["trolley_status"]
          trolley_number: string
          trolley_type?: string | null
          updated_at?: string
        }
        Update: {
          condition_notes?: string | null
          created_at?: string
          current_location?: string | null
          customer_id?: string | null
          delivery_run_id?: string | null
          id?: string
          last_inspection_date?: string | null
          org_id?: string
          status?: Database["public"]["Enums"]["trolley_status"]
          trolley_number?: string
          trolley_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trolleys_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_vat_treatment"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "trolleys_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trolleys_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_trolley_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "trolleys_delivery_run_id_fkey"
            columns: ["delivery_run_id"]
            isOneToOne: false
            referencedRelation: "delivery_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trolleys_delivery_run_id_fkey"
            columns: ["delivery_run_id"]
            isOneToOne: false
            referencedRelation: "v_active_delivery_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trolleys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          org_id: string
          trolley_capacity: number | null
          type: Database["public"]["Enums"]["vehicle_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          org_id: string
          trolley_capacity?: number | null
          type?: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          trolley_capacity?: number | null
          type?: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      batch_logs_view: {
        Row: {
          actor_id: string | null
          batch_id: string | null
          created_at: string | null
          id: string | null
          note: string | null
          occurred_at: string | null
          org_id: string | null
          qty_change: number | null
          type: string | null
        }
        Insert: {
          actor_id?: string | null
          batch_id?: string | null
          created_at?: string | null
          id?: string | null
          note?: never
          occurred_at?: string | null
          org_id?: string | null
          qty_change?: never
          type?: string | null
        }
        Update: {
          actor_id?: string | null
          batch_id?: string | null
          created_at?: string | null
          id?: string | null
          note?: never
          occurred_at?: string | null
          org_id?: string | null
          qty_change?: never
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "batch_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_vat_treatment: {
        Row: {
          country_code: string | null
          currency: string | null
          customer_id: string | null
          customer_name: string | null
          vat_description: string | null
          vat_number: string | null
          vat_treatment: string | null
        }
        Insert: {
          country_code?: string | null
          currency?: string | null
          customer_id?: string | null
          customer_name?: string | null
          vat_description?: never
          vat_number?: string | null
          vat_treatment?: never
        }
        Update: {
          country_code?: string | null
          currency?: string | null
          customer_id?: string | null
          customer_name?: string | null
          vat_description?: never
          vat_number?: string | null
          vat_treatment?: never
        }
        Relationships: []
      }
      lookup_locations: {
        Row: {
          covered: boolean | null
          id: string | null
          name: string | null
          nursery_site: string | null
          org_id: string | null
        }
        Insert: {
          covered?: boolean | null
          id?: string | null
          name?: string | null
          nursery_site?: string | null
          org_id?: string | null
        }
        Update: {
          covered?: boolean | null
          id?: string | null
          name?: string | null
          nursery_site?: string | null
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nursery_locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lookup_sizes: {
        Row: {
          cell_multiple: number | null
          container_type:
            | Database["public"]["Enums"]["size_container_type"]
            | null
          id: string | null
          name: string | null
        }
        Insert: {
          cell_multiple?: number | null
          container_type?:
            | Database["public"]["Enums"]["size_container_type"]
            | null
          id?: string | null
          name?: string | null
        }
        Update: {
          cell_multiple?: number | null
          container_type?:
            | Database["public"]["Enums"]["size_container_type"]
            | null
          id?: string | null
          name?: string | null
        }
        Relationships: []
      }
      lookup_suppliers: {
        Row: {
          country_code: string | null
          id: string | null
          name: string | null
          org_id: string | null
          producer_code: string | null
        }
        Insert: {
          country_code?: string | null
          id?: string | null
          name?: string | null
          org_id?: string | null
          producer_code?: string | null
        }
        Update: {
          country_code?: string | null
          id?: string | null
          name?: string | null
          org_id?: string | null
          producer_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lookup_varieties: {
        Row: {
          category: string | null
          created_at: string | null
          family: string | null
          genus: string | null
          id: string | null
          name: string | null
          species: string | null
          updated_at: string | null
        }
        Insert: {
          category?: never
          created_at?: string | null
          family?: string | null
          genus?: string | null
          id?: string | null
          name?: string | null
          species?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: never
          created_at?: string | null
          family?: string | null
          genus?: string | null
          id?: string | null
          name?: string | null
          species?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      org_admin_check: {
        Row: {
          org_id: string | null
          role: Database["public"]["Enums"]["org_role"] | null
          user_id: string | null
        }
        Insert: {
          org_id?: string | null
          role?: Database["public"]["Enums"]["org_role"] | null
          user_id?: string | null
        }
        Update: {
          org_id?: string | null
          role?: Database["public"]["Enums"]["org_role"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_memberships_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plant_varieties_compat: {
        Row: {
          category: Database["public"]["Enums"]["variety_category"] | null
          colour: string | null
          created_at: string | null
          family: string | null
          genus: string | null
          id: string | null
          name: string | null
          rating: number | null
          species: string | null
          updated_at: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["variety_category"] | null
          colour?: string | null
          created_at?: string | null
          family?: string | null
          genus?: string | null
          id?: string | null
          name?: string | null
          rating?: number | null
          species?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["variety_category"] | null
          colour?: string | null
          created_at?: string | null
          family?: string | null
          genus?: string | null
          id?: string | null
          name?: string | null
          rating?: number | null
          species?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      v_active_delivery_runs: {
        Row: {
          completed_deliveries: number | null
          driver_name: string | null
          id: string | null
          org_id: string | null
          pending_deliveries: number | null
          run_date: string | null
          run_number: string | null
          status: Database["public"]["Enums"]["delivery_run_status"] | null
          total_deliveries: number | null
          trolleys_loaded: number | null
          trolleys_outstanding: number | null
          trolleys_returned: number | null
          vehicle_registration: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_available_batches: {
        Row: {
          archived_at: string | null
          batch_number: string | null
          created_at: string | null
          dispatched_at: string | null
          grower_photo_url: string | null
          growing_status: string | null
          id: string | null
          initial_quantity: number | null
          location_id: string | null
          location_name: string | null
          log_history: Json | null
          org_id: string | null
          parent_batch_id: string | null
          passport_override_a: string | null
          passport_override_b: string | null
          passport_override_c: string | null
          passport_override_d: string | null
          phase: string | null
          plant_variety_id: string | null
          planted_at: string | null
          protocol_id: string | null
          qr_code: string | null
          qr_image_url: string | null
          quantity: number | null
          quantity_produced: number | null
          ready_at: string | null
          reserved_quantity: number | null
          sales_photo_url: string | null
          sales_status: string | null
          size_id: string | null
          size_name: string | null
          status: string | null
          status_id: string | null
          supplier_batch_number: string | null
          supplier_id: string | null
          unit: string | null
          updated_at: string | null
          variety_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "lookup_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "nursery_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_parent_batch_id_fkey"
            columns: ["parent_batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_parent_batch_id_fkey"
            columns: ["parent_batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_parent_batch_id_fkey"
            columns: ["parent_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "batches_parent_batch_id_fkey"
            columns: ["parent_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_plant_variety_id_fkey"
            columns: ["plant_variety_id"]
            isOneToOne: false
            referencedRelation: "lookup_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_plant_variety_id_fkey"
            columns: ["plant_variety_id"]
            isOneToOne: false
            referencedRelation: "plant_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_plant_variety_id_fkey"
            columns: ["plant_variety_id"]
            isOneToOne: false
            referencedRelation: "plant_varieties_compat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_plant_variety_id_fkey"
            columns: ["plant_variety_id"]
            isOneToOne: false
            referencedRelation: "v_plant_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "lookup_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "plant_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "attribute_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "lookup_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_batch_passport: {
        Row: {
          batch_id: string | null
          passport_a: string | null
          passport_b: string | null
          passport_c: string | null
          passport_d: string | null
        }
        Relationships: []
      }
      v_batch_search: {
        Row: {
          batch_number: string | null
          category: Database["public"]["Enums"]["variety_category"] | null
          created_at: string | null
          family: string | null
          id: string | null
          initial_quantity: number | null
          location_id: string | null
          location_name: string | null
          org_id: string | null
          parent_batch_id: string | null
          phase: string | null
          plant_variety_id: string | null
          planted_at: string | null
          quantity: number | null
          ready_at: string | null
          reserved_quantity: number | null
          size_id: string | null
          size_name: string | null
          status: string | null
          supplier_id: string | null
          supplier_name: string | null
          updated_at: string | null
          variety_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "lookup_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "nursery_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_parent_batch_id_fkey"
            columns: ["parent_batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_parent_batch_id_fkey"
            columns: ["parent_batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_parent_batch_id_fkey"
            columns: ["parent_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "batches_parent_batch_id_fkey"
            columns: ["parent_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_plant_variety_id_fkey"
            columns: ["plant_variety_id"]
            isOneToOne: false
            referencedRelation: "lookup_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_plant_variety_id_fkey"
            columns: ["plant_variety_id"]
            isOneToOne: false
            referencedRelation: "plant_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_plant_variety_id_fkey"
            columns: ["plant_variety_id"]
            isOneToOne: false
            referencedRelation: "plant_varieties_compat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_plant_variety_id_fkey"
            columns: ["plant_variety_id"]
            isOneToOne: false
            referencedRelation: "v_plant_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "lookup_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "plant_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "lookup_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_credit_note_summary: {
        Row: {
          credit_number: string | null
          customer_name: string | null
          id: string | null
          issue_date: string | null
          org_id: string | null
          status: Database["public"]["Enums"]["credit_status"] | null
          subtotal_ex_vat: number | null
          total_inc_vat: number | null
          vat_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_customer_trolley_summary: {
        Row: {
          customer_id: string | null
          customer_name: string | null
          days_outstanding: number | null
          last_delivery_date: string | null
          last_return_date: string | null
          org_id: string | null
          trolleys_outstanding: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_delivery_manifest: {
        Row: {
          cost_estimate: number | null
          customer_name: string | null
          delivery_id: string | null
          delivery_status: Database["public"]["Enums"]["delivery_status"] | null
          method: string | null
          order_number: string | null
          scheduled_date: string | null
          trolley_count: number | null
          vehicle_name: string | null
        }
        Relationships: []
      }
      v_delivery_note_header: {
        Row: {
          customer_name: string | null
          delivery_id: string | null
          delivery_status: Database["public"]["Enums"]["delivery_status"] | null
          method: string | null
          order_id: string | null
          order_number: string | null
          org_id: string | null
          scheduled_date: string | null
          ship_city: string | null
          ship_country: string | null
          ship_county: string | null
          ship_eircode: string | null
          ship_label: string | null
          ship_line1: string | null
          ship_line2: string | null
          trolley_count: number | null
          vehicle_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_delivery_note_lines: {
        Row: {
          container_type:
            | Database["public"]["Enums"]["size_container_type"]
            | null
          delivery_id: string | null
          description: string | null
          order_item_id: string | null
          quantity: number | null
          size_name: string | null
          sku_code: string | null
          variety_name: string | null
        }
        Relationships: []
      }
      v_invoice_summary: {
        Row: {
          amount_credited: number | null
          balance_due: number | null
          customer_name: string | null
          due_date: string | null
          id: string | null
          invoice_number: string | null
          issue_date: string | null
          org_id: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          subtotal_ex_vat: number | null
          total_inc_vat: number | null
          vat_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_order_picklist: {
        Row: {
          batch_id: string | null
          batch_number: string | null
          container_type:
            | Database["public"]["Enums"]["size_container_type"]
            | null
          location_name: string | null
          order_id: string | null
          order_item_id: string | null
          quantity: number | null
          size_name: string | null
          sku_code: string | null
          variety_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_allocations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_allocations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_allocations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "batch_allocations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_header"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_ready_for_dispatch"
            referencedColumns: ["id"]
          },
        ]
      }
      v_order_summary: {
        Row: {
          customer_name: string | null
          id: string | null
          order_number: string | null
          org_id: string | null
          requested_delivery_date: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          subtotal_ex_vat: number | null
          total_inc_vat: number | null
          vat_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_orders_ready_for_dispatch: {
        Row: {
          customer_id: string | null
          customer_name: string | null
          delivery_status: string | null
          id: string | null
          order_number: string | null
          org_id: string | null
          packing_status: Database["public"]["Enums"]["packing_status"] | null
          requested_delivery_date: string | null
          total_inc_vat: number | null
          trolleys_used: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_vat_treatment"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_trolley_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pick_lists_detail: {
        Row: {
          assigned_team_id: string | null
          completed_at: string | null
          created_at: string | null
          customer_name: string | null
          id: string | null
          notes: string | null
          order_id: string | null
          order_number: string | null
          order_status: Database["public"]["Enums"]["order_status"] | null
          org_id: string | null
          picked_items: number | null
          picked_qty: number | null
          requested_delivery_date: string | null
          sequence: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["pick_list_status"] | null
          team_name: string | null
          total_items: number | null
          total_qty: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pick_lists_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_delivery_note_header"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "pick_lists_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_orders_ready_for_dispatch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_team_id_fkey"
            columns: ["assigned_team_id"]
            isOneToOne: false
            referencedRelation: "picking_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_team_id_fkey"
            columns: ["assigned_team_id"]
            isOneToOne: false
            referencedRelation: "v_picking_team_workload"
            referencedColumns: ["team_id"]
          },
        ]
      }
      v_picker_feedback: {
        Row: {
          batch_id: string | null
          created_at: string | null
          id: string | null
          message: string | null
          order_id: string | null
          order_item_id: string | null
          order_number: string | null
          org_id: string | null
          photo_urls: Json | null
          resolution_status:
            | Database["public"]["Enums"]["resolution_status"]
            | null
          severity: Database["public"]["Enums"]["feedback_severity"] | null
          type: Database["public"]["Enums"]["feedback_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "picking_feedback_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_feedback_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_feedback_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "picking_feedback_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_header"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "picking_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_ready_for_dispatch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_feedback_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_feedback_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_lines"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "picking_feedback_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "v_order_picklist"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "picking_feedback_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_picking_team_workload: {
        Row: {
          completed_today: number | null
          in_progress_picks: number | null
          member_count: number | null
          org_id: string | null
          pending_picks: number | null
          team_id: string | null
          team_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "picking_teams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_plant_varieties: {
        Row: {
          category: Database["public"]["Enums"]["variety_category"] | null
          colour: string | null
          created_at: string | null
          family: string | null
          genus: string | null
          id: string | null
          name: string | null
          rating: number | null
          species: string | null
          updated_at: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["variety_category"] | null
          colour?: string | null
          created_at?: string | null
          family?: string | null
          genus?: string | null
          id?: string | null
          name?: string | null
          rating?: number | null
          species?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["variety_category"] | null
          colour?: string | null
          created_at?: string | null
          family?: string | null
          genus?: string | null
          id?: string | null
          name?: string | null
          rating?: number | null
          species?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      v_substitution_requests: {
        Row: {
          applied_at: string | null
          created_at: string | null
          decided_at: string | null
          id: string | null
          order_id: string | null
          order_item_id: string | null
          order_number: string | null
          org_id: string | null
          proposed_sku_id: string | null
          reason_text: string | null
          requested_by: string | null
          requested_qty: number | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["substitution_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "order_item_substitutions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_substitutions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_header"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_item_substitutions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_substitutions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_ready_for_dispatch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_substitutions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_substitutions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_lines"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "order_item_substitutions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "v_order_picklist"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "order_item_substitutions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_substitutions_proposed_sku_id_fkey"
            columns: ["proposed_sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_order_item_substitution: {
        Args: { _sub_id: string }
        Returns: undefined
      }
      bootstrap_org_owner: { Args: { _org: string }; Returns: undefined }
      compute_quantity_produced: {
        Args: {
          _cell_multiple: number
          _container: Database["public"]["Enums"]["size_container_type"]
          _initial: number
        }
        Returns: number
      }
      create_order_with_allocations: {
        Args: {
          p_customer_id: string
          p_lines: Json
          p_notes?: string
          p_order_number: string
          p_org_id: string
          p_requested_delivery_date?: string
        }
        Returns: Json
      }
      current_org_id: { Args: never; Returns: string }
      current_org_ids: { Args: never; Returns: string[] }
      current_user_id: { Args: never; Returns: string }
      decrement_batch_quantity: {
        Args: { p_batch_id: string; p_org_id: string; p_units: number }
        Returns: number
      }
      fn_checkin_batch: {
        Args: {
          p_containers: number
          p_incoming_date: string
          p_location_id: string
          p_org_id: string
          p_passport_overrides: Json
          p_phase: Database["public"]["Enums"]["production_phase"]
          p_photos: Json
          p_quality: Json
          p_size_id: string
          p_supplier_batch_number: string
          p_supplier_id: string
          p_variety_id: string
        }
        Returns: {
          batch_id: string
          batch_number: string
        }[]
      }
      fn_format_batch_number: {
        Args: {
          p_org_id: string
          p_phase: Database["public"]["Enums"]["production_phase"]
          p_ref_date: string
        }
        Returns: string
      }
      fn_next_org_counter: {
        Args: { p_key: string; p_org_id: string }
        Returns: number
      }
      generate_credit_number: {
        Args: { _issue_date: string; _org_id: string }
        Returns: string
      }
      generate_invoice_number: {
        Args: { _issue_date: string; _org_id: string }
        Returns: string
      }
      increment_counter: {
        Args: { p_key: string; p_org_id: string }
        Returns: number
      }
      increment_org_counter: {
        Args: { p_key: string; p_org_id: string }
        Returns: number
      }
      is_member_of: { Args: { _org: string }; Returns: boolean }
      next_counter: { Args: { _key: string; _org_id: string }; Returns: number }
      next_sku_code: { Args: never; Returns: number }
      perform_transplant: {
        Args: {
          p_archive_parent_if_empty?: boolean
          p_containers: number
          p_location_id: string
          p_notes?: string
          p_org_id: string
          p_parent_batch_id: string
          p_planted_at?: string
          p_size_id: string
          p_user_id: string
        }
        Returns: Json
      }
      recalc_invoice_totals: {
        Args: { _invoice_id: string }
        Returns: undefined
      }
      recalc_order_totals: { Args: { _order_id: string }; Returns: undefined }
      refresh_log_history_for_batch: {
        Args: { _batch_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      switch_active_org: { Args: { _org: string }; Returns: undefined }
      user_in_org: { Args: { target_org_id: string }; Returns: boolean }
    }
    Enums: {
      allocation_status:
        | "allocated"
        | "picked"
        | "short"
        | "damaged"
        | "replaced"
      credit_status: "draft" | "issued" | "void"
      delivery_item_status:
        | "pending"
        | "loading"
        | "in_transit"
        | "delivered"
        | "failed"
        | "rescheduled"
      delivery_run_status:
        | "planned"
        | "loading"
        | "in_transit"
        | "completed"
        | "cancelled"
      delivery_status:
        | "unscheduled"
        | "scheduled"
        | "in_transit"
        | "delivered"
        | "cancelled"
      feedback_severity: "info" | "warning" | "critical"
      feedback_type: "quality" | "shortage" | "pest" | "damage" | "other"
      health_event_type:
        | "scout_flag"
        | "treatment"
        | "measurement"
        | "clearance"
      invoice_status: "draft" | "issued" | "void"
      order_status:
        | "draft"
        | "confirmed"
        | "picking"
        | "packed"
        | "dispatched"
        | "delivered"
        | "cancelled"
      org_role:
        | "owner"
        | "admin"
        | "editor"
        | "viewer"
        | "staff"
        | "grower"
        | "sales"
      packing_status: "not_started" | "in_progress" | "completed" | "verified"
      pick_item_status:
        | "pending"
        | "picked"
        | "short"
        | "substituted"
        | "skipped"
      pick_list_status: "pending" | "in_progress" | "completed" | "cancelled"
      production_phase:
        | "propagation"
        | "plug"
        | "potting"
        | "plug_linear"
        | "potted"
      production_status:
        | "Growing"
        | "Ready"
        | "Available"
        | "Looking Good"
        | "Archived"
        | "Incoming"
        | "Planned"
      resolution_status: "open" | "approved" | "rejected" | "resolved"
      size_container_type: "prop_tray" | "plug_tray" | "pot"
      substitution_status:
        | "requested"
        | "approved"
        | "rejected"
        | "applied"
        | "cancelled"
      trolley_status:
        | "available"
        | "loaded"
        | "at_customer"
        | "returned"
        | "damaged"
        | "lost"
      variety_category:
        | "Perennial"
        | "Heather"
        | "Annual"
        | "Shrub"
        | "Hedge"
        | "Tree"
        | "Biennial"
      vehicle_type: "van" | "truck" | "trailer" | "other" | "haulier"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      allocation_status: [
        "allocated",
        "picked",
        "short",
        "damaged",
        "replaced",
      ],
      credit_status: ["draft", "issued", "void"],
      delivery_item_status: [
        "pending",
        "loading",
        "in_transit",
        "delivered",
        "failed",
        "rescheduled",
      ],
      delivery_run_status: [
        "planned",
        "loading",
        "in_transit",
        "completed",
        "cancelled",
      ],
      delivery_status: [
        "unscheduled",
        "scheduled",
        "in_transit",
        "delivered",
        "cancelled",
      ],
      feedback_severity: ["info", "warning", "critical"],
      feedback_type: ["quality", "shortage", "pest", "damage", "other"],
      health_event_type: [
        "scout_flag",
        "treatment",
        "measurement",
        "clearance",
      ],
      invoice_status: ["draft", "issued", "void"],
      order_status: [
        "draft",
        "confirmed",
        "picking",
        "packed",
        "dispatched",
        "delivered",
        "cancelled",
      ],
      org_role: [
        "owner",
        "admin",
        "editor",
        "viewer",
        "staff",
        "grower",
        "sales",
      ],
      packing_status: ["not_started", "in_progress", "completed", "verified"],
      pick_item_status: [
        "pending",
        "picked",
        "short",
        "substituted",
        "skipped",
      ],
      pick_list_status: ["pending", "in_progress", "completed", "cancelled"],
      production_phase: [
        "propagation",
        "plug",
        "potting",
        "plug_linear",
        "potted",
      ],
      production_status: [
        "Growing",
        "Ready",
        "Available",
        "Looking Good",
        "Archived",
        "Incoming",
        "Planned",
      ],
      resolution_status: ["open", "approved", "rejected", "resolved"],
      size_container_type: ["prop_tray", "plug_tray", "pot"],
      substitution_status: [
        "requested",
        "approved",
        "rejected",
        "applied",
        "cancelled",
      ],
      trolley_status: [
        "available",
        "loaded",
        "at_customer",
        "returned",
        "damaged",
        "lost",
      ],
      variety_category: [
        "Perennial",
        "Heather",
        "Annual",
        "Shrub",
        "Hedge",
        "Tree",
        "Biennial",
      ],
      vehicle_type: ["van", "truck", "trailer", "other", "haulier"],
    },
  },
} as const
