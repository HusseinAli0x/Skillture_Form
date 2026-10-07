/**
 * Client-side checks for an image about to be uploaded. They mirror what the
 * API enforces (handlers.saveImageUpload: png/jpg/jpeg/webp/gif, 5 MB default)
 * so the admin hears about a bad file before waiting for an upload to fail.
 * The server stays the authority; this only saves a round-trip.
 */

export const MAX_IMAGE_MB = 5;
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export const ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(',');
export const IMAGE_FORMATS_LABEL = 'PNG, JPG, WebP or GIF';

const EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

interface FileLike {
  name: string;
  type: string;
  size: number;
}

/** A human-readable reason the file is unusable, or null when it is fine. */
export function validateImageFile(file: FileLike, maxMb: number = MAX_IMAGE_MB): string | null {
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  const typeOk = (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type);
  // Some browsers report an empty type for a dragged file; fall back to the extension.
  const extOk = EXTENSIONS.includes(ext);
  if (!(typeOk || (file.type === '' && extOk)) || !extOk) {
    return `"${file.name}" is not a supported image. Use ${IMAGE_FORMATS_LABEL}.`;
  }
  if (file.size === 0) return `"${file.name}" is empty.`;
  if (file.size > maxMb * 1024 * 1024) {
    return `"${file.name}" is ${formatBytes(file.size)}; the limit is ${maxMb} MB.`;
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
