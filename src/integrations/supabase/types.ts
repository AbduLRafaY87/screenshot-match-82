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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          author_id: string
          body: string
          course_id: string | null
          created_at: string
          id: string
          is_pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          course_id?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          course_id?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          allow_late: boolean
          attachment_path: string | null
          course_id: string
          created_at: string
          created_by: string
          due_at: string
          id: string
          instructions: string
          max_marks: number
          title: string
          updated_at: string
        }
        Insert: {
          allow_late?: boolean
          attachment_path?: string | null
          course_id: string
          created_at?: string
          created_by: string
          due_at: string
          id?: string
          instructions: string
          max_marks: number
          title: string
          updated_at?: string
        }
        Update: {
          allow_late?: boolean
          attachment_path?: string | null
          course_id?: string
          created_at?: string
          created_by?: string
          due_at?: string
          id?: string
          instructions?: string
          max_marks?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          entity: string
          entity_id?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          entity?: string
          entity_id?: string | null
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string
          course_id: string
          created_at: string
          deleted_at: string | null
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          course_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          course_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          admin_response: string | null
          attachment_path: string | null
          category: string
          course_id: string | null
          created_at: string
          description: string
          id: string
          raised_by: string
          resolved_by: string | null
          status: Database["public"]["Enums"]["complaint_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          admin_response?: string | null
          attachment_path?: string | null
          category: string
          course_id?: string | null
          created_at?: string
          description: string
          id?: string
          raised_by: string
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          admin_response?: string | null
          attachment_path?: string | null
          category?: string
          course_id?: string | null
          created_at?: string
          description?: string
          id?: string
          raised_by?: string
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_teachers: {
        Row: {
          course_id: string
          created_at: string
          teacher_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          teacher_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_teachers_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_teachers_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_archived: boolean
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          course_id: string
          created_at: string
          enrolled_at: string
          student_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          enrolled_at?: string
          student_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          enrolled_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          must_change_password: boolean
          roll_no: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          must_change_password?: boolean
          roll_no?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          must_change_password?: boolean
          roll_no?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quiz_answers: {
        Row: {
          correct_option_ids: string[]
          created_at: string
          question_id: string
        }
        Insert: {
          correct_option_ids: string[]
          created_at?: string
          question_id: string
        }
        Update: {
          correct_option_ids?: string[]
          created_at?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers: Json
          created_at: string
          id: string
          quiz_id: string
          score: number | null
          started_at: string
          student_id: string
          submitted_at: string | null
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          quiz_id: string
          score?: number | null
          started_at?: string
          student_id: string
          submitted_at?: string | null
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          quiz_id?: string
          score?: number | null
          started_at?: string
          student_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          created_at: string
          id: string
          marks: number
          options: Json
          position: number
          prompt: string
          quiz_id: string
          type: Database["public"]["Enums"]["question_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          marks?: number
          options: Json
          position: number
          prompt: string
          quiz_id: string
          type: Database["public"]["Enums"]["question_type"]
        }
        Update: {
          created_at?: string
          id?: string
          marks?: number
          options?: Json
          position?: number
          prompt?: string
          quiz_id?: string
          type?: Database["public"]["Enums"]["question_type"]
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          closes_at: string
          course_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_published: boolean
          opens_at: string
          time_limit_minutes: number
          title: string
          updated_at: string
        }
        Insert: {
          closes_at: string
          course_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_published?: boolean
          opens_at: string
          time_limit_minutes: number
          title: string
          updated_at?: string
        }
        Update: {
          closes_at?: string
          course_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_published?: boolean
          opens_at?: string
          time_limit_minutes?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          id: string
          mime_type: string
          size_bytes: number
          title: string
          uploaded_by: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          id?: string
          mime_type: string
          size_bytes: number
          title: string
          uploaded_by: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          title?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          assignment_id: string
          created_at: string
          feedback: string | null
          file_path: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          is_late: boolean
          marks_obtained: number | null
          student_id: string
          submitted_at: string
          text_answer: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          feedback?: string | null
          file_path?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_late?: boolean
          marks_obtained?: number | null
          student_id: string
          submitted_at?: string
          text_answer?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          feedback?: string | null
          file_path?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_late?: boolean
          marks_obtained?: number | null
          student_id?: string
          submitted_at?: string
          text_answer?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_student_marks: {
        Row: {
          course_id: string | null
          graded_at: string | null
          item_id: string | null
          kind: string | null
          max: number | null
          obtained: number | null
          student_id: string | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      assignment_course: { Args: { _a: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_course_member: {
        Args: { _course: string; _user: string }
        Returns: boolean
      }
      mark_password_changed: { Args: never; Returns: undefined }
      quiz_course: { Args: { _q: string }; Returns: string }
      start_quiz: {
        Args: { _quiz: string }
        Returns: {
          answers: Json
          created_at: string
          id: string
          quiz_id: string
          score: number | null
          started_at: string
          student_id: string
          submitted_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "quiz_attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_quiz: { Args: { _answers: Json; _quiz: string }; Returns: number }
      teaches: { Args: { _course: string; _user: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "teacher" | "student"
      complaint_status: "open" | "in_review" | "resolved" | "rejected"
      question_type: "mcq_single" | "mcq_multi" | "true_false"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "teacher", "student"],
      complaint_status: ["open", "in_review", "resolved", "rejected"],
      question_type: ["mcq_single", "mcq_multi", "true_false"],
    },
  },
} as const
