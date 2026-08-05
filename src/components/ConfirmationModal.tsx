import { X, AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger'
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-surface-container-high flex justify-between items-center">
          <div className="flex items-center gap-2">
            <AlertTriangle className={variant === 'danger' ? 'text-error' : 'text-primary'} size={20} />
            <h3 className="text-lg font-bold text-on-surface">{title}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-on-surface-variant text-sm leading-relaxed">
            {message}
          </p>
        </div>

        <div className="px-6 py-4 bg-surface-container-low/50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-2.5 bg-surface-container-high text-on-surface font-bold rounded-lg hover:bg-surface-container-highest transition-all text-sm"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 px-6 py-2.5 text-white font-bold rounded-lg hover:opacity-90 transition-all shadow-lg text-sm ${
              variant === 'danger' ? 'bg-error shadow-error/20' : 'bg-primary shadow-primary/20'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
