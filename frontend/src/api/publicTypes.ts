import type { Localized } from '../lib/i18n';

export const WORKSHOP_TRACKS = ['technical', 'career', 'industry', 'business'] as const;
export type WorkshopTrack = (typeof WORKSHOP_TRACKS)[number];

export const TEAM_GROUPS = ['leadership', 'core', 'volunteer', 'alumni'] as const;
export type TeamGroup = (typeof TEAM_GROUPS)[number];

/**
 * Where a workshop stands for sign-ups: `ended` once the date has passed,
 * `closed` when the organiser switched registration off, `full` at capacity.
 */
export type RegistrationStatus = 'open' | 'full' | 'closed' | 'ended';

/** A workshop as served by the public API, upcoming or past. */
export interface PublicWorkshop {
  id: string;
  title: Localized;
  description: Localized;
  extra_info?: Localized;
  image_path: string | null;
  event_date: string;
  event_time: string | null;
  track: WorkshopTrack | null;
  location: string | null;
  speaker: string | null;
  attendees: number | null;
  outcome?: Localized;
  recap?: Localized;
  gallery: string[];
  /** External sign-up link, if the organiser uses another site. */
  registration_url: string | null;
  registration_open: boolean;
  /** Seat limit; null means no limit. */
  capacity: number | null;
  registered: number;
  /** Seats remaining; null means no limit. */
  spots_left: number | null;
  registration_status: RegistrationStatus;
}

export interface TeamMember {
  id: string;
  name: Localized;
  role: Localized;
  bio?: Localized;
  photo_path: string | null;
  linkedin_url: string | null;
  group: TeamGroup;
  sort_order: number;
}

export interface Impact {
  workshops_held: number;
  workshops_upcoming: number;
  attendees_total: number;
  tracks: Record<WorkshopTrack, number>;
}
