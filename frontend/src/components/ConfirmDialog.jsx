import React from 'react';
import { Modal } from './Modal.jsx';
import { AlertTriangle, Loader2 } from 'lucide-react';

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isLoading = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={isLoading ? () => {} : onClose} title={title}>
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3.5">
          {isDestructive && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 shrink-0 border border-rose-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}
          <p className="text-[16px] text-zinc-300 leading-relaxed pt-0.5">{message}</p>
        </div>

        <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 text-[15px] font-medium rounded-lg text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-700/60 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
