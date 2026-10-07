import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useLanguageStore } from '../../context/LanguageStore';
import JoinPinForm from './JoinPinForm';

describe('JoinPinForm host entry point', () => {
  it('offers hosting a game right under the PIN box', () => {
    render(
      <MemoryRouter>
        <JoinPinForm />
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: /host a game/i });
    expect(link).toHaveAttribute('href', '/create');
    expect(screen.getByText(/no account needed/i)).toBeInTheDocument();
  });

  it('says it in Arabic too', () => {
    useLanguageStore.setState({ locale: 'ar' });
    render(
      <MemoryRouter>
        <JoinPinForm />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: /استضف لعبة/ })).toHaveAttribute('href', '/create');
    useLanguageStore.setState({ locale: 'en' });
  });
});
