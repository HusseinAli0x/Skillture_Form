import React from 'react';
import { useToastStore, type ToastType } from '../context/ToastStore';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-cyan-400" />,
  error: <XCircle className="w-5 h-5 text-red-400" />,
  info: <Info className="w-5 h-5 text-slate-400" />,
};

const bgColors: Record<ToastType, string> = {
  success: 'bg-cyan-900/20 border-cyan-500/30 text-cyan-100',
  error: 'bg-red-900/20 border-red-500/30 text-red-100',
  info: 'bg-slate-800/40 border-slate-700/50 text-slate-200',
};

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center gap-3 min-w-[280px] px-4 py-3 rounded-lg border shadow-xl transform transition-all duration-300 translate-y-0 opacity-100 ${bgColors[toast.type]}`}
        >
          {icons[toast.type]}
          <p className="flex-1 text-sm font-medium">{toast.message}</p>
          <button onClick={() => removeToast(toast.id)} className="opacity-70 hover:opacity-100 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
