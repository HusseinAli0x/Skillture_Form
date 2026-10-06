import { describe, expect, it } from 'vitest';
import {
  duplicateQuestion,
  emptyQuestion,
  formatDuration,
  quizSnapshot,
  readQuestion,
  serializeQuestion,
  summarizeQuiz,
  validateQuestion,
} from './questionState';

describe('validateQuestion', () => {
  const valid = () => {
    const q = emptyQuestion();
    q.question = 'What is 2 + 2?';
    q.options = [
      { id: 'a', value: '3' },
      { id: 'b', value: '4' },
    ];
    q.correctOptionId = 'b';
    return q;
  };

  it('accepts a complete question', () => {
    expect(validateQuestion(valid())).toEqual([]);
  });

  it('asks for the question text, the right answer and no empty options', () => {
    const q = emptyQuestion();
    q.options[0].value = '  ';
    const fields = validateQuestion(q).map(i => i.field);
    expect(fields).toEqual(expect.arrayContaining(['text', 'options', 'answer']));
  });

  it('flags identical answers', () => {
    const q = valid();
    q.options[0].value = ' FOUR ';
    q.options[1].value = 'four';
    expect(validateQuestion(q).some(i => i.field === 'options')).toBe(true);
  });

  it('wants an expected answer for a short question, not an option', () => {
    const q = { ...valid(), type: 'short' as const, options: [], correctOptionId: '' };
    expect(validateQuestion(q).map(i => i.field)).toEqual(['answer']);
    expect(validateQuestion({ ...q, correctOptionId: 'way' })).toEqual([]);
  });

  it('rejects zero points and zero seconds, which the API refuses', () => {
    const fields = validateQuestion({ ...valid(), points: 0, timeLimit: 0 }).map(i => i.field);
    expect(fields).toEqual(expect.arrayContaining(['points', 'time']));
  });
});

describe('serializeQuestion', () => {
  it('writes ordered opt_N keys and the correct answer by value', () => {
    const q = emptyQuestion();
    q.question = ' Q ';
    q.options = [
      { id: 'zzz', value: 'First' },
      { id: 'aaa', value: 'Second' },
    ];
    q.correctOptionId = 'aaa';
    const out = serializeQuestion(q);
    expect(Object.keys(out.options)).toEqual(['opt_0', 'opt_1']);
    expect(out.options.opt_0.value).toBe('First');
    expect(out.correct_answer).toEqual({ value: 'Second' });
    expect(out.question).toEqual({ en: 'Q' });
    expect(out.id).toBeUndefined();
  });

  it('sends the server id for a saved question and no options for a short one', () => {
    const q = { ...emptyQuestion(), isNew: false, id: 'srv-1', type: 'short' as const, options: [], correctOptionId: 'way' };
    const out = serializeQuestion(q);
    expect(out.id).toBe('srv-1');
    expect(out.options).toEqual({});
    expect(out.correct_answer).toEqual({ value: 'way' });
  });
});

describe('readQuestion', () => {
  it('round-trips through serializeQuestion in the original option order', () => {
    const q = emptyQuestion();
    q.question = 'Pick';
    q.options = ['A', 'B', 'C', 'D', 'E'].map((v, i) => ({ id: `r${i}`, value: v }));
    q.correctOptionId = 'r3';
    const wire = serializeQuestion(q);
    // JSONB hands keys back in its own order; simulate a shuffled one.
    const shuffled = Object.fromEntries(Object.entries(wire.options).reverse());
    const back = readQuestion({ ...wire, id: 'srv', quiz_id: 'qz', position: 1, options: shuffled } as never);
    expect(back.options.map(o => o.value)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(back.options.find(o => o.id === back.correctOptionId)?.value).toBe('D');
  });
});

describe('duplicateQuestion', () => {
  it('copies with new ids and a correct mark that follows its option', () => {
    const q = emptyQuestion();
    q.options = [
      { id: 'a', value: 'X' },
      { id: 'b', value: 'Y' },
    ];
    q.correctOptionId = 'b';
    const copy = duplicateQuestion({ ...q, isNew: false });
    expect(copy.id).not.toBe(q.id);
    expect(copy.isNew).toBe(true);
    expect(copy.options.map(o => o.id)).not.toContain('a');
    expect(copy.options.find(o => o.id === copy.correctOptionId)?.value).toBe('Y');
  });
});

describe('quiz summary and snapshot', () => {
  it('totals points and timers', () => {
    const a = { ...emptyQuestion(), points: 500, timeLimit: 10 };
    const b = { ...emptyQuestion(), points: 1000, timeLimit: 20 };
    expect(summarizeQuiz([a, b])).toEqual({ count: 2, points: 1500, seconds: 30 });
    expect(formatDuration(45)).toBe('45 sec');
    expect(formatDuration(300)).toBe('5 min');
  });

  it('changes when the author edits and not otherwise', () => {
    const q = emptyQuestion();
    const base = quizSnapshot('T', '', [q]);
    expect(quizSnapshot('T', '', [q])).toBe(base);
    expect(quizSnapshot('T2', '', [q])).not.toBe(base);
    expect(quizSnapshot('T', '', [{ ...q, points: 5 }])).not.toBe(base);
  });
});
