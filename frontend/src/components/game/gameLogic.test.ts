import { describe, expect, it } from 'vitest';
import {
  answerFeedback,
  correctAnswerText,
  formatPin,
  joinAddresses,
  ordinal,
  parseOptions,
  playUrl,
  rankChanges,
  resultBars,
  sanitizePin,
  secondsLeft,
} from './gameLogic';
import { initials, randomNickname } from '../../lib/avatars';
import { reconnectDelay } from '../../api/ws';

describe('parseOptions', () => {
  it('orders opt_N keys numerically, not alphabetically', () => {
    const opts = parseOptions({ opt_10: { value: 'K' }, opt_2: { value: 'C' }, opt_0: { value: 'A' } });
    expect(opts.map(o => o.label)).toEqual(['A', 'C', 'K']);
  });

  it('puts True before False for legacy random ids', () => {
    const opts = parseOptions({ aaa: { value: 'False' }, bbb: { value: 'True' } });
    expect(opts.map(o => o.label)).toEqual(['True', 'False']);
  });

  it('is empty for a short-answer question', () => {
    expect(parseOptions(undefined)).toEqual([]);
    expect(parseOptions({})).toEqual([]);
  });
});

describe('correctAnswerText', () => {
  it('reads value, text or en', () => {
    expect(correctAnswerText({ value: 'Cairo' })).toBe('Cairo');
    expect(correctAnswerText({ text: 'Giza' })).toBe('Giza');
    expect(correctAnswerText({ en: 'Nile' })).toBe('Nile');
    expect(correctAnswerText(undefined)).toBe('');
  });
});

describe('resultBars', () => {
  const options = [
    { id: 'opt_0', label: 'Cairo' },
    { id: 'opt_1', label: 'Giza' },
    { id: 'opt_2', label: 'Luxor' },
  ];

  it('marks the correct option and scales widths to the leader', () => {
    const bars = resultBars(options, { Cairo: 3, Giza: 1 }, { value: 'Cairo' }, 4);
    expect(bars.map(b => b.count)).toEqual([3, 1, 0]);
    expect(bars.map(b => b.isCorrect)).toEqual([true, false, false]);
    expect(bars[0].width).toBe(100);
    expect(bars[1].width).toBe(33);
    expect(bars[0].percent).toBe(75);
  });

  it('matches votes case- and space-insensitively', () => {
    const bars = resultBars(options, { 'cairo ': 2 }, { value: 'Cairo' }, 2);
    expect(bars[0].count).toBe(2);
  });

  it('keeps votes that match no option', () => {
    const bars = resultBars(options, { Cairo: 1, Alexandria: 2 }, { value: 'Cairo' }, 3);
    expect(bars).toHaveLength(4);
    expect(bars[3]).toMatchObject({ label: 'alexandria', count: 2, isCorrect: false });
  });

  it('shows the right answer of a short question even when nobody typed it', () => {
    const bars = resultBars([], { nope: 2 }, { value: 'Cairo' }, 2);
    expect(bars.some(b => b.isCorrect && b.label === 'Cairo' && b.count === 0)).toBe(true);
  });

  it('never divides by zero when nobody answered', () => {
    const bars = resultBars(options, {}, { value: 'Cairo' }, 0);
    expect(bars.every(b => b.percent === 0 && b.width === 0)).toBe(true);
  });
});

describe('rankChanges', () => {
  it('reports places gained and lost, ignoring new players', () => {
    const prev = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const next = [{ id: 'c' }, { id: 'a' }, { id: 'b' }, { id: 'd' }];
    expect(rankChanges(prev, next)).toEqual({ c: 2, a: -1, b: -1 });
  });
});

describe('pin helpers', () => {
  it('sanitises pasted text to six digits', () => {
    expect(sanitizePin('12a 34-5678')).toBe('123456');
  });
  it('groups for reading aloud', () => {
    expect(formatPin('123456')).toBe('123 456');
    expect(formatPin('12')).toBe('12');
  });
});

describe('ordinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [21, '21st'],
    [112, '112th'],
  ])('%i -> %s', (n, s) => expect(ordinal(n)).toBe(s));
});

describe('joinAddresses', () => {
  const local = { protocol: 'http:', hostname: 'localhost', port: '5180', origin: 'http://localhost:5180' };

  it('offers LAN addresses ahead of localhost', () => {
    const a = joinAddresses(['192.168.0.98'], local);
    expect(a.map(x => x.origin)).toEqual(['http://192.168.0.98:5180', 'http://localhost:5180']);
    expect(a[0].lan).toBe(true);
  });

  it('keeps a real hostname first', () => {
    const a = joinAddresses(['10.0.0.4'], { protocol: 'https:', hostname: 'quiz.example.com', port: '', origin: 'https://quiz.example.com' });
    expect(a[0].origin).toBe('https://quiz.example.com');
  });

  it('falls back to the page origin with no LAN info', () => {
    expect(joinAddresses([], local).map(x => x.origin)).toEqual(['http://localhost:5180']);
  });

  it('builds the join link', () => {
    expect(playUrl('http://192.168.0.98:5180', '123456')).toBe('http://192.168.0.98:5180/play?pin=123456');
  });
});

describe('answerFeedback', () => {
  it('celebrates streaks and names the bonus', () => {
    expect(answerFeedback({ correct: true, points: 900, streak: 3, streakBonus: 90 })).toMatchObject({
      tone: 'correct',
      headline: '3 in a row',
      detail: 'Includes +90 streak bonus',
    });
  });
  it('is gentle on a wrong answer', () => {
    expect(answerFeedback({ correct: false, points: 0 }).tone).toBe('wrong');
  });
});

describe('secondsLeft', () => {
  it('counts down and floors at zero', () => {
    expect(secondsLeft(20, 0, 5000)).toBe(15);
    expect(secondsLeft(20, 0, 99999)).toBe(0);
  });
  it('is null for an untimed question', () => {
    expect(secondsLeft(0, 0, 1000)).toBeNull();
  });
});

describe('avatars helpers', () => {
  it('suggests a two-word nickname', () => {
    expect(randomNickname(() => 0)).toBe('Curious Fox');
    expect(randomNickname(() => 0.999)).toBe('Brave Compass');
  });
  it('takes initials', () => {
    expect(initials('Curious Fox')).toBe('CF');
    expect(initials('  sam ')).toBe('SA');
    expect(initials('')).toBe('?');
  });
});

describe('reconnectDelay', () => {
  it('backs off and caps', () => {
    expect(reconnectDelay(0)).toBe(800);
    expect(reconnectDelay(2)).toBe(2400);
    expect(reconnectDelay(50)).toBe(5000);
  });
});
