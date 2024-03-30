export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      campaign_contacts: {
        Row: {
          campaign_id: number
          contact_id: number
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: number
          contact_id: number
          sent_at?: string | null
          status: string
        }
        Update: {
          campaign_id?: number
          contact_id?: number
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "campaign_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["contact_id"]
          },
        ]
      }
      campaigns: {
        Row: {
          campaign_id: number
          created_at: string | null
          description: string | null
          name: string
          project_id: number | null
          status: string
          template_id: number | null
          updated_at: string | null
        }
        Insert: {
          campaign_id?: number
          created_at?: string | null
          description?: string | null
          name: string
          project_id?: number | null
          status: string
          template_id?: number | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: number
          created_at?: string | null
          description?: string | null
          name?: string
          project_id?: number | null
          status?: string
          template_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["template_id"]
          },
        ]
      }
      contact_list_members: {
        Row: {
          contact_id: number
          contact_list_id: number
        }
        Insert: {
          contact_id: number
          contact_list_id: number
        }
        Update: {
          contact_id?: number
          contact_list_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "contact_list_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "contact_list_members_contact_list_id_fkey"
            columns: ["contact_list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["contact_list_id"]
          },
        ]
      }
      contact_lists: {
        Row: {
          contact_list_id: number
          created_at: string | null
          description: string | null
          name: string
          project_id: number | null
        }
        Insert: {
          contact_list_id?: number
          created_at?: string | null
          description?: string | null
          name: string
          project_id?: number | null
        }
        Update: {
          contact_list_id?: number
          created_at?: string | null
          description?: string | null
          name?: string
          project_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_contact_lists_projects"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["project_id"]
          },
        ]
      }
      contacts: {
        Row: {
          contact_id: number
          created_at: string | null
          email: string | null
          name: string
          phone: string | null
          profile_picture: string | null
          wa_id: string
        }
        Insert: {
          contact_id?: number
          created_at?: string | null
          email?: string | null
          name: string
          phone?: string | null
          profile_picture?: string | null
          wa_id: string
        }
        Update: {
          contact_id?: number
          created_at?: string | null
          email?: string | null
          name?: string
          phone?: string | null
          profile_picture?: string | null
          wa_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          contact_id: number | null
          conversation_id: number
          current_window_id: number | null
          last_message_id: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          contact_id?: number | null
          conversation_id?: number
          current_window_id?: number | null
          last_message_id?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          contact_id?: number | null
          conversation_id?: number
          current_window_id?: number | null
          last_message_id?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "conversations_last_message_id_fkey"
            columns: ["last_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["message_id"]
          },
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          integration_id: number
          integration_type: string
          settings: Json | null
          user_id: string | null
        }
        Insert: {
          integration_id?: number
          integration_type: string
          settings?: Json | null
          user_id?: string | null
        }
        Update: {
          integration_id?: number
          integration_type?: string
          settings?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_status_updates: {
        Row: {
          error_code: string | null
          error_description: string | null
          message_id: number | null
          status: string
          timestamp: string | null
          update_id: number
        }
        Insert: {
          error_code?: string | null
          error_description?: string | null
          message_id?: number | null
          status: string
          timestamp?: string | null
          update_id?: number
        }
        Update: {
          error_code?: string | null
          error_description?: string | null
          message_id?: number | null
          status?: string
          timestamp?: string | null
          update_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "message_status_updates_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["message_id"]
          },
        ]
      }
      message_window: {
        Row: {
          closed_at: string | null
          contact_id: number | null
          opened_at: string | null
          window_id: number
        }
        Insert: {
          closed_at?: string | null
          contact_id?: number | null
          opened_at?: string | null
          window_id?: number
        }
        Update: {
          closed_at?: string | null
          contact_id?: number | null
          opened_at?: string | null
          window_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "message_window_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["contact_id"]
          },
        ]
      }
      messages: {
        Row: {
          contact_id: number
          content: string
          created_at: string | null
          message_id: number
          message_type: string
          phone_number_id: number | null
          status: string | null
          wa_message_id: string | null
        }
        Insert: {
          contact_id: number
          content: string
          created_at?: string | null
          message_id?: number
          message_type: string
          phone_number_id?: number | null
          status?: string | null
          wa_message_id?: string | null
        }
        Update: {
          contact_id?: number
          content?: string
          created_at?: string | null
          message_id?: number
          message_type?: string
          phone_number_id?: number | null
          status?: string | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["phone_number_id"]
          },
          {
            foreignKeyName: "public_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["contact_id"]
          },
        ]
      }
      phone_numbers: {
        Row: {
          created_at: string | null
          number: string
          phone_number_id: number
          quality_rating: string | null
          waba_id: number | null
        }
        Insert: {
          created_at?: string | null
          number: string
          phone_number_id?: number
          quality_rating?: string | null
          waba_id?: number | null
        }
        Update: {
          created_at?: string | null
          number?: string
          phone_number_id?: number
          quality_rating?: string | null
          waba_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "public_phone_numbers_waba_id_fkey"
            columns: ["waba_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_business_accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          description: string | null
          name: string
          project_id: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          name: string
          project_id?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          name?: string
          project_id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      quality_metrics: {
        Row: {
          delivered_count: number | null
          metric_id: number
          phone_number_id: number | null
          read_count: number | null
          timestamp: string | null
          user_feedback: string | null
        }
        Insert: {
          delivered_count?: number | null
          metric_id?: number
          phone_number_id?: number | null
          read_count?: number | null
          timestamp?: string | null
          user_feedback?: string | null
        }
        Update: {
          delivered_count?: number | null
          metric_id?: number
          phone_number_id?: number | null
          read_count?: number | null
          timestamp?: string | null
          user_feedback?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_metrics_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["phone_number_id"]
          },
        ]
      }
      template_approval_history: {
        Row: {
          history_id: number
          notes: string | null
          status: string
          template_id: number | null
          timestamp: string | null
        }
        Insert: {
          history_id?: number
          notes?: string | null
          status: string
          template_id?: number | null
          timestamp?: string | null
        }
        Update: {
          history_id?: number
          notes?: string | null
          status?: string
          template_id?: number | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_approval_history_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["template_id"]
          },
        ]
      }
      templates: {
        Row: {
          account_id: number | null
          approval_status: string
          content: string
          created_at: string | null
          name: string
          project_id: number | null
          rejection_reason: string | null
          template_id: number
        }
        Insert: {
          account_id?: number | null
          approval_status: string
          content: string
          created_at?: string | null
          name: string
          project_id?: number | null
          rejection_reason?: string | null
          template_id?: number
        }
        Update: {
          account_id?: number | null
          approval_status?: string
          content?: string
          created_at?: string | null
          name?: string
          project_id?: number | null
          rejection_reason?: string | null
          template_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "templates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_business_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["project_id"]
          },
        ]
      }
      whatsapp_business_accounts: {
        Row: {
          account_id: number
          created_at: string | null
          name: string | null
          updated_at: string | null
          waba_id: string
        }
        Insert: {
          account_id?: number
          created_at?: string | null
          name?: string | null
          updated_at?: string | null
          waba_id: string
        }
        Update: {
          account_id?: number
          created_at?: string | null
          name?: string | null
          updated_at?: string | null
          waba_id?: string
        }
        Relationships: []
      }
      workflow_steps: {
        Row: {
          sequence: number
          step_data: string | null
          step_id: number
          step_type: string
          workflow_id: number | null
        }
        Insert: {
          sequence: number
          step_data?: string | null
          step_id?: number
          step_type: string
          workflow_id?: number | null
        }
        Update: {
          sequence?: number
          step_data?: string | null
          step_id?: number
          step_type?: string
          workflow_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["workflow_id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string | null
          description: string | null
          is_active: boolean | null
          name: string
          user_id: string | null
          workflow_id: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          is_active?: boolean | null
          name: string
          user_id?: string | null
          workflow_id?: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          is_active?: boolean | null
          name?: string
          user_id?: string | null
          workflow_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never
