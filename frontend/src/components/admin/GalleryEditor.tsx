import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, UploadCloud, X } from 'lucide-react';
import { apiErrorMessage } from '../../lib/apiError';
import { ACCEPT_ATTR, IMAGE_FORMATS_LABEL, MAX_IMAGE_MB, validateImageFile } from './imageFile';
import { moveItem } from './listOps';
import type { Uploader } from './ImageUpload';

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  upload: Uploader;
  max: number;
  onBusyChange?: (busy: boolean) => void;
}

/**
 * A photo gallery: add several images at once (browse or drop), reorder them
 * (arrows, or drag a thumbnail), remove one. Order here is the order on the
 * public workshop page. Files that fail a check are listed by name; the
 * rest still upload.
 */
const GalleryEditor: React.FC<Props> = ({ value, onChange, upload, max, onBusyChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [problems, setProblems] = useState<string[]>([]);
  const [overZone, setOverZone] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  // Refs so a slow upload appends to the *current* gallery, not the one it started with.
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onBusyRef = useRef(onBusyChange);
  onBusyRef.current = onBusyChange;
  useEffect(() => () => onBusyRef.current?.(false), []);

  const full = value.length >= max;

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const notes: string[] = [];
    const room = max - valueRef.current.length;
    const candidates: File[] = [];
    for (const file of files) {
      const invalid = validateImageFile(file);
      if (invalid) notes.push(invalid);
      else candidates.push(file);
    }
    if (candidates.length > room) {
      notes.push(
        room <= 0
          ? `The gallery is full (${max} photos). Remove one to add another.`
          : `Only ${room} more photo${room === 1 ? '' : 's'} fit; ${candidates.length - room} skipped.`
      );
    }
    setProblems(notes);
    const accepted = candidates.slice(0, Math.max(room, 0));
    if (accepted.length === 0) return;

    setUploading(n => n + accepted.length);
    onBusyRef.current?.(true);
    let remaining = accepted.length;
    for (const file of accepted) {
      try {
        const path = await upload(file);
        onChangeRef.current([...valueRef.current, path]);
      } catch (err) {
        setProblems(p => [...p, `"${file.name}": ${apiErrorMessage(err, 'upload failed')}`]);
      } finally {
        remaining -= 1;
        setUploading(n => n - 1);
        if (remaining === 0) onBusyRef.current?.(false);
      }
    }
  };

  const move = (from: number, to: number) => onChange(moveItem(value, from, to));

  return (
    <div>
      {value.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {value.map((path, i) => (
            <li
              key={path}
              draggable
              onDragStart={e => {
                setDragFrom(i);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(i));
              }}
              onDragOver={e => {
                if (dragFrom === null) return;
                e.preventDefault();
                setDragOver(i);
              }}
              onDrop={e => {
                if (dragFrom === null) return;
                e.preventDefault();
                e.stopPropagation();
                move(dragFrom, i);
                setDragFrom(null);
                setDragOver(null);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setDragOver(null);
              }}
              className={`group relative aspect-square rounded-lg overflow-hidden border bg-bg cursor-grab active:cursor-grabbing ${
                dragOver === i && dragFrom !== i ? 'border-primary ring-1 ring-primary' : 'border-border'
              } ${dragFrom === i ? 'opacity-50' : ''}`}
            >
              <img src={path} alt={`Gallery photo ${i + 1}`} draggable={false} className="w-full h-full object-cover" />
              <span className="absolute start-1 top-1 rounded bg-black/70 px-1.5 text-[11px] font-semibold text-white">
                {i + 1}
              </span>
              <button
                type="button"
                aria-label={`Remove gallery photo ${i + 1}`}
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="absolute end-1 top-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-black/70 text-white hover:bg-danger focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/70 to-transparent p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                <button
                  type="button"
                  aria-label={`Move photo ${i + 1} earlier`}
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-black/70 text-white disabled:opacity-30 hover:bg-primary hover:text-bg rtl:rotate-180"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Move photo ${i + 1} later`}
                  disabled={i === value.length - 1}
                  onClick={() => move(i, i + 1)}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-black/70 text-white disabled:opacity-30 hover:bg-primary hover:text-bg rtl:rotate-180"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
          {Array.from({ length: uploading }).map((_, i) => (
            <li
              key={`pending-${i}`}
              className="aspect-square rounded-lg border border-dashed border-border-strong flex items-center justify-center"
              role="status"
              aria-label="Uploading photo"
            >
              <span className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </li>
          ))}
        </ul>
      )}

      <div
        onDragOver={e => {
          if (dragFrom !== null || full) return;
          e.preventDefault();
          setOverZone(true);
        }}
        onDragLeave={() => setOverZone(false)}
        onDrop={e => {
          if (dragFrom !== null) return;
          e.preventDefault();
          setOverZone(false);
          void addFiles(Array.from(e.dataTransfer.files ?? []));
        }}
        className={`rounded-lg border border-dashed px-4 py-4 text-center transition-colors ${
          overZone ? 'border-primary bg-primary-subtle' : 'border-border-strong'
        }`}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={full}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover disabled:text-muted disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          {value.length === 0 ? <UploadCloud aria-hidden="true" className="w-4 h-4" /> : <Plus aria-hidden="true" className="w-4 h-4" />}
          {full ? 'Gallery is full' : value.length === 0 ? 'Add photos' : 'Add more photos'}
        </button>
        <p className="mt-1 text-xs text-muted">
          or drop them here · {IMAGE_FORMATS_LABEL} · up to {MAX_IMAGE_MB} MB each · {value.length}/{max} used
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        className="sr-only"
        tabIndex={-1}
        aria-label="Add gallery photos"
        onChange={e => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          void addFiles(files);
        }}
      />
      {problems.length > 0 && (
        <ul role="alert" className="mt-2 space-y-1 text-xs text-danger">
          {problems.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
      {value.length > 1 && (
        <p className="mt-2 text-xs text-muted">Drag a photo, or use its arrows, to change the order shown on the site.</p>
      )}
    </div>
  );
};

export default GalleryEditor;
