
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "comments": {
                  Row: {
                    "ai_areas": (Database["public"]['Enums']["ai_area"])[],"body": string,"created_at": string,"deleted_at": string | null,"edited_at": string | null,"evidence_url": string | null,"id": string,"media_id": string,"parent_id": string | null,"status": Database["public"]['Enums']["content_status"],"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_areas"?: (Database["public"]['Enums']["ai_area"])[],"body": string,"created_at"?: string,"deleted_at"?: string | null,"edited_at"?: string | null,"evidence_url"?: string | null,"id"?: string,"media_id": string,"parent_id"?: string | null,"status"?: Database["public"]['Enums']["content_status"],"user_id"?: string | null
                  }
                  Update: {
                    "ai_areas"?: (Database["public"]['Enums']["ai_area"])[],"body"?: string,"created_at"?: string,"deleted_at"?: string | null,"edited_at"?: string | null,"evidence_url"?: string | null,"id"?: string,"media_id"?: string,"parent_id"?: string | null,"status"?: Database["public"]['Enums']["content_status"],"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"contributors": {
                  Row: {
                    "created_at": string,"external_id": string | null,"id": string,"kind": Database["public"]['Enums']["contributor_kind"],"name": string,"source": Database["public"]['Enums']["media_source"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"external_id"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["contributor_kind"],"name": string,"source": Database["public"]['Enums']["media_source"]
                  }
                  Update: {
                    "created_at"?: string,"external_id"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["contributor_kind"],"name"?: string,"source"?: Database["public"]['Enums']["media_source"]
                  }
                  Relationships: [
                    
                  ]
                },"credits": {
                  Row: {
                    "billing_order": number | null,"character_name": string | null,"contributor_id": string,"media_id": string,"role": Database["public"]['Enums']["credit_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "billing_order"?: number | null,"character_name"?: string | null,"contributor_id": string,"media_id": string,"role": Database["public"]['Enums']["credit_role"]
                  }
                  Update: {
                    "billing_order"?: number | null,"character_name"?: string | null,"contributor_id"?: string,"media_id"?: string,"role"?: Database["public"]['Enums']["credit_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "credits_contributor_id_fkey"
      columns: ["contributor_id"]
isOneToOne: false
      referencedRelation: "contributors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "credits_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    }
                  ]
                },"genres": {
                  Row: {
                    "id": number,"kinds": (Database["public"]['Enums']["media_kind"])[],"name": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"kinds": (Database["public"]['Enums']["media_kind"])[],"name": string,"slug": string
                  }
                  Update: {
                    "id"?: never,"kinds"?: (Database["public"]['Enums']["media_kind"])[],"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"media": {
                  Row: {
                    "comments_locked": boolean,"cover_url": string | null,"created_at": string,"created_by": string | null,"external_id": string | null,"id": string,"kind": Database["public"]['Enums']["media_kind"],"merged_into": string | null,"original_title": string | null,"release_year": number | null,"search": unknown,"slug": string,"source": Database["public"]['Enums']["media_source"],"status": Database["public"]['Enums']["content_status"],"synopsis": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comments_locked"?: boolean,"cover_url"?: string | null,"created_at"?: string,"created_by"?: string | null,"external_id"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["media_kind"],"merged_into"?: string | null,"original_title"?: string | null,"release_year"?: number | null,"search"?: never,"slug": string,"source": Database["public"]['Enums']["media_source"],"status"?: Database["public"]['Enums']["content_status"],"synopsis"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "comments_locked"?: boolean,"cover_url"?: string | null,"created_at"?: string,"created_by"?: string | null,"external_id"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["media_kind"],"merged_into"?: string | null,"original_title"?: string | null,"release_year"?: number | null,"search"?: never,"slug"?: string,"source"?: Database["public"]['Enums']["media_source"],"status"?: Database["public"]['Enums']["content_status"],"synopsis"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "media_merged_into_fkey"
      columns: ["merged_into"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    }
                  ]
                },"media_genres": {
                  Row: {
                    "genre_id": number,"media_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "genre_id": number,"media_id": string
                  }
                  Update: {
                    "genre_id"?: number,"media_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_genres_genre_id_fkey"
      columns: ["genre_id"]
isOneToOne: false
      referencedRelation: "genres"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "media_genres_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    }
                  ]
                },"mod_actions": {
                  Row: {
                    "action": Database["public"]['Enums']["mod_action_type"],"actor_id": string | null,"created_at": string,"id": number,"reason": string | null,"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  ComputedFields: never
                  Insert: {
                    "action": Database["public"]['Enums']["mod_action_type"],"actor_id"?: string | null,"created_at"?: string,"id"?: never,"reason"?: string | null,"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["mod_action_type"],"actor_id"?: string | null,"created_at"?: string,"id"?: never,"reason"?: string | null,"target_id"?: string,"target_type"?: Database["public"]['Enums']["report_target"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "mod_actions_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"banned_until": string | null,"created_at": string,"display_name": string | null,"handle": string,"handle_changed_at": string | null,"id": string,"role": Database["public"]['Enums']["user_role"],"show_votes": boolean,"trust_level": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"banned_until"?: string | null,"created_at"?: string,"display_name"?: string | null,"handle": string,"handle_changed_at"?: string | null,"id": string,"role"?: Database["public"]['Enums']["user_role"],"show_votes"?: boolean,"trust_level"?: number,"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"banned_until"?: string | null,"created_at"?: string,"display_name"?: string | null,"handle"?: string,"handle_changed_at"?: string | null,"id"?: string,"role"?: Database["public"]['Enums']["user_role"],"show_votes"?: boolean,"trust_level"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"handled_at": string | null,"handled_by": string | null,"id": string,"note": string | null,"reason": Database["public"]['Enums']["report_reason"],"reporter_id": string | null,"status": Database["public"]['Enums']["report_status"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"note"?: string | null,"reason": Database["public"]['Enums']["report_reason"],"reporter_id"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  Update: {
                    "created_at"?: string,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"note"?: string | null,"reason"?: Database["public"]['Enums']["report_reason"],"reporter_id"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_id"?: string,"target_type"?: Database["public"]['Enums']["report_target"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_handled_by_fkey"
      columns: ["handled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"vote_tallies": {
                  Row: {
                    "counted_total": number | null,"media_id": string,"no_ai": number,"under_review": boolean,"unsure": number,"updated_at": string,"uses_ai": number
                  }
                  ComputedFields: never
                  Insert: {
                    "counted_total"?: never,"media_id": string,"no_ai"?: number,"under_review"?: boolean,"unsure"?: number,"updated_at"?: string,"uses_ai"?: number
                  }
                  Update: {
                    "counted_total"?: never,"media_id"?: string,"no_ai"?: number,"under_review"?: boolean,"unsure"?: number,"updated_at"?: string,"uses_ai"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "vote_tallies_media_id_fkey"
      columns: ["media_id"]
isOneToOne: true
      referencedRelation: "media"
      referencedColumns: ["id"]
    }
                  ]
                },"votes": {
                  Row: {
                    "created_at": string,"media_id": string,"updated_at": string,"user_id": string,"value": Database["public"]['Enums']["vote_value"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"media_id": string,"updated_at"?: string,"user_id"?: string,"value": Database["public"]['Enums']["vote_value"]
                  }
                  Update: {
                    "created_at"?: string,"media_id"?: string,"updated_at"?: string,"user_id"?: string,"value"?: Database["public"]['Enums']["vote_value"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "votes_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "votes_user_id_fkey"
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
            "browse_media":
{ Args: { "p_genre"?: string,"p_kind"?: Database["public"]['Enums']["media_kind"],"p_limit"?: number,"p_offset"?: number,"p_q"?: string,"p_sort"?: string }; Returns: {
              "counted_total": number,"cover_url": string,"created_at": string,"genres": (string)[],"id": string,"kind": Database["public"]['Enums']["media_kind"],"no_ai": number,"release_year": number,"slug": string,"title": string,"unsure": number,"uses_ai": number
            }[]
                           },
"cast_vote":
{ Args: { "p_media": string,"p_value": Database["public"]['Enums']["vote_value"] }; Returns: Database["public"]['Enums']["vote_value"]
                           },
"create_media":
{ Args: { "p": Json }; Returns: {
              "existing": boolean,"id": string,"slug": string,"status": Database["public"]['Enums']["content_status"]
            }[]
                           },
"handle_available":
{ Args: { "p_handle": string }; Returns: boolean
                           },
"mod_profile_cards":
{ Args: { "p_ids": (string)[] }; Returns: {
              "banned_until": string,"display_name": string,"handle": string,"id": string,"role": Database["public"]['Enums']["user_role"],"trust_level": number
            }[]
                           },
"moderate":
{ Args: { "p_action": Database["public"]['Enums']["mod_action_type"],"p_reason"?: string,"p_target": string,"p_target_type": Database["public"]['Enums']["report_target"],"p_value"?: number }; Returns: number
                           },
"my_comment_count":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"my_profile":
{ Args: Record<PropertyKey, never>; Returns: {
              "avatar_path": string,"banned_until": string,"created_at": string,"display_name": string,"email_verified": boolean,"handle": string,"handle_changed_at": string,"id": string,"role": Database["public"]['Enums']["user_role"],"show_votes": boolean,"trust_level": number
            }[]
                           },
"profile_stats":
{ Args: { "p_user": string }; Returns: {
              "comment_count": number,"titles_added": number,"vote_count": number
            }[]
                           },
"rate_limit_check":
{ Args: { "p_bucket": string }; Returns: undefined
                           },
"refresh_trust_levels":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"related_media":
{ Args: { "p_limit"?: number,"p_media": string }; Returns: {
              "cover_url": string,"id": string,"kind": Database["public"]['Enums']["media_kind"],"release_year": number,"shared_genres": number,"shared_people": (string)[],"slug": string,"title": string
            }[]
                           },
"sitemap_media":
{ Args: { "p_limit"?: number,"p_offset"?: number }; Returns: {
              "slug": string,"updated_at": string
            }[]
                           }
          }
          Enums: {
            "ai_area": "writing"|"visuals"|"cover_art"|"voice"|"music"|"translation"|"marketing"|"other","content_status": "published"|"pending"|"hidden"|"removed","contributor_kind": "person"|"company","credit_role": "actor"|"director"|"creator"|"writer"|"showrunner"|"composer"|"author"|"illustrator"|"translator"|"studio"|"network"|"publisher","media_kind": "movie"|"tv_show"|"book","media_source": "tmdb"|"openlibrary"|"manual","mod_action_type": "hide"|"restore"|"remove"|"ban"|"unban"|"set_trust"|"set_role"|"merge"|"edit"|"lock_comments"|"dismiss_report","report_reason": "spam"|"harassment"|"unsupported_claim"|"duplicate"|"wrong_details"|"other","report_status": "open"|"actioned"|"dismissed","report_target": "media"|"comment"|"profile","user_role": "user"|"moderator"|"admin","vote_value": "uses_ai"|"no_ai"|"unsure"
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
  "public": {
          Enums: {
            "ai_area": ["writing", "visuals", "cover_art", "voice", "music", "translation", "marketing", "other"],"content_status": ["published", "pending", "hidden", "removed"],"contributor_kind": ["person", "company"],"credit_role": ["actor", "director", "creator", "writer", "showrunner", "composer", "author", "illustrator", "translator", "studio", "network", "publisher"],"media_kind": ["movie", "tv_show", "book"],"media_source": ["tmdb", "openlibrary", "manual"],"mod_action_type": ["hide", "restore", "remove", "ban", "unban", "set_trust", "set_role", "merge", "edit", "lock_comments", "dismiss_report"],"report_reason": ["spam", "harassment", "unsupported_claim", "duplicate", "wrong_details", "other"],"report_status": ["open", "actioned", "dismissed"],"report_target": ["media", "comment", "profile"],"user_role": ["user", "moderator", "admin"],"vote_value": ["uses_ai", "no_ai", "unsure"]
          }
        }
} as const
