import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check } from 'lucide-react';
import { Modal, Button, Input } from './ui';

interface Props {
  url: string;
  title: string;
  onClose: () => void;
  /** Optional hint under the title. */
  description?: string;
}

/**
 * The single share dialog for forms and quizzes.
 *
 * Dashboard and QuizzesPage each carried their own copy of this markup, and
 * GameLobby a fourth copy of just the copy-to-clipboard logic. Only this one
 * rendered a QR code, so which affordances a user got depended on which page
 * they happened to be on.
 */
const ShareModal: React.FC<Props> = ({ url, title, onClose, description }) => {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The "Copied" reset timer was never cleared, so it could fire after the
  // dialog had already unmounted.
  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is denied outside a secure context; the input is
      // selectable so the user can still copy manually.
    }
  };

  return (
    <Modal title={title} onClose={onClose} maxWidth="max-w-sm">
      <p className="text-sm text-muted mb-6 -mt-2">
        {description ?? 'Scan the QR code or copy the link below.'}
      </p>

      {/* The QR code needs a light background to stay scannable. */}
      <div className="flex justify-center mb-6 bg-white p-4 rounded-xl mx-auto w-fit">
        <QRCodeSVG value={url} size={200} />
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={url}
          readOnly
          aria-label="Share link"
          onClick={e => e.currentTarget.select()}
          className="flex-1"
        />
        <Button variant={copied ? 'secondary' : 'subtle'} onClick={handleCopy} className="shrink-0">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </Modal>
  );
};

export default ShareModal;
