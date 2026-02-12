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
      allocation_ledger: {
        Row: {
          allocated_at: string | null
          allocation_status: Database["public"]["Enums"]["allocation_status_v2"]
          allocation_tier: Database["public"]["Enums"]["allocation_tier"]
          batch_id: string | null
          cancelled_at: string | null
          created_at: string
          id: string
          order_item_id: string
          org_id: string
          picked_at: string | null
          picked_quantity: number
          priority_rank: number | null
          product_id: string
          quantity: number
          reserved_at: string
          shipped_at: string | null
          updated_at: string
        }
        Insert: {
          allocated_at?: string | null
          allocation_status?: Database["public"]["Enums"]["allocation_status_v2"]
          allocation_tier?: Database["public"]["Enums"]["allocation_tier"]
          batch_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          id?: string
          order_item_id: string
          org_id: string
          picked_at?: string | null
          picked_quantity?: number
          priority_rank?: number | null
          product_id: string
          quantity: number
          reserved_at?: string
          shipped_at?: string | null
          updated_at?: string
        }
        Update: {
          allocated_at?: string | null
          allocation_status?: Database["public"]["Enums"]["allocation_status_v2"]
          allocation_tier?: Database["public"]["Enums"]["allocation_tier"]
          batch_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          id?: string
          order_item_id?: string
          org_id?: string
          picked_at?: string | null
          picked_quantity?: number
          priority_rank?: number | null
          product_id?: string
          quantity?: number
          reserved_at?: string
          shipped_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocation_ledger_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_ledger_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_ledger_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "allocation_ledger_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_ledger_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_inventory"
            referencedColumns: ["product_id"]
          },
        ]
      }
      attribute_options: {
        Row: {
          attribute_key: string
          behavior: string | null
          category: string | null
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
          category?: string | null
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
          category?: string | null
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
      balance_transfer_log: {
        Row: {
          action: string
          from_haulier_id: string
          from_haulier_name: string
          id: string
          org_id: string
          performed_at: string
          performed_by: string
          reason: string | null
          shelves: number
          to_customer_id: string
          to_customer_name: string
          transfer_request_id: string
          trolleys: number
        }
        Insert: {
          action: string
          from_haulier_id: string
          from_haulier_name: string
          id?: string
          org_id: string
          performed_at?: string
          performed_by: string
          reason?: string | null
          shelves: number
          to_customer_id: string
          to_customer_name: string
          transfer_request_id: string
          trolleys: number
        }
        Update: {
          action?: string
          from_haulier_id?: string
          from_haulier_name?: string
          id?: string
          org_id?: string
          performed_at?: string
          performed_by?: string
          reason?: string | null
          shelves?: number
          to_customer_id?: string
          to_customer_name?: string
          transfer_request_id?: string
          trolleys?: number
        }
        Relationships: [
          {
            foreignKeyName: "balance_transfer_log_org_fkey"
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
      batch_images: {
        Row: {
          batch_id: string
          caption: string | null
          created_at: string
          id: string
          image_url: string
          is_hero: boolean
          org_id: string
          photo_type: string
          promoted_to_product_id: string | null
          status_at_capture: string | null
          taken_at: string
          taken_by: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          batch_id: string
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
          is_hero?: boolean
          org_id: string
          photo_type?: string
          promoted_to_product_id?: string | null
          status_at_capture?: string | null
          taken_at?: string
          taken_by?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          batch_id?: string
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
          is_hero?: boolean
          org_id?: string
          photo_type?: string
          promoted_to_product_id?: string | null
          status_at_capture?: string | null
          taken_at?: string
          taken_by?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_images_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_images_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_images_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "batch_images_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_images_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_images_promoted_to_product_id_fkey"
            columns: ["promoted_to_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_images_promoted_to_product_id_fkey"
            columns: ["promoted_to_product_id"]
            isOneToOne: false
            referencedRelation: "v_product_inventory"
            referencedColumns: ["product_id"]
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
      batch_plans: {
        Row: {
          created_at: string
          guide_plan_id: string | null
          id: string
          notes: string | null
          org_id: string
          planned_quantity: number
          plant_variety_id: string
          protocol_id: string | null
          ready_from_week: number | null
          ready_from_year: number | null
          ready_to_week: number | null
          ready_to_year: number | null
          status: string
          target_size_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          guide_plan_id?: string | null
          id?: string
          notes?: string | null
          org_id: string
          planned_quantity: number
          plant_variety_id: string
          protocol_id?: string | null
          ready_from_week?: number | null
          ready_from_year?: number | null
          ready_to_week?: number | null
          ready_to_year?: number | null
          status?: string
          target_size_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          guide_plan_id?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          planned_quantity?: number
          plant_variety_id?: string
          protocol_id?: string | null
          ready_from_week?: number | null
          ready_from_year?: number | null
          ready_to_week?: number | null
          ready_to_year?: number | null
          status?: string
          target_size_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_plans_guide_plan_id_fkey"
            columns: ["guide_plan_id"]
            isOneToOne: false
            referencedRelation: "guide_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_plans_plant_variety_id_fkey"
            columns: ["plant_variety_id"]
            isOneToOne: false
            referencedRelation: "lookup_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_plans_plant_variety_id_fkey"
            columns: ["plant_variety_id"]
            isOneToOne: false
            referencedRelation: "plant_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_plans_plant_variety_id_fkey"
            columns: ["plant_variety_id"]
            isOneToOne: false
            referencedRelation: "plant_varieties_compat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_plans_plant_variety_id_fkey"
            columns: ["plant_variety_id"]
            isOneToOne: false
            referencedRelation: "v_plant_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_plans_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_plans_target_size_id_fkey"
            columns: ["target_size_id"]
            isOneToOne: false
            referencedRelation: "lookup_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_plans_target_size_id_fkey"
            columns: ["target_size_id"]
            isOneToOne: false
            referencedRelation: "plant_sizes"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          archived_at: string | null
          batch_number: string
          batch_plan_id: string | null
          created_at: string
          dispatched_at: string | null
          grower_photo_url: string | null
          growing_status: string | null
          hidden: boolean | null
          id: string
          initial_quantity: number | null
          location_id: string | null
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
          reserved_for_customer_id: string | null
          reserved_quantity: number
          saleable_quantity: number | null
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
          batch_plan_id?: string | null
          created_at?: string
          dispatched_at?: string | null
          grower_photo_url?: string | null
          growing_status?: string | null
          hidden?: boolean | null
          id?: string
          initial_quantity?: number | null
          location_id?: string | null
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
          reserved_for_customer_id?: string | null
          reserved_quantity?: number
          saleable_quantity?: number | null
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
          batch_plan_id?: string | null
          created_at?: string
          dispatched_at?: string | null
          grower_photo_url?: string | null
          growing_status?: string | null
          hidden?: boolean | null
          id?: string
          initial_quantity?: number | null
          location_id?: string | null
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
          reserved_for_customer_id?: string | null
          reserved_quantity?: number
          saleable_quantity?: number | null
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
            foreignKeyName: "batches_batch_plan_id_fkey"
            columns: ["batch_plan_id"]
            isOneToOne: false
            referencedRelation: "batch_plans"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "batches_reserved_for_customer_id_fkey"
            columns: ["reserved_for_customer_id"]
            isOneToOne: false
            referencedRelation: "customer_vat_treatment"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "batches_reserved_for_customer_id_fkey"
            columns: ["reserved_for_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_reserved_for_customer_id_fkey"
            columns: ["reserved_for_customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_trolley_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "batches_reserved_for_customer_id_fkey"
            columns: ["reserved_for_customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "batches_reserved_for_customer_id_fkey"
            columns: ["reserved_for_customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
            referencedColumns: ["customer_id"]
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
      bulk_pick_batch_orders: {
        Row: {
          bulk_batch_id: string
          created_at: string
          id: string
          order_id: string
          packed_at: string | null
          packed_by: string | null
          packing_status: string
          pick_list_id: string | null
        }
        Insert: {
          bulk_batch_id: string
          created_at?: string
          id?: string
          order_id: string
          packed_at?: string | null
          packed_by?: string | null
          packing_status?: string
          pick_list_id?: string | null
        }
        Update: {
          bulk_batch_id?: string
          created_at?: string
          id?: string
          order_id?: string
          packed_at?: string | null
          packed_by?: string | null
          packing_status?: string
          pick_list_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bulk_pick_batch_orders_bulk_batch_fkey"
            columns: ["bulk_batch_id"]
            isOneToOne: false
            referencedRelation: "bulk_pick_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_pick_batch_orders_order_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_pick_batch_orders_order_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_header"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "bulk_pick_batch_orders_order_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_pick_batch_orders_order_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_ready_for_dispatch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_pick_batch_orders_order_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "bulk_pick_batch_orders_pick_list_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "pick_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_pick_batch_orders_pick_list_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "v_pick_lists_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_pick_batch_orders_pick_list_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "v_picker_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_pick_batches: {
        Row: {
          batch_date: string
          batch_number: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          notes: string | null
          org_id: string
          started_at: string | null
          started_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          batch_date: string
          batch_number: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          org_id: string
          started_at?: string | null
          started_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          batch_date?: string
          batch_number?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string
          started_at?: string | null
          started_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_pick_batches_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_pick_batches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_pick_batches_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_pick_items: {
        Row: {
          assigned_to: string | null
          bulk_batch_id: string
          created_at: string
          id: string
          location_hint: string | null
          picked_batch_id: string | null
          picked_qty: number
          size_category_id: string | null
          sku_id: string
          status: string
          substitute_batch_id: string | null
          substitution_reason: string | null
          total_qty: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          bulk_batch_id: string
          created_at?: string
          id?: string
          location_hint?: string | null
          picked_batch_id?: string | null
          picked_qty?: number
          size_category_id?: string | null
          sku_id: string
          status?: string
          substitute_batch_id?: string | null
          substitution_reason?: string | null
          total_qty?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          bulk_batch_id?: string
          created_at?: string
          id?: string
          location_hint?: string | null
          picked_batch_id?: string | null
          picked_qty?: number
          size_category_id?: string | null
          sku_id?: string
          status?: string
          substitute_batch_id?: string | null
          substitution_reason?: string | null
          total_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_pick_items_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_pick_items_bulk_batch_fkey"
            columns: ["bulk_batch_id"]
            isOneToOne: false
            referencedRelation: "bulk_pick_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_pick_items_size_category_id_fkey"
            columns: ["size_category_id"]
            isOneToOne: false
            referencedRelation: "picking_size_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_pick_items_sku_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          checklist_type: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          items: Json
          name: string
          org_id: string
          process_type: string
          source_module: string
          updated_at: string
        }
        Insert: {
          checklist_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          items?: Json
          name: string
          org_id: string
          process_type: string
          source_module?: string
          updated_at?: string
        }
        Update: {
          checklist_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          items?: Json
          name?: string
          org_id?: string
          process_type?: string
          source_module?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
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
          preferences: Json
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
          preferences?: Json
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
          preferences?: Json
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
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
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
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
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
            foreignKeyName: "customer_favorite_products_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_favorite_products_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
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
          {
            foreignKeyName: "customer_favorite_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_inventory"
            referencedColumns: ["product_id"]
          },
        ]
      }
      customer_follow_ups: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string
          description: string | null
          due_date: string
          id: string
          org_id: string
          source_interaction_id: string | null
          status: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          description?: string | null
          due_date: string
          id?: string
          org_id: string
          source_interaction_id?: string | null
          status?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          description?: string | null
          due_date?: string
          id?: string
          org_id?: string
          source_interaction_id?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_follow_ups_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_vat_treatment"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_follow_ups_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_follow_ups_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_trolley_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_follow_ups_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_follow_ups_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_follow_ups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_follow_ups_source_interaction_id_fkey"
            columns: ["source_interaction_id"]
            isOneToOne: false
            referencedRelation: "customer_interactions"
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
            foreignKeyName: "customer_impersonation_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_impersonation_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
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
      customer_interactions: {
        Row: {
          created_at: string | null
          customer_id: string
          id: string
          notes: string | null
          org_id: string
          outcome: string | null
          type: Database["public"]["Enums"]["interaction_type"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          org_id: string
          outcome?: string | null
          type: Database["public"]["Enums"]["interaction_type"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          org_id?: string
          outcome?: string | null
          type?: Database["public"]["Enums"]["interaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_interactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_vat_treatment"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_interactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_interactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_trolley_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_interactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_interactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_interactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_interactions_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_milestones: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_id: string
          description: string | null
          event_date: string
          id: string
          milestone_type: string
          org_id: string
          recurring: boolean
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          description?: string | null
          event_date: string
          id?: string
          milestone_type: string
          org_id: string
          recurring?: boolean
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          description?: string | null
          event_date?: string
          id?: string
          milestone_type?: string
          org_id?: string
          recurring?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_milestones_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_vat_treatment"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_milestones_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_milestones_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_trolley_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_milestones_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_milestones_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_milestones_org_id_fkey"
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
          shelves_out: number
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
          shelves_out?: number
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
          shelves_out?: number
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
            foreignKeyName: "customer_trolley_balance_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_trolley_balance_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
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
          pre_pricing_cost_per_label: number | null
          pre_pricing_foc: boolean
          pricing_tier: string | null
          requires_pre_pricing: boolean
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
          pre_pricing_cost_per_label?: number | null
          pre_pricing_foc?: boolean
          pricing_tier?: string | null
          requires_pre_pricing?: boolean
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
          pre_pricing_cost_per_label?: number | null
          pre_pricing_foc?: boolean
          pricing_tier?: string | null
          requires_pre_pricing?: boolean
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
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["order_id"]
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
            foreignKeyName: "delivery_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["order_id"]
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
          color_code: string | null
          created_at: string
          created_by: string | null
          display_order: number | null
          driver_name: string | null
          estimated_return_time: string | null
          haulier_id: string | null
          id: string
          load_name: string | null
          org_id: string
          planned_departure_time: string | null
          route_notes: string | null
          run_date: string
          run_number: string
          shelves_loaded: number | null
          shelves_returned: number | null
          status: Database["public"]["Enums"]["delivery_run_status"]
          trolleys_loaded: number
          trolleys_returned: number
          updated_at: string
          vehicle_id: string | null
          vehicle_registration: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
          week_number: number | null
        }
        Insert: {
          actual_departure_time?: string | null
          actual_return_time?: string | null
          color_code?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number | null
          driver_name?: string | null
          estimated_return_time?: string | null
          haulier_id?: string | null
          id?: string
          load_name?: string | null
          org_id: string
          planned_departure_time?: string | null
          route_notes?: string | null
          run_date: string
          run_number: string
          shelves_loaded?: number | null
          shelves_returned?: number | null
          status?: Database["public"]["Enums"]["delivery_run_status"]
          trolleys_loaded?: number
          trolleys_returned?: number
          updated_at?: string
          vehicle_id?: string | null
          vehicle_registration?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          week_number?: number | null
        }
        Update: {
          actual_departure_time?: string | null
          actual_return_time?: string | null
          color_code?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number | null
          driver_name?: string | null
          estimated_return_time?: string | null
          haulier_id?: string | null
          id?: string
          load_name?: string | null
          org_id?: string
          planned_departure_time?: string | null
          route_notes?: string | null
          run_date?: string
          run_number?: string
          shelves_loaded?: number | null
          shelves_returned?: number | null
          status?: Database["public"]["Enums"]["delivery_run_status"]
          trolleys_loaded?: number
          trolleys_returned?: number
          updated_at?: string
          vehicle_id?: string | null
          vehicle_registration?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_runs_haulier_id_fkey"
            columns: ["haulier_id"]
            isOneToOne: false
            referencedRelation: "hauliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_runs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "haulier_vehicles"
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
          {
            foreignKeyName: "dispatch_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["order_id"]
          },
        ]
      }
      document_template_versions: {
        Row: {
          bindings: Json
          created_at: string
          created_by: string | null
          id: string
          layout: Json
          notes: string | null
          sample_data: Json | null
          template_id: string
          variables: Json
          version_number: number
        }
        Insert: {
          bindings?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          layout?: Json
          notes?: string | null
          sample_data?: Json | null
          template_id: string
          variables?: Json
          version_number: number
        }
        Update: {
          bindings?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          layout?: Json
          notes?: string | null
          sample_data?: Json | null
          template_id?: string
          variables?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          created_at: string
          current_version_id: string | null
          description: string | null
          document_type: string
          id: string
          name: string
          org_id: string
          published_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_version_id?: string | null
          description?: string | null
          document_type: string
          id?: string
          name: string
          org_id: string
          published_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_version_id?: string | null
          description?: string | null
          document_type?: string
          id?: string
          name?: string
          org_id?: string
          published_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "document_template_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      eircode_zones: {
        Row: {
          adjacent_keys: string[] | null
          county: string
          lat: number | null
          lng: number | null
          routing_key: string
          zone_name: string
        }
        Insert: {
          adjacent_keys?: string[] | null
          county: string
          lat?: number | null
          lng?: number | null
          routing_key: string
          zone_name: string
        }
        Update: {
          adjacent_keys?: string[] | null
          county?: string
          lat?: number | null
          lng?: number | null
          routing_key?: string
          zone_name?: string
        }
        Relationships: []
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
      equipment_movement_log: {
        Row: {
          created_at: string
          customer_id: string
          delivery_run_id: string | null
          id: string
          movement_date: string
          movement_type: string
          notes: string | null
          org_id: string
          recorded_by: string | null
          shelves: number
          signed_docket_url: string | null
          trolleys: number
        }
        Insert: {
          created_at?: string
          customer_id: string
          delivery_run_id?: string | null
          id?: string
          movement_date?: string
          movement_type: string
          notes?: string | null
          org_id: string
          recorded_by?: string | null
          shelves?: number
          signed_docket_url?: string | null
          trolleys?: number
        }
        Update: {
          created_at?: string
          customer_id?: string
          delivery_run_id?: string | null
          id?: string
          movement_date?: string
          movement_type?: string
          notes?: string | null
          org_id?: string
          recorded_by?: string | null
          shelves?: number
          signed_docket_url?: string | null
          trolleys?: number
        }
        Relationships: [
          {
            foreignKeyName: "equipment_movement_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_vat_treatment"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "equipment_movement_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_movement_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_trolley_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "equipment_movement_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "equipment_movement_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "equipment_movement_log_delivery_run_id_fkey"
            columns: ["delivery_run_id"]
            isOneToOne: false
            referencedRelation: "delivery_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_movement_log_delivery_run_id_fkey"
            columns: ["delivery_run_id"]
            isOneToOne: false
            referencedRelation: "v_active_delivery_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_movement_log_org_id_fkey"
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
      execution_groups: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          filter_criteria: Json
          icon: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          filter_criteria?: Json
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          filter_criteria?: Json
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_worksheet_batches: {
        Row: {
          added_at: string
          batch_id: string
          completed_at: string | null
          completed_by: string | null
          notes: string | null
          sort_order: number | null
          worksheet_id: string
        }
        Insert: {
          added_at?: string
          batch_id: string
          completed_at?: string | null
          completed_by?: string | null
          notes?: string | null
          sort_order?: number | null
          worksheet_id: string
        }
        Update: {
          added_at?: string
          batch_id?: string
          completed_at?: string | null
          completed_by?: string | null
          notes?: string | null
          sort_order?: number | null
          worksheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_worksheet_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_worksheet_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_worksheet_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "execution_worksheet_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_worksheet_batches_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_worksheet_batches_worksheet_id_fkey"
            columns: ["worksheet_id"]
            isOneToOne: false
            referencedRelation: "execution_worksheets"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_worksheets: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          org_id: string
          scheduled_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          org_id: string
          scheduled_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          scheduled_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_worksheets_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_worksheets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_worksheets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_plans: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string
          protocol_id: string | null
          ready_from_week: number
          ready_from_year: number
          ready_to_week: number
          ready_to_year: number
          status: string
          target_family: string
          target_quantity: number
          target_size_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id: string
          protocol_id?: string | null
          ready_from_week: number
          ready_from_year: number
          ready_to_week: number
          ready_to_year: number
          status?: string
          target_family: string
          target_quantity: number
          target_size_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          protocol_id?: string | null
          ready_from_week?: number
          ready_from_year?: number
          ready_to_week?: number
          ready_to_year?: number
          status?: string
          target_family?: string
          target_quantity?: number
          target_size_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_plans_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_plans_target_size_id_fkey"
            columns: ["target_size_id"]
            isOneToOne: false
            referencedRelation: "lookup_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_plans_target_size_id_fkey"
            columns: ["target_size_id"]
            isOneToOne: false
            referencedRelation: "plant_sizes"
            referencedColumns: ["id"]
          },
        ]
      }
      haulier_trolley_balance: {
        Row: {
          created_at: string
          haulier_id: string
          id: string
          last_load_date: string | null
          last_return_date: string | null
          org_id: string
          shelves_out: number
          trolleys_out: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          haulier_id: string
          id?: string
          last_load_date?: string | null
          last_return_date?: string | null
          org_id: string
          shelves_out?: number
          trolleys_out?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          haulier_id?: string
          id?: string
          last_load_date?: string | null
          last_return_date?: string | null
          org_id?: string
          shelves_out?: number
          trolleys_out?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "haulier_trolley_balance_haulier_fkey"
            columns: ["haulier_id"]
            isOneToOne: false
            referencedRelation: "hauliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "haulier_trolley_balance_org_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      haulier_vehicles: {
        Row: {
          created_at: string | null
          haulier_id: string
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          org_id: string
          registration: string | null
          trolley_capacity: number
          truck_layout: Json | null
          updated_at: string | null
          vehicle_type: string | null
        }
        Insert: {
          created_at?: string | null
          haulier_id: string
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          org_id: string
          registration?: string | null
          trolley_capacity?: number
          truck_layout?: Json | null
          updated_at?: string | null
          vehicle_type?: string | null
        }
        Update: {
          created_at?: string | null
          haulier_id?: string
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          org_id?: string
          registration?: string | null
          trolley_capacity?: number
          truck_layout?: Json | null
          updated_at?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "haulier_vehicles_haulier_id_fkey"
            columns: ["haulier_id"]
            isOneToOne: false
            referencedRelation: "hauliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "haulier_vehicles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hauliers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          is_internal: boolean
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          trolley_capacity: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_internal?: boolean
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          trolley_capacity?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_internal?: boolean
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          trolley_capacity?: number | null
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
      inventory_events: {
        Row: {
          actor_id: string | null
          allocation_id: string | null
          batch_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["inventory_event_type"]
          id: string
          metadata: Json
          occurred_at: string
          order_id: string | null
          order_item_id: string | null
          org_id: string
          product_id: string | null
          quantity_change: number
          running_batch_available: number | null
          running_product_ats: number | null
        }
        Insert: {
          actor_id?: string | null
          allocation_id?: string | null
          batch_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["inventory_event_type"]
          id?: string
          metadata?: Json
          occurred_at?: string
          order_id?: string | null
          order_item_id?: string | null
          org_id: string
          product_id?: string | null
          quantity_change: number
          running_batch_available?: number | null
          running_product_ats?: number | null
        }
        Update: {
          actor_id?: string | null
          allocation_id?: string | null
          batch_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["inventory_event_type"]
          id?: string
          metadata?: Json
          occurred_at?: string
          order_id?: string | null
          order_item_id?: string | null
          org_id?: string
          product_id?: string | null
          quantity_change?: number
          running_batch_available?: number | null
          running_product_ats?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_events_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "allocation_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_events_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "v_batch_allocations_compat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "inventory_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_header"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "inventory_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_ready_for_dispatch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "inventory_events_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_inventory"
            referencedColumns: ["product_id"]
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
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
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
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["order_id"]
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
      ipm_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          is_active: boolean | null
          org_id: string
          program_id: string
          starts_at: string | null
          target_family: string | null
          target_location_id: string | null
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          org_id: string
          program_id: string
          starts_at?: string | null
          target_family?: string | null
          target_location_id?: string | null
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          org_id?: string
          program_id?: string
          starts_at?: string | null
          target_family?: string | null
          target_location_id?: string | null
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ipm_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_assignments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "ipm_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_assignments_target_location_id_fkey"
            columns: ["target_location_id"]
            isOneToOne: false
            referencedRelation: "lookup_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_assignments_target_location_id_fkey"
            columns: ["target_location_id"]
            isOneToOne: false
            referencedRelation: "nursery_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      ipm_jobs: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          bottle_id: string | null
          calendar_week: number
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          group_key: string
          id: string
          name: string
          notes: string | null
          org_id: string
          priority: string | null
          quantity_used_ml: number | null
          scheduled_date: string
          scout_notes: string | null
          signed_by: string | null
          sprayer_used: string | null
          started_at: string | null
          status: string
          total_volume_ml: number | null
          updated_at: string | null
          weather_conditions: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          bottle_id?: string | null
          calendar_week: number
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          group_key: string
          id?: string
          name: string
          notes?: string | null
          org_id: string
          priority?: string | null
          quantity_used_ml?: number | null
          scheduled_date: string
          scout_notes?: string | null
          signed_by?: string | null
          sprayer_used?: string | null
          started_at?: string | null
          status?: string
          total_volume_ml?: number | null
          updated_at?: string | null
          weather_conditions?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          bottle_id?: string | null
          calendar_week?: number
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          group_key?: string
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          priority?: string | null
          quantity_used_ml?: number | null
          scheduled_date?: string
          scout_notes?: string | null
          signed_by?: string | null
          sprayer_used?: string | null
          started_at?: string | null
          status?: string
          total_volume_ml?: number | null
          updated_at?: string | null
          weather_conditions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ipm_jobs_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_jobs_bottle_id_fkey"
            columns: ["bottle_id"]
            isOneToOne: false
            referencedRelation: "ipm_product_bottles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_jobs_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ipm_product_bottles: {
        Row: {
          batch_number: string | null
          bottle_code: string
          created_at: string
          created_by: string | null
          emptied_at: string | null
          expiry_date: string | null
          id: string
          notes: string | null
          opened_at: string | null
          org_id: string
          product_id: string
          purchase_date: string | null
          remaining_ml: number
          status: string
          updated_at: string
          volume_ml: number
        }
        Insert: {
          batch_number?: string | null
          bottle_code: string
          created_at?: string
          created_by?: string | null
          emptied_at?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          opened_at?: string | null
          org_id: string
          product_id: string
          purchase_date?: string | null
          remaining_ml: number
          status?: string
          updated_at?: string
          volume_ml: number
        }
        Update: {
          batch_number?: string | null
          bottle_code?: string
          created_at?: string
          created_by?: string | null
          emptied_at?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          opened_at?: string | null
          org_id?: string
          product_id?: string
          purchase_date?: string | null
          remaining_ml?: number
          status?: string
          updated_at?: string
          volume_ml?: number
        }
        Relationships: [
          {
            foreignKeyName: "ipm_product_bottles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_product_bottles_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "ipm_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_product_bottles_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_ipm_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "ipm_product_bottles_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_upcoming_ipm_treatments"
            referencedColumns: ["product_id"]
          },
        ]
      }
      ipm_products: {
        Row: {
          active_ingredient: string | null
          application_methods: string[] | null
          created_at: string
          default_bottle_volume_ml: number | null
          harvest_interval_days: number | null
          id: string
          is_active: boolean | null
          low_stock_threshold: number | null
          max_rate: number | null
          name: string
          notes: string | null
          org_id: string
          pcs_number: string | null
          rei_hours: number | null
          suggested_rate: number | null
          suggested_rate_unit: string | null
          target_pests: string[] | null
          target_stock_bottles: number | null
          updated_at: string
          use_restriction: string | null
        }
        Insert: {
          active_ingredient?: string | null
          application_methods?: string[] | null
          created_at?: string
          default_bottle_volume_ml?: number | null
          harvest_interval_days?: number | null
          id?: string
          is_active?: boolean | null
          low_stock_threshold?: number | null
          max_rate?: number | null
          name: string
          notes?: string | null
          org_id: string
          pcs_number?: string | null
          rei_hours?: number | null
          suggested_rate?: number | null
          suggested_rate_unit?: string | null
          target_pests?: string[] | null
          target_stock_bottles?: number | null
          updated_at?: string
          use_restriction?: string | null
        }
        Update: {
          active_ingredient?: string | null
          application_methods?: string[] | null
          created_at?: string
          default_bottle_volume_ml?: number | null
          harvest_interval_days?: number | null
          id?: string
          is_active?: boolean | null
          low_stock_threshold?: number | null
          max_rate?: number | null
          name?: string
          notes?: string | null
          org_id?: string
          pcs_number?: string | null
          rei_hours?: number | null
          suggested_rate?: number | null
          suggested_rate_unit?: string | null
          target_pests?: string[] | null
          target_stock_bottles?: number | null
          updated_at?: string
          use_restriction?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ipm_products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ipm_program_steps: {
        Row: {
          created_at: string
          id: string
          method: string | null
          notes: string | null
          product_id: string
          program_id: string
          rate: number | null
          rate_unit: string | null
          step_order: number
          week_number: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          method?: string | null
          notes?: string | null
          product_id: string
          program_id: string
          rate?: number | null
          rate_unit?: string | null
          step_order?: number
          week_number?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          method?: string | null
          notes?: string | null
          product_id?: string
          program_id?: string
          rate?: number | null
          rate_unit?: string | null
          step_order?: number
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ipm_program_steps_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "ipm_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_program_steps_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_ipm_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "ipm_program_steps_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_upcoming_ipm_treatments"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "ipm_program_steps_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "ipm_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      ipm_programs: {
        Row: {
          created_at: string
          description: string | null
          duration_weeks: number
          id: string
          interval_days: number
          is_active: boolean | null
          name: string
          org_id: string
          schedule_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_weeks: number
          id?: string
          interval_days: number
          is_active?: boolean | null
          name: string
          org_id: string
          schedule_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_weeks?: number
          id?: string
          interval_days?: number
          is_active?: boolean | null
          name?: string
          org_id?: string
          schedule_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ipm_programs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ipm_remedial_application_steps: {
        Row: {
          application_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_date: string
          id: string
          notes: string | null
          plant_health_log_id: string | null
          step_id: string
        }
        Insert: {
          application_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_date: string
          id?: string
          notes?: string | null
          plant_health_log_id?: string | null
          step_id: string
        }
        Update: {
          application_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_date?: string
          id?: string
          notes?: string | null
          plant_health_log_id?: string | null
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ipm_remedial_application_steps_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "ipm_remedial_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_remedial_application_steps_plant_health_log_id_fkey"
            columns: ["plant_health_log_id"]
            isOneToOne: false
            referencedRelation: "plant_health_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_remedial_application_steps_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "ipm_remedial_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      ipm_remedial_applications: {
        Row: {
          created_at: string
          created_by: string | null
          expected_completion: string | null
          id: string
          notes: string | null
          org_id: string
          program_id: string
          started_at: string
          status: string
          steps_completed: number
          target_batch_id: string | null
          target_location_id: string | null
          target_type: string
          total_steps: number
          triggered_by_log_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_completion?: string | null
          id?: string
          notes?: string | null
          org_id: string
          program_id: string
          started_at?: string
          status?: string
          steps_completed?: number
          target_batch_id?: string | null
          target_location_id?: string | null
          target_type: string
          total_steps?: number
          triggered_by_log_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_completion?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          program_id?: string
          started_at?: string
          status?: string
          steps_completed?: number
          target_batch_id?: string | null
          target_location_id?: string | null
          target_type?: string
          total_steps?: number
          triggered_by_log_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ipm_remedial_applications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_remedial_applications_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "ipm_remedial_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_remedial_applications_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_programs_by_pest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_remedial_applications_target_batch_id_fkey"
            columns: ["target_batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_remedial_applications_target_batch_id_fkey"
            columns: ["target_batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_remedial_applications_target_batch_id_fkey"
            columns: ["target_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "ipm_remedial_applications_target_batch_id_fkey"
            columns: ["target_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_remedial_applications_target_location_id_fkey"
            columns: ["target_location_id"]
            isOneToOne: false
            referencedRelation: "lookup_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_remedial_applications_target_location_id_fkey"
            columns: ["target_location_id"]
            isOneToOne: false
            referencedRelation: "nursery_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_remedial_applications_triggered_by_log_id_fkey"
            columns: ["triggered_by_log_id"]
            isOneToOne: false
            referencedRelation: "plant_health_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      ipm_remedial_programs: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          severity_applicability: string[] | null
          target_pest_disease: string
          treatment_duration_days: number
          treatment_urgency: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          severity_applicability?: string[] | null
          target_pest_disease: string
          treatment_duration_days?: number
          treatment_urgency?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          severity_applicability?: string[] | null
          target_pest_disease?: string
          treatment_duration_days?: number
          treatment_urgency?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ipm_remedial_programs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ipm_remedial_steps: {
        Row: {
          created_at: string
          day_offset: number
          id: string
          method: string | null
          notes: string | null
          product_id: string
          program_id: string
          rate: number | null
          rate_unit: string | null
          step_order: number
        }
        Insert: {
          created_at?: string
          day_offset?: number
          id?: string
          method?: string | null
          notes?: string | null
          product_id: string
          program_id: string
          rate?: number | null
          rate_unit?: string | null
          step_order?: number
        }
        Update: {
          created_at?: string
          day_offset?: number
          id?: string
          method?: string | null
          notes?: string | null
          product_id?: string
          program_id?: string
          rate?: number | null
          rate_unit?: string | null
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "ipm_remedial_steps_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "ipm_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_remedial_steps_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_ipm_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "ipm_remedial_steps_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_upcoming_ipm_treatments"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "ipm_remedial_steps_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "ipm_remedial_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_remedial_steps_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_programs_by_pest"
            referencedColumns: ["id"]
          },
        ]
      }
      ipm_spot_treatments: {
        Row: {
          application_interval_days: number | null
          applications_completed: number
          applications_total: number
          created_at: string
          created_by: string | null
          fertilizer_name: string | null
          fertilizer_rate: number | null
          fertilizer_unit: string | null
          first_application_date: string
          id: string
          mechanical_action: string | null
          method: string | null
          next_application_date: string | null
          org_id: string
          product_id: string | null
          rate: number | null
          rate_unit: string | null
          reason: string | null
          status: string | null
          target_batch_id: string | null
          target_location_id: string | null
          target_type: string
          treatment_type: string | null
          triggered_by_log_id: string | null
          updated_at: string
        }
        Insert: {
          application_interval_days?: number | null
          applications_completed?: number
          applications_total?: number
          created_at?: string
          created_by?: string | null
          fertilizer_name?: string | null
          fertilizer_rate?: number | null
          fertilizer_unit?: string | null
          first_application_date: string
          id?: string
          mechanical_action?: string | null
          method?: string | null
          next_application_date?: string | null
          org_id: string
          product_id?: string | null
          rate?: number | null
          rate_unit?: string | null
          reason?: string | null
          status?: string | null
          target_batch_id?: string | null
          target_location_id?: string | null
          target_type: string
          treatment_type?: string | null
          triggered_by_log_id?: string | null
          updated_at?: string
        }
        Update: {
          application_interval_days?: number | null
          applications_completed?: number
          applications_total?: number
          created_at?: string
          created_by?: string | null
          fertilizer_name?: string | null
          fertilizer_rate?: number | null
          fertilizer_unit?: string | null
          first_application_date?: string
          id?: string
          mechanical_action?: string | null
          method?: string | null
          next_application_date?: string | null
          org_id?: string
          product_id?: string | null
          rate?: number | null
          rate_unit?: string | null
          reason?: string | null
          status?: string | null
          target_batch_id?: string | null
          target_location_id?: string | null
          target_type?: string
          treatment_type?: string | null
          triggered_by_log_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ipm_spot_treatments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_spot_treatments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "ipm_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_spot_treatments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_ipm_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "ipm_spot_treatments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_upcoming_ipm_treatments"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "ipm_spot_treatments_target_batch_id_fkey"
            columns: ["target_batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_spot_treatments_target_batch_id_fkey"
            columns: ["target_batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_spot_treatments_target_batch_id_fkey"
            columns: ["target_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "ipm_spot_treatments_target_batch_id_fkey"
            columns: ["target_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_spot_treatments_target_location_id_fkey"
            columns: ["target_location_id"]
            isOneToOne: false
            referencedRelation: "lookup_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_spot_treatments_target_location_id_fkey"
            columns: ["target_location_id"]
            isOneToOne: false
            referencedRelation: "nursery_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_spot_treatments_triggered_by_log_id_fkey"
            columns: ["triggered_by_log_id"]
            isOneToOne: false
            referencedRelation: "plant_health_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      ipm_stock_movements: {
        Row: {
          bottle_id: string
          health_log_id: string | null
          id: string
          location_id: string | null
          movement_type: string
          notes: string | null
          org_id: string
          product_id: string
          quantity_ml: number
          recorded_at: string
          recorded_by: string | null
          remaining_after_ml: number
          spot_treatment_id: string | null
        }
        Insert: {
          bottle_id: string
          health_log_id?: string | null
          id?: string
          location_id?: string | null
          movement_type: string
          notes?: string | null
          org_id: string
          product_id: string
          quantity_ml: number
          recorded_at?: string
          recorded_by?: string | null
          remaining_after_ml: number
          spot_treatment_id?: string | null
        }
        Update: {
          bottle_id?: string
          health_log_id?: string | null
          id?: string
          location_id?: string | null
          movement_type?: string
          notes?: string | null
          org_id?: string
          product_id?: string
          quantity_ml?: number
          recorded_at?: string
          recorded_by?: string | null
          remaining_after_ml?: number
          spot_treatment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ipm_stock_movements_bottle_id_fkey"
            columns: ["bottle_id"]
            isOneToOne: false
            referencedRelation: "ipm_product_bottles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_stock_movements_health_log_id_fkey"
            columns: ["health_log_id"]
            isOneToOne: false
            referencedRelation: "plant_health_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_stock_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "lookup_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_stock_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "nursery_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_stock_movements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "ipm_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_ipm_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "ipm_stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_upcoming_ipm_treatments"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "ipm_stock_movements_spot_treatment_id_fkey"
            columns: ["spot_treatment_id"]
            isOneToOne: false
            referencedRelation: "ipm_spot_treatments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_stock_movements_spot_treatment_id_fkey"
            columns: ["spot_treatment_id"]
            isOneToOne: false
            referencedRelation: "v_upcoming_ipm_treatments"
            referencedColumns: ["source_id"]
          },
        ]
      }
      ipm_tasks: {
        Row: {
          area_treated: string | null
          batch_id: string | null
          bottle_id: string | null
          calendar_week: number | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          crop_name: string | null
          fertiliser_composition: string | null
          group_key: string | null
          harvest_interval_days: number | null
          id: string
          is_tank_mix: boolean | null
          job_id: string | null
          location_id: string | null
          method: string | null
          notes: string | null
          org_id: string
          pcs_number: string | null
          product_id: string
          product_name: string
          program_id: string | null
          program_step_id: string | null
          quantity_used_ml: number | null
          rate: number | null
          rate_unit: string | null
          reason_for_use: string | null
          safe_harvest_date: string | null
          scheduled_date: string
          signed_by: string | null
          skip_reason: string | null
          spot_treatment_id: string | null
          sprayer_used: string | null
          status: string
          tank_mix_group_id: string | null
          updated_at: string
          weather_conditions: string | null
          week_number: number
        }
        Insert: {
          area_treated?: string | null
          batch_id?: string | null
          bottle_id?: string | null
          calendar_week?: number | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          crop_name?: string | null
          fertiliser_composition?: string | null
          group_key?: string | null
          harvest_interval_days?: number | null
          id?: string
          is_tank_mix?: boolean | null
          job_id?: string | null
          location_id?: string | null
          method?: string | null
          notes?: string | null
          org_id: string
          pcs_number?: string | null
          product_id: string
          product_name: string
          program_id?: string | null
          program_step_id?: string | null
          quantity_used_ml?: number | null
          rate?: number | null
          rate_unit?: string | null
          reason_for_use?: string | null
          safe_harvest_date?: string | null
          scheduled_date: string
          signed_by?: string | null
          skip_reason?: string | null
          spot_treatment_id?: string | null
          sprayer_used?: string | null
          status?: string
          tank_mix_group_id?: string | null
          updated_at?: string
          weather_conditions?: string | null
          week_number: number
        }
        Update: {
          area_treated?: string | null
          batch_id?: string | null
          bottle_id?: string | null
          calendar_week?: number | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          crop_name?: string | null
          fertiliser_composition?: string | null
          group_key?: string | null
          harvest_interval_days?: number | null
          id?: string
          is_tank_mix?: boolean | null
          job_id?: string | null
          location_id?: string | null
          method?: string | null
          notes?: string | null
          org_id?: string
          pcs_number?: string | null
          product_id?: string
          product_name?: string
          program_id?: string | null
          program_step_id?: string | null
          quantity_used_ml?: number | null
          rate?: number | null
          rate_unit?: string | null
          reason_for_use?: string | null
          safe_harvest_date?: string | null
          scheduled_date?: string
          signed_by?: string | null
          skip_reason?: string | null
          spot_treatment_id?: string | null
          sprayer_used?: string | null
          status?: string
          tank_mix_group_id?: string | null
          updated_at?: string
          weather_conditions?: string | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "ipm_tasks_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_tasks_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_tasks_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "ipm_tasks_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_tasks_bottle_id_fkey"
            columns: ["bottle_id"]
            isOneToOne: false
            referencedRelation: "ipm_product_bottles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_tasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ipm_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_tasks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "lookup_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_tasks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "nursery_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_tasks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "ipm_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_tasks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_ipm_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "ipm_tasks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_upcoming_ipm_treatments"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "ipm_tasks_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "ipm_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_tasks_program_step_id_fkey"
            columns: ["program_step_id"]
            isOneToOne: false
            referencedRelation: "ipm_program_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_tasks_spot_treatment_id_fkey"
            columns: ["spot_treatment_id"]
            isOneToOne: false
            referencedRelation: "ipm_spot_treatments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_tasks_spot_treatment_id_fkey"
            columns: ["spot_treatment_id"]
            isOneToOne: false
            referencedRelation: "v_upcoming_ipm_treatments"
            referencedColumns: ["source_id"]
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
      material_categories: {
        Row: {
          code: string
          consumption_type: string
          created_at: string
          id: string
          name: string
          parent_group: string
          sort_order: number
        }
        Insert: {
          code: string
          consumption_type?: string
          created_at?: string
          id?: string
          name: string
          parent_group: string
          sort_order?: number
        }
        Update: {
          code?: string
          consumption_type?: string
          created_at?: string
          id?: string
          name?: string
          parent_group?: string
          sort_order?: number
        }
        Relationships: []
      }
      material_consumption_rules: {
        Row: {
          created_at: string
          id: string
          material_id: string
          org_id: string
          quantity_per_unit: number
          size_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          org_id: string
          quantity_per_unit?: number
          size_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          org_id?: string
          quantity_per_unit?: number
          size_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_consumption_rules_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_consumption_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_consumption_rules_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "lookup_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_consumption_rules_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "plant_sizes"
            referencedColumns: ["id"]
          },
        ]
      }
      material_stock: {
        Row: {
          created_at: string
          id: string
          last_counted_at: string | null
          last_movement_at: string | null
          location_id: string | null
          material_id: string
          org_id: string
          quantity_available: number | null
          quantity_on_hand: number
          quantity_reserved: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_counted_at?: string | null
          last_movement_at?: string | null
          location_id?: string | null
          material_id: string
          org_id: string
          quantity_available?: number | null
          quantity_on_hand?: number
          quantity_reserved?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_counted_at?: string | null
          last_movement_at?: string | null
          location_id?: string | null
          material_id?: string
          org_id?: string
          quantity_available?: number | null
          quantity_on_hand?: number
          quantity_reserved?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_stock_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "lookup_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_stock_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "nursery_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_stock_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_stock_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      material_transactions: {
        Row: {
          batch_id: string | null
          cost_per_unit: number | null
          created_at: string
          created_by: string | null
          from_location_id: string | null
          id: string
          material_id: string
          notes: string | null
          org_id: string
          purchase_order_line_id: string | null
          quantity: number
          quantity_after: number | null
          reference: string | null
          to_location_id: string | null
          transaction_type: Database["public"]["Enums"]["material_transaction_type"]
          uom: string
        }
        Insert: {
          batch_id?: string | null
          cost_per_unit?: number | null
          created_at?: string
          created_by?: string | null
          from_location_id?: string | null
          id?: string
          material_id: string
          notes?: string | null
          org_id: string
          purchase_order_line_id?: string | null
          quantity: number
          quantity_after?: number | null
          reference?: string | null
          to_location_id?: string | null
          transaction_type: Database["public"]["Enums"]["material_transaction_type"]
          uom?: string
        }
        Update: {
          batch_id?: string | null
          cost_per_unit?: number | null
          created_at?: string
          created_by?: string | null
          from_location_id?: string | null
          id?: string
          material_id?: string
          notes?: string | null
          org_id?: string
          purchase_order_line_id?: string | null
          quantity?: number
          quantity_after?: number | null
          reference?: string | null
          to_location_id?: string | null
          transaction_type?: Database["public"]["Enums"]["material_transaction_type"]
          uom?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_transactions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_transactions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_transactions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "material_transactions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_transactions_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "lookup_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_transactions_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "nursery_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_transactions_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_transactions_purchase_order_line_id_fkey"
            columns: ["purchase_order_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_transactions_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "lookup_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_transactions_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "nursery_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          barcode: string | null
          base_uom: string
          category_id: string
          created_at: string
          default_supplier_id: string | null
          description: string | null
          id: string
          internal_barcode: string | null
          is_active: boolean
          linked_size_id: string | null
          name: string
          org_id: string
          part_number: string
          reorder_point: number | null
          reorder_quantity: number | null
          standard_cost: number | null
          target_stock: number | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          base_uom?: string
          category_id: string
          created_at?: string
          default_supplier_id?: string | null
          description?: string | null
          id?: string
          internal_barcode?: string | null
          is_active?: boolean
          linked_size_id?: string | null
          name: string
          org_id: string
          part_number: string
          reorder_point?: number | null
          reorder_quantity?: number | null
          standard_cost?: number | null
          target_stock?: number | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          base_uom?: string
          category_id?: string
          created_at?: string
          default_supplier_id?: string | null
          description?: string | null
          id?: string
          internal_barcode?: string | null
          is_active?: boolean
          linked_size_id?: string | null
          name?: string
          org_id?: string
          part_number?: string
          reorder_point?: number | null
          reorder_quantity?: number | null
          standard_cost?: number | null
          target_stock?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "material_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_default_supplier_id_fkey"
            columns: ["default_supplier_id"]
            isOneToOne: false
            referencedRelation: "lookup_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_default_supplier_id_fkey"
            columns: ["default_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_linked_size_id_fkey"
            columns: ["linked_size_id"]
            isOneToOne: false
            referencedRelation: "lookup_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_linked_size_id_fkey"
            columns: ["linked_size_id"]
            isOneToOne: false
            referencedRelation: "plant_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_org_id_fkey"
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
          health_status: string | null
          id: string
          is_virtual: boolean
          name: string
          nursery_site: string
          org_id: string
          restricted_until: string | null
          site_id: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          area?: number | null
          covered?: boolean
          created_at?: string
          health_status?: string | null
          id?: string
          is_virtual?: boolean
          name: string
          nursery_site: string
          org_id: string
          restricted_until?: string | null
          site_id?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          area?: number | null
          covered?: boolean
          created_at?: string
          health_status?: string | null
          id?: string
          is_virtual?: boolean
          name?: string
          nursery_site?: string
          org_id?: string
          restricted_until?: string | null
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
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["order_id"]
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
            foreignKeyName: "order_exceptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_exceptions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
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
      order_fees: {
        Row: {
          created_at: string | null
          description: string | null
          fee_type: string
          id: string
          name: string
          order_id: string
          org_fee_id: string | null
          quantity: number | null
          subtotal: number
          total_amount: number
          unit: string
          unit_amount: number
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          fee_type: string
          id?: string
          name: string
          order_id: string
          org_fee_id?: string | null
          quantity?: number | null
          subtotal: number
          total_amount: number
          unit?: string
          unit_amount: number
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          fee_type?: string
          id?: string
          name?: string
          order_id?: string
          org_fee_id?: string | null
          quantity?: number | null
          subtotal?: number
          total_amount?: number
          unit?: string
          unit_amount?: number
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_fees_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_fees_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_header"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_fees_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_fees_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_ready_for_dispatch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_fees_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_fees_org_fee_id_fkey"
            columns: ["org_fee_id"]
            isOneToOne: false
            referencedRelation: "org_fees"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_preferences: {
        Row: {
          created_at: string
          fulfilled_qty: number | null
          id: string
          notes: string | null
          order_item_id: string
          org_id: string
          product_id: string | null
          requested_qty: number
          updated_at: string
          variety_id: string | null
        }
        Insert: {
          created_at?: string
          fulfilled_qty?: number | null
          id?: string
          notes?: string | null
          order_item_id: string
          org_id: string
          product_id?: string | null
          requested_qty: number
          updated_at?: string
          variety_id?: string | null
        }
        Update: {
          created_at?: string
          fulfilled_qty?: number | null
          id?: string
          notes?: string | null
          order_item_id?: string
          org_id?: string
          product_id?: string | null
          requested_qty?: number
          updated_at?: string
          variety_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_item_preferences_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_preferences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_preferences_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_preferences_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_inventory"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_item_preferences_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "lookup_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_preferences_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "plant_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_preferences_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "plant_varieties_compat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_preferences_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "v_plant_varieties"
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
            foreignKeyName: "order_item_substitutions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_item_substitutions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
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
          product_group_id: string | null
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
          product_group_id?: string | null
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
          product_group_id?: string | null
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
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_product_group_id_fkey"
            columns: ["product_group_id"]
            isOneToOne: false
            referencedRelation: "product_groups"
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
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_inventory"
            referencedColumns: ["product_id"]
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
          qc_checklist: Json | null
          qc_notes: string | null
          shelves: number | null
          special_instructions: string | null
          status: Database["public"]["Enums"]["packing_status"]
          total_units: number | null
          trolley_numbers: string[] | null
          trolley_type: string | null
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
          qc_checklist?: Json | null
          qc_notes?: string | null
          shelves?: number | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["packing_status"]
          total_units?: number | null
          trolley_numbers?: string[] | null
          trolley_type?: string | null
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
          qc_checklist?: Json | null
          qc_notes?: string | null
          shelves?: number | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["packing_status"]
          total_units?: number | null
          trolley_numbers?: string[] | null
          trolley_type?: string | null
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
            foreignKeyName: "order_packing_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["order_id"]
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
            foreignKeyName: "order_status_updates_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["order_id"]
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
          confirmation_sent_at: string | null
          created_at: string
          created_by_staff_id: string | null
          created_by_user_id: string | null
          currency: string
          customer_id: string
          dispatch_email_sent_at: string | null
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
          confirmation_sent_at?: string | null
          created_at?: string
          created_by_staff_id?: string | null
          created_by_user_id?: string | null
          currency?: string
          customer_id: string
          dispatch_email_sent_at?: string | null
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
          confirmation_sent_at?: string | null
          created_at?: string
          created_by_staff_id?: string | null
          created_by_user_id?: string | null
          currency?: string
          customer_id?: string
          dispatch_email_sent_at?: string | null
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
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
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
          {
            foreignKeyName: "orders_ship_to_address_id_fkey"
            columns: ["ship_to_address_id"]
            isOneToOne: false
            referencedRelation: "v_store_order_metrics"
            referencedColumns: ["address_id"]
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
      org_fees: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          description: string | null
          fee_type: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          max_amount: number | null
          metadata: Json | null
          min_order_value: number | null
          name: string
          org_id: string
          unit: string
          updated_at: string | null
          vat_rate: number | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          description?: string | null
          fee_type: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          max_amount?: number | null
          metadata?: Json | null
          min_order_value?: number | null
          name: string
          org_id: string
          unit?: string
          updated_at?: string | null
          vat_rate?: number | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          description?: string | null
          fee_type?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          max_amount?: number | null
          metadata?: Json | null
          min_order_value?: number | null
          name?: string
          org_id?: string
          unit?: string
          updated_at?: string | null
          vat_rate?: number | null
        }
        Relationships: []
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
          bank_bic: string | null
          bank_iban: string | null
          bank_name: string | null
          company_reg_number: string | null
          country_code: string
          created_at: string
          default_payment_terms: number | null
          email: string | null
          id: string
          invoice_footer_text: string | null
          invoice_prefix: string | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          phone: string | null
          producer_code: string | null
          updated_at: string
          vat_number: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          bank_bic?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          company_reg_number?: string | null
          country_code?: string
          created_at?: string
          default_payment_terms?: number | null
          email?: string | null
          id?: string
          invoice_footer_text?: string | null
          invoice_prefix?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          phone?: string | null
          producer_code?: string | null
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          bank_bic?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          company_reg_number?: string | null
          country_code?: string
          created_at?: string
          default_payment_terms?: number | null
          email?: string | null
          id?: string
          invoice_footer_text?: string | null
          invoice_prefix?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          phone?: string | null
          producer_code?: string | null
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Relationships: []
      }
      pending_balance_transfers: {
        Row: {
          created_at: string
          delivery_item_id: string | null
          delivery_run_id: string | null
          driver_notes: string | null
          from_haulier_id: string
          id: string
          org_id: string
          photo_url: string | null
          reason: string
          requested_at: string
          requested_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          shelves: number
          signed_docket_url: string | null
          status: Database["public"]["Enums"]["transfer_status"]
          to_customer_id: string
          trolleys: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_item_id?: string | null
          delivery_run_id?: string | null
          driver_notes?: string | null
          from_haulier_id: string
          id?: string
          org_id: string
          photo_url?: string | null
          reason: string
          requested_at?: string
          requested_by: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shelves?: number
          signed_docket_url?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_customer_id: string
          trolleys?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_item_id?: string | null
          delivery_run_id?: string | null
          driver_notes?: string | null
          from_haulier_id?: string
          id?: string
          org_id?: string
          photo_url?: string | null
          reason?: string
          requested_at?: string
          requested_by?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shelves?: number
          signed_docket_url?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_customer_id?: string
          trolleys?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_balance_transfers_customer_fkey"
            columns: ["to_customer_id"]
            isOneToOne: false
            referencedRelation: "customer_vat_treatment"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "pending_balance_transfers_customer_fkey"
            columns: ["to_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_balance_transfers_customer_fkey"
            columns: ["to_customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_trolley_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "pending_balance_transfers_customer_fkey"
            columns: ["to_customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "pending_balance_transfers_customer_fkey"
            columns: ["to_customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "pending_balance_transfers_haulier_fkey"
            columns: ["from_haulier_id"]
            isOneToOne: false
            referencedRelation: "hauliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_balance_transfers_item_fkey"
            columns: ["delivery_item_id"]
            isOneToOne: false
            referencedRelation: "delivery_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_balance_transfers_org_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_balance_transfers_run_fkey"
            columns: ["delivery_run_id"]
            isOneToOne: false
            referencedRelation: "delivery_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_balance_transfers_run_fkey"
            columns: ["delivery_run_id"]
            isOneToOne: false
            referencedRelation: "v_active_delivery_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_item_batches: {
        Row: {
          batch_id: string
          created_at: string | null
          id: string
          org_id: string
          pick_item_id: string
          picked_at: string | null
          picked_by: string | null
          quantity: number
          updated_at: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string | null
          id?: string
          org_id: string
          pick_item_id: string
          picked_at?: string | null
          picked_by?: string | null
          quantity: number
          updated_at?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string | null
          id?: string
          org_id?: string
          pick_item_id?: string
          picked_at?: string | null
          picked_by?: string | null
          quantity?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pick_item_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_item_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_item_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "pick_item_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_item_batches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_item_batches_pick_item_id_fkey"
            columns: ["pick_item_id"]
            isOneToOne: false
            referencedRelation: "pick_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_item_batches_picked_by_fkey"
            columns: ["picked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "pick_items_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "v_picker_tasks"
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
          {
            foreignKeyName: "pick_list_events_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "v_picker_tasks"
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
          is_partial: boolean
          merge_status: string | null
          notes: string | null
          order_id: string
          org_id: string
          parent_pick_list_id: string | null
          qc_status: string | null
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
          is_partial?: boolean
          merge_status?: string | null
          notes?: string | null
          order_id: string
          org_id: string
          parent_pick_list_id?: string | null
          qc_status?: string | null
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
          is_partial?: boolean
          merge_status?: string | null
          notes?: string | null
          order_id?: string
          org_id?: string
          parent_pick_list_id?: string | null
          qc_status?: string | null
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
            foreignKeyName: "pick_lists_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "pick_lists_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_parent_pick_list_id_fkey"
            columns: ["parent_pick_list_id"]
            isOneToOne: false
            referencedRelation: "pick_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_parent_pick_list_id_fkey"
            columns: ["parent_pick_list_id"]
            isOneToOne: false
            referencedRelation: "v_pick_lists_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_parent_pick_list_id_fkey"
            columns: ["parent_pick_list_id"]
            isOneToOne: false
            referencedRelation: "v_picker_tasks"
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
        ]
      }
      picker_specializations: {
        Row: {
          category_id: string
          created_at: string
          id: string
          org_id: string
          proficiency: number
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          org_id: string
          proficiency?: number
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          org_id?: string
          proficiency?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "picker_specializations_cat_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "picking_size_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picker_specializations_org_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picker_specializations_user_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
            foreignKeyName: "picking_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "picking_feedback_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
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
      picking_size_categories: {
        Row: {
          color: string | null
          created_at: string
          display_order: number
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          display_order?: number
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "picking_size_categories_org_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      picking_size_category_sizes: {
        Row: {
          category_id: string
          id: string
          plant_size_id: string
        }
        Insert: {
          category_id: string
          id?: string
          plant_size_id: string
        }
        Update: {
          category_id?: string
          id?: string
          plant_size_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "picking_size_category_sizes_cat_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "picking_size_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_size_category_sizes_size_fkey"
            columns: ["plant_size_id"]
            isOneToOne: false
            referencedRelation: "lookup_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_size_category_sizes_size_fkey"
            columns: ["plant_size_id"]
            isOneToOne: false
            referencedRelation: "plant_sizes"
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
      planned_batch_materials: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          material_id: string
          notes: string | null
          org_id: string
          quantity_planned: number
          updated_at: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          material_id: string
          notes?: string | null
          org_id: string
          quantity_planned: number
          updated_at?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          material_id?: string
          notes?: string | null
          org_id?: string
          quantity_planned?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_batch_materials_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_batch_materials_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_batch_materials_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "planned_batch_materials_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_batch_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_batch_materials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plant_health_logs: {
        Row: {
          affected_batch_ids: string[] | null
          application_number: number | null
          area_treated: string | null
          batch_id: string | null
          bottle_id: string | null
          created_at: string
          crop_name: string | null
          ec_reading: number | null
          event_at: string
          event_type: Database["public"]["Enums"]["health_event_type"]
          fertiliser_composition: string | null
          harvest_interval_days: number | null
          id: string
          ipm_product_id: string | null
          ipm_task_id: string | null
          issue_reason: string | null
          location_id: string | null
          measurements: Json | null
          method: string | null
          notes: string | null
          org_id: string
          pcs_number: string | null
          ph_reading: number | null
          photo_url: string | null
          photos: string[] | null
          product_name: string | null
          quantity_used_ml: number | null
          rate: number | null
          reason_for_use: string | null
          recorded_by: string | null
          remedial_application_id: string | null
          safe_harvest_date: string | null
          severity: string | null
          signed_by: string | null
          spot_treatment_id: string | null
          sprayer_used: string | null
          title: string | null
          unit: string | null
          updated_at: string
          weather_conditions: string | null
        }
        Insert: {
          affected_batch_ids?: string[] | null
          application_number?: number | null
          area_treated?: string | null
          batch_id?: string | null
          bottle_id?: string | null
          created_at?: string
          crop_name?: string | null
          ec_reading?: number | null
          event_at?: string
          event_type: Database["public"]["Enums"]["health_event_type"]
          fertiliser_composition?: string | null
          harvest_interval_days?: number | null
          id?: string
          ipm_product_id?: string | null
          ipm_task_id?: string | null
          issue_reason?: string | null
          location_id?: string | null
          measurements?: Json | null
          method?: string | null
          notes?: string | null
          org_id: string
          pcs_number?: string | null
          ph_reading?: number | null
          photo_url?: string | null
          photos?: string[] | null
          product_name?: string | null
          quantity_used_ml?: number | null
          rate?: number | null
          reason_for_use?: string | null
          recorded_by?: string | null
          remedial_application_id?: string | null
          safe_harvest_date?: string | null
          severity?: string | null
          signed_by?: string | null
          spot_treatment_id?: string | null
          sprayer_used?: string | null
          title?: string | null
          unit?: string | null
          updated_at?: string
          weather_conditions?: string | null
        }
        Update: {
          affected_batch_ids?: string[] | null
          application_number?: number | null
          area_treated?: string | null
          batch_id?: string | null
          bottle_id?: string | null
          created_at?: string
          crop_name?: string | null
          ec_reading?: number | null
          event_at?: string
          event_type?: Database["public"]["Enums"]["health_event_type"]
          fertiliser_composition?: string | null
          harvest_interval_days?: number | null
          id?: string
          ipm_product_id?: string | null
          ipm_task_id?: string | null
          issue_reason?: string | null
          location_id?: string | null
          measurements?: Json | null
          method?: string | null
          notes?: string | null
          org_id?: string
          pcs_number?: string | null
          ph_reading?: number | null
          photo_url?: string | null
          photos?: string[] | null
          product_name?: string | null
          quantity_used_ml?: number | null
          rate?: number | null
          reason_for_use?: string | null
          recorded_by?: string | null
          remedial_application_id?: string | null
          safe_harvest_date?: string | null
          severity?: string | null
          signed_by?: string | null
          spot_treatment_id?: string | null
          sprayer_used?: string | null
          title?: string | null
          unit?: string | null
          updated_at?: string
          weather_conditions?: string | null
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
            foreignKeyName: "plant_health_logs_bottle_id_fkey"
            columns: ["bottle_id"]
            isOneToOne: false
            referencedRelation: "ipm_product_bottles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_health_logs_ipm_product_id_fkey"
            columns: ["ipm_product_id"]
            isOneToOne: false
            referencedRelation: "ipm_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_health_logs_ipm_product_id_fkey"
            columns: ["ipm_product_id"]
            isOneToOne: false
            referencedRelation: "v_ipm_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "plant_health_logs_ipm_product_id_fkey"
            columns: ["ipm_product_id"]
            isOneToOne: false
            referencedRelation: "v_upcoming_ipm_treatments"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "plant_health_logs_ipm_task_id_fkey"
            columns: ["ipm_task_id"]
            isOneToOne: false
            referencedRelation: "ipm_tasks"
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
          {
            foreignKeyName: "plant_health_logs_remedial_application_id_fkey"
            columns: ["remedial_application_id"]
            isOneToOne: false
            referencedRelation: "ipm_remedial_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_health_logs_spot_treatment_id_fkey"
            columns: ["spot_treatment_id"]
            isOneToOne: false
            referencedRelation: "ipm_spot_treatments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_health_logs_spot_treatment_id_fkey"
            columns: ["spot_treatment_id"]
            isOneToOne: false
            referencedRelation: "v_upcoming_ipm_treatments"
            referencedColumns: ["source_id"]
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
          container_type: string
          created_at: string
          id: string
          name: string
          shelf_quantity: number | null
          tray_quantity: number | null
          trolley_quantity: number | null
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
          container_type?: string
          created_at?: string
          id?: string
          name: string
          shelf_quantity?: number | null
          tray_quantity?: number | null
          trolley_quantity?: number | null
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
          container_type?: string
          created_at?: string
          id?: string
          name?: string
          shelf_quantity?: number | null
          tray_quantity?: number | null
          trolley_quantity?: number | null
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
          is_archived: boolean
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
          is_archived?: boolean
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
          is_archived?: boolean
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
            foreignKeyName: "price_list_customers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "price_list_customers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
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
      print_agents: {
        Row: {
          agent_key: string
          agent_key_prefix: string
          created_at: string
          created_by: string | null
          id: string
          last_seen_at: string | null
          name: string
          org_id: string
          status: string
          updated_at: string
          workstation_info: Json | null
        }
        Insert: {
          agent_key: string
          agent_key_prefix: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_seen_at?: string | null
          name: string
          org_id: string
          status?: string
          updated_at?: string
          workstation_info?: Json | null
        }
        Update: {
          agent_key?: string
          agent_key_prefix?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_seen_at?: string | null
          name?: string
          org_id?: string
          status?: string
          updated_at?: string
          workstation_info?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "print_agents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      print_queue: {
        Row: {
          agent_id: string
          completed_at: string | null
          copies: number
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          job_type: string
          org_id: string
          printer_id: string
          sent_at: string | null
          status: string
          zpl_data: string
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          copies?: number
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          job_type: string
          org_id: string
          printer_id: string
          sent_at?: string | null
          status?: string
          zpl_data: string
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          copies?: number
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          org_id?: string
          printer_id?: string
          sent_at?: string | null
          status?: string
          zpl_data?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_queue_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "print_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_queue_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_queue_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      printers: {
        Row: {
          agent_id: string | null
          connection_type: string
          created_at: string | null
          dpi: number | null
          host: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          label_columns: number | null
          label_gap_mm: number | null
          label_width_mm: number | null
          name: string
          notes: string | null
          org_id: string
          port: number | null
          type: string
          updated_at: string | null
          usb_device_id: string | null
          usb_device_name: string | null
        }
        Insert: {
          agent_id?: string | null
          connection_type?: string
          created_at?: string | null
          dpi?: number | null
          host?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          label_columns?: number | null
          label_gap_mm?: number | null
          label_width_mm?: number | null
          name: string
          notes?: string | null
          org_id: string
          port?: number | null
          type?: string
          updated_at?: string | null
          usb_device_id?: string | null
          usb_device_name?: string | null
        }
        Update: {
          agent_id?: string | null
          connection_type?: string
          created_at?: string | null
          dpi?: number | null
          host?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          label_columns?: number | null
          label_gap_mm?: number | null
          label_width_mm?: number | null
          name?: string
          notes?: string | null
          org_id?: string
          port?: number | null
          type?: string
          updated_at?: string | null
          usb_device_id?: string | null
          usb_device_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "printers_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "print_agents"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "product_aliases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "product_aliases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
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
            foreignKeyName: "product_aliases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_inventory"
            referencedColumns: ["product_id"]
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
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_inventory"
            referencedColumns: ["product_id"]
          },
        ]
      }
      product_group_aliases: {
        Row: {
          alias_name: string
          created_at: string
          customer_barcode: string | null
          customer_id: string | null
          customer_sku_code: string | null
          group_id: string
          id: string
          is_active: boolean
          notes: string | null
          org_id: string
          price_list_id: string | null
          rrp: number | null
          unit_price_ex_vat: number | null
          updated_at: string
        }
        Insert: {
          alias_name: string
          created_at?: string
          customer_barcode?: string | null
          customer_id?: string | null
          customer_sku_code?: string | null
          group_id: string
          id?: string
          is_active?: boolean
          notes?: string | null
          org_id: string
          price_list_id?: string | null
          rrp?: number | null
          unit_price_ex_vat?: number | null
          updated_at?: string
        }
        Update: {
          alias_name?: string
          created_at?: string
          customer_barcode?: string | null
          customer_id?: string | null
          customer_sku_code?: string | null
          group_id?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          org_id?: string
          price_list_id?: string | null
          rrp?: number | null
          unit_price_ex_vat?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_group_aliases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_vat_treatment"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "product_group_aliases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_group_aliases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_trolley_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "product_group_aliases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "product_group_aliases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "product_group_aliases_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "product_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_group_aliases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_group_aliases_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      product_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          inclusion_type: Database["public"]["Enums"]["product_group_inclusion_type"]
          notes: string | null
          org_id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          inclusion_type?: Database["public"]["Enums"]["product_group_inclusion_type"]
          notes?: string | null
          org_id: string
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          inclusion_type?: Database["public"]["Enums"]["product_group_inclusion_type"]
          notes?: string | null
          org_id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "product_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_group_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_group_members_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_group_members_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_inventory"
            referencedColumns: ["product_id"]
          },
        ]
      }
      product_groups: {
        Row: {
          created_at: string
          default_barcode: string | null
          description: string | null
          id: string
          is_active: boolean
          match_category: string[] | null
          match_family: string[] | null
          match_genus: string[] | null
          match_size_ids: string[] | null
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_barcode?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          match_category?: string[] | null
          match_family?: string[] | null
          match_genus?: string[] | null
          match_size_ids?: string[] | null
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_barcode?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          match_category?: string[] | null
          match_family?: string[] | null
          match_genus?: string[] | null
          match_size_ids?: string[] | null
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          {
            foreignKeyName: "product_mapping_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_inventory"
            referencedColumns: ["product_id"]
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
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_inventory"
            referencedColumns: ["product_id"]
          },
        ]
      }
      product_varieties: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          org_id: string
          product_id: string
          updated_at: string
          variety_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          org_id: string
          product_id: string
          updated_at?: string
          variety_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          org_id?: string
          product_id?: string
          updated_at?: string
          variety_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_varieties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_varieties_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_varieties_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_inventory"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_varieties_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "lookup_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_varieties_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "plant_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_varieties_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "plant_varieties_compat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_varieties_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "v_plant_varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      production_job_batches: {
        Row: {
          added_at: string
          batch_id: string
          job_id: string
          sort_order: number | null
        }
        Insert: {
          added_at?: string
          batch_id: string
          job_id: string
          sort_order?: number | null
        }
        Update: {
          added_at?: string
          batch_id?: string
          job_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_job_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_job_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_job_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "production_job_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_job_batches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_job_batches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      production_jobs: {
        Row: {
          assigned_to: string | null
          checklist_progress: Json | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          location: string | null
          machine: string | null
          name: string
          org_id: string
          process_type: string | null
          scheduled_date: string | null
          scheduled_week: number | null
          scheduled_year: number | null
          started_at: string | null
          status: string
          task_id: string | null
          updated_at: string
          wizard_progress: Json | null
          wizard_template: string | null
        }
        Insert: {
          assigned_to?: string | null
          checklist_progress?: Json | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          location?: string | null
          machine?: string | null
          name: string
          org_id: string
          process_type?: string | null
          scheduled_date?: string | null
          scheduled_week?: number | null
          scheduled_year?: number | null
          started_at?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
          wizard_progress?: Json | null
          wizard_template?: string | null
        }
        Update: {
          assigned_to?: string | null
          checklist_progress?: Json | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          location?: string | null
          machine?: string | null
          name?: string
          org_id?: string
          process_type?: string | null
          scheduled_date?: string | null
          scheduled_week?: number | null
          scheduled_year?: number | null
          started_at?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
          wizard_progress?: Json | null
          wizard_template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_jobs_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_jobs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_jobs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_with_productivity"
            referencedColumns: ["id"]
          },
        ]
      }
      productivity_logs: {
        Row: {
          duration_minutes: number
          id: string
          job_id: string | null
          location: string | null
          logged_at: string
          machine: string | null
          org_id: string
          plant_count: number
          task_id: string | null
          task_type: string
          user_id: string
        }
        Insert: {
          duration_minutes: number
          id?: string
          job_id?: string | null
          location?: string | null
          logged_at?: string
          machine?: string | null
          org_id: string
          plant_count: number
          task_id?: string | null
          task_type: string
          user_id: string
        }
        Update: {
          duration_minutes?: number
          id?: string
          job_id?: string | null
          location?: string | null
          logged_at?: string
          machine?: string | null
          org_id?: string
          plant_count?: number
          task_id?: string | null
          task_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "productivity_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productivity_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productivity_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productivity_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productivity_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_with_productivity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productivity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allow_oversell: boolean | null
          ats_override: number | null
          created_at: string
          default_status: string | null
          description: string | null
          hero_image_url: string | null
          id: string
          is_active: boolean
          low_stock_threshold: number | null
          match_families: string[] | null
          match_genera: string[] | null
          min_order_qty: number | null
          name: string
          org_id: string
          shelf_quantity_override: number | null
          sku_id: string
          trolley_quantity_override: number | null
          unit_qty: number | null
          updated_at: string
        }
        Insert: {
          allow_oversell?: boolean | null
          ats_override?: number | null
          created_at?: string
          default_status?: string | null
          description?: string | null
          hero_image_url?: string | null
          id?: string
          is_active?: boolean
          low_stock_threshold?: number | null
          match_families?: string[] | null
          match_genera?: string[] | null
          min_order_qty?: number | null
          name: string
          org_id: string
          shelf_quantity_override?: number | null
          sku_id: string
          trolley_quantity_override?: number | null
          unit_qty?: number | null
          updated_at?: string
        }
        Update: {
          allow_oversell?: boolean | null
          ats_override?: number | null
          created_at?: string
          default_status?: string | null
          description?: string | null
          hero_image_url?: string | null
          id?: string
          is_active?: boolean
          low_stock_threshold?: number | null
          match_families?: string[] | null
          match_genera?: string[] | null
          min_order_qty?: number | null
          name?: string
          org_id?: string
          shelf_quantity_override?: number | null
          sku_id?: string
          trolley_quantity_override?: number | null
          unit_qty?: number | null
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
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_org_id: string | null
          created_at: string | null
          customer_address_id: string | null
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
          customer_address_id?: string | null
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
          customer_address_id?: string | null
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
            foreignKeyName: "profiles_customer_address_id_fkey"
            columns: ["customer_address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_customer_address_id_fkey"
            columns: ["customer_address_id"]
            isOneToOne: false
            referencedRelation: "v_store_order_metrics"
            referencedColumns: ["address_id"]
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
          {
            foreignKeyName: "profiles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "profiles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
            referencedColumns: ["customer_id"]
          },
        ]
      }
      protocol_performance: {
        Row: {
          actual_duration_days: number | null
          actual_ready_week: number | null
          actual_yield_pct: number | null
          batch_id: string
          completed_at: string | null
          created_at: string | null
          final_quantity: number | null
          id: string
          initial_quantity: number | null
          org_id: string
          planned_duration_days: number | null
          planned_ready_week: number | null
          planned_yield_pct: number | null
          protocol_id: string
        }
        Insert: {
          actual_duration_days?: number | null
          actual_ready_week?: number | null
          actual_yield_pct?: number | null
          batch_id: string
          completed_at?: string | null
          created_at?: string | null
          final_quantity?: number | null
          id?: string
          initial_quantity?: number | null
          org_id: string
          planned_duration_days?: number | null
          planned_ready_week?: number | null
          planned_yield_pct?: number | null
          protocol_id: string
        }
        Update: {
          actual_duration_days?: number | null
          actual_ready_week?: number | null
          actual_yield_pct?: number | null
          batch_id?: string
          completed_at?: string | null
          created_at?: string | null
          final_quantity?: number | null
          id?: string
          initial_quantity?: number | null
          org_id?: string
          planned_duration_days?: number | null
          planned_ready_week?: number | null
          planned_yield_pct?: number | null
          protocol_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocol_performance_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: true
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_performance_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: true
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_performance_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: true
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "protocol_performance_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: true
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_performance_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_performance_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
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
      purchase_order_lines: {
        Row: {
          created_at: string
          discount_pct: number
          id: string
          line_number: number
          line_total: number
          material_id: string
          notes: string | null
          purchase_order_id: string
          quantity_ordered: number
          quantity_received: number
          unit_price: number
          uom: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_pct?: number
          id?: string
          line_number: number
          line_total: number
          material_id: string
          notes?: string | null
          purchase_order_id: string
          quantity_ordered: number
          quantity_received?: number
          unit_price: number
          uom?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_pct?: number
          id?: string
          line_number?: number
          line_total?: number
          material_id?: string
          notes?: string | null
          purchase_order_id?: string
          quantity_ordered?: number
          quantity_received?: number
          unit_price?: number
          uom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          delivery_location_id: string | null
          delivery_notes: string | null
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_date: string
          org_id: string
          po_number: string
          received_at: string | null
          status: Database["public"]["Enums"]["purchase_order_status"]
          submitted_at: string | null
          subtotal: number
          supplier_id: string
          supplier_ref: string | null
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivery_location_id?: string | null
          delivery_notes?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          org_id: string
          po_number: string
          received_at?: string | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          submitted_at?: string | null
          subtotal?: number
          supplier_id: string
          supplier_ref?: string | null
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivery_location_id?: string | null
          delivery_notes?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          org_id?: string
          po_number?: string
          received_at?: string | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          submitted_at?: string | null
          subtotal?: number
          supplier_id?: string
          supplier_ref?: string | null
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_delivery_location_id_fkey"
            columns: ["delivery_location_id"]
            isOneToOne: false
            referencedRelation: "lookup_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_delivery_location_id_fkey"
            columns: ["delivery_location_id"]
            isOneToOne: false
            referencedRelation: "nursery_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "lookup_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_feedback: {
        Row: {
          action_required: string | null
          created_at: string
          created_by: string | null
          id: string
          issue_type: string
          notes: string | null
          org_id: string
          pick_item_id: string | null
          pick_list_id: string
          picker_acknowledged_at: string | null
          picker_notified_at: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          action_required?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          issue_type: string
          notes?: string | null
          org_id: string
          pick_item_id?: string | null
          pick_list_id: string
          picker_acknowledged_at?: string | null
          picker_notified_at?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          action_required?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          issue_type?: string
          notes?: string | null
          org_id?: string
          pick_item_id?: string | null
          pick_list_id?: string
          picker_acknowledged_at?: string | null
          picker_notified_at?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qc_feedback_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_feedback_pick_item_id_fkey"
            columns: ["pick_item_id"]
            isOneToOne: false
            referencedRelation: "pick_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_feedback_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "pick_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_feedback_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "v_pick_lists_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_feedback_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "v_picker_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          expire_at: number
          key: string
          points: number
        }
        Insert: {
          expire_at: number
          key: string
          points?: number
        }
        Update: {
          expire_at?: number
          key?: string
          points?: number
        }
        Relationships: []
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
      supplier_addresses: {
        Row: {
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country_code: string
          county: string | null
          created_at: string
          eircode: string | null
          id: string
          is_default: boolean
          label: string
          line1: string
          line2: string | null
          org_id: string
          supplier_id: string
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
          eircode?: string | null
          id?: string
          is_default?: boolean
          label: string
          line1: string
          line2?: string | null
          org_id: string
          supplier_id: string
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
          eircode?: string | null
          id?: string
          is_default?: boolean
          label?: string
          line1?: string
          line2?: string | null
          org_id?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_addresses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_addresses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "lookup_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_addresses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
          is_internal: boolean | null
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
          is_internal?: boolean | null
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
          is_internal?: boolean | null
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
      targeting_config: {
        Row: {
          config_key: string
          config_value: Json
          id: string
          org_id: string | null
          updated_at: string | null
        }
        Insert: {
          config_key: string
          config_value: Json
          id?: string
          org_id?: string | null
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          id?: string
          org_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "targeting_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_team_id: string | null
          assigned_to: string | null
          checklist_progress: Json | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          org_id: string
          plant_quantity: number | null
          priority: number | null
          scheduled_date: string | null
          source_module: string
          source_ref_id: string | null
          source_ref_type: string | null
          started_at: string | null
          status: string
          task_type: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_team_id?: string | null
          assigned_to?: string | null
          checklist_progress?: Json | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          org_id: string
          plant_quantity?: number | null
          priority?: number | null
          scheduled_date?: string | null
          source_module: string
          source_ref_id?: string | null
          source_ref_type?: string | null
          started_at?: string | null
          status?: string
          task_type?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_team_id?: string | null
          assigned_to?: string | null
          checklist_progress?: Json | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          org_id?: string
          plant_quantity?: number | null
          priority?: number | null
          scheduled_date?: string | null
          source_module?: string
          source_ref_id?: string | null
          source_ref_type?: string | null
          started_at?: string | null
          status?: string
          task_type?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_team_id_fkey"
            columns: ["assigned_team_id"]
            isOneToOne: false
            referencedRelation: "picking_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_team_id_fkey"
            columns: ["assigned_team_id"]
            isOneToOne: false
            referencedRelation: "v_picking_team_workload"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_org_id_fkey"
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
      trial_findings: {
        Row: {
          approved_by: string | null
          created_at: string
          created_by: string | null
          description: string
          finding_type: string
          id: string
          implemented_at: string | null
          implemented_protocol_id: string | null
          recommended_protocol_changes: Json | null
          reviewed_by: string | null
          status: string | null
          supporting_data: Json | null
          title: string
          trial_id: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          finding_type: string
          id?: string
          implemented_at?: string | null
          implemented_protocol_id?: string | null
          recommended_protocol_changes?: Json | null
          reviewed_by?: string | null
          status?: string | null
          supporting_data?: Json | null
          title: string
          trial_id: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          finding_type?: string
          id?: string
          implemented_at?: string | null
          implemented_protocol_id?: string | null
          recommended_protocol_changes?: Json | null
          reviewed_by?: string | null
          status?: string | null
          supporting_data?: Json | null
          title?: string
          trial_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_findings_implemented_protocol_id_fkey"
            columns: ["implemented_protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_findings_trial_id_fkey"
            columns: ["trial_id"]
            isOneToOne: false
            referencedRelation: "trials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_findings_trial_id_fkey"
            columns: ["trial_id"]
            isOneToOne: false
            referencedRelation: "v_trial_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_groups: {
        Row: {
          created_at: string
          description: string | null
          group_type: string
          id: string
          label_color: string | null
          name: string
          sort_order: number
          strategy: Json
          target_plant_count: number
          trial_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_type: string
          id?: string
          label_color?: string | null
          name: string
          sort_order?: number
          strategy?: Json
          target_plant_count?: number
          trial_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          group_type?: string
          id?: string
          label_color?: string | null
          name?: string
          sort_order?: number
          strategy?: Json
          target_plant_count?: number
          trial_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_groups_trial_id_fkey"
            columns: ["trial_id"]
            isOneToOne: false
            referencedRelation: "trials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_groups_trial_id_fkey"
            columns: ["trial_id"]
            isOneToOne: false
            referencedRelation: "v_trial_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_measurements: {
        Row: {
          anomalies: string | null
          biomass_g: number | null
          canopy_width_cm: number | null
          color_score: number | null
          created_at: string
          disease_score: number | null
          ec: number | null
          flowers_count: number | null
          fruits_count: number | null
          harvest_weight_g: number | null
          height_cm: number | null
          humidity_pct: number | null
          id: string
          internode_length_mm: number | null
          leaf_count: number | null
          light_level_lux: number | null
          measurement_date: string
          observations: string | null
          overall_health_score: number | null
          pest_score: number | null
          ph: number | null
          photo_urls: string[] | null
          quality_grade: string | null
          recorded_by: string | null
          root_score: number | null
          stem_diameter_mm: number | null
          subject_id: string
          temperature_c: number | null
          updated_at: string
          vigor_score: number | null
          week_number: number
        }
        Insert: {
          anomalies?: string | null
          biomass_g?: number | null
          canopy_width_cm?: number | null
          color_score?: number | null
          created_at?: string
          disease_score?: number | null
          ec?: number | null
          flowers_count?: number | null
          fruits_count?: number | null
          harvest_weight_g?: number | null
          height_cm?: number | null
          humidity_pct?: number | null
          id?: string
          internode_length_mm?: number | null
          leaf_count?: number | null
          light_level_lux?: number | null
          measurement_date: string
          observations?: string | null
          overall_health_score?: number | null
          pest_score?: number | null
          ph?: number | null
          photo_urls?: string[] | null
          quality_grade?: string | null
          recorded_by?: string | null
          root_score?: number | null
          stem_diameter_mm?: number | null
          subject_id: string
          temperature_c?: number | null
          updated_at?: string
          vigor_score?: number | null
          week_number: number
        }
        Update: {
          anomalies?: string | null
          biomass_g?: number | null
          canopy_width_cm?: number | null
          color_score?: number | null
          created_at?: string
          disease_score?: number | null
          ec?: number | null
          flowers_count?: number | null
          fruits_count?: number | null
          harvest_weight_g?: number | null
          height_cm?: number | null
          humidity_pct?: number | null
          id?: string
          internode_length_mm?: number | null
          leaf_count?: number | null
          light_level_lux?: number | null
          measurement_date?: string
          observations?: string | null
          overall_health_score?: number | null
          pest_score?: number | null
          ph?: number | null
          photo_urls?: string[] | null
          quality_grade?: string | null
          recorded_by?: string | null
          root_score?: number | null
          stem_diameter_mm?: number | null
          subject_id?: string
          temperature_c?: number | null
          updated_at?: string
          vigor_score?: number | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "trial_measurements_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "trial_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_subjects: {
        Row: {
          batch_id: string | null
          created_at: string
          dropout_date: string | null
          dropout_reason: string | null
          group_id: string
          id: string
          initial_height_cm: number | null
          initial_leaf_count: number | null
          initial_photo_url: string | null
          initial_vigor_score: number | null
          is_active: boolean
          label: string | null
          location_id: string | null
          plant_identifier: string | null
          position_notes: string | null
          subject_number: number
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          dropout_date?: string | null
          dropout_reason?: string | null
          group_id: string
          id?: string
          initial_height_cm?: number | null
          initial_leaf_count?: number | null
          initial_photo_url?: string | null
          initial_vigor_score?: number | null
          is_active?: boolean
          label?: string | null
          location_id?: string | null
          plant_identifier?: string | null
          position_notes?: string | null
          subject_number: number
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          dropout_date?: string | null
          dropout_reason?: string | null
          group_id?: string
          id?: string
          initial_height_cm?: number | null
          initial_leaf_count?: number | null
          initial_photo_url?: string | null
          initial_vigor_score?: number | null
          is_active?: boolean
          label?: string | null
          location_id?: string | null
          plant_identifier?: string | null
          position_notes?: string | null
          subject_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_subjects_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_subjects_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_subjects_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "trial_subjects_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_subjects_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "trial_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_subjects_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "lookup_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_subjects_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "nursery_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_treatments: {
        Row: {
          applied_by: string | null
          created_at: string
          group_id: string
          id: string
          ipm_product_id: string | null
          material_id: string | null
          method: string | null
          name: string
          notes: string | null
          protocol_id: string | null
          quantity_applied: number | null
          rate: number | null
          rate_unit: string | null
          treatment_date: string
          treatment_type: string
        }
        Insert: {
          applied_by?: string | null
          created_at?: string
          group_id: string
          id?: string
          ipm_product_id?: string | null
          material_id?: string | null
          method?: string | null
          name: string
          notes?: string | null
          protocol_id?: string | null
          quantity_applied?: number | null
          rate?: number | null
          rate_unit?: string | null
          treatment_date: string
          treatment_type: string
        }
        Update: {
          applied_by?: string | null
          created_at?: string
          group_id?: string
          id?: string
          ipm_product_id?: string | null
          material_id?: string | null
          method?: string | null
          name?: string
          notes?: string | null
          protocol_id?: string | null
          quantity_applied?: number | null
          rate?: number | null
          rate_unit?: string | null
          treatment_date?: string
          treatment_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_treatments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "trial_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_treatments_ipm_product_id_fkey"
            columns: ["ipm_product_id"]
            isOneToOne: false
            referencedRelation: "ipm_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_treatments_ipm_product_id_fkey"
            columns: ["ipm_product_id"]
            isOneToOne: false
            referencedRelation: "v_ipm_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "trial_treatments_ipm_product_id_fkey"
            columns: ["ipm_product_id"]
            isOneToOne: false
            referencedRelation: "v_upcoming_ipm_treatments"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "trial_treatments_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_treatments_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      trials: {
        Row: {
          actual_end_date: string | null
          created_at: string
          created_by: string | null
          description: string | null
          hypothesis: string | null
          id: string
          measurement_frequency_days: number
          methodology: string | null
          name: string
          objective: string | null
          org_id: string
          planned_end_date: string | null
          protocol_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["trial_status"]
          target_size_id: string | null
          trial_location_id: string | null
          trial_number: string
          updated_at: string
          variety_id: string | null
        }
        Insert: {
          actual_end_date?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          hypothesis?: string | null
          id?: string
          measurement_frequency_days?: number
          methodology?: string | null
          name: string
          objective?: string | null
          org_id: string
          planned_end_date?: string | null
          protocol_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["trial_status"]
          target_size_id?: string | null
          trial_location_id?: string | null
          trial_number: string
          updated_at?: string
          variety_id?: string | null
        }
        Update: {
          actual_end_date?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          hypothesis?: string | null
          id?: string
          measurement_frequency_days?: number
          methodology?: string | null
          name?: string
          objective?: string | null
          org_id?: string
          planned_end_date?: string | null
          protocol_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["trial_status"]
          target_size_id?: string | null
          trial_location_id?: string | null
          trial_number?: string
          updated_at?: string
          variety_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_target_size_id_fkey"
            columns: ["target_size_id"]
            isOneToOne: false
            referencedRelation: "lookup_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_target_size_id_fkey"
            columns: ["target_size_id"]
            isOneToOne: false
            referencedRelation: "plant_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_trial_location_id_fkey"
            columns: ["trial_location_id"]
            isOneToOne: false
            referencedRelation: "lookup_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_trial_location_id_fkey"
            columns: ["trial_location_id"]
            isOneToOne: false
            referencedRelation: "nursery_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "lookup_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "plant_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "plant_varieties_compat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trials_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "v_plant_varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      trolley_capacity: {
        Row: {
          created_at: string
          family: string | null
          id: string
          notes: string | null
          org_id: string
          shelves_per_trolley: number
          size_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          family?: string | null
          id?: string
          notes?: string | null
          org_id: string
          shelves_per_trolley?: number
          size_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          family?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          shelves_per_trolley?: number
          size_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trolley_capacity_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trolley_capacity_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "lookup_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trolley_capacity_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "plant_sizes"
            referencedColumns: ["id"]
          },
        ]
      }
      trolley_labels: {
        Row: {
          created_at: string
          customer_name: string | null
          id: string
          label_code: string
          order_id: string | null
          order_number: string | null
          org_id: string
          pick_list_id: string | null
          printed_at: string | null
          printed_by: string | null
          scanned_at: string | null
          scanned_by: string | null
          trolley_number: string | null
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          id?: string
          label_code: string
          order_id?: string | null
          order_number?: string | null
          org_id: string
          pick_list_id?: string | null
          printed_at?: string | null
          printed_by?: string | null
          scanned_at?: string | null
          scanned_by?: string | null
          trolley_number?: string | null
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          id?: string
          label_code?: string
          order_id?: string | null
          order_number?: string | null
          org_id?: string
          pick_list_id?: string | null
          printed_at?: string | null
          printed_by?: string | null
          scanned_at?: string | null
          scanned_by?: string | null
          trolley_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trolley_labels_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trolley_labels_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_note_header"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "trolley_labels_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trolley_labels_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_ready_for_dispatch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trolley_labels_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "trolley_labels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trolley_labels_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "pick_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trolley_labels_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "v_pick_lists_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trolley_labels_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "v_picker_tasks"
            referencedColumns: ["id"]
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
            foreignKeyName: "trolley_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "trolley_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
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
            foreignKeyName: "trolleys_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "trolleys_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
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
          truck_layout: Json | null
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
          truck_layout?: Json | null
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
          truck_layout?: Json | null
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
      checklist_templates_summary: {
        Row: {
          checklist_type: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          description: string | null
          id: string | null
          is_active: boolean | null
          item_count: number | null
          items: Json | null
          name: string | null
          org_id: string | null
          process_type: string | null
          source_module: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_order_patterns: {
        Row: {
          avg_order_interval: number | null
          avg_order_value: number | null
          customer_id: string | null
          interval_stddev: number | null
          last_order_at: string | null
          org_id: string | null
          preferred_dow: number | null
          preferred_week: number | null
          total_orders: number | null
          total_revenue: number | null
          value_quartile: number | null
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
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
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
          is_virtual: boolean | null
          name: string | null
          nursery_site: string | null
          org_id: string | null
        }
        Insert: {
          covered?: boolean | null
          id?: string | null
          is_virtual?: boolean | null
          name?: string | null
          nursery_site?: string | null
          org_id?: string | null
        }
        Update: {
          covered?: boolean | null
          id?: string | null
          is_virtual?: boolean | null
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
          container_type: string | null
          id: string | null
          name: string | null
        }
        Insert: {
          cell_multiple?: number | null
          container_type?: string | null
          id?: string | null
          name?: string | null
        }
        Update: {
          cell_multiple?: number | null
          container_type?: string | null
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
      production_jobs_summary: {
        Row: {
          assigned_to: string | null
          assigned_to_email: string | null
          assigned_to_name: string | null
          batch_count: number | null
          checklist_progress: Json | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          id: string | null
          location: string | null
          machine: string | null
          name: string | null
          org_id: string | null
          process_type: string | null
          scheduled_date: string | null
          scheduled_week: number | null
          scheduled_year: number | null
          started_at: string | null
          status: string | null
          task_id: string | null
          total_plants: number | null
          updated_at: string | null
          wizard_progress: Json | null
          wizard_template: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_jobs_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_jobs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_jobs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_with_productivity"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks_with_productivity: {
        Row: {
          assigned_team_id: string | null
          assigned_team_name: string | null
          assigned_to: string | null
          assigned_to_email: string | null
          assigned_to_name: string | null
          checklist_progress: Json | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          id: string | null
          org_id: string | null
          plant_quantity: number | null
          plants_per_hour: number | null
          priority: number | null
          scheduled_date: string | null
          source_module: string | null
          source_ref_id: string | null
          source_ref_type: string | null
          started_at: string | null
          status: string | null
          task_type: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_team_id_fkey"
            columns: ["assigned_team_id"]
            isOneToOne: false
            referencedRelation: "picking_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_team_id_fkey"
            columns: ["assigned_team_id"]
            isOneToOne: false
            referencedRelation: "v_picking_team_workload"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      v_active_delivery_zones: {
        Row: {
          county: string | null
          lat: number | null
          lng: number | null
          order_count: number | null
          org_id: string | null
          requested_delivery_date: string | null
          routing_key: string | null
          routing_keys_in_zone: string[] | null
          total_trolleys: number | null
          zone_name: string | null
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
          saleable_quantity: number | null
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
      v_batch_allocations_compat: {
        Row: {
          batch_id: string | null
          created_at: string | null
          id: string | null
          note: string | null
          order_item_id: string | null
          org_id: string | null
          quantity: number | null
          status: Database["public"]["Enums"]["allocation_status"] | null
          updated_at: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string | null
          id?: string | null
          note?: never
          order_item_id?: string | null
          org_id?: string | null
          quantity?: number | null
          status?: never
          updated_at?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string | null
          id?: string | null
          note?: never
          order_item_id?: string | null
          org_id?: string | null
          quantity?: number | null
          status?: never
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allocation_ledger_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_ledger_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_ledger_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "allocation_ledger_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_ledger_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          behavior: string | null
          category: string | null
          created_at: string | null
          distribution: Json | null
          family: string | null
          grower_photo_url: string | null
          id: string | null
          initial_quantity: number | null
          location_id: string | null
          location_name: string | null
          location_site: string | null
          log_history: Json | null
          org_id: string | null
          phase: string | null
          plant_variety_id: string | null
          quantity: number | null
          ready_at: string | null
          reserved_quantity: number | null
          saleable_quantity: number | null
          sales_photo_url: string | null
          size_id: string | null
          size_name: string | null
          status: string | null
          status_id: string | null
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
      v_ipm_stock_summary: {
        Row: {
          bottles_in_stock: number | null
          bottles_open: number | null
          bottles_sealed: number | null
          default_bottle_volume_ml: number | null
          is_low_stock: boolean | null
          low_stock_threshold: number | null
          org_id: string | null
          product_id: string | null
          product_name: string | null
          target_stock_bottles: number | null
          total_remaining_ml: number | null
          usage_last_30_days_ml: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ipm_products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
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
            foreignKeyName: "pick_lists_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["order_id"]
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
            foreignKeyName: "picking_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "picking_feedback_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
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
      v_picker_tasks: {
        Row: {
          assigned_team_id: string | null
          assigned_user_id: string | null
          completed_at: string | null
          created_at: string | null
          customer_name: string | null
          id: string | null
          is_partial: boolean | null
          merge_status: string | null
          notes: string | null
          order_id: string | null
          order_number: string | null
          order_status: Database["public"]["Enums"]["order_status"] | null
          org_id: string | null
          pending_feedback_count: number | null
          picked_items: number | null
          picked_qty: number | null
          qc_status: string | null
          requested_delivery_date: string | null
          sequence: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["pick_list_status"] | null
          total_items: number | null
          total_qty: number | null
          unacknowledged_feedback_count: number | null
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
            foreignKeyName: "pick_lists_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["order_id"]
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
      v_product_inventory: {
        Row: {
          allow_oversell: boolean | null
          ats_override: number | null
          calculated_stock: number | null
          effective_ats: number | null
          is_active: boolean | null
          low_stock_threshold: number | null
          org_id: string | null
          product_id: string | null
          product_name: string | null
          stock_status: string | null
          tier1_reserved: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_remedial_programs_by_pest: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          org_id: string | null
          product_ids: string[] | null
          product_names: string[] | null
          severity_applicability: string[] | null
          step_count: number | null
          target_pest_disease: string | null
          treatment_duration_days: number | null
          treatment_urgency: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          org_id?: string | null
          product_ids?: never
          product_names?: never
          severity_applicability?: string[] | null
          step_count?: never
          target_pest_disease?: string | null
          treatment_duration_days?: number | null
          treatment_urgency?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          org_id?: string | null
          product_ids?: never
          product_names?: never
          severity_applicability?: string[] | null
          step_count?: never
          target_pest_disease?: string | null
          treatment_duration_days?: number | null
          treatment_urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ipm_remedial_programs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_sales_admin_inbox: {
        Row: {
          action_label: string | null
          customer_name: string | null
          description: string | null
          link_url: string | null
          order_number: string | null
          org_id: string | null
          priority: number | null
          reference_id: string | null
          task_date: string | null
          task_type: string | null
          title: string | null
          total_inc_vat: number | null
        }
        Relationships: []
      }
      v_scheduled_deliveries_map: {
        Row: {
          city: string | null
          county: string | null
          customer_id: string | null
          customer_name: string | null
          eircode: string | null
          lat: number | null
          lng: number | null
          order_id: string | null
          order_number: string | null
          org_id: string | null
          requested_delivery_date: string | null
          routing_key: string | null
          trolleys_estimated: number | null
          zone_name: string | null
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
      v_smart_sales_targets: {
        Row: {
          avg_order_interval: number | null
          avg_order_value: number | null
          city: string | null
          context_note: string | null
          county: string | null
          customer_id: string | null
          customer_name: string | null
          eircode: string | null
          email: string | null
          last_interaction_at: string | null
          last_interaction_outcome: string | null
          last_order_at: string | null
          lat: number | null
          lng: number | null
          org_id: string | null
          phone: string | null
          preferred_dow: number | null
          priority_score: number | null
          probability_score: number | null
          route_fit_score: number | null
          routing_key: string | null
          suggested_delivery_date: string | null
          target_reason: string | null
          total_orders: number | null
          total_revenue: number | null
          value_quartile: number | null
          van_current_load: number | null
          zone_name: string | null
          zone_order_count: number | null
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
      v_store_order_metrics: {
        Row: {
          address_id: string | null
          avg_order_value: number | null
          city: string | null
          county: string | null
          customer_id: string | null
          label: string | null
          last_order_at: string | null
          order_count: number | null
          store_name: string | null
          total_revenue: number | null
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
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_smart_sales_targets"
            referencedColumns: ["customer_id"]
          },
        ]
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
            foreignKeyName: "order_item_substitutions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_scheduled_deliveries_map"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_item_substitutions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
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
      v_trial_summary: {
        Row: {
          created_at: string | null
          current_week: number | null
          group_count: number | null
          id: string | null
          last_measurement_date: string | null
          measurement_count: number | null
          name: string | null
          org_id: string | null
          planned_end_date: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["trial_status"] | null
          subject_count: number | null
          trial_number: string | null
          variety_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_upcoming_ipm_treatments: {
        Row: {
          applications_total: number | null
          batch_number: string | null
          current_application: number | null
          due_date: string | null
          location_name: string | null
          method: string | null
          notes: string | null
          org_id: string | null
          product_id: string | null
          product_name: string | null
          rate: number | null
          rate_unit: string | null
          source_id: string | null
          target_batch_id: string | null
          target_location_id: string | null
          target_type: string | null
          treatment_source: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ipm_spot_treatments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_spot_treatments_target_batch_id_fkey"
            columns: ["target_batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_spot_treatments_target_batch_id_fkey"
            columns: ["target_batch_id"]
            isOneToOne: false
            referencedRelation: "v_available_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_spot_treatments_target_batch_id_fkey"
            columns: ["target_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_passport"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "ipm_spot_treatments_target_batch_id_fkey"
            columns: ["target_batch_id"]
            isOneToOne: false
            referencedRelation: "v_batch_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_spot_treatments_target_location_id_fkey"
            columns: ["target_location_id"]
            isOneToOne: false
            referencedRelation: "lookup_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipm_spot_treatments_target_location_id_fkey"
            columns: ["target_location_id"]
            isOneToOne: false
            referencedRelation: "nursery_locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      actualize_batch: {
        Args: {
          p_actual_date: string
          p_actual_quantity: number
          p_batch_id: string
          p_location_id?: string
          p_notes?: string
          p_org_id: string
          p_user_id: string
        }
        Returns: Json
      }
      apply_balance_transfer: {
        Args: { p_notes?: string; p_reviewer_id: string; p_transfer_id: string }
        Returns: Json
      }
      apply_location_treatment_atomic: {
        Args: {
          p_bottle_id?: string
          p_ipm_product_id?: string
          p_location_id: string
          p_method: string
          p_notes?: string
          p_org_id: string
          p_product_name: string
          p_quantity_used_ml?: number
          p_rate: number
          p_rei_hours: number
          p_unit: string
          p_user_id: string
        }
        Returns: Json
      }
      apply_order_item_substitution: {
        Args: { _sub_id: string }
        Returns: undefined
      }
      bootstrap_org_owner: { Args: { _org: string }; Returns: undefined }
      cleanup_stale_print_queue: { Args: never; Returns: undefined }
      clear_location_atomic: {
        Args: {
          p_location_id: string
          p_notes?: string
          p_org_id: string
          p_user_id: string
        }
        Returns: Json
      }
      complete_pick_list: {
        Args: { p_org_id: string; p_pick_list_id: string; p_user_id: string }
        Returns: Json
      }
      complete_production_job: {
        Args: {
          p_job_id: string
          p_org_id: string
          p_user_id: string
          p_wizard_data?: Json
        }
        Returns: Json
      }
      compute_quantity_produced: {
        Args: { _cell_multiple: number; _container: string; _initial: number }
        Returns: number
      }
      create_order_with_allocations: {
        Args: {
          p_created_by_staff_id?: string
          p_created_by_user_id?: string
          p_customer_id: string
          p_lines: Json
          p_notes?: string
          p_order_number: string
          p_org_id: string
          p_requested_delivery_date?: string
          p_ship_to_address_id?: string
          p_status?: Database["public"]["Enums"]["order_status"]
        }
        Returns: Json
      }
      create_purchase_order: {
        Args: {
          p_delivery_location_id?: string
          p_delivery_notes?: string
          p_expected_delivery_date?: string
          p_lines?: Json
          p_notes?: string
          p_org_id: string
          p_po_number: string
          p_supplier_id: string
          p_supplier_ref?: string
          p_user_id: string
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
      decrement_reserved_quantity: {
        Args: { p_amount: number; p_batch_id: string }
        Returns: number
      }
      dispatch_load: { Args: { p_load_id: string }; Returns: Json }
      flag_location_atomic: {
        Args: {
          p_affected_batch_ids?: string[]
          p_issue_reason: string
          p_location_id: string
          p_notes?: string
          p_org_id: string
          p_photo_url?: string
          p_severity: string
          p_user_id: string
        }
        Returns: Json
      }
      fn_calculate_product_ats: {
        Args: { p_product_id: string }
        Returns: {
          calculated_ats: number
          effective_ats: number
          override_ats: number
          stock_status: string
          tier1_reserved: number
        }[]
      }
      fn_cancel_allocation: {
        Args: {
          p_actor_id?: string
          p_allocation_id: string
          p_reason?: string
        }
        Returns: Json
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
      fn_confirm_order_with_allocations: {
        Args: { p_actor_id?: string; p_order_id: string }
        Returns: Json
      }
      fn_create_order_with_product_allocations: {
        Args: {
          p_actor_id?: string
          p_auto_confirm?: boolean
          p_customer_id: string
          p_items: Json
          p_order_data: Json
          p_org_id: string
        }
        Returns: Json
      }
      fn_create_product_allocation: {
        Args: {
          p_actor_id?: string
          p_order_item_id: string
          p_org_id: string
          p_priority_rank?: number
          p_product_id: string
          p_quantity: number
        }
        Returns: Json
      }
      fn_format_batch_number: {
        Args: {
          p_org_id: string
          p_phase: Database["public"]["Enums"]["production_phase"]
          p_ref_date: string
        }
        Returns: string
      }
      fn_get_allocation_candidates: {
        Args: {
          p_location_filter?: string
          p_org_id: string
          p_product_id: string
          p_variety_filter?: string
        }
        Returns: {
          age_weeks: number
          available_quantity: number
          batch_id: string
          batch_number: string
          growing_status: string
          location_id: string
          location_name: string
          planted_at: string
          sales_status: string
          variety_id: string
          variety_name: string
        }[]
      }
      fn_get_order_allocation_status: {
        Args: { p_order_id: string }
        Returns: Json
      }
      fn_log_inventory_event: {
        Args: {
          p_actor_id?: string
          p_allocation_id?: string
          p_batch_id?: string
          p_event_type: Database["public"]["Enums"]["inventory_event_type"]
          p_metadata?: Json
          p_order_id?: string
          p_order_item_id?: string
          p_org_id: string
          p_product_id?: string
          p_quantity_change: number
          p_running_batch_available?: number
          p_running_product_ats?: number
        }
        Returns: string
      }
      fn_mark_allocation_picked: {
        Args: {
          p_actor_id?: string
          p_allocation_id: string
          p_picked_quantity?: number
        }
        Returns: Json
      }
      fn_next_org_counter: {
        Args: { p_key: string; p_org_id: string }
        Returns: number
      }
      fn_start_picking_order: {
        Args: { p_actor_id?: string; p_order_id: string }
        Returns: Json
      }
      fn_transition_to_batch_allocation: {
        Args: {
          p_actor_id?: string
          p_allocation_id: string
          p_batch_id: string
        }
        Returns: Json
      }
      generate_bottle_code: {
        Args: { p_org_id: string; p_product_id: string }
        Returns: string
      }
      generate_credit_number: {
        Args: { _issue_date: string; _org_id: string }
        Returns: string
      }
      generate_invoice_for_order: {
        Args: { p_order_id: string; p_org_id: string; p_user_id: string }
        Returns: Json
      }
      generate_invoice_number: {
        Args: { _issue_date: string; _org_id: string }
        Returns: string
      }
      generate_trial_number: { Args: { p_org_id: string }; Returns: string }
      get_batch_distribution: { Args: { p_batch_id: string }; Returns: Json }
      get_batch_plan_progress: {
        Args: { p_batch_plan_id: string }
        Returns: {
          batch_count: number
          batch_plan_id: string
          planned_quantity: number
          total_completed: number
          total_in_batches: number
        }[]
      }
      get_batches_for_view: {
        Args: never
        Returns: {
          batch_number: string
          behavior: string
          category: string
          created_at: string
          distribution: Json
          family: string
          grower_photo_url: string
          id: string
          initial_quantity: number
          location_id: string
          location_name: string
          log_history: Json
          org_id: string
          phase: string
          plant_variety_id: string
          quantity: number
          ready_at: string
          reserved_quantity: number
          saleable_quantity: number
          sales_photo_url: string
          size_id: string
          size_name: string
          status: string
          status_id: string
          supplier_id: string
          supplier_name: string
          updated_at: string
          variety_name: string
        }[]
      }
      get_dashboard_stats: {
        Args: { p_org_id: string }
        Returns: {
          active_batches: number
          archived_batches: number
          family_distribution: Json
          ready_for_sale_batches: number
          ready_for_sale_plants: number
          size_distribution: Json
          total_plants: number
        }[]
      }
      get_guide_plan_progress: {
        Args: { p_guide_plan_id: string }
        Returns: {
          guide_plan_id: string
          target_quantity: number
          total_completed: number
          total_in_batches: number
          total_planned: number
        }[]
      }
      get_planning_buckets: {
        Args: {
          p_horizon_months?: number
          p_org_id: string
          p_start_date?: string
        }
        Returns: {
          bucket_label: string
          bucket_month: string
          incoming: number
          physical: number
          planned: number
        }[]
      }
      get_product_availability: {
        Args: { p_org_id: string }
        Returns: {
          available_quantity: number
          batch_count: number
          plant_variety: string
          plant_variety_id: string
          product_key: string
          reserved_quantity: number
          sample_image_url: string
          size: string
          size_id: string
          total_quantity: number
        }[]
      }
      get_product_group_members: {
        Args: { p_group_id: string }
        Returns: {
          inclusion_source: string
          product_id: string
          product_name: string
        }[]
      }
      get_reference_data: {
        Args: { p_org_id: string }
        Returns: {
          locations: Json
          sizes: Json
          suppliers: Json
          varieties: Json
        }[]
      }
      get_saleable_batches: {
        Args: { p_org_id: string }
        Returns: {
          available_quantity: number
          batch_number: string
          created_at: string
          grower_photo_url: string
          growing_status: string
          hidden: boolean
          id: string
          location: string
          plant_variety: string
          plant_variety_id: string
          planted_at: string
          quantity: number
          reserved_quantity: number
          sales_photo_url: string
          sales_status: string
          size: string
          size_id: string
          status: string
        }[]
      }
      increment_batch_quantity: {
        Args: { p_batch_id: string; p_org_id: string; p_units: number }
        Returns: number
      }
      increment_counter: {
        Args: { p_key: string; p_org_id: string }
        Returns: number
      }
      increment_org_counter: {
        Args: { p_key: string; p_org_id: string }
        Returns: number
      }
      increment_reserved_quantity: {
        Args: { p_amount: number; p_batch_id: string }
        Returns: number
      }
      is_member_of: { Args: { _org: string }; Returns: boolean }
      mark_stale_agents_offline: { Args: never; Returns: undefined }
      migrate_log_history_to_events: {
        Args: { p_batch_id?: string }
        Returns: number
      }
      next_counter: { Args: { _key: string; _org_id: string }; Returns: number }
      next_sku_code: { Args: never; Returns: number }
      perform_transplant:
        | {
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
        | {
            Args: {
              p_archive_parent_if_empty?: boolean
              p_containers: number
              p_location_id: string
              p_notes?: string
              p_org_id: string
              p_parent_batch_id: string
              p_planted_at?: string
              p_size_id: string
              p_units?: number
              p_user_id: string
            }
            Returns: Json
          }
      pick_item_atomic: {
        Args: {
          p_notes?: string
          p_org_id: string
          p_pick_item_id: string
          p_picked_batch_id: string
          p_picked_qty: number
          p_status?: string
          p_substitution_reason?: string
          p_user_id: string
        }
        Returns: Json
      }
      pick_item_multi_batch: {
        Args: {
          p_batches: Json
          p_notes?: string
          p_org_id: string
          p_pick_item_id: string
          p_user_id: string
        }
        Returns: Json
      }
      recalc_invoice_totals: {
        Args: { _invoice_id: string }
        Returns: undefined
      }
      recalc_order_totals: { Args: { _order_id: string }; Returns: undefined }
      recalculate_customer_trolley_balance: {
        Args: { p_customer_id: string; p_org_id: string }
        Returns: undefined
      }
      recalculate_haulier_trolley_balance: {
        Args: { p_haulier_id: string; p_org_id: string }
        Returns: undefined
      }
      recall_load: { Args: { p_load_id: string }; Returns: Json }
      receive_goods_atomic: {
        Args: {
          p_lines: Json
          p_location_id?: string
          p_notes?: string
          p_org_id: string
          p_po_id: string
          p_user_id: string
        }
        Returns: Json
      }
      refresh_customer_order_patterns_manual: {
        Args: never
        Returns: undefined
      }
      refresh_log_history_for_batch: {
        Args: { _batch_id: string }
        Returns: undefined
      }
      reject_balance_transfer: {
        Args: { p_notes?: string; p_reviewer_id: string; p_transfer_id: string }
        Returns: Json
      }
      reject_pick_list_atomic: {
        Args: {
          p_failed_items?: Json
          p_failure_reason: string
          p_org_id: string
          p_pick_list_id: string
          p_user_id: string
        }
        Returns: Json
      }
      resolve_status_id: {
        Args: { p_org_id: string; p_status_code: string }
        Returns: string
      }
      restore_batch_quantity: {
        Args: { p_batch_id: string; p_quantity: number }
        Returns: undefined
      }
      search_batches_for_scout: {
        Args: { p_limit?: number; p_org_id: string; p_search: string }
        Returns: {
          batch_number: string
          id: string
          location_id: string
          location_name: string
          variety_family: string
          variety_name: string
        }[]
      }
      seed_default_execution_groups: {
        Args: { p_org_id: string }
        Returns: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          filter_criteria: Json
          icon: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          sort_order: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "execution_groups"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      submit_qc_check: {
        Args: {
          p_checklist: Json
          p_failed_items: Json
          p_failure_reason?: string
          p_order_id: string
          p_org_id: string
          p_passed: boolean
          p_pick_list_id: string
          p_user_id: string
        }
        Returns: Json
      }
      switch_active_org: { Args: { _org: string }; Returns: undefined }
      user_in_org: { Args: { target_org_id: string }; Returns: boolean }
      void_order_with_allocations: {
        Args: { p_order_id: string; p_org_id: string; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      allocation_status:
        | "allocated"
        | "picked"
        | "short"
        | "damaged"
        | "replaced"
      allocation_status_v2:
        | "reserved"
        | "allocated"
        | "picked"
        | "shipped"
        | "cancelled"
      allocation_tier: "product" | "batch"
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
      interaction_type: "call" | "email" | "visit" | "whatsapp" | "other"
      inventory_event_type:
        | "PRODUCT_RESERVED"
        | "PRODUCT_UNRESERVED"
        | "BATCH_ALLOCATED"
        | "BATCH_DEALLOCATED"
        | "BATCH_PICKED"
        | "BATCH_PICK_REVERSED"
        | "BATCH_SHIPPED"
        | "MANUAL_ADJUSTMENT"
        | "SHORTAGE_RECORDED"
        | "OVERSELL_RECORDED"
      invoice_status: "draft" | "issued" | "void"
      material_transaction_type:
        | "receive"
        | "consume"
        | "adjust"
        | "transfer"
        | "count"
        | "return"
        | "scrap"
      order_status:
        | "draft"
        | "confirmed"
        | "picking"
        | "ready"
        | "packed"
        | "dispatched"
        | "delivered"
        | "cancelled"
        | "void"
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
      product_group_inclusion_type: "auto" | "manual_include" | "manual_exclude"
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
      purchase_order_status:
        | "draft"
        | "submitted"
        | "confirmed"
        | "partially_received"
        | "received"
        | "cancelled"
      resolution_status: "open" | "approved" | "rejected" | "resolved"
      size_container_type: "prop_tray" | "plug_tray" | "pot"
      substitution_status:
        | "requested"
        | "approved"
        | "rejected"
        | "applied"
        | "cancelled"
      transfer_status: "pending" | "approved" | "rejected"
      trial_status: "draft" | "active" | "paused" | "completed" | "archived"
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
      allocation_status_v2: [
        "reserved",
        "allocated",
        "picked",
        "shipped",
        "cancelled",
      ],
      allocation_tier: ["product", "batch"],
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
      interaction_type: ["call", "email", "visit", "whatsapp", "other"],
      inventory_event_type: [
        "PRODUCT_RESERVED",
        "PRODUCT_UNRESERVED",
        "BATCH_ALLOCATED",
        "BATCH_DEALLOCATED",
        "BATCH_PICKED",
        "BATCH_PICK_REVERSED",
        "BATCH_SHIPPED",
        "MANUAL_ADJUSTMENT",
        "SHORTAGE_RECORDED",
        "OVERSELL_RECORDED",
      ],
      invoice_status: ["draft", "issued", "void"],
      material_transaction_type: [
        "receive",
        "consume",
        "adjust",
        "transfer",
        "count",
        "return",
        "scrap",
      ],
      order_status: [
        "draft",
        "confirmed",
        "picking",
        "ready",
        "packed",
        "dispatched",
        "delivered",
        "cancelled",
        "void",
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
      product_group_inclusion_type: [
        "auto",
        "manual_include",
        "manual_exclude",
      ],
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
      purchase_order_status: [
        "draft",
        "submitted",
        "confirmed",
        "partially_received",
        "received",
        "cancelled",
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
      transfer_status: ["pending", "approved", "rejected"],
      trial_status: ["draft", "active", "paused", "completed", "archived"],
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
