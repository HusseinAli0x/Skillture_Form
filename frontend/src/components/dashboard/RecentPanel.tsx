import React from 'react';
import { ArrowRight, Edit2, Plus, Share2 } from 'lucide-react';
import StatusDropdown, { type StatusValue } from '../StatusDropdown';
import { Card, CardHeader, IconButton, Button, SkeletonRows } from '../ui';

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

const SHOWN = 4;

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
          type="button"
          onClick={onViewAll}
          className="text-xs font-medium inline-flex items-center gap-1 px-1 min-h-8 rounded text-primary hover:text-primary-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          View all <ArrowRight className="w-3 h-3 rtl:rotate-180" />
        </button>
      }
    />

    {isLoading ? (
      <SkeletonRows rows={3} label={`Loading ${heading.toLowerCase()}`} />
    ) : items.length === 0 ? (
      <div className="px-5 py-8 text-center">
        <p className="text-sm mb-3 text-muted">{emptyLabel}</p>
        <Button variant="subtle" size="sm" onClick={onCreate}>
          <Plus className="w-3.5 h-3.5" /> {createLabel}
        </Button>
      </div>
    ) : (
      items.slice(0, SHOWN).map((item, i) => (
        <div
          key={item.id}
          className={`flex items-center gap-3 px-5 py-3 transition-colors hover:bg-hover-overlay ${
            i < Math.min(items.length, SHOWN) - 1 ? 'border-b border-border' : ''
          }`}
        >
          <button
            type="button"
            onClick={() => onOpen(item.id)}
            className="flex items-center gap-3 flex-1 min-w-0 text-start rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary-subtle border border-primary-border-soft text-primary">
              {icon}
            </span>
            <span className="block text-sm font-medium truncate text-text">{item.title}</span>
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
