
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "agencies": {
                  Row: {
                    "created_at": string,"created_by": string | null,"domain": string | null,"fee_cents": number | null,"icon_url": string | null,"id": string,"logo_dark_url": string | null,"logo_light_url": string | null,"name": string,"payment_model": string | null,"slug": string,"status": string,"theme": Json | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"domain"?: string | null,"fee_cents"?: number | null,"icon_url"?: string | null,"id"?: string,"logo_dark_url"?: string | null,"logo_light_url"?: string | null,"name": string,"payment_model"?: string | null,"slug": string,"status"?: string,"theme"?: Json | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"domain"?: string | null,"fee_cents"?: number | null,"icon_url"?: string | null,"id"?: string,"logo_dark_url"?: string | null,"logo_light_url"?: string | null,"name"?: string,"payment_model"?: string | null,"slug"?: string,"status"?: string,"theme"?: Json | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"agency_id": string | null,"client_id": string | null,"created_at": string,"detail": NonNullable<Json>,"id": number,"target_id": string | null,"target_type": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"agency_id"?: string | null,"client_id"?: string | null,"created_at"?: string,"detail"?: NonNullable<Json>,"id"?: never,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"agency_id"?: string | null,"client_id"?: string | null,"created_at"?: string,"detail"?: NonNullable<Json>,"id"?: never,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_agency_id_fkey"
      columns: ["agency_id"]
isOneToOne: false
      referencedRelation: "agencies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_log_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"avatar_knowledge": {
                  Row: {
                    "avatar_id": string,"last_error": string | null,"needs_refresh": boolean,"page_token": string,"published_at": string | null,"tavus_document_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_id": string,"last_error"?: string | null,"needs_refresh"?: boolean,"page_token": string,"published_at"?: string | null,"tavus_document_id"?: string | null
                  }
                  Update: {
                    "avatar_id"?: string,"last_error"?: string | null,"needs_refresh"?: boolean,"page_token"?: string,"published_at"?: string | null,"tavus_document_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "avatar_knowledge_avatar_id_fkey"
      columns: ["avatar_id"]
isOneToOne: true
      referencedRelation: "avatars"
      referencedColumns: ["id"]
    }
                  ]
                },"avatar_secrets": {
                  Row: {
                    "avatar_id": string,"callback_secret": string,"webhook_token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_id": string,"callback_secret": string,"webhook_token": string
                  }
                  Update: {
                    "avatar_id"?: string,"callback_secret"?: string,"webhook_token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "avatar_secrets_avatar_id_fkey"
      columns: ["avatar_id"]
isOneToOne: true
      referencedRelation: "avatars"
      referencedColumns: ["id"]
    }
                  ]
                },"avatars": {
                  Row: {
                    "client_id": string,"custom_photo_url": string | null,"display_name": string,"id": string,"last_event_at": string | null,"linked_at": string,"linked_by": string | null,"photo_url": string | null,"previous_callback_url": string | null,"role_label": string | null,"tavus_pal_id": string,"unlinked_at": string | null,"webhook_configured_at": string | null,"webhook_error": string | null,"webhook_status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"custom_photo_url"?: string | null,"display_name": string,"id"?: string,"last_event_at"?: string | null,"linked_at"?: string,"linked_by"?: string | null,"photo_url"?: string | null,"previous_callback_url"?: string | null,"role_label"?: string | null,"tavus_pal_id": string,"unlinked_at"?: string | null,"webhook_configured_at"?: string | null,"webhook_error"?: string | null,"webhook_status"?: string
                  }
                  Update: {
                    "client_id"?: string,"custom_photo_url"?: string | null,"display_name"?: string,"id"?: string,"last_event_at"?: string | null,"linked_at"?: string,"linked_by"?: string | null,"photo_url"?: string | null,"previous_callback_url"?: string | null,"role_label"?: string | null,"tavus_pal_id"?: string,"unlinked_at"?: string | null,"webhook_configured_at"?: string | null,"webhook_error"?: string | null,"webhook_status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "avatars_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "avatars_tavus_pal_id_fkey"
      columns: ["tavus_pal_id"]
isOneToOne: false
      referencedRelation: "tavus_pals"
      referencedColumns: ["pal_id"]
    }
                  ]
                },"client_billing": {
                  Row: {
                    "cancel_at_period_end": boolean,"cancel_reason": string | null,"cancel_requested_at": string | null,"client_id": string,"current_period_end": string | null,"current_period_start": string | null,"paused_deployments": NonNullable<Json>,"paused_for_usage_at": string | null,"plan_id": string | null,"status": string,"stripe_customer_id": string | null,"stripe_subscription_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_at_period_end"?: boolean,"cancel_reason"?: string | null,"cancel_requested_at"?: string | null,"client_id": string,"current_period_end"?: string | null,"current_period_start"?: string | null,"paused_deployments"?: NonNullable<Json>,"paused_for_usage_at"?: string | null,"plan_id"?: string | null,"status"?: string,"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "cancel_at_period_end"?: boolean,"cancel_reason"?: string | null,"cancel_requested_at"?: string | null,"client_id"?: string,"current_period_end"?: string | null,"current_period_start"?: string | null,"paused_deployments"?: NonNullable<Json>,"paused_for_usage_at"?: string | null,"plan_id"?: string | null,"status"?: string,"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_billing_client_id_fkey"
      columns: ["client_id"]
isOneToOne: true
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_billing_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    }
                  ]
                },"client_contacts": {
                  Row: {
                    "client_id": string,"created_at": string,"created_by": string | null,"email": string | null,"full_name": string,"id": string,"is_primary": boolean,"notes": string | null,"phone": string | null,"title": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"full_name": string,"id"?: string,"is_primary"?: boolean,"notes"?: string | null,"phone"?: string | null,"title"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"full_name"?: string,"id"?: string,"is_primary"?: boolean,"notes"?: string | null,"phone"?: string | null,"title"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_contacts_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"client_glass": {
                  Row: {
                    "checked_at": string | null,"client_id": string,"enabled_at": string,"enabled_by": string | null,"key_hint": string | null,"key_set_at": string | null,"key_set_by": string | null,"last_used_at": string | null,"secret_id": string | null,"status": string,"status_detail": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "checked_at"?: string | null,"client_id": string,"enabled_at"?: string,"enabled_by"?: string | null,"key_hint"?: string | null,"key_set_at"?: string | null,"key_set_by"?: string | null,"last_used_at"?: string | null,"secret_id"?: string | null,"status"?: string,"status_detail"?: string | null
                  }
                  Update: {
                    "checked_at"?: string | null,"client_id"?: string,"enabled_at"?: string,"enabled_by"?: string | null,"key_hint"?: string | null,"key_set_at"?: string | null,"key_set_by"?: string | null,"last_used_at"?: string | null,"secret_id"?: string | null,"status"?: string,"status_detail"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_glass_client_id_fkey"
      columns: ["client_id"]
isOneToOne: true
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"client_notes": {
                  Row: {
                    "author_id": string | null,"body": string,"client_id": string,"created_at": string,"id": string,"kind": string,"pinned": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body": string,"client_id": string,"created_at"?: string,"id"?: string,"kind"?: string,"pinned"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"client_id"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"pinned"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_notes_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"clients": {
                  Row: {
                    "account_manager_id": string | null,"address": string | null,"agency_id": string | null,"brand_color": string | null,"created_at": string,"created_by": string | null,"id": string,"industry": string | null,"logo_url": string | null,"name": string,"phone": string | null,"slug": string,"status": string,"timezone": string,"updated_at": string,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_manager_id"?: string | null,"address"?: string | null,"agency_id"?: string | null,"brand_color"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"industry"?: string | null,"logo_url"?: string | null,"name": string,"phone"?: string | null,"slug": string,"status"?: string,"timezone"?: string,"updated_at"?: string,"website"?: string | null
                  }
                  Update: {
                    "account_manager_id"?: string | null,"address"?: string | null,"agency_id"?: string | null,"brand_color"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"industry"?: string | null,"logo_url"?: string | null,"name"?: string,"phone"?: string | null,"slug"?: string,"status"?: string,"timezone"?: string,"updated_at"?: string,"website"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_agency_id_fkey"
      columns: ["agency_id"]
isOneToOne: false
      referencedRelation: "agencies"
      referencedColumns: ["id"]
    }
                  ]
                },"conversation_insights": {
                  Row: {
                    "attempts": number,"client_id": string,"conversation_id": string,"created_at": string,"error": string | null,"model": string | null,"status": string,"summary": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"client_id": string,"conversation_id": string,"created_at"?: string,"error"?: string | null,"model"?: string | null,"status"?: string,"summary"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"client_id"?: string,"conversation_id"?: string,"created_at"?: string,"error"?: string | null,"model"?: string | null,"status"?: string,"summary"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_insights_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_insights_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: true
      referencedRelation: "conversations"
      referencedColumns: ["conversation_id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "avatar_id": string,"avatar_speech_seconds": number | null,"billable_seconds": number | null,"client_id": string,"conversation_id": string,"created_at": string,"ended_at": string | null,"has_transcript": boolean,"shutdown_reason": string | null,"started_at": string | null,"talk_seconds": number | null,"turns": number | null,"updated_at": string,"usage_date": string | null,"visitor_speech_seconds": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_id": string,"avatar_speech_seconds"?: number | null,"billable_seconds"?: number | null,"client_id": string,"conversation_id": string,"created_at"?: string,"ended_at"?: string | null,"has_transcript"?: boolean,"shutdown_reason"?: string | null,"started_at"?: string | null,"talk_seconds"?: number | null,"turns"?: number | null,"updated_at"?: string,"usage_date"?: string | null,"visitor_speech_seconds"?: number | null
                  }
                  Update: {
                    "avatar_id"?: string,"avatar_speech_seconds"?: number | null,"billable_seconds"?: number | null,"client_id"?: string,"conversation_id"?: string,"created_at"?: string,"ended_at"?: string | null,"has_transcript"?: boolean,"shutdown_reason"?: string | null,"started_at"?: string | null,"talk_seconds"?: number | null,"turns"?: number | null,"updated_at"?: string,"usage_date"?: string | null,"visitor_speech_seconds"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_avatar_id_fkey"
      columns: ["avatar_id"]
isOneToOne: false
      referencedRelation: "avatars"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"glass_calls": {
                  Row: {
                    "asked_at": string,"avatar_id": string,"client_id": string,"conversation_id": string,"cost_cents": number | null,"duration_ms": number,"error_code": string | null,"glass_request_id": string | null,"glass_version": string | null,"id": number,"input_tokens": number,"output_tokens": number,"status": string,"tool_call_id": string | null,"usage_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "asked_at"?: string,"avatar_id": string,"client_id": string,"conversation_id": string,"cost_cents"?: number | null,"duration_ms"?: number,"error_code"?: string | null,"glass_request_id"?: string | null,"glass_version"?: string | null,"id"?: never,"input_tokens"?: number,"output_tokens"?: number,"status": string,"tool_call_id"?: string | null,"usage_date": string
                  }
                  Update: {
                    "asked_at"?: string,"avatar_id"?: string,"client_id"?: string,"conversation_id"?: string,"cost_cents"?: number | null,"duration_ms"?: number,"error_code"?: string | null,"glass_request_id"?: string | null,"glass_version"?: string | null,"id"?: never,"input_tokens"?: number,"output_tokens"?: number,"status"?: string,"tool_call_id"?: string | null,"usage_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "glass_calls_avatar_id_fkey"
      columns: ["avatar_id"]
isOneToOne: false
      referencedRelation: "avatars"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "glass_calls_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "amount_due_cents": number,"amount_paid_cents": number,"client_id": string,"currency": string,"hosted_invoice_url": string | null,"id": string,"invoice_pdf": string | null,"issued_at": string,"number": string | null,"period_end": string | null,"period_start": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_due_cents"?: number,"amount_paid_cents"?: number,"client_id": string,"currency"?: string,"hosted_invoice_url"?: string | null,"id": string,"invoice_pdf"?: string | null,"issued_at"?: string,"number"?: string | null,"period_end"?: string | null,"period_start"?: string | null,"status": string
                  }
                  Update: {
                    "amount_due_cents"?: number,"amount_paid_cents"?: number,"client_id"?: string,"currency"?: string,"hosted_invoice_url"?: string | null,"id"?: string,"invoice_pdf"?: string | null,"issued_at"?: string,"number"?: string | null,"period_end"?: string | null,"period_start"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "channel": string,"client_id": string,"created_at": string,"detail": string | null,"id": number,"kind": string,"period_start": string,"recipient": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": string,"client_id": string,"created_at"?: string,"detail"?: string | null,"id"?: never,"kind": string,"period_start"?: string,"recipient": string,"status": string
                  }
                  Update: {
                    "channel"?: string,"client_id"?: string,"created_at"?: string,"detail"?: string | null,"id"?: never,"kind"?: string,"period_start"?: string,"recipient"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"permissions": {
                  Row: {
                    "description": string,"key": string,"label": string,"side": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string,"key": string,"label": string,"side": string,"sort"?: number
                  }
                  Update: {
                    "description"?: string,"key"?: string,"label"?: string,"side"?: string,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"plans": {
                  Row: {
                    "agency_id": string | null,"created_at": string,"currency": string,"description": string,"id": string,"included_minutes": number,"is_active": boolean,"max_concurrent": number | null,"monthly_price_cents": number,"name": string,"sort": number,"stripe_price_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agency_id"?: string | null,"created_at"?: string,"currency"?: string,"description"?: string,"id"?: string,"included_minutes": number,"is_active"?: boolean,"max_concurrent"?: number | null,"monthly_price_cents": number,"name": string,"sort"?: number,"stripe_price_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "agency_id"?: string | null,"created_at"?: string,"currency"?: string,"description"?: string,"id"?: string,"included_minutes"?: number,"is_active"?: boolean,"max_concurrent"?: number | null,"monthly_price_cents"?: number,"name"?: string,"sort"?: number,"stripe_price_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plans_agency_id_fkey"
      columns: ["agency_id"]
isOneToOne: false
      referencedRelation: "agencies"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "agency_id": string | null,"client_id": string | null,"created_at": string,"email": string,"full_name": string,"id": string,"invited_by": string | null,"is_active": boolean,"phone": string | null,"role_id": string,"side": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agency_id"?: string | null,"client_id"?: string | null,"created_at"?: string,"email": string,"full_name"?: string,"id": string,"invited_by"?: string | null,"is_active"?: boolean,"phone"?: string | null,"role_id": string,"side": string
                  }
                  Update: {
                    "agency_id"?: string | null,"client_id"?: string | null,"created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"invited_by"?: string | null,"is_active"?: boolean,"phone"?: string | null,"role_id"?: string,"side"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_agency_id_fkey"
      columns: ["agency_id"]
isOneToOne: false
      referencedRelation: "agencies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id"]
    }
                  ]
                },"question_groups": {
                  Row: {
                    "answer": string | null,"answered_at": string | null,"answered_by": string | null,"avatar_ids": (string)[],"client_id": string,"created_at": string,"id": string,"knowledge_error": string | null,"knowledge_status": string,"last_asked_at": string | null,"question": string,"status": string,"times_asked": number
                  }
                  ComputedFields: never
                  Insert: {
                    "answer"?: string | null,"answered_at"?: string | null,"answered_by"?: string | null,"avatar_ids"?: (string)[],"client_id": string,"created_at"?: string,"id"?: string,"knowledge_error"?: string | null,"knowledge_status"?: string,"last_asked_at"?: string | null,"question": string,"status"?: string,"times_asked"?: number
                  }
                  Update: {
                    "answer"?: string | null,"answered_at"?: string | null,"answered_by"?: string | null,"avatar_ids"?: (string)[],"client_id"?: string,"created_at"?: string,"id"?: string,"knowledge_error"?: string | null,"knowledge_status"?: string,"last_asked_at"?: string | null,"question"?: string,"status"?: string,"times_asked"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_groups_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"questions": {
                  Row: {
                    "avatar_id": string,"client_id": string,"conversation_id": string,"created_at": string,"group_id": string | null,"id": string,"outcome": string,"position": number,"question": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_id": string,"client_id": string,"conversation_id": string,"created_at"?: string,"group_id"?: string | null,"id"?: string,"outcome": string,"position"?: number,"question": string
                  }
                  Update: {
                    "avatar_id"?: string,"client_id"?: string,"conversation_id"?: string,"created_at"?: string,"group_id"?: string | null,"id"?: string,"outcome"?: string,"position"?: number,"question"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "questions_avatar_id_fkey"
      columns: ["avatar_id"]
isOneToOne: false
      referencedRelation: "avatars"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "questions_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "questions_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["conversation_id"]
    },{
      foreignKeyName: "questions_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "question_groups"
      referencedColumns: ["id"]
    }
                  ]
                },"role_permissions": {
                  Row: {
                    "permission": string,"role_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "permission": string,"role_id": string
                  }
                  Update: {
                    "permission"?: string,"role_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "role_permissions_permission_fkey"
      columns: ["permission"]
isOneToOne: false
      referencedRelation: "permissions"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "role_permissions_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id"]
    }
                  ]
                },"roles": {
                  Row: {
                    "client_scope": string,"created_at": string,"description": string,"id": string,"is_system": boolean,"key": string,"name": string,"side": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_scope"?: string,"created_at"?: string,"description"?: string,"id"?: string,"is_system"?: boolean,"key": string,"name": string,"side": string
                  }
                  Update: {
                    "client_scope"?: string,"created_at"?: string,"description"?: string,"id"?: string,"is_system"?: boolean,"key"?: string,"name"?: string,"side"?: string
                  }
                  Relationships: [
                    
                  ]
                },"settings": {
                  Row: {
                    "description": string,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "description"?: string,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"staff_client_assignments": {
                  Row: {
                    "client_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"user_id": string
                  }
                  Update: {
                    "client_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_client_assignments_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_client_assignments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"stripe_events": {
                  Row: {
                    "id": string,"received_at": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"received_at"?: string,"type": string
                  }
                  Update: {
                    "id"?: string,"received_at"?: string,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"support_messages": {
                  Row: {
                    "attachments": NonNullable<Json>,"author_id": string | null,"author_name": string,"author_side": string,"body": string,"client_id": string,"created_at": string,"email_message_id": string | null,"id": string,"is_internal": boolean,"kind": string,"notified_at": string | null,"notify_attempts": number,"notify_claimed_at": string | null,"notify_result": string | null,"ticket_id": string,"via": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attachments"?: NonNullable<Json>,"author_id"?: string | null,"author_name"?: string,"author_side": string,"body": string,"client_id": string,"created_at"?: string,"email_message_id"?: string | null,"id"?: string,"is_internal"?: boolean,"kind"?: string,"notified_at"?: string | null,"notify_attempts"?: number,"notify_claimed_at"?: string | null,"notify_result"?: string | null,"ticket_id": string,"via"?: string
                  }
                  Update: {
                    "attachments"?: NonNullable<Json>,"author_id"?: string | null,"author_name"?: string,"author_side"?: string,"body"?: string,"client_id"?: string,"created_at"?: string,"email_message_id"?: string | null,"id"?: string,"is_internal"?: boolean,"kind"?: string,"notified_at"?: string | null,"notify_attempts"?: number,"notify_claimed_at"?: string | null,"notify_result"?: string | null,"ticket_id"?: string,"via"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_messages_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "support_messages_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "support_tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"support_ticket_secrets": {
                  Row: {
                    "reply_token": string,"ticket_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "reply_token"?: string,"ticket_id": string
                  }
                  Update: {
                    "reply_token"?: string,"ticket_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_ticket_secrets_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: true
      referencedRelation: "support_tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"support_tickets": {
                  Row: {
                    "assignee_id": string | null,"assignee_name": string | null,"category": string,"client_id": string,"conversation_id": string | null,"created_at": string,"first_response_at": string | null,"id": string,"last_message_at": string,"last_message_side": string,"message_count": number,"number": number,"opened_by": string | null,"opened_by_name": string,"opened_via": string,"priority": string,"resolved_at": string | null,"status": string,"subject": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_id"?: string | null,"assignee_name"?: string | null,"category"?: string,"client_id": string,"conversation_id"?: string | null,"created_at"?: string,"first_response_at"?: string | null,"id"?: string,"last_message_at"?: string,"last_message_side"?: string,"message_count"?: number,"number"?: number,"opened_by"?: string | null,"opened_by_name"?: string,"opened_via"?: string,"priority"?: string,"resolved_at"?: string | null,"status"?: string,"subject": string,"updated_at"?: string
                  }
                  Update: {
                    "assignee_id"?: string | null,"assignee_name"?: string | null,"category"?: string,"client_id"?: string,"conversation_id"?: string | null,"created_at"?: string,"first_response_at"?: string | null,"id"?: string,"last_message_at"?: string,"last_message_side"?: string,"message_count"?: number,"number"?: number,"opened_by"?: string | null,"opened_by_name"?: string,"opened_via"?: string,"priority"?: string,"resolved_at"?: string | null,"status"?: string,"subject"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_tickets_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "support_tickets_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["conversation_id"]
    }
                  ]
                },"tavus_deployments": {
                  Row: {
                    "agency_id": string | null,"allowed_origins": (string)[],"channel": string,"deployment_id": string,"limits": NonNullable<Json>,"name": string,"page_url": string | null,"pal_id": string,"removed_at": string | null,"status": string,"synced_at": string,"tavus_created_at": string | null,"tavus_updated_at": string | null,"thumbnail_image_url": string | null,"usage_today": number | null,"usage_total": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "agency_id"?: string | null,"allowed_origins"?: (string)[],"channel": string,"deployment_id": string,"limits"?: NonNullable<Json>,"name"?: string,"page_url"?: string | null,"pal_id": string,"removed_at"?: string | null,"status": string,"synced_at"?: string,"tavus_created_at"?: string | null,"tavus_updated_at"?: string | null,"thumbnail_image_url"?: string | null,"usage_today"?: number | null,"usage_total"?: number | null
                  }
                  Update: {
                    "agency_id"?: string | null,"allowed_origins"?: (string)[],"channel"?: string,"deployment_id"?: string,"limits"?: NonNullable<Json>,"name"?: string,"page_url"?: string | null,"pal_id"?: string,"removed_at"?: string | null,"status"?: string,"synced_at"?: string,"tavus_created_at"?: string | null,"tavus_updated_at"?: string | null,"thumbnail_image_url"?: string | null,"usage_today"?: number | null,"usage_total"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tavus_deployments_agency_id_fkey"
      columns: ["agency_id"]
isOneToOne: false
      referencedRelation: "agencies"
      referencedColumns: ["id"]
    }
                  ]
                },"tavus_events": {
                  Row: {
                    "avatar_id": string | null,"conversation_id": string,"event_key": string,"event_type": string,"id": number,"occurred_at": string | null,"payload": NonNullable<Json>,"received_at": string,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_id"?: string | null,"conversation_id": string,"event_key": string,"event_type": string,"id"?: never,"occurred_at"?: string | null,"payload": NonNullable<Json>,"received_at"?: string,"source": string
                  }
                  Update: {
                    "avatar_id"?: string | null,"conversation_id"?: string,"event_key"?: string,"event_type"?: string,"id"?: never,"occurred_at"?: string | null,"payload"?: NonNullable<Json>,"received_at"?: string,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tavus_events_avatar_id_fkey"
      columns: ["avatar_id"]
isOneToOne: false
      referencedRelation: "avatars"
      referencedColumns: ["id"]
    }
                  ]
                },"tavus_pals": {
                  Row: {
                    "agency_id": string | null,"callback_host": string | null,"default_face_id": string | null,"first_seen_at": string,"name": string,"pal_id": string,"pipeline_mode": string | null,"removed_at": string | null,"synced_at": string,"tavus_created_at": string | null,"tavus_updated_at": string | null,"thumbnail_image_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "agency_id"?: string | null,"callback_host"?: string | null,"default_face_id"?: string | null,"first_seen_at"?: string,"name"?: string,"pal_id": string,"pipeline_mode"?: string | null,"removed_at"?: string | null,"synced_at"?: string,"tavus_created_at"?: string | null,"tavus_updated_at"?: string | null,"thumbnail_image_url"?: string | null
                  }
                  Update: {
                    "agency_id"?: string | null,"callback_host"?: string | null,"default_face_id"?: string | null,"first_seen_at"?: string,"name"?: string,"pal_id"?: string,"pipeline_mode"?: string | null,"removed_at"?: string | null,"synced_at"?: string,"tavus_created_at"?: string | null,"tavus_updated_at"?: string | null,"thumbnail_image_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tavus_pals_agency_id_fkey"
      columns: ["agency_id"]
isOneToOne: false
      referencedRelation: "agencies"
      referencedColumns: ["id"]
    }
                  ]
                },"tavus_sync_runs": {
                  Row: {
                    "agency_id": string | null,"deployments_count": number | null,"error": string | null,"finished_at": string | null,"id": number,"pals_count": number | null,"started_at": string,"status": string,"trigger": string,"triggered_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "agency_id"?: string | null,"deployments_count"?: number | null,"error"?: string | null,"finished_at"?: string | null,"id"?: never,"pals_count"?: number | null,"started_at"?: string,"status"?: string,"trigger"?: string,"triggered_by"?: string | null
                  }
                  Update: {
                    "agency_id"?: string | null,"deployments_count"?: number | null,"error"?: string | null,"finished_at"?: string | null,"id"?: never,"pals_count"?: number | null,"started_at"?: string,"status"?: string,"trigger"?: string,"triggered_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tavus_sync_runs_agency_id_fkey"
      columns: ["agency_id"]
isOneToOne: false
      referencedRelation: "agencies"
      referencedColumns: ["id"]
    }
                  ]
                },"transcripts": {
                  Row: {
                    "client_id": string,"conversation_id": string,"created_at": string,"turns": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"conversation_id": string,"created_at"?: string,"turns": NonNullable<Json>
                  }
                  Update: {
                    "client_id"?: string,"conversation_id"?: string,"created_at"?: string,"turns"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "transcripts_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transcripts_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: true
      referencedRelation: "conversations"
      referencedColumns: ["conversation_id"]
    }
                  ]
                },"usage_daily": {
                  Row: {
                    "avatar_id": string,"billable_seconds": number,"client_id": string,"conversations": number,"talk_seconds": number,"usage_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_id": string,"billable_seconds": number,"client_id": string,"conversations": number,"talk_seconds": number,"usage_date": string
                  }
                  Update: {
                    "avatar_id"?: string,"billable_seconds"?: number,"client_id"?: string,"conversations"?: number,"talk_seconds"?: number,"usage_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "usage_daily_avatar_id_fkey"
      columns: ["avatar_id"]
isOneToOne: false
      referencedRelation: "avatars"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "usage_daily_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"usage_topups": {
                  Row: {
                    "amount_cents": number,"client_id": string,"created_at": string,"created_by": string | null,"currency": string,"id": string,"minutes": number,"paid_at": string | null,"period_end": string,"period_start": string,"status": string,"stripe_session_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"client_id": string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"minutes": number,"paid_at"?: string | null,"period_end": string,"period_start": string,"status"?: string,"stripe_session_id"?: string | null
                  }
                  Update: {
                    "amount_cents"?: number,"client_id"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"minutes"?: number,"paid_at"?: string | null,"period_end"?: string,"period_start"?: string,"status"?: string,"stripe_session_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "usage_topups_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "agency_set_brand":
{ Args: { "p_agency_id": string,"p_icon_url"?: string,"p_logo_dark_url"?: string,"p_logo_light_url"?: string,"p_theme": Json }; Returns: {
              "created_at": string,
"created_by": string | null,
"domain": string | null,
"fee_cents": number | null,
"icon_url": string | null,
"id": string,
"logo_dark_url": string | null,
"logo_light_url": string | null,
"name": string,
"payment_model": string | null,
"slug": string,
"status": string,
"theme": Json | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "agencies"
        isOneToOne: true
        isSetofReturn: false
      } },
"agency_staff":
{ Args: { "p_agency_id": string }; Returns: {
              "created_at": string,"email": string,"full_name": string,"id": string,"is_active": boolean,"role_name": string
            }[]
                           },
"agency_usage":
{ Args: { "p_from": string,"p_to": string }; Returns: Json[]
                           },
"agency_usage_by_day":
{ Args: { "p_agency_id": string,"p_from": string,"p_to": string }; Returns: {
              "conversations": number,"minutes": number,"usage_date": string
            }[]
                           },
"answer_question":
{ Args: { "p_answer": string,"p_group_id": string }; Returns: {
              "answer": string | null,
"answered_at": string | null,
"answered_by": string | null,
"avatar_ids": (string)[],
"client_id": string,
"created_at": string,
"id": string,
"knowledge_error": string | null,
"knowledge_status": string,
"last_asked_at": string | null,
"question": string,
"status": string,
"times_asked": number
            }
                          SetofOptions: {
        from: "*"
        to: "question_groups"
        isOneToOne: true
        isSetofReturn: false
      } },
"billing_contacts":
{ Args: { "p_client_id": string }; Returns: {
              "email": string,"full_name": string,"phone": string,"side": string
            }[]
                           },
"billing_summary":
{ Args: { "p_client_id": string }; Returns: Json
                           },
"brand_for_host":
{ Args: { "p_host"?: string,"p_slug"?: string }; Returns: Json
                           },
"can_invite_to_agency":
{ Args: { "p_agency_id": string }; Returns: boolean
                           },
"check_access":
{ Args: { "p_client_id"?: string,"p_permission": string }; Returns: boolean
                           },
"create_agency":
{ Args: { "p_domain"?: string,"p_fee_cents"?: number,"p_name": string,"p_payment_model"?: string,"p_slug": string,"p_theme"?: Json }; Returns: {
              "created_at": string,
"created_by": string | null,
"domain": string | null,
"fee_cents": number | null,
"icon_url": string | null,
"id": string,
"logo_dark_url": string | null,
"logo_light_url": string | null,
"name": string,
"payment_model": string | null,
"slug": string,
"status": string,
"theme": Json | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "agencies"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_client":
{ Args: { "p_brand_color"?: string,"p_logo_url"?: string,"p_name": string,"p_slug": string,"p_timezone"?: string }; Returns: {
              "account_manager_id": string | null,
"address": string | null,
"agency_id": string | null,
"brand_color": string | null,
"created_at": string,
"created_by": string | null,
"id": string,
"industry": string | null,
"logo_url": string | null,
"name": string,
"phone": string | null,
"slug": string,
"status": string,
"timezone": string,
"updated_at": string,
"website": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "clients"
        isOneToOne: true
        isSetofReturn: false
      } },
"crm_clients":
{ Args: Record<PropertyKey, never>; Returns: Json[]
                           },
"expired_export_paths":
{ Args: { "p_days"?: number }; Returns: string[]
                           },
"finance_summary":
{ Args: { "p_from": string,"p_to": string }; Returns: Json
                           },
"glass_enable":
{ Args: { "p_client_id": string,"p_enabled": boolean }; Returns: undefined
                           },
"glass_read_key":
{ Args: { "p_client_id": string }; Returns: string
                           },
"glass_record_call":
{ Args: { "p_avatar_id": string,"p_conversation_id": string,"p_duration_ms": number,"p_error_code": string,"p_input_tokens": number,"p_output_tokens": number,"p_request_id": string,"p_status": string,"p_tool_call_id": string,"p_version": string }; Returns: number
                           },
"glass_remove_key":
{ Args: { "p_client_id": string }; Returns: undefined
                           },
"glass_set_key":
{ Args: { "p_client_id": string,"p_key": string }; Returns: undefined
                           },
"glass_set_status":
{ Args: { "p_client_id": string,"p_detail"?: string,"p_status": string }; Returns: undefined
                           },
"glass_usage_by_avatar":
{ Args: { "p_client_id": string,"p_from": string,"p_to": string }; Returns: {
              "avatar_id": string,"cost_cents": number,"duration_ms": number,"failed": number,"input_tokens": number,"output_tokens": number,"questions": number
            }[]
                           },
"glass_usage_by_conversation":
{ Args: { "p_conversation_ids": (string)[] }; Returns: {
              "conversation_id": string,"cost_cents": number,"duration_ms": number,"failed": number,"input_tokens": number,"output_tokens": number,"questions": number
            }[]
                           },
"glass_usage_by_day":
{ Args: { "p_client_id": string,"p_from": string,"p_to": string }; Returns: {
              "cost_cents": number,"duration_ms": number,"failed": number,"input_tokens": number,"output_tokens": number,"questions": number,"usage_date": string
            }[]
                           },
"ingest_tavus_event":
{ Args: { "p_avatar_id": string,"p_payload": Json,"p_source"?: string }; Returns: Json
                           },
"my_access":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_agency":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"refresh_avatar_photos":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"save_conversation_insights":
{ Args: { "p_conversation_id": string,"p_model"?: string,"p_questions": Json,"p_summary": string }; Returns: undefined
                           },
"search_tavus_pals":
{ Args: { "p_limit"?: number,"p_query"?: string }; Returns: {
              "deployments": Json,"linked_avatar_id": string,"linked_client_id": string,"linked_client_name": string,"name": string,"pal_id": string,"score": number,"tavus_updated_at": string,"thumbnail_image_url": string
            }[]
                           },
"set_question_status":
{ Args: { "p_group_id": string,"p_status": string }; Returns: {
              "answer": string | null,
"answered_at": string | null,
"answered_by": string | null,
"avatar_ids": (string)[],
"client_id": string,
"created_at": string,
"id": string,
"knowledge_error": string | null,
"knowledge_status": string,
"last_asked_at": string | null,
"question": string,
"status": string,
"times_asked": number
            }
                          SetofOptions: {
        from: "*"
        to: "question_groups"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_staff_assignments":
{ Args: { "p_client_ids": (string)[],"p_user_id": string }; Returns: undefined
                           },
"set_user_active":
{ Args: { "p_active": boolean,"p_user_id": string }; Returns: undefined
                           },
"set_user_role":
{ Args: { "p_role_id": string,"p_user_id": string }; Returns: undefined
                           },
"support_assign":
{ Args: { "p_assignee_id": string,"p_ticket_id": string }; Returns: undefined
                           },
"support_claim_notifications":
{ Args: { "p_limit"?: number }; Returns: {
              "attachment_count": number,"author_name": string,"author_side": string,"body": string,"client_name": string,"client_slug": string,"message_id": string,"priority": string,"recipients": (string)[],"reply_token": string,"subject": string,"ticket_number": number
            }[]
                           },
"support_ingest_email":
{ Args: { "p_body": string,"p_from": string,"p_message_id": string,"p_reference": string,"p_subject": string }; Returns: Json
                           },
"support_mark_notified":
{ Args: { "p_done": boolean,"p_message_id": string,"p_result": string }; Returns: undefined
                           },
"support_open_ticket":
{ Args: { "p_attachments"?: Json,"p_body": string,"p_category"?: string,"p_client_id": string,"p_conversation_id"?: string,"p_subject": string }; Returns: {
              "assignee_id": string | null,
"assignee_name": string | null,
"category": string,
"client_id": string,
"conversation_id": string | null,
"created_at": string,
"first_response_at": string | null,
"id": string,
"last_message_at": string,
"last_message_side": string,
"message_count": number,
"number": number,
"opened_by": string | null,
"opened_by_name": string,
"opened_via": string,
"priority": string,
"resolved_at": string | null,
"status": string,
"subject": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "support_tickets"
        isOneToOne: true
        isSetofReturn: false
      } },
"support_reply":
{ Args: { "p_attachments"?: Json,"p_body": string,"p_internal"?: boolean,"p_ticket_id": string }; Returns: string
                           },
"support_set_status":
{ Args: { "p_status": string,"p_ticket_id": string }; Returns: undefined
                           },
"support_staff":
{ Args: { "p_client_id": string }; Returns: {
              "email": string,"full_name": string,"id": string
            }[]
                           },
"support_update_ticket":
{ Args: { "p_category"?: string,"p_priority"?: string,"p_ticket_id": string }; Returns: undefined
                           },
"topup_custom_rule":
{ Args: { "p_client_id": string }; Returns: Json
                           },
"topup_offer":
{ Args: { "p_amount_cents": number,"p_client_id": string }; Returns: {
              "currency": string,"minutes": number,"period_end": string,"period_start": string
            }[]
                           },
"update_agency":
{ Args: { "p_agency_id": string,"p_domain": string,"p_fee_cents": number,"p_name": string,"p_payment_model": string,"p_status": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"domain": string | null,
"fee_cents": number | null,
"icon_url": string | null,
"id": string,
"logo_dark_url": string | null,
"logo_light_url": string | null,
"name": string,
"payment_model": string | null,
"slug": string,
"status": string,
"theme": Json | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "agencies"
        isOneToOne: true
        isSetofReturn: false
      } },
"update_my_profile":
{ Args: { "p_full_name": string }; Returns: undefined
                           },
"usage_by_avatar":
{ Args: { "p_client_id": string,"p_from": string,"p_to": string }; Returns: {
              "avatar_id": string,"billable_seconds": number,"conversations": number,"talk_seconds": number
            }[]
                           },
"usage_by_client":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "billable_seconds": number,"client_id": string,"conversations": number,"talk_seconds": number
            }[]
                           },
"usage_by_day":
{ Args: { "p_client_id": string,"p_from": string,"p_to": string }; Returns: {
              "billable_seconds": number,"conversations": number,"talk_seconds": number,"usage_date": string
            }[]
                           },
"usage_standings":
{ Args: Record<PropertyKey, never>; Returns: Json[]
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
  "public": {
          Enums: {
            
          }
        }
} as const
