// Wire types for the Go API.
//
// These must mirror the `json:` tags on the entities in
// backend/internal/domain/entities. Several of them previously did not:
// Form.status and Quiz.status were typed as string unions while the API sends
// int16 enums, so the dashboard stat cards compared `q.status === 'active'`
// against the number 1 and read zero forever. Call sites worked around it with
// `form.status as any as 0 | 1 | 2` instead of correcting the type.

export interface Admin {
  id: string;
  username: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  token: string;
  expires_at: string;
  admin: Admin;
}

// ── Forms ──────────────────────────────────────────────
// enums.FormStatus is an int16: 0 = draft, 1 = published, 2 = closed.
export const FormStatus = {
  Draft: 0,
  Published: 1,
  Closed: 2,
} as const;
export type FormStatus = (typeof FormStatus)[keyof typeof FormStatus];

export const FormStatusLabels: Record<FormStatus, string> = {
  [FormStatus.Draft]: 'Draft',
  [FormStatus.Published]: 'Published',
  [FormStatus.Closed]: 'Closed',
};

export interface Form {
  id: string;
  title: Record<string, string>;
  description?: Record<string, string>;
  status: FormStatus;
  /** Misspelled on the backend too (`json:"creat_at"`); kept in sync deliberately. */
  creat_at: string;
}

// enums.FieldType is an int16 starting at 1.
export const FieldType = {
  Text: 1,
  Textarea: 2,
  Number: 3,
  Email: 4,
  Select: 5,
  Radio: 6,
  Checkbox: 7,
  Date: 8,
} as const;
export type FieldType = (typeof FieldType)[keyof typeof FieldType];

export const FieldTypeLabels: Record<FieldType, string> = {
  [FieldType.Text]: 'Short Text',
  [FieldType.Textarea]: 'Long Text',
  [FieldType.Number]: 'Number',
  [FieldType.Email]: 'Email',
  [FieldType.Select]: 'Dropdown',
  [FieldType.Radio]: 'Radio',
  [FieldType.Checkbox]: 'Checkbox',
  [FieldType.Date]: 'Date',
};

export interface FormField {
  id: string;
  form_id: string;
  label: Record<string, string>;
  placeholder?: Record<string, string>;
  help_text?: Record<string, string>;
  /** entities.FormField tags this `json:"required"` — not `is_required`. */
  required: boolean;
  options?: Record<string, unknown>;
  field_order: number;
  type: FieldType;
  created_at: string;
  updated_at: string;
}

// ── Responses ─────────────────────────────────────────
export const ResponseStatus = {
  Pending: 0,
  Submitted: 1,
  Reviewed: 2,
} as const;
export type ResponseStatus = (typeof ResponseStatus)[keyof typeof ResponseStatus];

export interface ResponseAnswer {
  id: string;
  response_id: string;
  field_id: string;
  value: Record<string, unknown>;
  created_at: string;
}

export interface FormResponse {
  id: string;
  form_id: string;
  respondent?: Record<string, unknown>;
  status: ResponseStatus;
  submitted_at: string;
  answers?: ResponseAnswer[];
}

// ── Quiz Game ──────────────────────────────────────────
// enums.QuizStatus is an int16: 0 = draft, 1 = active, 2 = archived.
export const QuizStatus = {
  Draft: 0,
  Active: 1,
  Archived: 2,
} as const;
export type QuizStatus = (typeof QuizStatus)[keyof typeof QuizStatus];

export const QuizStatusLabels: Record<QuizStatus, string> = {
  [QuizStatus.Draft]: 'Draft',
  [QuizStatus.Active]: 'Active',
  [QuizStatus.Archived]: 'Archived',
};

export interface Quiz {
  id: string;
  title: Record<string, string>;
  description?: Record<string, string>;
  status: QuizStatus;
  created_at: string;
  updated_at: string;
}

// enums.QuizQuestionType is a string enum.
export type QuizQuestionType = 'mcq' | 'tf' | 'short';

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question: Record<string, string>;
  type: QuizQuestionType;
  position: number;
  time_limit_sec: number;
  points: number;
  options?: Record<string, unknown>;
  /**
   * Admin-only. The player-facing broadcast uses entities.PublicQuizQuestion,
   * which omits this field — see PublicQuizQuestion below.
   */
  correct_answer: Record<string, unknown>;
}

/** What players receive over the WebSocket when the host advances. */
export type PublicQuizQuestion = Omit<QuizQuestion, 'correct_answer'>;

// enums.QuizSessionStatus is a string enum, and the field is `status`, not `state`.
export type QuizSessionStatus = 'lobby' | 'active' | 'finished';

export interface QuizSession {
  id: string;
  quiz_id: string;
  /** Null once the hosting admin is deleted — the session outlives them. */
  host_id?: string;
  pin: string;
  status: QuizSessionStatus;
  current_question_id?: string;
  created_at: string;
  started_at?: string;
  finished_at?: string;
}

/**
 * A row of the leaderboard — entities.QuizPlayer.
 *
 * avatar_id/avatar_url are optional: a player who joined before avatars
 * existed has neither, and the UI falls back to a deterministic glyph
 * (see lib/avatars.ts) rather than rendering blank.
 */
export interface QuizPlayer {
  id: string;
  session_id: string;
  name: string;
  score: number;
  joined_at: string;
  avatar_id?: number;
  avatar_url?: string;
}
