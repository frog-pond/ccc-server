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
      app_notice: {
        Row: {
          active_from: string | null
          active_until: string | null
          app_version: string | null
          body: string | null
          created_at: string
          id: string
          platform: string | null
          severity: string
          source: string
          subtitle: string | null
          title: string
        }
        Insert: {
          active_from?: string | null
          active_until?: string | null
          app_version?: string | null
          body?: string | null
          created_at?: string
          id?: string
          platform?: string | null
          severity: string
          source: string
          subtitle?: string | null
          title: string
        }
        Update: {
          active_from?: string | null
          active_until?: string | null
          app_version?: string | null
          body?: string | null
          created_at?: string
          id?: string
          platform?: string | null
          severity?: string
          source?: string
          subtitle?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_notice_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe: {
        Row: {
          description: string | null
          id: string
          location: string | null
          name: string
          source: string
        }
        Insert: {
          description?: string | null
          id?: string
          location?: string | null
          name: string
          source: string
        }
        Update: {
          description?: string | null
          id?: string
          location?: string | null
          name?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe_location_fkey"
            columns: ["location"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_cor: {
        Row: {
          description: string
          icon_uri: string
          id: string
          title: string
        }
        Insert: {
          description: string
          icon_uri: string
          id: string
          title: string
        }
        Update: {
          description?: string
          icon_uri?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      cafe_item: {
        Row: {
          description: string | null
          id: string
          monotony: Json
          nutrition: Json
          rating: number | null
          source: string
          title: string
        }
        Insert: {
          description?: string | null
          id?: string
          monotony?: Json
          nutrition?: Json
          rating?: number | null
          source: string
          title: string
        }
        Update: {
          description?: string | null
          id?: string
          monotony?: Json
          nutrition?: Json
          rating?: number | null
          source?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe_item_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_item_cor: {
        Row: {
          cafe_cor_id: string
          cafe_item_id: string
        }
        Insert: {
          cafe_cor_id: string
          cafe_item_id: string
        }
        Update: {
          cafe_cor_id?: string
          cafe_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe_item_cor_cafe_cor_id_fkey"
            columns: ["cafe_cor_id"]
            isOneToOne: false
            referencedRelation: "cafe_cor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_item_cor_cafe_item_id_fkey"
            columns: ["cafe_item_id"]
            isOneToOne: false
            referencedRelation: "cafe_item"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_item_variation: {
        Row: {
          cafe_item_id: string
          description: string | null
          title: string
        }
        Insert: {
          cafe_item_id: string
          description?: string | null
          title: string
        }
        Update: {
          cafe_item_id?: string
          description?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe_item_variation_cafe_item_id_fkey"
            columns: ["cafe_item_id"]
            isOneToOne: false
            referencedRelation: "cafe_item"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_menu_schedule: {
        Row: {
          schedule_id: string
          station_id: string
        }
        Insert: {
          schedule_id: string
          station_id: string
        }
        Update: {
          schedule_id?: string
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe_menu_schedule_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "location_schedule"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_menu_schedule_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "cafe_station_menu"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_station_menu: {
        Row: {
          id: string
          is_featured: boolean
          item_id: string
          item_sort_order: number
          source: string
          station_note: string | null
          station_sort_order: number
          station_title: string
        }
        Insert: {
          id?: string
          is_featured?: boolean
          item_id: string
          item_sort_order: number
          source: string
          station_note?: string | null
          station_sort_order: number
          station_title: string
        }
        Update: {
          id?: string
          is_featured?: boolean
          item_id?: string
          item_sort_order?: number
          source?: string
          station_note?: string | null
          station_sort_order?: number
          station_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe_station_menu_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "cafe_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_station_menu_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event: {
        Row: {
          banner_uri: string | null
          campus_location_id: string | null
          description: string
          end_time: string
          id: string
          recurrence_of_event_id: string | null
          source: string
          sponsoring_entity: string | null
          start_time: string
          textual_location: string | null
          thumbnail_uri: string | null
          title: string
        }
        Insert: {
          banner_uri?: string | null
          campus_location_id?: string | null
          description?: string
          end_time: string
          id?: string
          recurrence_of_event_id?: string | null
          source: string
          sponsoring_entity?: string | null
          start_time: string
          textual_location?: string | null
          thumbnail_uri?: string | null
          title: string
        }
        Update: {
          banner_uri?: string | null
          campus_location_id?: string | null
          description?: string
          end_time?: string
          id?: string
          recurrence_of_event_id?: string | null
          source?: string
          sponsoring_entity?: string | null
          start_time?: string
          textual_location?: string | null
          thumbnail_uri?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_campus_location_id_fkey"
            columns: ["campus_location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_recurrence_of_event_id_fkey"
            columns: ["recurrence_of_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_event"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_sponsoring_entity_fkey"
            columns: ["sponsoring_entity"]
            isOneToOne: false
            referencedRelation: "directory_entry"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_category: {
        Row: {
          calendar_event_id: string
          category_id: string
          source: string
        }
        Insert: {
          calendar_event_id: string
          category_id: string
          source: string
        }
        Update: {
          calendar_event_id?: string
          category_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_category_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_event"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_category_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "content_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_category_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_link: {
        Row: {
          calendar_event_id: string
          content_type: string | null
          href: string
          link_mode: string
          source: string
          title: string
        }
        Insert: {
          calendar_event_id: string
          content_type?: string | null
          href: string
          link_mode: string
          source: string
          title: string
        }
        Update: {
          calendar_event_id?: string
          content_type?: string | null
          href?: string
          link_mode?: string
          source?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_link_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_event"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_link_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
        ]
      }
      content_category: {
        Row: {
          id: string
          sort_title: string | null
          title: string
        }
        Insert: {
          id?: string
          sort_title?: string | null
          title: string
        }
        Update: {
          id?: string
          sort_title?: string | null
          title?: string
        }
        Relationships: []
      }
      data_source: {
        Row: {
          id: string
          type: string
          uri: string | null
        }
        Insert: {
          id: string
          type: string
          uri?: string | null
        }
        Update: {
          id?: string
          type?: string
          uri?: string | null
        }
        Relationships: []
      }
      dictionary: {
        Row: {
          description: string
          id: string
          image_uri: string | null
          sort_group: string
          sort_title: string | null
          source: string
          subtitle: string
          text_color: string
          tint_color: string
          title: string
          uri: string
        }
        Insert: {
          description?: string
          id?: string
          image_uri?: string | null
          sort_group?: string
          sort_title?: string | null
          source: string
          subtitle?: string
          text_color?: string
          tint_color?: string
          title: string
          uri?: string
        }
        Update: {
          description?: string
          id?: string
          image_uri?: string | null
          sort_group?: string
          sort_title?: string | null
          source?: string
          subtitle?: string
          text_color?: string
          tint_color?: string
          title?: string
          uri?: string
        }
        Relationships: [
          {
            foreignKeyName: "dictionary_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
        ]
      }
      directory_entry: {
        Row: {
          email: string | null
          id: string
          name: string
          office_hours: string | null
          phone: string | null
          photo: string | null
          profile_text: string | null
          profile_uri: string | null
          pronouns: string | null
          sort_name: string
          source: string
          specialties: string | null
          title: string | null
          type: string
        }
        Insert: {
          email?: string | null
          id?: string
          name: string
          office_hours?: string | null
          phone?: string | null
          photo?: string | null
          profile_text?: string | null
          profile_uri?: string | null
          pronouns?: string | null
          sort_name: string
          source: string
          specialties?: string | null
          title?: string | null
          type: string
        }
        Update: {
          email?: string | null
          id?: string
          name?: string
          office_hours?: string | null
          phone?: string | null
          photo?: string | null
          profile_text?: string | null
          profile_uri?: string | null
          pronouns?: string | null
          sort_name?: string
          source?: string
          specialties?: string | null
          title?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "directory_entry_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
        ]
      }
      directory_entry_category: {
        Row: {
          category: string
          directory_entry: string | null
        }
        Insert: {
          category: string
          directory_entry?: string | null
        }
        Update: {
          category?: string
          directory_entry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directory_entry_category_directory_entry_fkey"
            columns: ["directory_entry"]
            isOneToOne: false
            referencedRelation: "directory_entry"
            referencedColumns: ["id"]
          },
        ]
      }
      directory_entry_location: {
        Row: {
          description: string | null
          directory_entry: string
          email: string | null
          fax: string | null
          hours: string | null
          location: string
          phone: string | null
          source: string
          title: string | null
        }
        Insert: {
          description?: string | null
          directory_entry: string
          email?: string | null
          fax?: string | null
          hours?: string | null
          location: string
          phone?: string | null
          source: string
          title?: string | null
        }
        Update: {
          description?: string | null
          directory_entry?: string
          email?: string | null
          fax?: string | null
          hours?: string | null
          location?: string
          phone?: string | null
          source?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directory_entry_location_directory_entry_fkey"
            columns: ["directory_entry"]
            isOneToOne: false
            referencedRelation: "directory_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directory_entry_location_location_fkey"
            columns: ["location"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directory_entry_location_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
        ]
      }
      directory_entry_organization: {
        Row: {
          description: string | null
          directory_entry: string
          directory_organization: string
          email: string | null
          fax: string | null
          hours: string | null
          phone: string | null
          role: string | null
          source: string
          title: string | null
        }
        Insert: {
          description?: string | null
          directory_entry: string
          directory_organization: string
          email?: string | null
          fax?: string | null
          hours?: string | null
          phone?: string | null
          role?: string | null
          source: string
          title?: string | null
        }
        Update: {
          description?: string | null
          directory_entry?: string
          directory_organization?: string
          email?: string | null
          fax?: string | null
          hours?: string | null
          phone?: string | null
          role?: string | null
          source?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directory_entry_organization_directory_entry_fkey"
            columns: ["directory_entry"]
            isOneToOne: false
            referencedRelation: "directory_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directory_entry_organization_directory_organization_fkey"
            columns: ["directory_organization"]
            isOneToOne: false
            referencedRelation: "directory_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directory_entry_organization_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
        ]
      }
      feed: {
        Row: {
          id: string
          source: string
          title: string
          uri: string
        }
        Insert: {
          id?: string
          source: string
          title: string
          uri: string
        }
        Update: {
          id?: string
          source?: string
          title?: string
          uri?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_article: {
        Row: {
          banner_uri: string | null
          body: string
          campus_location_id: string | null
          id: string
          published_at: string
          source: string
          sponsoring_entity: string | null
          textual_location: string | null
          thumbnail_uri: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          banner_uri?: string | null
          body?: string
          campus_location_id?: string | null
          id?: string
          published_at: string
          source: string
          sponsoring_entity?: string | null
          textual_location?: string | null
          thumbnail_uri?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          banner_uri?: string | null
          body?: string
          campus_location_id?: string | null
          id?: string
          published_at?: string
          source?: string
          sponsoring_entity?: string | null
          textual_location?: string | null
          thumbnail_uri?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_article_campus_location_id_fkey"
            columns: ["campus_location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_article_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_article_sponsoring_entity_fkey"
            columns: ["sponsoring_entity"]
            isOneToOne: false
            referencedRelation: "directory_entry"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_article_category: {
        Row: {
          category_id: string
          feed_article_id: string
        }
        Insert: {
          category_id: string
          feed_article_id: string
        }
        Update: {
          category_id?: string
          feed_article_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_article_category_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "content_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_article_category_feed_article_id_fkey"
            columns: ["feed_article_id"]
            isOneToOne: false
            referencedRelation: "feed_article"
            referencedColumns: ["id"]
          },
        ]
      }
      link: {
        Row: {
          description: string
          image_uri: string | null
          sort_group: string
          sort_title: string | null
          source: string
          subtitle: string
          text_color: string
          tint_color: string
          title: string
          type: string
          uri: string
        }
        Insert: {
          description?: string
          image_uri?: string | null
          sort_group?: string
          sort_title?: string | null
          source: string
          subtitle?: string
          text_color?: string
          tint_color?: string
          title: string
          type: string
          uri?: string
        }
        Update: {
          description?: string
          image_uri?: string | null
          sort_group?: string
          sort_title?: string | null
          source?: string
          subtitle?: string
          text_color?: string
          tint_color?: string
          title?: string
          type?: string
          uri?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
        ]
      }
      livestream: {
        Row: {
          calendar_source: string | null
          email: string | null
          id: string
          logo_uri: string | null
          phone: string | null
          source: string
          stream_uri: string
          subtitle: string
          text_color: string | null
          tint_color: string | null
          title: string
          website: string | null
        }
        Insert: {
          calendar_source?: string | null
          email?: string | null
          id?: string
          logo_uri?: string | null
          phone?: string | null
          source: string
          stream_uri: string
          subtitle: string
          text_color?: string | null
          tint_color?: string | null
          title: string
          website?: string | null
        }
        Update: {
          calendar_source?: string | null
          email?: string | null
          id?: string
          logo_uri?: string | null
          phone?: string | null
          source?: string
          stream_uri?: string
          subtitle?: string
          text_color?: string | null
          tint_color?: string | null
          title?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "livestream_calendar_source_fkey"
            columns: ["calendar_source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livestream_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
        ]
      }
      location: {
        Row: {
          abbreviation: string
          banner_uri: string
          category: string
          coordinates: Json
          email: string
          icon_uri: string
          id: string
          outline_shape: Json
          phone: string
          room_number: string
          source: string
          subtitle: string
          title: string
          website_uri: string
          within: string | null
        }
        Insert: {
          abbreviation?: string
          banner_uri?: string
          category: string
          coordinates?: Json
          email?: string
          icon_uri?: string
          id?: string
          outline_shape?: Json
          phone?: string
          room_number?: string
          source?: string
          subtitle?: string
          title?: string
          website_uri?: string
          within?: string | null
        }
        Update: {
          abbreviation?: string
          banner_uri?: string
          category?: string
          coordinates?: Json
          email?: string
          icon_uri?: string
          id?: string
          outline_shape?: Json
          phone?: string
          room_number?: string
          source?: string
          subtitle?: string
          title?: string
          website_uri?: string
          within?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "location_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_within_fkey"
            columns: ["within"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
        ]
      }
      location_category: {
        Row: {
          id: string
          sort_title: string | null
          source: string
          title: string
        }
        Insert: {
          id?: string
          sort_title?: string | null
          source: string
          title: string
        }
        Update: {
          id?: string
          sort_title?: string | null
          source?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_category_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
        ]
      }
      location_schedule: {
        Row: {
          active_from: string
          active_until: string | null
          audience: string
          id: string
          location: string | null
          location_category: string | null
          message: string | null
          parent_schedule: string | null
          source: string
          status: string
          title: string
        }
        Insert: {
          active_from: string
          active_until?: string | null
          audience?: string
          id?: string
          location?: string | null
          location_category?: string | null
          message?: string | null
          parent_schedule?: string | null
          source: string
          status?: string
          title: string
        }
        Update: {
          active_from?: string
          active_until?: string | null
          audience?: string
          id?: string
          location?: string | null
          location_category?: string | null
          message?: string | null
          parent_schedule?: string | null
          source?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_schedule_location_category_fkey"
            columns: ["location_category"]
            isOneToOne: false
            referencedRelation: "location_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_schedule_location_fkey"
            columns: ["location"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_schedule_parent_schedule_fkey"
            columns: ["parent_schedule"]
            isOneToOne: false
            referencedRelation: "location_schedule"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_schedule_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
        ]
      }
      location_schedule_timetable: {
        Row: {
          days: string
          id: string
          location_schedule_id: string
          open_at: string
          open_for: unknown
          source: string
        }
        Insert: {
          days: string
          id?: string
          location_schedule_id: string
          open_at: string
          open_for: unknown
          source: string
        }
        Update: {
          days?: string
          id?: string
          location_schedule_id?: string
          open_at?: string
          open_for?: unknown
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_schedule_timetable_location_schedule_id_fkey"
            columns: ["location_schedule_id"]
            isOneToOne: false
            referencedRelation: "location_schedule"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_schedule_timetable_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
        ]
      }
      metadata: {
        Row: {
          key: string
          source: string
          value: string
        }
        Insert: {
          key: string
          source: string
          value?: string
        }
        Update: {
          key?: string
          source?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "metadata_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
        ]
      }
      route: {
        Row: {
          id: string
          key: string
          source: string
          title: string
        }
        Insert: {
          id?: string
          key: string
          source: string
          title: string
        }
        Update: {
          id?: string
          key?: string
          source?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
        ]
      }
      route_schedule: {
        Row: {
          active_from: string | null
          active_until: string | null
          route_id: string
          source: string
          timetable_id: string
        }
        Insert: {
          active_from?: string | null
          active_until?: string | null
          route_id: string
          source: string
          timetable_id: string
        }
        Update: {
          active_from?: string | null
          active_until?: string | null
          route_id?: string
          source?: string
          timetable_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_schedule_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "route"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_schedule_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_schedule_timetable_id_fkey"
            columns: ["timetable_id"]
            isOneToOne: false
            referencedRelation: "route_timetable"
            referencedColumns: ["id"]
          },
        ]
      }
      route_stop: {
        Row: {
          coordinates: Json
          id: string
          name: string
          source: string
        }
        Insert: {
          coordinates?: Json
          id?: string
          name: string
          source: string
        }
        Update: {
          coordinates?: Json
          id?: string
          name?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_stop_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
        ]
      }
      route_timetable: {
        Row: {
          id: string
          inbound_stop: string | null
          inbound_time: string | null
          outbound_stop: string | null
          outbound_time: string | null
          source: string
        }
        Insert: {
          id?: string
          inbound_stop?: string | null
          inbound_time?: string | null
          outbound_stop?: string | null
          outbound_time?: string | null
          source: string
        }
        Update: {
          id?: string
          inbound_stop?: string | null
          inbound_time?: string | null
          outbound_stop?: string | null
          outbound_time?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_timetable_inbound_stop_fkey"
            columns: ["inbound_stop"]
            isOneToOne: false
            referencedRelation: "route_stop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_timetable_outbound_stop_fkey"
            columns: ["outbound_stop"]
            isOneToOne: false
            referencedRelation: "route_stop"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_timetable_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
            referencedColumns: ["id"]
          },
        ]
      }
      student_work: {
        Row: {
          category: string
          classification: string | null
          department_id: string | null
          department_name: string | null
          description: string | null
          duties: string | null
          id: string
          pay_rate: string | null
          position_duration: string | null
          position_title: string
          posted_at: string
          qualifications: string | null
          skills: string | null
          source: string
        }
        Insert: {
          category: string
          classification?: string | null
          department_id?: string | null
          department_name?: string | null
          description?: string | null
          duties?: string | null
          id?: string
          pay_rate?: string | null
          position_duration?: string | null
          position_title: string
          posted_at: string
          qualifications?: string | null
          skills?: string | null
          source: string
        }
        Update: {
          category?: string
          classification?: string | null
          department_id?: string | null
          department_name?: string | null
          description?: string | null
          duties?: string | null
          id?: string
          pay_rate?: string | null
          position_duration?: string | null
          position_title?: string
          posted_at?: string
          qualifications?: string | null
          skills?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_work_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "directory_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_work_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "data_source"
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
