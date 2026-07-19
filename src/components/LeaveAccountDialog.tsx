interface LeaveAccountDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirmLeave: () => void;
}

export default function LeaveAccountDialog({ open, onClose, onConfirmLeave }: LeaveAccountDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-account-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-gray-100 bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,0.15)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="leave-account-title" className="text-lg font-bold text-gray-800">
          Sair do arquivo?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          Deseja sair da sua conta e voltar à página inicial do site ProVisual?
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 px-4 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-50"
          >
            Continuar no arquivo
          </button>
          <button
            type="button"
            onClick={onConfirmLeave}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#a21b7e] px-4 text-sm font-bold text-white transition-colors hover:bg-[#8e176e]"
          >
            Sair e ir para início
          </button>
        </div>
      </div>
    </div>
  );
}
