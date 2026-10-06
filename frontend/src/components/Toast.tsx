import React from 'react';
import { useToastStore, type ToastType } from '../context/ToastStore';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />,
  error: <XCircle className="w-5 h-5 text-danger shrink-0" />,
  info: <Info className="w-5 h-5 text-muted shrink-0" />,
};

const tones: Record<ToastType, string> = {
  success: 'bg-panel-2 border-primary-border text-text',
  error: 'bg-panel-2 border-danger-border text-text',
  info: 'bg-panel-2 border-border-strong text-text',
};

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    // Errors are announced assertively; everything else politely. The live
    // regions stay mounted so a toast added later is still read out.
    <div className="fixed z-[60] top-4 inset-x-4 sm:inset-x-auto sm:end-4 flex flex-col gap-2 pointer-events-none items-stretch sm:items-end">
      <div aria-live="polite" role="status" className="contents">
        {toasts
          .filter(t => t.type !== 'error')
          .map(toast => (
            <ToastItem key={toast.id} id={toast.id} type={toast.type} message={toast.message} onClose={removeToast} />
          ))}
      </div>
      <div aria-live="assertive" role="alert" className="contents">
        {toasts
          .filter(t => t.type === 'error')
          .map(toast => (
            <ToastItem key={toast.id} id={toast.id} type={toast.type} message={toast.message} onClose={removeToast} />
          ))}
      </div>
    </div>
  );
};

const ToastItem: React.FC<{
  id: string;
  type: ToastType;
  message: string;
  onClose: (id: string) => void;
}> = ({ id, type, message, onClose }) => (
  <div
    className={`pointer-events-auto flex items-center gap-3 sm:min-w-[300px] sm:max-w-md px-4 py-3 rounded-xl border shadow-2xl ${tones[type]}`}
  >
    {icons[type]}
    <p className="flex-1 text-sm font-medium">{message}</p>
    <button
      type="button"
      onClick={() => onClose(id)}
      aria-label="Dismiss notification"
      className="text-muted hover:text-text transition-colors rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <X className="w-4 h-4" />
    </button>
  </div>
);

export default ToastContainer;
