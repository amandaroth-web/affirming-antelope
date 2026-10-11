
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity_completions": {
                  Row: {
                    "activity_id": string | null,"client_id": string,"completed_at": string,"id": string,"kind": string,"minutes": number,"ref_id": string,"skill": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id"?: string | null,"client_id": string,"completed_at"?: string,"id"?: string,"kind": string,"minutes"?: number,"ref_id": string,"skill"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "activity_id"?: string | null,"client_id"?: string,"completed_at"?: string,"id"?: string,"kind"?: string,"minutes"?: number,"ref_id"?: string,"skill"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_completions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"assignment_items": {
                  Row: {
                    "assignment_id": string,"id": string,"kind": string,"position": number,"quantity": number,"ref_id": string | null,"skill": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assignment_id": string,"id"?: string,"kind": string,"position"?: number,"quantity"?: number,"ref_id"?: string | null,"skill"?: string | null
                  }
                  Update: {
                    "assignment_id"?: string,"id"?: string,"kind"?: string,"position"?: number,"quantity"?: number,"ref_id"?: string | null,"skill"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "assignment_items_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "assignments"
      referencedColumns: ["id"]
    }
                  ]
                },"assignments": {
                  Row: {
                    "archived_at": string | null,"cohort_id": string,"created_at": string,"created_by": string | null,"due_at": string | null,"id": string,"instructions": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"cohort_id": string,"created_at"?: string,"created_by"?: string | null,"due_at"?: string | null,"id"?: string,"instructions"?: string,"title": string
                  }
                  Update: {
                    "archived_at"?: string | null,"cohort_id"?: string,"created_at"?: string,"created_by"?: string | null,"due_at"?: string | null,"id"?: string,"instructions"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assignments_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "cohorts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assignments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cohort_members": {
                  Row: {
                    "cohort_id": string,"joined_at": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cohort_id": string,"joined_at"?: string,"role"?: string,"user_id": string
                  }
                  Update: {
                    "cohort_id"?: string,"joined_at"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cohort_members_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "cohorts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cohort_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cohorts": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"join_code": string,"name": string,"pathway_id": string,"starts_on": string | null,"trainer_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"join_code": string,"name": string,"pathway_id"?: string,"starts_on"?: string | null,"trainer_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"join_code"?: string,"name"?: string,"pathway_id"?: string,"starts_on"?: string | null,"trainer_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cohorts_trainer_id_fkey"
      columns: ["trainer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"learner_state": {
                  Row: {
                    "state": NonNullable<Json>,"updated_at": string,"user_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "state"?: NonNullable<Json>,"updated_at"?: string,"user_id"?: string,"version"?: number
                  }
                  Update: {
                    "state"?: NonNullable<Json>,"updated_at"?: string,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "learner_state_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"practice_sessions": {
                  Row: {
                    "client_id": string,"debrief": Json | null,"duration_sec": number | null,"ended_at": string | null,"id": string,"kind": string,"mode": string,"ref_id": string,"self_reflection": Json | null,"skill": string | null,"started_at": string,"transcript": NonNullable<Json>,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"debrief"?: Json | null,"duration_sec"?: number | null,"ended_at"?: string | null,"id"?: string,"kind": string,"mode"?: string,"ref_id": string,"self_reflection"?: Json | null,"skill"?: string | null,"started_at"?: string,"transcript"?: NonNullable<Json>,"user_id"?: string
                  }
                  Update: {
                    "client_id"?: string,"debrief"?: Json | null,"duration_sec"?: number | null,"ended_at"?: string | null,"id"?: string,"kind"?: string,"mode"?: string,"ref_id"?: string,"self_reflection"?: Json | null,"skill"?: string | null,"started_at"?: string,"transcript"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "practice_sessions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "can_train": boolean,"created_at": string,"display_name": string,"display_name_set": boolean,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "can_train"?: boolean,"created_at"?: string,"display_name": string,"display_name_set"?: boolean,"id": string
                  }
                  Update: {
                    "can_train"?: boolean,"created_at"?: string,"display_name"?: string,"display_name_set"?: boolean,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reviews": {
                  Row: {
                    "audio_path": string | null,"created_at": string,"feedback": string,"id": string,"learner_seen_at": string | null,"rating": string | null,"recommended_kind": string | null,"recommended_ref": string | null,"submission_id": string,"trainer_id": string,"try_again": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audio_path"?: string | null,"created_at"?: string,"feedback"?: string,"id"?: string,"learner_seen_at"?: string | null,"rating"?: string | null,"recommended_kind"?: string | null,"recommended_ref"?: string | null,"submission_id": string,"trainer_id"?: string,"try_again"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "audio_path"?: string | null,"created_at"?: string,"feedback"?: string,"id"?: string,"learner_seen_at"?: string | null,"rating"?: string | null,"recommended_kind"?: string | null,"recommended_ref"?: string | null,"submission_id"?: string,"trainer_id"?: string,"try_again"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: true
      referencedRelation: "submissions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_trainer_id_fkey"
      columns: ["trainer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"submissions": {
                  Row: {
                    "cohort_id": string,"id": string,"note_to_trainer": string | null,"reviewed_at": string | null,"session_id": string,"status": string,"submitted_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cohort_id": string,"id"?: string,"note_to_trainer"?: string | null,"reviewed_at"?: string | null,"session_id": string,"status"?: string,"submitted_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "cohort_id"?: string,"id"?: string,"note_to_trainer"?: string | null,"reviewed_at"?: string | null,"session_id"?: string,"status"?: string,"submitted_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "submissions_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "cohorts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "submissions_session_id_user_id_fkey"
      columns: ["session_id","user_id"]
isOneToOne: false
      referencedRelation: "practice_sessions"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "submissions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "assignment_progress":
{ Args: { "assignment_id": string }; Returns: {
              "display_name": string,"done": number,"item_id": string,"quantity": number,"user_id": string
            }[]
                           },
"claim_trainer":
{ Args: { "code": string }; Returns: boolean
                           },
"cohort_member_stats":
{ Args: { "cohort_id": string }; Returns: {
              "assigned": number,"completed": number,"display_name": string,"last_active_at": string,"needs_review": number,"user_id": string
            }[]
                           },
"consume_ai_quota":
{ Args: { "bucket": string }; Returns: Json
                           },
"consume_legacy_ai_quota":
{ Args: { "bucket": string,"ip_hash": string }; Returns: Json
                           },
"create_cohort":
{ Args: { "name": string,"pathway_id"?: string,"starts_on"?: string }; Returns: {
              "archived_at": string | null,
"created_at": string,
"id": string,
"join_code": string,
"name": string,
"pathway_id": string,
"starts_on": string | null,
"trainer_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "cohorts"
        isOneToOne: true
        isSetofReturn: false
      } },
"join_cohort":
{ Args: { "code": string }; Returns: {
              "archived_at": string | null,
"created_at": string,
"id": string,
"join_code": string,
"name": string,
"pathway_id": string,
"starts_on": string | null,
"trainer_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "cohorts"
        isOneToOne: true
        isSetofReturn: false
      } },
"merge_anonymous_user":
{ Args: { "account_version"?: number,"anonymous_id": string,"merged_state"?: Json,"permanent_id": string }; Returns: Json
                           },
"rotate_join_code":
{ Args: { "cohort_id": string }; Returns: string
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
