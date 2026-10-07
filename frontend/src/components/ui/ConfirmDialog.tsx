import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Accessible name of the dialog's close button. */
  closeLabel?: string;
  /** Styles the confirm button as destructive. */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Replaces the native `confirm()` calls that were used for destructive
 * actions. Those block the main thread, cannot be styled, and are suppressed
 * outright in some embedded browsers — meaning the delete would either hang or
 * proceed without ever asking.
 *
 * Focus lands on Cancel for destructive dialogs, so a stray Enter keeps data.
 */
const ConfirmDialog: React.FC<Props> = ({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  closeLabel,
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}) => (
  <Modal title={title} onClose={onCancel} closeLabel={closeLabel}>
    <div className="flex gap-4">
      {destructive && (
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-danger-soft border border-danger-border text-danger">
          <AlertTriangle className="w-5 h-5" />
        </div>
      )}
      <p className="text-sm text-muted leading-relaxed">{message}</p>
    </div>

    <div className="flex justify-end gap-3 mt-6">
      <Button variant="secondary" onClick={onCancel} disabled={loading} autoFocus={destructive}>
        {cancelLabel}
      </Button>
      <Button
        variant={destructive ? 'danger' : 'primary'}
        onClick={onConfirm}
        loading={loading}
        autoFocus={!destructive}
      >
        {confirmLabel}
      </Button>
    </div>
  </Modal>
);

export default ConfirmDialog;
