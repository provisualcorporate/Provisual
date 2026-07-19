/** Converte a resposta do Google Drive em itens prontos para exibir na UI. */

export type DriveBrowseFolder = {
  id: string;
  name: string;
  date: Date;
  parentId: string | null;
  color?: string;
  ownerId?: string;
  trashed?: boolean;
};

export type DriveBrowseAsset = {
  id: string;
  name: string;
  type: "image" | "video" | "document" | "folder";
  captureDate: Date;
  uploadDate: Date;
  folderId: string;
  ownerId: string;
  driveId: string;
  thumbnailUrl: string;
  starred?: boolean;
  trashed?: boolean;
  versions: Array<{ quality: "original"; size: string; url: string }>;
};

export type DriveBrowseListing = {
  folders: DriveBrowseFolder[];
  assets: DriveBrowseAsset[];
};

function isSystemFile(name: string): boolean {
  return (
    name.toLowerCase().includes("ds_store") ||
    name.startsWith("._") ||
    name === "Thumbs.db" ||
    name === "desktop.ini"
  );
}

function resolveDriveId(file: {
  id: string;
  mimeType?: string;
  shortcutDetails?: { targetId?: string };
}): string {
  if (
    file.mimeType === "application/vnd.google-apps.shortcut" &&
    file.shortcutDetails?.targetId
  ) {
    return file.shortcutDetails.targetId;
  }
  return file.id;
}

export function parseDriveListing(
  driveFiles: any[],
  parentFolderId: string,
  displayName?: (name: unknown) => string
): DriveBrowseListing {
  const formatName = displayName ?? ((n: unknown) => String(n ?? ""));
  const resolvedParentId = parentFolderId === "root" ? null : parentFolderId;
  const assetFolderId = parentFolderId === "root" ? "root" : parentFolderId;
  const now = new Date();

  const folders: DriveBrowseFolder[] = [];
  const assets: DriveBrowseAsset[] = [];

  for (const file of driveFiles) {
    const safeName = typeof file.name === "string" ? file.name : "";
    if (isSystemFile(safeName)) continue;

    const isShortcut = file.mimeType === "application/vnd.google-apps.shortcut";
    const targetMimeType = isShortcut ? file.shortcutDetails?.targetMimeType : null;
    const isFolder =
      file.mimeType === "application/vnd.google-apps.folder" ||
      (isShortcut && targetMimeType === "application/vnd.google-apps.folder");

    const realId = resolveDriveId(file);
    const mimeTypeToUse = targetMimeType || file.mimeType || "";
    const extension = safeName.split(".").pop()?.toLowerCase() || "";
    const isRaw = ["cr2", "cr3", "nef", "arw", "dng", "raf", "orf"].includes(extension);
    const fileType: DriveBrowseAsset["type"] = isFolder
      ? "folder"
      : mimeTypeToUse.includes("image") || isRaw
        ? "image"
        : mimeTypeToUse.includes("video")
          ? "video"
          : "document";
    const fileSize = file.size
      ? `${(parseInt(file.size, 10) / 1024 / 1024).toFixed(1)} MB`
      : "0 MB";
    const created = file.createdTime ? new Date(file.createdTime) : now;

    if (isFolder) {
      folders.push({
        id: realId,
        name: formatName(file.name),
        date: created,
        parentId: file.trashed ? "trash" : resolvedParentId,
        color: "#e2b13c",
        ownerId: "google-drive",
        trashed: file.trashed || false,
      });
      continue;
    }

    assets.push({
      id: realId,
      name: safeName,
      type: fileType,
      captureDate: created,
      uploadDate: now,
      folderId: file.trashed ? "trash" : assetFolderId,
      ownerId: "google-drive",
      driveId: realId,
      thumbnailUrl: file.thumbnailLink || "",
      starred: file.starred || false,
      trashed: file.trashed || false,
      versions: [
        {
          quality: "original",
          size: fileSize,
          url: file.webViewLink || "",
        },
      ],
    });
  }

  return { folders, assets };
}

export function mergeById<T extends { id: string }>(primary: T[], secondary: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of primary) map.set(item.id, item);
  for (const item of secondary) map.set(item.id, item);
  return Array.from(map.values());
}

export function parentMatchesFolder(
  itemParentId: string | null | undefined,
  folderId: string | null
): boolean {
  if (!folderId) return itemParentId == null || itemParentId === "" || itemParentId === "root";
  return String(itemParentId ?? "") === String(folderId);
}
