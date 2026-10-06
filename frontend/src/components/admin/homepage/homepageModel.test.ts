import { describe, expect, it } from 'vitest';
import {
  contentToState,
  factErrors,
  factsPayload,
  matchesTrackName,
  newPillar,
  pillarErrors,
  pillarNum,
  pillarsPayload,
  samePillars,
  sameText,
  type HomepageContent,
} from './homepageModel';

const api: HomepageContent = {
  hero_kicker: 'k',
  hero_title: 'Hero',
  hero_subtitle: 'Sub',
  cta_primary_text: 'a',
  cta_secondary_text: 'b',
  about_kicker: 'ak',
  about_title: 'About',
  about_body1: 'b1',
  about_body2: 'b2',
  about_facts: [{ value: '10', label: 'Things' }],
  offer_kicker: 'ok',
  offer_title: 'Offer',
  offer_subtitle: 'OSub',
  offer_pillars: [{ num: '01', title: 'Technical', description: 'd', points: ['x'] }],
};

describe('contentToState', () => {
  it('maps the API response and pads slots', () => {
    const s = contentToState(api);
    expect(s.text.hero_title).toBe('Hero');
    expect(s.facts).toHaveLength(3);
    expect(s.pillars[0].points).toEqual(['x', '', '']);
  });

  it('survives an empty response', () => {
    const s = contentToState({});
    expect(s.text.hero_title).toBe('');
    expect(s.pillars).toHaveLength(1);
  });
});

describe('payloads', () => {
  it('numbers a pillar with a blank num by position', () => {
    expect(pillarNum({ ...newPillar(), num: ' ' }, 2)).toBe('03');
    expect(pillarNum({ ...newPillar(), num: 'A' }, 2)).toBe('A');
  });

  it('drops empty bullets and trims', () => {
    const p = { ...newPillar(), title: ' T ', description: 'D', points: ['a', '  ', 'c'] };
    expect(pillarsPayload([p])).toEqual([{ num: '01', title: 'T', description: 'D', points: ['a', 'c'] }]);
  });

  it('trims facts', () => {
    expect(factsPayload([{ key: 'k', value: ' 5 ', label: ' x ' }])).toEqual([{ value: '5', label: 'x' }]);
  });
});

describe('dirty comparison', () => {
  it('ignores client keys and padding', () => {
    const a = contentToState(api).pillars;
    const b = contentToState(api).pillars;
    expect(samePillars(a, b)).toBe(true);
  });

  it('sees a reorder and an edit', () => {
    const two = { ...api, offer_pillars: [...api.offer_pillars, { num: '02', title: 'Career', description: 'e', points: [] }] };
    const a = contentToState(two).pillars;
    expect(samePillars(a, [...a].reverse())).toBe(false);
    expect(samePillars(a, a.map((p, i) => (i === 0 ? { ...p, title: 'Tech' } : p)))).toBe(false);
  });

  it('compares text', () => {
    const t = contentToState(api).text;
    expect(sameText(t, { ...t })).toBe(true);
    expect(sameText(t, { ...t, hero_title: 'x' })).toBe(false);
  });
});

describe('validation', () => {
  it('flags incomplete facts and pillars by index', () => {
    const s = contentToState(api);
    expect(Object.keys(factErrors(s.facts))).toEqual(['1', '2']);
    expect(pillarErrors(s.pillars)).toEqual({});
    expect(Object.keys(pillarErrors([newPillar()]))).toEqual(['0']);
  });
});

describe('matchesTrackName', () => {
  it('recognises the four track names, any case', () => {
    expect(matchesTrackName(' Technical ')).toBe(true);
    expect(matchesTrackName('Design')).toBe(false);
  });
});
