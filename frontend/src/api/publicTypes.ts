import type { Localized } from '../lib/i18n';

export const WORKSHOP_TRACKS = ['technical', 'career', 'industry', 'business'] as const;
export type WorkshopTrack = (typeof WORKSHOP_TRACKS)[number];

export const TEAM_GROUPS = ['leadership', 'core', 'volunteer', 'alumni'] as const;
export type TeamGroup = (typeof TEAM_GROUPS)[number];

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
  registration_url: string | null;
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
