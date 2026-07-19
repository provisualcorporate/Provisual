export function toggleSelectionId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

export type DragSelectionPayload = { assetIds: string[]; folderIds: string[] };

export function buildDragPayload(
  item: { type: "asset" | "folder"; id: string },
  selectedAssetIds: string[],
  selectedFolderIds: string[],
): DragSelectionPayload {
  if (item.type === "asset") {
    const assetIds =
      selectedAssetIds.length > 0
        ? selectedAssetIds
        : selectedAssetIds.includes(item.id)
          ? selectedAssetIds
          : [item.id];
    return { assetIds, folderIds: selectedFolderIds };
  }
  const folderIds =
    selectedFolderIds.length > 0
      ? selectedFolderIds
      : selectedFolderIds.includes(item.id)
        ? selectedFolderIds
        : [item.id];
  return { assetIds: selectedAssetIds, folderIds };
}

export function parseDragPayload(data: string): DragSelectionPayload | null {
  try {
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      assetIds: Array.isArray(parsed.assetIds) ? parsed.assetIds : [],
      folderIds: Array.isArray(parsed.folderIds) ? parsed.folderIds : [],
    };
  } catch {
    return null;
  }
}

export function folderClickAction(
  folderId: string,
  selectedFolderIds: string[],
): "open" | "select" {
  return selectedFolderIds.includes(folderId) ? "open" : "select";
}
