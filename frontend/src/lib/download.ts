/**
 * Saving a file the browser already holds as a Blob. Used for downloads that
 * need the Authorization header, which a plain `<a href>` cannot send.
 */

/**
 * The file name a `Content-Disposition` header asks for, or `fallback`.
 * Understands `filename="a.csv"`, `filename=a.csv` and the RFC 5987 form
 * `filename*=UTF-8''a%20b.csv`, and drops any path the server might have sent.
 */
export function filenameFromDisposition(header: unknown, fallback: string): string {
  if (typeof header !== 'string' || !header) return fallback;
  const encoded = /filename\*\s*=\s*(?:[\w-]+)?'[^']*'([^;]+)/i.exec(header);
  let name = '';
  if (encoded) {
    try {
      name = decodeURIComponent(encoded[1].trim());
    } catch {
      name = '';
    }
  }
  if (!name) {
    const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(header);
    name = (plain?.[1] ?? plain?.[2] ?? '').trim();
  }
  name = name.split(/[\\/]/).pop()?.trim() ?? '';
  return name || fallback;
}

/** Offer `blob` to the user as a download called `filename`. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Copy text to the clipboard; falls back to a hidden textarea where the async API is unavailable. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or insecure context: try the legacy path below.
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
