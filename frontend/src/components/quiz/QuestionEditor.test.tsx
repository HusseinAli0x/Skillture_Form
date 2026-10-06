import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import QuestionEditor from './QuestionEditor';
import { emptyQuestion, type QuestionState } from './questionState';

const renderEditor = (overrides: Partial<QuestionState> = {}, onChange = vi.fn()) => {
  const question = { ...emptyQuestion(), ...overrides };
  render(
    <QuestionEditor
      question={question}
      index={0}
      total={2}
      onChange={onChange}
      onRemove={vi.fn()}
      onMove={vi.fn()}
    />
  );
  return { question, onChange };
};

describe('QuestionEditor option editing', () => {
  it('patches options immutably', async () => {
    // The original assigned into the existing option object
    // (`newOpts[optIdx].value = …`), mutating React state in place.
    const { question, onChange } = renderEditor();

    await userEvent.type(screen.getByRole('textbox', { name: 'Option 1' }), 'X');

    const patch = onChange.mock.calls[0][0];
    expect(patch.options[0]).not.toBe(question.options[0]);
    expect(question.options[0].value).toBe('Option A');
  });

  it('clears the correct mark when that option is deleted', async () => {
    // Otherwise the quiz saves a correct_answer no option matches, and the
    // question becomes unanswerable.
    const question = emptyQuestion();
    question.options.push({ id: 'opt-c', value: 'Option C' });
    const { onChange } = renderEditor(
      { options: question.options, correctOptionId: question.options[1].id }
    );

    await userEvent.click(screen.getByRole('button', { name: 'Remove option 2' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ correctOptionId: '' })
    );
  });

  it('keeps the correct mark when a different option is deleted', async () => {
    const question = emptyQuestion();
    question.options.push({ id: 'opt-c', value: 'Option C' });
    const { onChange } = renderEditor(
      { options: question.options, correctOptionId: question.options[0].id }
    );

    await userEvent.click(screen.getByRole('button', { name: 'Remove option 3' }));

    expect(onChange.mock.calls[0][0]).not.toHaveProperty('correctOptionId');
  });

  it('stops offering more options at the cap', () => {
    const options = Array.from({ length: 5 }, (_, i) => ({ id: `o${i}`, value: `Option ${i}` }));
    renderEditor({ options });
    expect(screen.queryByRole('button', { name: /add option/i })).not.toBeInTheDocument();
  });
});

describe('QuestionEditor numeric fields', () => {
  it('does not send NaN while the field is being cleared', async () => {
    // parseInt('') is NaN, which was serialised into the request body as null
    // and rejected by the API's time-limit check.
    const { onChange } = renderEditor({ timeLimit: 20 });

    await userEvent.clear(screen.getByRole('spinbutton', { name: /time/i }));

    for (const [patch] of onChange.mock.calls) {
      if ('timeLimit' in patch) expect(Number.isNaN(patch.timeLimit)).toBe(false);
    }
  });
});

describe('QuestionEditor by type', () => {
  it('offers only True and False for a true/false question', () => {
    renderEditor({
      type: 'tf',
      options: [
        { id: 't', value: 'True' },
        { id: 'f', value: 'False' },
      ],
    });
    expect(screen.getByRole('button', { name: 'True' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add option/i })).not.toBeInTheDocument();
  });

  it('takes a typed answer for a short question', async () => {
    const { onChange } = renderEditor({ type: 'short', options: [], correctOptionId: '' });

    await userEvent.type(screen.getByRole('textbox', { name: 'Correct answer' }), '4');
    expect(onChange).toHaveBeenCalledWith({ correctOptionId: '4' });
  });
});

describe('QuestionEditor reordering', () => {
  it('disables the up arrow on the first question', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: 'Move question up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move question down' })).toBeEnabled();
  });
});
