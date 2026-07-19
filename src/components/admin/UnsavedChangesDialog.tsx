import { Loader2 } from "lucide-react";

interface UnsavedChangesDialogProps {
  open: boolean;
  saving?: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
}

export default function UnsavedChangesDialog({
  open,
  saving = false,
  onCancel,
  onDiscard,
  onSave,
}: UnsavedChangesDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/25"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-changes-title"
    >
      <div className="w-full max-w-md rounded-xl border border-gray-100 bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
        <h3 id="unsaved-changes-title" className="text-lg font-bold text-gray-800">
          Alterações não guardadas
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          Tem alterações em edição. Deseja sair sem guardar ou prefere continuar a editar?
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="h-10 px-4 rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="h-10 px-4 rounded-lg border border-gray-200 bg-gray-50 text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            Sair sem guardar
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="h-10 px-4 rounded-lg bg-[#a21b7e] text-sm font-bold text-white hover:bg-[#8e176e] transition-colors cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
