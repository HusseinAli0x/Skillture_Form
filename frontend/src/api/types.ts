export interface Admin {
  id: string;
  username: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  token: string;
  admin: Admin;
}

// ── Forms ──────────────────────────────────────────────
export type FormStatus = 'draft' | 'published' | 'closed';

export interface Form {
  id: string;
  title: Record<string, string>;
  description?: Record<string, string>;
  status: FormStatus;
  creat_at: string;
}

export type FieldType = 'text' | 'textarea' | 'number' | 'email' | 'select' | 'radio' | 'checkbox' | 'date';

export const FieldTypeToInt: Record<FieldType, number> = {
  text: 1, textarea: 2, number: 3, email: 4,
  select: 5, radio: 6, checkbox: 7, date: 8,
};

export const FieldTypeLabels: Record<FieldType, string> = {
  text: 'Short Text', textarea: 'Long Text', number: 'Number',
  email: 'Email', select: 'Dropdown', radio: 'Radio', checkbox: 'Checkbox', date: 'Date',
};

export interface FormField {
  id: string;
  form_id: string;
  label: Record<string, string>;
  placeholder?: Record<string, string>;
  help_text?: Record<string, string>;
  required: boolean;
  options?: Record<string, any>;
  field_order: number;
  type: number;
  created_at: string;
  updated_at: string;
}

// ── Responses ─────────────────────────────────────────
export type ResponseStatus = 0 | 1 | 2; // Pending, Submitted, Reviewed

export interface ResponseAnswer {
  id: string;
  response_id: string;
  field_id: string;
  value: Record<string, any>;
  created_at: string;
}

export interface FormResponse {
  id: string;
  form_id: string;
  respondent?: Record<string, any>;
  status: ResponseStatus;
  submitted_at: string;
  answers?: ResponseAnswer[];
}

// ── Quiz Game ──────────────────────────────────────────
export type QuizStatus = 'draft' | 'active' | 'archived';

export interface Quiz {
  id: string;
  title: Record<string, string>;
  description?: Record<string, string>;
  status: QuizStatus;
  created_at: string;
  updated_at: string;
}

export type QuizQuestionType = 'mcq' | 'tf' | 'short';

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question: Record<string, string>;
  type: QuizQuestionType;
  position: number;
  time_limit_sec: number;
  points: number;
  options?: Record<string, any>;
  correct_answer: Record<string, any>;
}

export type SessionState = 'waiting' | 'in_progress' | 'finished';

export interface QuizSession {
  id: string;
  quiz_id: string;
  host_id: string;
  pin: string;
  state: SessionState;
  current_question_id?: string;
  started_at?: string;
  finished_at?: string;
}
