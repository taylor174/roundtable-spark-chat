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
      blocks: {
        Row: {
          created_at: string
          id: string
          is_tie_break: boolean
          round_id: string
          suggestion_id: string | null
          table_id: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_tie_break?: boolean
          round_id: string
          suggestion_id?: string | null
          table_id: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          is_tie_break?: boolean
          round_id?: string
          suggestion_id?: string | null
          table_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "suggestions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          message_type: string
          table_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          message_type?: string
          table_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          message_type?: string
          table_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      participants: {
        Row: {
          client_id: string
          display_name: string
          id: string
          is_host: boolean
          is_online: boolean | null
          joined_at: string
          last_seen_at: string | null
          table_id: string
        }
        Insert: {
          client_id: string
          display_name: string
          id?: string
          is_host?: boolean
          is_online?: boolean | null
          joined_at?: string
          last_seen_at?: string | null
          table_id: string
        }
        Update: {
          client_id?: string
          display_name?: string
          id?: string
          is_host?: boolean
          is_online?: boolean | null
          joined_at?: string
          last_seen_at?: string | null
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participants_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rounds: {
        Row: {
          ended_at: string | null
          ends_at: string | null
          id: string
          number: number
          started_at: string
          status: string
          table_id: string
          winner_suggestion_id: string | null
        }
        Insert: {
          ended_at?: string | null
          ends_at?: string | null
          id?: string
          number: number
          started_at?: string
          status?: string
          table_id: string
          winner_suggestion_id?: string | null
        }
        Update: {
          ended_at?: string | null
          ends_at?: string | null
          id?: string
          number?: number
          started_at?: string
          status?: string
          table_id?: string
          winner_suggestion_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rounds_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_winner_suggestion_id_fkey"
            columns: ["winner_suggestion_id"]
            isOneToOne: false
            referencedRelation: "suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestions: {
        Row: {
          created_at: string
          id: string
          participant_id: string
          round_id: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          participant_id: string
          round_id: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          participant_id?: string
          round_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          auto_advance: boolean
          code: string
          created_at: string
          current_round_id: string | null
          default_suggest_sec: number
          default_vote_sec: number
          description: string | null
          host_secret: string
          id: string
          phase_ends_at: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          auto_advance?: boolean
          code: string
          created_at?: string
          current_round_id?: string | null
          default_suggest_sec?: number
          default_vote_sec?: number
          description?: string | null
          host_secret: string
          id?: string
          phase_ends_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          auto_advance?: boolean
          code?: string
          created_at?: string
          current_round_id?: string | null
          default_suggest_sec?: number
          default_vote_sec?: number
          description?: string | null
          host_secret?: string
          id?: string
          phase_ends_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      votes: {
        Row: {
          created_at: string
          id: string
          participant_id: string
          round_id: string
          suggestion_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          participant_id: string
          round_id: string
          suggestion_id: string
        }
        Update: {
          created_at?: string
          id?: string
          participant_id?: string
          round_id?: string
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_proposal_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "suggestions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advance_phase_atomic: {
        Args: { p_client_id: string; p_round_id: string; p_table_id: string }
        Returns: Json
      }
      advance_phase_atomic_v2: {
        Args: { p_client_id: string; p_round_id: string; p_table_id: string }
        Returns: Json
      }
      can_access_table_secrets: {
        Args: { table_id: string }
        Returns: boolean
      }
      cleanup_stale_rounds: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_public_table_info: {
        Args: { table_code?: string }
        Returns: {
          auto_advance: boolean
          code: string
          created_at: string
          current_round_id: string
          default_suggest_sec: number
          default_vote_sec: number
          description: string
          id: string
          phase_ends_at: string
          status: string
          title: string
          updated_at: string
        }[]
      }
      get_safe_table_data: {
        Args: { p_table_code?: string }
        Returns: {
          auto_advance: boolean
          code: string
          created_at: string
          current_round_id: string
          default_suggest_sec: number
          default_vote_sec: number
          description: string
          id: string
          phase_ends_at: string
          status: string
          title: string
          updated_at: string
        }[]
      }
      get_table_host_data: {
        Args: { p_client_id: string; p_table_id: string }
        Returns: {
          auto_advance: boolean
          code: string
          created_at: string
          current_round_id: string
          default_suggest_sec: number
          default_vote_sec: number
          description: string
          host_secret: string
          id: string
          phase_ends_at: string
          status: string
          title: string
          updated_at: string
        }[]
      }
      get_table_public_data: {
        Args: { p_table_id: string }
        Returns: {
          auto_advance: boolean
          code: string
          created_at: string
          current_round_id: string
          default_suggest_sec: number
          default_vote_sec: number
          description: string
          id: string
          phase_ends_at: string
          status: string
          title: string
          updated_at: string
        }[]
      }
      get_table_with_secrets: {
        Args: { p_client_id: string; p_table_id: string }
        Returns: {
          auto_advance: boolean
          code: string
          created_at: string
          current_round_id: string
          default_suggest_sec: number
          default_vote_sec: number
          description: string
          host_secret: string
          id: string
          phase_ends_at: string
          status: string
          title: string
          updated_at: string
        }[]
      }
      is_current_user_host: {
        Args: { table_id: string }
        Returns: boolean
      }
      is_table_host: {
        Args: { p_client_id: string; p_table_id: string }
        Returns: boolean
      }
      is_table_participant: {
        Args: { p_client_id: string; p_table_id: string }
        Returns: boolean
      }
      mark_participant_offline: {
        Args: { p_participant_id: string }
        Returns: undefined
      }
      resolve_tie: {
        Args: {
          p_round_id: string
          p_suggestion_id: string
          p_table_id: string
        }
        Returns: undefined
      }
      start_table_session: {
        Args: { p_table_id: string }
        Returns: {
          ends_at: string
          round_id: string
        }[]
      }
      start_vote_phase_atomic: {
        Args: { p_ends_at: string; p_round_id: string; p_table_id: string }
        Returns: undefined
      }
      submit_vote_with_validation: {
        Args: {
          p_participant_id: string
          p_round_id: string
          p_suggestion_id: string
        }
        Returns: Json
      }
      update_participant_presence: {
        Args: { p_client_id: string; p_table_id: string }
        Returns: undefined
      }
      upsert_block_safe: {
        Args: {
          p_is_tie_break?: boolean
          p_round_id: string
          p_suggestion_id: string
          p_table_id: string
          p_text: string
        }
        Returns: Json
      }
      validate_table_session: {
        Args: { p_client_id: string; p_table_id: string }
        Returns: Json
      }
      verify_host_access: {
        Args: { p_client_id: string; p_table_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
