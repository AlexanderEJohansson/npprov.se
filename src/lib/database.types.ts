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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      anvandare: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          namn: string | null
          roll: string | null
          verified_larare: boolean | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          namn?: string | null
          roll?: string | null
          verified_larare?: boolean | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          namn?: string | null
          roll?: string | null
          verified_larare?: boolean | null
        }
        Relationships: []
      }
      community_forklaring: {
        Row: {
          created_at: string | null
          forfattare: string | null
          forfattare_roll: string | null
          fraga_id: string
          id: string
          moderated_at: string | null
          moderated_by: string | null
          moderation_note: string | null
          status: Database["public"]["Enums"]["forklaring_status"] | null
          text: string
          upvotes: number | null
        }
        Insert: {
          created_at?: string | null
          forfattare?: string | null
          forfattare_roll?: string | null
          fraga_id: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          status?: Database["public"]["Enums"]["forklaring_status"] | null
          text: string
          upvotes?: number | null
        }
        Update: {
          created_at?: string | null
          forfattare?: string | null
          forfattare_roll?: string | null
          fraga_id?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          status?: Database["public"]["Enums"]["forklaring_status"] | null
          text?: string
          upvotes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "community_forklaring_fraga_id_fkey"
            columns: ["fraga_id"]
            isOneToOne: false
            referencedRelation: "fraga"
            referencedColumns: ["id"]
          },
        ]
      }
      delprov: {
        Row: {
          audio_url: string | null
          beskrivning: string | null
          beteckning: string
          created_at: string | null
          id: string
          max_poang: number | null
          ordning: number | null
          pdf_url: string | null
          prov_id: string
          tid_minuter: number | null
          titel: string | null
        }
        Insert: {
          audio_url?: string | null
          beskrivning?: string | null
          beteckning: string
          created_at?: string | null
          id?: string
          max_poang?: number | null
          ordning?: number | null
          pdf_url?: string | null
          prov_id: string
          tid_minuter?: number | null
          titel?: string | null
        }
        Update: {
          audio_url?: string | null
          beskrivning?: string | null
          beteckning?: string
          created_at?: string | null
          id?: string
          max_poang?: number | null
          ordning?: number | null
          pdf_url?: string | null
          prov_id?: string
          tid_minuter?: number | null
          titel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delprov_prov_id_fkey"
            columns: ["prov_id"]
            isOneToOne: false
            referencedRelation: "prov"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delprov_prov_id_fkey"
            columns: ["prov_id"]
            isOneToOne: false
            referencedRelation: "prov_med_statistik"
            referencedColumns: ["id"]
          },
        ]
      }
      fraga: {
        Row: {
          bild_url: string | null
          created_at: string | null
          delprov_id: string
          fraga_nummer: string
          historiska_varianter: Json | null
          human_reviewed: boolean | null
          id: string
          kalla: string | null
          korrekt_svar: string | null
          last_updated: string | null
          max_poang: number | null
          search_vector: unknown
          svarighetsgrad: number | null
          svarsalternativ_json: Json | null
          svarstyp: string | null
          tabell_json: Json | null
          text: string
          typ: Database["public"]["Enums"]["fraga_typ"]
          vanliga_missforstand: string | null
          varfor_viktig: string | null
        }
        Insert: {
          bild_url?: string | null
          created_at?: string | null
          delprov_id: string
          fraga_nummer: string
          historiska_varianter?: Json | null
          human_reviewed?: boolean | null
          id?: string
          kalla?: string | null
          korrekt_svar?: string | null
          last_updated?: string | null
          max_poang?: number | null
          search_vector?: unknown
          svarighetsgrad?: number | null
          svarsalternativ_json?: Json | null
          svarstyp?: string | null
          tabell_json?: Json | null
          text: string
          typ: Database["public"]["Enums"]["fraga_typ"]
          vanliga_missforstand?: string | null
          varfor_viktig?: string | null
        }
        Update: {
          bild_url?: string | null
          created_at?: string | null
          delprov_id?: string
          fraga_nummer?: string
          historiska_varianter?: Json | null
          human_reviewed?: boolean | null
          id?: string
          kalla?: string | null
          korrekt_svar?: string | null
          last_updated?: string | null
          max_poang?: number | null
          search_vector?: unknown
          svarighetsgrad?: number | null
          svarsalternativ_json?: Json | null
          svarstyp?: string | null
          tabell_json?: Json | null
          text?: string
          typ?: Database["public"]["Enums"]["fraga_typ"]
          vanliga_missforstand?: string | null
          varfor_viktig?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fraga_delprov_id_fkey"
            columns: ["delprov_id"]
            isOneToOne: false
            referencedRelation: "delprov"
            referencedColumns: ["id"]
          },
        ]
      }
      fraga_kunskapsmal: {
        Row: {
          added_by: string | null
          created_at: string | null
          fraga_id: string
          kommentar: string | null
          kunskapsmal_id: string
          styrka: number | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string | null
          fraga_id: string
          kommentar?: string | null
          kunskapsmal_id: string
          styrka?: number | null
        }
        Update: {
          added_by?: string | null
          created_at?: string | null
          fraga_id?: string
          kommentar?: string | null
          kunskapsmal_id?: string
          styrka?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fraga_kunskapsmal_fraga_id_fkey"
            columns: ["fraga_id"]
            isOneToOne: false
            referencedRelation: "fraga"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraga_kunskapsmal_kunskapsmal_id_fkey"
            columns: ["kunskapsmal_id"]
            isOneToOne: false
            referencedRelation: "kunskapsmal"
            referencedColumns: ["id"]
          },
        ]
      }
      kunskapsmal: {
        Row: {
          amne: Database["public"]["Enums"]["prov_amn"] | null
          arskurs_kurs: string | null
          beskrivning: string
          created_at: string | null
          foralder_id: string | null
          id: string
          kod: string
          kurs: string
          lgr22_gy25_referens: string | null
        }
        Insert: {
          amne?: Database["public"]["Enums"]["prov_amn"] | null
          arskurs_kurs?: string | null
          beskrivning: string
          created_at?: string | null
          foralder_id?: string | null
          id?: string
          kod: string
          kurs: string
          lgr22_gy25_referens?: string | null
        }
        Update: {
          amne?: Database["public"]["Enums"]["prov_amn"] | null
          arskurs_kurs?: string | null
          beskrivning?: string
          created_at?: string | null
          foralder_id?: string | null
          id?: string
          kod?: string
          kurs?: string
          lgr22_gy25_referens?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kunskapsmal_foralder_id_fkey"
            columns: ["foralder_id"]
            isOneToOne: false
            referencedRelation: "kunskapsmal"
            referencedColumns: ["id"]
          },
        ]
      }
      prov: {
        Row: {
          amne: Database["public"]["Enums"]["prov_amn"]
          antal_delprov: number | null
          ar: number
          arskurs_kurs: Database["public"]["Enums"]["prov_arskurs"]
          audio_urls: Json | null
          beskrivning: string | null
          created_at: string | null
          extra_files: Json | null
          human_reviewed: boolean | null
          id: string
          kalla: string
          kalla_url: string | null
          last_updated: string | null
          max_poang_total: number | null
          metadata: Json | null
          pdf_url: string | null
          publicerad_datum: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string
          termin: string | null
          titel: string
          typ: Database["public"]["Enums"]["prov_typ"]
          updated_at: string | null
          zip_url: string | null
        }
        Insert: {
          amne: Database["public"]["Enums"]["prov_amn"]
          antal_delprov?: number | null
          ar: number
          arskurs_kurs: Database["public"]["Enums"]["prov_arskurs"]
          audio_urls?: Json | null
          beskrivning?: string | null
          created_at?: string | null
          extra_files?: Json | null
          human_reviewed?: boolean | null
          id?: string
          kalla?: string
          kalla_url?: string | null
          last_updated?: string | null
          max_poang_total?: number | null
          metadata?: Json | null
          pdf_url?: string | null
          publicerad_datum?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug: string
          termin?: string | null
          titel: string
          typ: Database["public"]["Enums"]["prov_typ"]
          updated_at?: string | null
          zip_url?: string | null
        }
        Update: {
          amne?: Database["public"]["Enums"]["prov_amn"]
          antal_delprov?: number | null
          ar?: number
          arskurs_kurs?: Database["public"]["Enums"]["prov_arskurs"]
          audio_urls?: Json | null
          beskrivning?: string | null
          created_at?: string | null
          extra_files?: Json | null
          human_reviewed?: boolean | null
          id?: string
          kalla?: string
          kalla_url?: string | null
          last_updated?: string | null
          max_poang_total?: number | null
          metadata?: Json | null
          pdf_url?: string | null
          publicerad_datum?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string
          termin?: string | null
          titel?: string
          typ?: Database["public"]["Enums"]["prov_typ"]
          updated_at?: string | null
          zip_url?: string | null
        }
        Relationships: []
      }
      trend_analys: {
        Row: {
          amne: Database["public"]["Enums"]["prov_amn"] | null
          andel_godkant: number | null
          ar: number | null
          arskurs_kurs: string | null
          forvantad_svarighet_gy25: string | null
          id: string
          kalla: string | null
          kalla_url: string | null
          last_updated: string | null
          medelresultat: number | null
          svarighetsindex: number | null
          trend_kommentar: string | null
        }
        Insert: {
          amne?: Database["public"]["Enums"]["prov_amn"] | null
          andel_godkant?: number | null
          ar?: number | null
          arskurs_kurs?: string | null
          forvantad_svarighet_gy25?: string | null
          id?: string
          kalla?: string | null
          kalla_url?: string | null
          last_updated?: string | null
          medelresultat?: number | null
          svarighetsindex?: number | null
          trend_kommentar?: string | null
        }
        Update: {
          amne?: Database["public"]["Enums"]["prov_amn"] | null
          andel_godkant?: number | null
          ar?: number | null
          arskurs_kurs?: string | null
          forvantad_svarighet_gy25?: string | null
          id?: string
          kalla?: string | null
          kalla_url?: string | null
          last_updated?: string | null
          medelresultat?: number | null
          svarighetsindex?: number | null
          trend_kommentar?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      prov_med_statistik: {
        Row: {
          amne: Database["public"]["Enums"]["prov_amn"] | null
          antal_delprov: number | null
          antal_delprov_riktiga: number | null
          antal_fragor: number | null
          ar: number | null
          arskurs_kurs: Database["public"]["Enums"]["prov_arskurs"] | null
          audio_urls: Json | null
          beskrivning: string | null
          created_at: string | null
          extra_files: Json | null
          human_reviewed: boolean | null
          id: string | null
          kalla: string | null
          kalla_url: string | null
          last_updated: string | null
          max_poang_total: number | null
          metadata: Json | null
          pdf_url: string | null
          publicerad_datum: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string | null
          termin: string | null
          titel: string | null
          typ: Database["public"]["Enums"]["prov_typ"] | null
          updated_at: string | null
          zip_url: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      forklaring_status: "pending" | "approved" | "rejected" | "needs_revision"
      fraga_typ:
        | "flerval"
        | "kort_svar"
        | "lang_svar"
        | "muntlig"
        | "lyssna"
        | "lasa"
        | "skriva"
        | "ovrigt"
      prov_amn:
        | "Matematik"
        | "Svenska"
        | "Svenska som andraspråk"
        | "Engelska"
        | "Biologi"
        | "Fysik"
        | "Kemi"
        | "Historia"
        | "Geografi"
        | "Samhällskunskap"
        | "Religionskunskap"
        | "Moderna språk"
      prov_arskurs: "ak3" | "ak6" | "ak9" | "gy"
      prov_typ:
        | "hela"
        | "delprov"
        | "exempel"
        | "bedomningsunderlag"
        | "bedomningsanvisningar"
        | "lararinformation"
        | "ovrigt"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      forklaring_status: ["pending", "approved", "rejected", "needs_revision"],
      fraga_typ: [
        "flerval",
        "kort_svar",
        "lang_svar",
        "muntlig",
        "lyssna",
        "lasa",
        "skriva",
        "ovrigt",
      ],
      prov_amn: [
        "Matematik",
        "Svenska",
        "Svenska som andraspråk",
        "Engelska",
        "Biologi",
        "Fysik",
        "Kemi",
        "Historia",
        "Geografi",
        "Samhällskunskap",
        "Religionskunskap",
        "Moderna språk",
      ],
      prov_arskurs: ["ak3", "ak6", "ak9", "gy"],
      prov_typ: [
        "hela",
        "delprov",
        "exempel",
        "bedomningsunderlag",
        "bedomningsanvisningar",
        "lararinformation",
        "ovrigt",
      ],
    },
  },
} as const
