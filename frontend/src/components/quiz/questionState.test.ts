import { describe, expect, it } from 'vitest';
import { emptyQuestion, MAX_OPTIONS, QUESTION_TYPE_LABELS, trueFalseOptions } from './questionState';

describe('emptyQuestion', () => {
  it('starts as an unanswered MCQ with two options', () => {
    const q = emptyQuestion();
    expect(q.type).toBe('mcq');
    expect(q.options).toHaveLength(2);
    expect(q.correctOptionId).toBe('');
    expect(q.isNew).toBe(true);
  });

  it('gives every option a distinct id', () => {
    // The option id doubles as the map key sent to the API and as the React
    // key, so two options sharing one would collapse a question's answers.
    const q = emptyQuestion();
    expect(new Set(q.options.map(o => o.id)).size).toBe(q.options.length);
  });

  it('does not share ids between questions', () => {
    const a = emptyQuestion();
    const b = emptyQuestion();
    expect(a.id).not.toBe(b.id);
    expect(a.options[0].id).not.toBe(b.options[0].id);
  });

  it('carries defaults the API accepts', () => {
    // entities.QuizQuestion.IsValid rejects a time limit or point value of 0.
    const q = emptyQuestion();
    expect(q.timeLimit).toBeGreaterThan(0);
    expect(q.points).toBeGreaterThan(0);
  });
});

describe('trueFalseOptions', () => {
  it('is True and False with distinct ids', () => {
    const options = trueFalseOptions();
    expect(options.map(o => o.value)).toEqual(['True', 'False']);
    expect(options[0].id).not.toBe(options[1].id);
  });

  it('is a fresh pair each call, not a shared array', () => {
    // Returned by a factory rather than a module constant precisely so two
    // questions switched to True/False cannot share option objects.
    const a = trueFalseOptions();
    const b = trueFalseOptions();
    expect(a).not.toBe(b);
    expect(a[0].id).not.toBe(b[0].id);
  });
});

describe('question type labels', () => {
  it('covers every type the builder offers', () => {
    expect(Object.keys(QUESTION_TYPE_LABELS)).toEqual(['mcq', 'tf', 'short']);
  });

  it('allows more options than a new question starts with', () => {
    expect(MAX_OPTIONS).toBeGreaterThan(emptyQuestion().options.length);
  });
});
