export function getDrivePreviewUrl(input: {
  driveId?: string;
  webViewLink?: string;
  versions?: { url?: string }[];
}) {
  if (input.driveId) {
    return `https://drive.google.com/file/d/${encodeURIComponent(input.driveId)}/preview`;
  }

  const url = input.versions?.[0]?.url || input.webViewLink || "";
  if (!url) return "";

  if (url.includes("drive.google.com")) {
    return url.replace("/view", "/preview").replace("/edit", "/preview");
  }

  return url;
}

export function triggerFileDownload(url: string, fileName?: string) {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  if (fileName) link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function triggerDriveDownload(fileId: string, fileName?: string) {
  const params = new URLSearchParams({ id: fileId });
  if (fileName) params.set("name", fileName);
  triggerFileDownload(`/api/drive/download?${params.toString()}`, fileName);
}

export async function downloadDriveFolder(folderId: string, folderName?: string) {
  const response = await fetch("/api/drive/folder-files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folderId }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Erro ao preparar download da pasta.");
  }

  const files: { id: string; name: string }[] = data.files || [];
  if (!files.length) {
    throw new Error(`A pasta${folderName ? ` "${folderName}"` : ""} não contém ficheiros para transferir.`);
  }

  for (let index = 0; index < files.length; index += 1) {
    triggerDriveDownload(files[index].id, files[index].name);
    if (index < files.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 450));
    }
  }

  return files.length;
}
