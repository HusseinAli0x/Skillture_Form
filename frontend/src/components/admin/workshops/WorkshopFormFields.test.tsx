import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import WorkshopFormFields from './WorkshopFormFields';
import { EMPTY_WORKSHOP_FORM, type WorkshopForm } from './workshopModel';

const Harness = ({ initial = EMPTY_WORKSHOP_FORM, errors = {} }: { initial?: WorkshopForm; errors?: Record<string, string> }) => {
  const [form, setForm] = useState(initial);
  return (
    <>
      <WorkshopFormFields
        form={form}
        errors={errors}
        patch={p => setForm(f => ({ ...f, ...p }))}
        upload={async () => '/x.png'}
        onBusyChange={() => {}}
        afterOpen={false}
      />
      <output data-testid="state">{JSON.stringify({ open: form.registration_open, cap: form.capacity })}</output>
    </>
  );
};

describe('WorkshopFormFields registration section', () => {
  it('has registrations on by default and toggles them', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const toggle = screen.getByRole('switch', { name: /accept registrations on the website/i });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('state')).toHaveTextContent('"open":false');
  });

  it('takes an optional seat limit and explains the automatic close', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByLabelText(/seat limit/i);
    expect(input).toHaveValue(null);
    expect(screen.getByText(/closes automatically when the seats are taken/i)).toBeInTheDocument();
    await user.type(input, '40');
    expect(screen.getByTestId('state')).toHaveTextContent('"cap":"40"');
  });

  it('shows a seat-limit error beside the field', () => {
    render(<Harness errors={{ capacity: 'Use a whole number from 1 to 100,000.' }} />);
    expect(screen.getByLabelText(/seat limit/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/whole number from 1 to 100,000/i)).toBeInTheDocument();
  });

  it('relabels the external registration link', () => {
    render(<Harness />);
    expect(screen.getByLabelText(/external registration link \(optional\)/i)).toBeInTheDocument();
  });
});
