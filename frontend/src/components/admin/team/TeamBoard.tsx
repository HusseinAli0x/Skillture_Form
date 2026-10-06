import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, GripVertical, Link2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { IconButton, Input } from '../../ui';
import { GROUPS, inGroup, initialsOf, matchesQuery, type Group, type Member } from './teamModel';

/** Photo as the public Team page crops it (4:5), or initials when there is none. */
export const MemberPhoto: React.FC<{ photo: string | null; name: string; className?: string }> = ({
  photo,
  name,
  className = 'w-16',
}) => (
  <div className={`${className} aspect-[4/5] shrink-0 overflow-hidden rounded-md border border-border bg-panel-2`}>
    {photo ? (
      <img src={photo} alt="" loading="lazy" className="w-full h-full object-cover" />
    ) : (
      <div
        aria-hidden="true"
        className="w-full h-full flex items-center justify-center bg-primary-soft text-primary font-display text-xl font-bold"
      >
        {initialsOf(name)}
      </div>
    )}
  </div>
);

interface ToolbarProps {
  query: string;
  onQuery: (q: string) => void;
  group: Group | 'all';
  onGroup: (g: Group | 'all') => void;
  members: Member[];
}

export const TeamToolbar: React.FC<ToolbarProps> = ({ query, onQuery, group, onGroup, members }) => {
  const options: { value: Group | 'all'; label: string; n: number }[] = [
    { value: 'all', label: 'Everyone', n: members.length },
    ...GROUPS.map(g => ({ value: g.value, label: g.label, n: members.filter(m => m.group === g.value).length })),
  ];
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
      <div className="relative lg:w-72">
        <Search aria-hidden="true" className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
        <Input
          type="search"
          aria-label="Search the team"
          placeholder="Search by name or role"
          value={query}
          onChange={e => onQuery(e.target.value)}
          className="!ps-9"
        />
      </div>
      <div role="group" aria-label="Filter by group" className="flex flex-wrap gap-1 rounded-lg border border-border p-0.5 bg-bg w-fit max-w-full">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            aria-pressed={group === o.value}
            onClick={() => onGroup(o.value)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              group === o.value ? 'bg-primary text-bg' : 'text-muted hover:text-text'
            }`}
          >
            {o.label} <span className="opacity-70">{o.n}</span>
          </button>
        ))}
      </div>
      {(query || group !== 'all') && (
        <button
          type="button"
          onClick={() => {
            onQuery('');
            onGroup('all');
          }}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover"
        >
          <X aria-hidden="true" className="w-3 h-3" /> Clear
        </button>
      )}
    </div>
  );
};

interface CardProps {
  member: Member;
  index: number;
  count: number;
  canReorder: boolean;
  dragging: boolean;
  dropTarget: boolean;
  onEdit: (m: Member) => void;
  onDelete: (m: Member) => void;
  onMove: (id: string, to: number) => void;
  onDragStart: (id: string) => void;
  onDragEnter: (id: string) => void;
  onDrop: (id: string, index: number) => void;
  onDragEnd: () => void;
}

const MemberCard: React.FC<CardProps> = ({
  member: m,
  index,
  count,
  canReorder,
  dragging,
  dropTarget,
  onEdit,
  onDelete,
  onMove,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
}) => (
  <li
    draggable={canReorder}
    onDragStart={e => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', m.id);
      onDragStart(m.id);
    }}
    onDragOver={e => {
      if (!canReorder) return;
      e.preventDefault();
      onDragEnter(m.id);
    }}
    onDrop={e => {
      e.preventDefault();
      onDrop(m.id, index);
    }}
    onDragEnd={onDragEnd}
    className={`rounded-xl border bg-panel p-3 flex gap-3 transition-colors ${
      dropTarget ? 'border-primary ring-1 ring-primary' : 'border-border'
    } ${dragging ? 'opacity-50' : ''}`}
  >
    <MemberPhoto photo={m.photo_path} name={m.name.en} />
    <div className="min-w-0 flex-1 flex flex-col">
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text truncate">{m.name.en}</p>
          <p lang="ar" dir="rtl" className="text-xs text-muted truncate w-fit max-w-full">
            {m.name.ar}
          </p>
        </div>
        {canReorder && count > 1 && (
          <span title="Drag to reorder" aria-hidden="true" className="text-muted/60 cursor-grab pt-0.5">
            <GripVertical className="w-4 h-4" />
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted truncate">{m.role.en}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
        <span className="font-semibold text-text/80">#{index + 1}</span>
        {!m.photo_path && <span className="rounded border border-warning-border bg-warning-soft px-1.5 text-warning">No photo</span>}
        {m.linkedin_url && (
          <span className="inline-flex items-center gap-1">
            <Link2 aria-hidden="true" className="w-3 h-3" /> LinkedIn
          </span>
        )}
      </div>
      <div className="mt-auto pt-2 flex items-center gap-0.5 -ms-1.5">
        <IconButton
          label={`Move ${m.name.en} earlier`}
          disabled={!canReorder || index === 0}
          onClick={() => onMove(m.id, index - 1)}
          className="rtl:rotate-180"
        >
          <ArrowLeft className="w-4 h-4" />
        </IconButton>
        <IconButton
          label={`Move ${m.name.en} later`}
          disabled={!canReorder || index === count - 1}
          onClick={() => onMove(m.id, index + 1)}
          className="rtl:rotate-180"
        >
          <ArrowRight className="w-4 h-4" />
        </IconButton>
        <span className="flex-1" />
        <IconButton label={`Edit ${m.name.en}`} tone="primary" onClick={() => onEdit(m)}>
          <Pencil className="w-4 h-4" />
        </IconButton>
        <IconButton label={`Delete ${m.name.en}`} tone="danger" onClick={() => onDelete(m)}>
          <Trash2 className="w-4 h-4" />
        </IconButton>
      </div>
    </div>
  </li>
);

interface BoardProps {
  members: Member[];
  query: string;
  groupFilter: Group | 'all';
  onAdd: (group: Group) => void;
  onEdit: (m: Member) => void;
  onDelete: (m: Member) => void;
  onMove: (id: string, to: number) => void;
}

/** Every group in the order the public page shows them, each with its own add button. */
export const TeamBoard: React.FC<BoardProps> = ({ members, query, groupFilter, onAdd, onEdit, onDelete, onMove }) => {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // While searching, positions among hidden people are meaningless.
  const canReorder = query.trim() === '';
  const groups = GROUPS.filter(g => groupFilter === 'all' || g.value === groupFilter);

  return (
    <div className="space-y-10">
      {groups.map(g => {
        const all = inGroup(members, g.value);
        const shown = all.filter(m => matchesQuery(m, query));
        // A search hides groups without a match; otherwise empty groups stay
        // visible so the first person can be added to them.
        if (query.trim() && shown.length === 0) return null;
        return (
          <section key={g.value} aria-labelledby={`team-${g.value}`}>
            <GroupHeading group={g} count={all.length} onAdd={onAdd} />
            {shown.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted text-center">
                Nobody in {g.label.toLowerCase()} yet.
              </p>
            ) : (
              <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {shown.map(m => (
                  <MemberCard
                    key={m.id}
                    member={m}
                    index={all.findIndex(x => x.id === m.id)}
                    count={all.length}
                    canReorder={canReorder}
                    dragging={dragId === m.id}
                    dropTarget={overId === m.id && dragId !== null && dragId !== m.id}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onMove={onMove}
                    onDragStart={setDragId}
                    onDragEnter={id => {
                      // Only reorder inside the group the drag started in.
                      const from = members.find(x => x.id === dragId);
                      const to = members.find(x => x.id === id);
                      setOverId(from && to && from.group === to.group ? id : null);
                    }}
                    onDrop={(id, index) => {
                      const from = members.find(x => x.id === dragId);
                      const to = members.find(x => x.id === id);
                      if (dragId && from && to && from.group === to.group && dragId !== id) onMove(dragId, index);
                      setDragId(null);
                      setOverId(null);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverId(null);
                    }}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
};

const GroupHeading: React.FC<{ group: (typeof GROUPS)[number]; count: number; onAdd: (g: Group) => void }> = ({
  group,
  count,
  onAdd,
}) => (
  <div className="flex items-end justify-between gap-3 mb-3">
    <div>
      <h2 id={`team-${group.value}`} className="text-base font-bold text-text">
        {group.label} <span className="text-muted font-medium">· {count}</span>
      </h2>
      <p className="text-xs text-muted">{group.blurb}</p>
    </div>
    <button
      type="button"
      onClick={() => onAdd(group.value)}
      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Plus aria-hidden="true" className="w-3.5 h-3.5" /> Add to {group.label.toLowerCase()}
    </button>
  </div>
);
