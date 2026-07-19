export interface AdminEditorHandle {
  isEditing: () => boolean;
  discard: () => void;
  save: () => Promise<boolean>;
}
