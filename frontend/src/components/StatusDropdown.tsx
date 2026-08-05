import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import client from '../api/client';

export type StatusValue = 0 | 1 | 2;

interface Props {
  type: 'form' | 'quiz';
  id: string;
  initialStatus: StatusValue;
  onStatusChange?: (newStatus: StatusValue) => void;
  // Fallback for full object update if needed
  fullObject?: any;
}

const palette = {
  0: { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)', border: 'rgba(251, 191, 36, 0.25)' },
  1: { color: '#0ABFBC', bg: 'rgba(10, 191, 188, 0.1)', border: 'rgba(10, 191, 188, 0.25)' },
  2: { color: '#888', bg: 'rgba(136, 136, 136, 0.1)', border: 'rgba(136, 136, 136, 0.25)' },
};

// Value 2 is "closed" for a form and "archived" for a quiz; a single shared
// label list showed forms as "Archived", which is not a form state at all.
const labels: Record<Props['type'], Record<StatusValue, string>> = {
  form: { 0: 'Draft', 1: 'Published', 2: 'Closed' },
  quiz: { 0: 'Draft', 1: 'Active', 2: 'Archived' },
};

const StatusDropdown: React.FC<Props> = ({ type, id, initialStatus, onStatusChange, fullObject }) => {
  const [status, setStatus] = useState<StatusValue>(initialStatus);
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Re-sync when the parent refetches. State seeded once from a prop went stale
  // as soon as the list reloaded, so the badge could disagree with the server.
  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  const handleUpdate = async (newStatus: StatusValue) => {
    if (newStatus === status) {
      setIsOpen(false);
      return;
    }
    
    setIsUpdating(true);
    try {
      if (type === 'quiz') {
        if (newStatus === 1) await client.patch(`/api/v1/quizzes/${id}/activate`);
        else if (newStatus === 2) await client.patch(`/api/v1/quizzes/${id}/archive`);
        // Note: Backend might not support reverting to draft via dedicated endpoint
        // If they have PUT, we'll try it:
        else await client.put(`/api/v1/quizzes/${id}`, { ...fullObject, status: newStatus });
      } else {
        await client.put(`/api/v1/forms/${id}`, { ...fullObject, status: newStatus });
      }
      
      setStatus(newStatus);
      if (onStatusChange) onStatusChange(newStatus);
    } catch (err) {
      console.error('Failed to update status', err);
      alert('Failed to update status.');
    } finally {
      setIsUpdating(false);
      setIsOpen(false);
    }
  };

  const currentOpt = {
    ...(palette[status] ?? palette[0]),
    label: labels[type][status] ?? labels[type][0],
  };

  return (
    <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all focus:outline-none"
        style={{ 
          backgroundColor: currentOpt.bg, 
          color: currentOpt.color, 
          border: `1px solid ${currentOpt.border}`,
          opacity: isUpdating ? 0.7 : 1
        }}
      >
        <span className="relative flex h-2 w-2 mr-1">
          {status === 1 && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: currentOpt.color }}></span>
          )}
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: currentOpt.color }}></span>
        </span>
        {currentOpt.label}
        <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-70" />
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-48 rounded-xl border shadow-2xl overflow-hidden z-50 py-1"
          style={{ backgroundColor: '#141414', borderColor: '#2a2a2a' }}
        >
          {([0, 1, 2] as StatusValue[]).map(val => (
            <button
              key={val}
              onClick={() => handleUpdate(val)}
              className="w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 hover:bg-white/5"
              style={{ color: status === val ? palette[val].color : '#f0f0f0' }}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: palette[val].color }} />
              {labels[type][val]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default StatusDropdown;
