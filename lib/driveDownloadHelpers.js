const GOOGLE_EXPORT_MAP = {
  "application/vnd.google-apps.document": {
    mimeType: "application/pdf",
    ext: ".pdf",
  },
  "application/vnd.google-apps.spreadsheet": {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: ".xlsx",
  },
  "application/vnd.google-apps.presentation": {
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ext: ".pptx",
  },
  "application/vnd.google-apps.drawing": {
    mimeType: "application/pdf",
    ext: ".pdf",
  },
};

function sanitizeFilename(name) {
  return String(name || "arquivo")
    .normalize("NFC")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim() || "arquivo";
}

export async function listAllFilesInFolder(drive, folderId, pathPrefix = "") {
  const files = [];
  let pageToken;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken,
    });

    for (const file of response.data.files || []) {
      const safeName = sanitizeFilename(file.name);
      if (file.mimeType === "application/vnd.google-apps.folder") {
        files.push(
          ...(await listAllFilesInFolder(
            drive,
            file.id,
            `${pathPrefix}${safeName}/`,
          )),
        );
      } else if (file.mimeType !== "application/vnd.google-apps.shortcut") {
        files.push({
          id: file.id,
          name: `${pathPrefix}${safeName}`,
          mimeType: file.mimeType,
        });
      }
    }

    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  return files;
}

export async function streamDriveFileDownload(drive, fileId, requestedName, res) {
  const metaResponse = await drive.files.get({
    fileId,
    fields: "name,mimeType",
    supportsAllDrives: true,
  });

  const mimeType = metaResponse.data.mimeType || "application/octet-stream";
  if (mimeType === "application/vnd.google-apps.folder") {
    const err = new Error("Use o download de pasta para pastas.");
    err.statusCode = 400;
    throw err;
  }

  const exportSpec = GOOGLE_EXPORT_MAP[mimeType];
  let filename = sanitizeFilename(requestedName || metaResponse.data.name || "arquivo");

  if (exportSpec) {
    if (!filename.toLowerCase().endsWith(exportSpec.ext)) {
      filename += exportSpec.ext;
    }
    const exportResponse = await drive.files.export(
      { fileId, mimeType: exportSpec.mimeType },
      { responseType: "stream" },
    );
    res.setHeader("Content-Type", exportSpec.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    exportResponse.data
      .on("error", (streamErr) => {
        console.error("Drive export stream error:", streamErr);
        if (!res.headersSent) res.status(500).end(streamErr.message);
      })
      .pipe(res);
    return;
  }

  const mediaResponse = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" },
  );

  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
  mediaResponse.data
    .on("error", (streamErr) => {
      console.error("Drive download stream error:", streamErr);
      if (!res.headersSent) res.status(500).end(streamErr.message);
    })
    .pipe(res);
}
