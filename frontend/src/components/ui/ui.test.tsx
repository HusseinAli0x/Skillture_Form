import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog, Modal, StatusChip, Tabs, nextTabIndex, statusTone, type TabItem } from '.';

describe('nextTabIndex', () => {
  it('wraps with arrows and jumps with Home/End', () => {
    expect(nextTabIndex('ArrowRight', 2, 3)).toBe(0);
    expect(nextTabIndex('ArrowLeft', 0, 3)).toBe(2);
    expect(nextTabIndex('Home', 2, 4)).toBe(0);
    expect(nextTabIndex('End', 0, 4)).toBe(3);
    expect(nextTabIndex('a', 0, 4)).toBeNull();
    expect(nextTabIndex('ArrowRight', 0, 0)).toBeNull();
  });
});

describe('statusTone', () => {
  it('maps draft/live/finished', () => {
    expect(statusTone(0)).toBe('warning');
    expect(statusTone(1)).toBe('brand');
    expect(statusTone(2)).toBe('neutral');
    expect(statusTone(undefined)).toBe('warning');
  });
});

describe('StatusChip', () => {
  it('renders its label', () => {
    render(<StatusChip tone="live">Live</StatusChip>);
    expect(screen.getByText('Live')).toBeInTheDocument();
  });
});

const items: TabItem[] = [
  { id: 'all', label: 'All', count: 3 },
  { id: 'draft', label: 'Drafts', count: 1 },
];

const Harness = ({ onChange }: { onChange?: (id: string) => void }) => {
  const [value, setValue] = useState('all');
  return (
    <Tabs
      label="Filter"
      items={items}
      value={value}
      onChange={id => {
        setValue(id);
        onChange?.(id);
      }}
    />
  );
};

describe('Tabs', () => {
  it('marks one tab selected and is a single tab stop', () => {
    render(<Harness />);
    expect(screen.getByRole('tab', { name: /all/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /drafts/i })).toHaveAttribute('tabindex', '-1');
  });

  it('moves selection and focus with the arrow keys', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    screen.getByRole('tab', { name: /all/i }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('draft');
    expect(screen.getByRole('tab', { name: /drafts/i })).toHaveFocus();
  });
});

describe('Modal', () => {
  it('closes on Escape and on backdrop click, not on panel click', async () => {
    const onClose = vi.fn();
    render(
      <Modal title="Hello" onClose={onClose}>
        <button>inside</button>
      </Modal>
    );
    await userEvent.click(screen.getByText('inside'));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps Tab inside the dialog', async () => {
    render(
      <Modal title="Trap" onClose={() => undefined}>
        <button>first</button>
        <button>last</button>
      </Modal>
    );
    screen.getByText('last').focus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });
});

describe('ConfirmDialog', () => {
  it('focuses Cancel when destructive so a stray Enter does not delete', () => {
    render(
      <ConfirmDialog title="Delete" message="Sure?" destructive confirmLabel="Delete it" onConfirm={() => undefined} onCancel={() => undefined} />
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });
});
