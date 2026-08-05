import React from 'react';
import { ArrowRight, Edit2, Plus, Share2 } from 'lucide-react';
import StatusDropdown, { type StatusValue } from '../StatusDropdown';
import { Card, CardHeader, IconButton, Button } from '../ui';

export interface RecentItem {
  id: string;
  title: string;
  status: StatusValue;
  raw: unknown;
}

interface Props {
  heading: string;
  type: 'form' | 'quiz';
  icon: React.ReactNode;
  items: RecentItem[];
  isLoading: boolean;
  emptyLabel: string;
  createLabel: string;
  onViewAll: () => void;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onShare: (id: string) => void;
}

/**
 * "Recent forms" / "Recent quizzes" list. The two panels were duplicated
 * markup differing only in labels, icon and routes.
 */
const RecentPanel: React.FC<Props> = ({
  heading,
  type,
  icon,
  items,
  isLoading,
  emptyLabel,
  createLabel,
  onViewAll,
  onCreate,
  onOpen,
  onEdit,
  onShare,
}) => (
  <Card>
    <CardHeader
      title={heading}
      action={
        <button
          onClick={onViewAll}
          className="text-xs font-medium flex items-center gap-1 text-primary hover:text-primary-hover transition-colors"
        >
          View all <ArrowRight className="w-3 h-3" />
        </button>
      }
    />

    {isLoading ? (
      <p className="px-5 py-8 text-center text-sm text-muted">Loading…</p>
    ) : items.length === 0 ? (
      <div className="px-5 py-8 text-center">
        <p className="text-sm mb-3 text-muted">{emptyLabel}</p>
        <Button variant="subtle" size="sm" onClick={onCreate}>
          <Plus className="w-3.5 h-3.5" /> {createLabel}
        </Button>
      </div>
    ) : (
      items.slice(0, 4).map((item, i) => (
        <div
          key={item.id}
          className={`flex items-center gap-3 px-5 py-3 transition-colors hover:bg-hover-overlay ${
            i < Math.min(items.length, 4) - 1 ? 'border-b border-border' : ''
          }`}
        >
          <button
            onClick={() => onOpen(item.id)}
            className="flex items-center gap-3 flex-1 min-w-0 text-left"
          >
            <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary-subtle border border-primary-border-soft text-primary">
              {icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium truncate text-text">{item.title}</span>
            </span>
          </button>

          <div className="flex items-center gap-1">
            {/* Rendered outside the button above — a dropdown cannot be nested
                inside another button element. */}
            <StatusDropdown type={type} id={item.id} initialStatus={item.status} />
            <IconButton label={`Edit ${type}`} tone="primary" onClick={() => onEdit(item.id)}>
              <Edit2 className="w-4 h-4" />
            </IconButton>
            <IconButton label={`Share ${type}`} tone="info" onClick={() => onShare(item.id)}>
              <Share2 className="w-4 h-4" />
            </IconButton>
          </div>
        </div>
      ))
    )}
  </Card>
);

export default RecentPanel;
