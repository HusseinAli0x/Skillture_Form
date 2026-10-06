import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImageIcon, RefreshCw, Trash2, UploadCloud } from 'lucide-react';
import { Button } from '../ui';
import { apiErrorMessage } from '../../lib/apiError';
import { ACCEPT_ATTR, IMAGE_FORMATS_LABEL, MAX_IMAGE_MB, validateImageFile } from './imageFile';

export type Uploader = (file: File) => Promise<string>;

interface Props {
  id: string;
  label: string;
  value: string | null;
  onChange: (path: string | null) => void;
  /** Sends the file to the API and resolves with the stored path. */
  upload: Uploader;
  /** Tailwind aspect class for the frame, e.g. `aspect-video` or `aspect-[4/5]`. */
  aspect?: string;
  /** Tailwind width cap for the frame. */
  frameClassName?: string;
  rounded?: 'md' | 'full';
  hint?: React.ReactNode;
  /** Error from the surrounding form (e.g. the server rejecting the saved path). */
  error?: string;
  /** Reports when an upload starts/ends so the form can hold its Save button. */
  onBusyChange?: (busy: boolean) => void;
  /** Text shown in the empty frame. */
  emptyLabel?: string;
  /** Alt text for the preview. */
  alt?: string;
  /** Allow clearing the image. Default true. */
  removable?: boolean;
}

/**
 * One image: drag a file onto the frame or browse, see it straight away
 * (a local preview while the upload runs), get a plain-language message for a
 * wrong type or size, and keep the previous image if an upload fails.
 */
const ImageUpload: React.FC<Props> = ({
  id,
  label,
  value,
  onChange,
  upload,
  aspect = 'aspect-video',
  frameClassName = '',
  rounded = 'md',
  hint,
  error,
  onBusyChange,
  emptyLabel = 'Drop an image here',
  alt = '',
  removable = true,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const onBusyRef = useRef(onBusyChange);
  onBusyRef.current = onBusyChange;
  useEffect(() => () => onBusyRef.current?.(false), []);

  // Local previews are blob URLs; release them or the document keeps them alive.
  useEffect(
    () => () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    },
    [localPreview]
  );

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const invalid = validateImageFile(file);
      if (invalid) {
        setProblem(invalid);
        return;
      }
      setProblem(null);
      setLocalPreview(URL.createObjectURL(file));
      setBusy(true);
      onBusyRef.current?.(true);
      try {
        const path = await upload(file);
        onChange(path);
        setLocalPreview(null);
      } catch (err) {
        setLocalPreview(null);
        setProblem(apiErrorMessage(err, 'The upload failed. Check your connection and try again.'));
      } finally {
        setBusy(false);
        onBusyRef.current?.(false);
      }
    },
    [upload, onChange]
  );

  const shown = localPreview ?? value;
  const message = problem ?? error;
  const radius = rounded === 'full' ? 'rounded-full' : 'rounded-lg';

  return (
    <div>
      <p className="text-xs font-medium mb-1.5 text-muted" id={`${id}-label`}>
        {label}
      </p>
      <div className="flex flex-wrap items-start gap-4">
        <div
          onDragOver={e => {
            e.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setDragging(false);
            if (!busy) void handleFile(e.dataTransfer.files?.[0]);
          }}
          className={[
            'relative w-full overflow-hidden border bg-bg transition-colors',
            aspect,
            frameClassName || 'max-w-xs',
            radius,
            dragging ? 'border-primary bg-primary-subtle' : message ? 'border-danger' : 'border-border-strong',
            shown ? '' : 'border-dashed',
          ].join(' ')}
        >
          {shown ? (
            <img src={shown} alt={alt} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-muted hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {dragging ? <UploadCloud className="w-7 h-7 text-primary" /> : <ImageIcon className="w-7 h-7" />}
              <span className="text-xs font-medium">{dragging ? 'Drop to upload' : emptyLabel}</span>
              <span className="text-[11px] text-muted/80">
                {IMAGE_FORMATS_LABEL} · up to {MAX_IMAGE_MB} MB
              </span>
            </button>
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55" role="status" aria-label="Uploading">
              <span className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          )}
          {dragging && shown && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary-soft text-primary text-xs font-semibold">
              Drop to replace
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            aria-describedby={`${id}-label`}
          >
            {value || localPreview ? (
              <RefreshCw aria-hidden="true" className="w-3.5 h-3.5" />
            ) : (
              <UploadCloud aria-hidden="true" className="w-3.5 h-3.5" />
            )}
            {busy ? 'Uploading…' : value ? 'Replace' : 'Choose file'}
          </Button>
          {removable && value && !busy && (
            <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
              <Trash2 aria-hidden="true" className="w-3.5 h-3.5" />
              Remove
            </Button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        tabIndex={-1}
        aria-labelledby={`${id}-label`}
        onChange={e => {
          void handleFile(e.target.files?.[0]);
          // Without this, picking the same file again fires no change event.
          e.target.value = '';
        }}
      />
      {message ? (
        <p role="alert" className="mt-2 text-xs text-danger leading-relaxed">
          {message}
        </p>
      ) : (
        hint && <p className="mt-2 text-xs text-muted leading-relaxed">{hint}</p>
      )}
    </div>
  );
};

export default ImageUpload;
