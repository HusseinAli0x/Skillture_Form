import { describe, expect, it } from 'vitest';
import { fieldForServerMessage, sentence } from './serverErrors';

const FIELDS = {
  title: 'title',
  description: 'description',
  event_date: 'event_date',
  registration_url: 'registration_url',
  gallery: 'gallery',
  attendees: 'attendees',
  track: 'track',
  capacity: 'capacity',
};

describe('fieldForServerMessage', () => {
  it('matches the validation messages the workshop API produces', () => {
    expect(fieldForServerMessage('title requires both an English and an Arabic value', FIELDS)).toBe('title');
    expect(fieldForServerMessage('event_date must be YYYY-MM-DD', FIELDS)).toBe('event_date');
    expect(fieldForServerMessage('registration_url must be an http(s) URL', FIELDS)).toBe('registration_url');
    expect(fieldForServerMessage('attendees cannot be negative', FIELDS)).toBe('attendees');
    expect(fieldForServerMessage('track must be one of: technical, career, industry, business', FIELDS)).toBe('track');
  });

  it('maps the seat-limit message to the capacity field', () => {
    expect(
      fieldForServerMessage('capacity must be between 1 and 100000, or left empty for no limit', FIELDS)
    ).toBe('capacity');
  });

  it('finds the field when it is not the first word', () => {
    expect(fieldForServerMessage('a workshop gallery holds at most 12 images', FIELDS)).toBe('gallery');
  });

  it('prefers the earliest mention', () => {
    // "track" appears later in the sentence than "title".
    expect(fieldForServerMessage('title is wrong for this track', FIELDS)).toBe('title');
  });

  it('does not match inside a longer word', () => {
    expect(fieldForServerMessage('subtitles are not supported', FIELDS)).toBeNull();
  });

  it('returns null for messages about no field', () => {
    expect(fieldForServerMessage('Invalid request payload', FIELDS)).toBeNull();
    expect(fieldForServerMessage('', FIELDS)).toBeNull();
  });
});

describe('sentence', () => {
  it('capitalises', () => {
    expect(sentence('title is required')).toBe('Title is required');
    expect(sentence('')).toBe('');
  });
});
