import React, { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import {
  AlertCircle,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  createGalleryAlbum,
  deleteGalleryAlbum,
  fetchAdminGalleryAlbums,
  fetchAdminGalleryPhotos,
  updateGalleryAlbum,
  type SiteDriveAlbum,
  type SiteDrivePhoto,
} from "../../lib/siteGalleryApi";
import { driveDisplayUrl } from "../../lib/driveImageUrl";
import { ADMIN_CACHE_KEYS, readAdminCache } from "../../lib/siteAdminCache";
import type { AdminEditorHandle } from "./AdminEditorHandle";
import type { AdminNavState } from "./AdminBreadcrumb";
import AdminToolbarSearch from "./AdminToolbarSearch";

const ALBUMS_INITIAL_COUNT = 10;
const ALBUMS_LOAD_MORE_COUNT = 10;

type FormMode = "hidden" | "add" | "edit";

type PendingPhoto = {
  key: string;
  file: File;
  preview: string;
};

function albumCoverUrl(album: SiteDriveAlbum) {
  const staticCandidate = [album.coverUrl, album.image].find((u) => u?.startsWith("/INICIO/"));
  if (staticCandidate) return staticCandidate;
  if (album.coverDriveId && !String(album.coverDriveId).startsWith("static-")) {
    return `/api/drive/thumbnail?id=${encodeURIComponent(album.coverDriveId)}&sz=400`;
  }
  if (album.image?.includes("/api/drive/")) return driveDisplayUrl(album.image, "sm");
  return album.image || album.coverUrl || "";
}

function photoPreviewUrl(photo: SiteDrivePhoto) {
  return driveDisplayUrl(photo.thumbnailUrl || photo.url, "sm");
}

interface AlbumsAdminTabProps {
  isActive?: boolean;
  onToolbarChange?: (actions: React.ReactNode) => void;
  onNavChange?: (state: AdminNavState) => void;
}

export default forwardRef<AdminEditorHandle, AlbumsAdminTabProps>(function AlbumsAdminTab(
  { isActive = true, onToolbarChange, onNavChange },
  ref,
) {
  const [albums, setAlbums] = useState<SiteDriveAlbum[]>(
    () => readAdminCache<SiteDriveAlbum[]>(ADMIN_CACHE_KEYS.albums) ?? [],
  );
  const [loading, setLoading] = useState(
    () => !readAdminCache<SiteDriveAlbum[]>(ADMIN_CACHE_KEYS.albums)?.length,
  );
  const [saving, setSaving] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>("hidden");
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<SiteDrivePhoto[]>([]);
  const [deletedPhotoIds, setDeletedPhotoIds] = useState<string[]>([]);
  const [visibleAlbumCount, setVisibleAlbumCount] = useState(ALBUMS_INITIAL_COUNT);
  const [searchQuery, setSearchQuery] = useState("");

  const loadAlbums = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      const cached = readAdminCache<SiteDriveAlbum[]>(ADMIN_CACHE_KEYS.albums);
      if (cached?.length) {
        setAlbums(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
    }
    setError(null);
    try {
      const data = await fetchAdminGalleryAlbums();
      setAlbums(data);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar álbuns.");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadAlbums();
  }, []);

  useEffect(() => {
    albums.forEach((album) => {
      const cached = readAdminCache<SiteDrivePhoto[]>(ADMIN_CACHE_KEYS.photos(album.slug));
      if (!cached?.length) {
        fetchAdminGalleryPhotos(album.slug).catch(() => {});
      }
    });
  }, [albums]);

  useEffect(() => {
    const reload = () => {
      loadAlbums({ silent: true });
    };
    const onFocus = () => {
      if (error) reload();
    };

    window.addEventListener("drive-auth-changed", reload);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("drive-auth-changed", reload);
      window.removeEventListener("focus", onFocus);
    };
  }, [error]);

  useEffect(() => {
    setVisibleAlbumCount(ALBUMS_INITIAL_COUNT);
  }, [albums.length, searchQuery]);

  const filteredAlbums = searchQuery.trim()
    ? albums.filter((album) => {
        const q = searchQuery.toLowerCase();
        const title = (album.title || album.name || "").toLowerCase();
        const subtitle = (album.subtitle || "").toLowerCase();
        return title.includes(q) || subtitle.includes(q) || album.slug.toLowerCase().includes(q);
      })
    : albums;

  const visibleAlbums = filteredAlbums.slice(0, visibleAlbumCount);
  const hasMoreAlbums = visibleAlbumCount < filteredAlbums.length;

  const resetForm = () => {
    pendingPhotos.forEach((photo) => URL.revokeObjectURL(photo.preview));
    setFormMode("hidden");
    setEditingSlug(null);
    setTitle("");
    setSubtitle("");
    setCoverFile(null);
    setCoverPreview(null);
    setPendingPhotos([]);
    setExistingPhotos([]);
    setDeletedPhotoIds([]);
    setError(null);
  };

  useEffect(() => {
    if (!onNavChange || !isActive) return;
    if (formMode === "hidden") {
      onNavChange({ crumbs: [{ label: "Gestão do Site" }, { label: "Álbuns" }] });
      return;
    }
    if (formMode === "add") {
      onNavChange({
        crumbs: [
          { label: "Gestão do Site" },
          { label: "Álbuns", onClick: resetForm },
          { label: "Novo álbum" },
        ],
        onBack: resetForm,
      });
      return;
    }
    onNavChange({
      crumbs: [
        { label: "Gestão do Site" },
        { label: "Álbuns", onClick: resetForm },
        { label: title.trim() || "Editar álbum" },
      ],
      onBack: resetForm,
    });
  }, [formMode, title, onNavChange, isActive]);

  const openAddForm = () => {
    pendingPhotos.forEach((photo) => URL.revokeObjectURL(photo.preview));
    setEditingSlug(null);
    setTitle("");
    setSubtitle("");
    setCoverFile(null);
    setCoverPreview(null);
    setPendingPhotos([]);
    setExistingPhotos([]);
    setDeletedPhotoIds([]);
    setError(null);
    setFormMode("add");
  };

  const openEditForm = (album: SiteDriveAlbum) => {
    pendingPhotos.forEach((photo) => URL.revokeObjectURL(photo.preview));
    setError(null);
    setFormMode("edit");
    setEditingSlug(album.slug);
    setTitle(album.title || album.name);
    setSubtitle(album.subtitle || "");
    setCoverFile(null);
    setCoverPreview(albumCoverUrl(album) || null);
    setPendingPhotos([]);
    setDeletedPhotoIds([]);
    const cachedPhotos = readAdminCache<SiteDrivePhoto[]>(ADMIN_CACHE_KEYS.photos(album.slug));
    if (cachedPhotos?.length) {
      setExistingPhotos(cachedPhotos);
      setLoadingPhotos(false);
      fetchAdminGalleryPhotos(album.slug)
        .then((photos) => setExistingPhotos(photos))
        .catch(() => {});
    } else {
      setExistingPhotos([]);
      setLoadingPhotos(true);
      fetchAdminGalleryPhotos(album.slug)
        .then((photos) => setExistingPhotos(photos))
        .catch((e: Error) => setError(e.message || "Erro ao carregar fotos do álbum."))
        .finally(() => setLoadingPhotos(false));
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const addPendingFiles = (files: File[]) => {
    const next = files.map((file) => ({
      key: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
    }));
    setPendingPhotos((prev) => [...prev, ...next]);
  };

  const handleBulkPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length) addPendingFiles(files);
    e.target.value = "";
  };

  const removePendingPhoto = (key: string) => {
    setPendingPhotos((prev) => {
      const target = prev.find((photo) => photo.key === key);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((photo) => photo.key !== key);
    });
  };

  const markExistingPhotoDeleted = (photoId: string) => {
    setDeletedPhotoIds((prev) => (prev.includes(photoId) ? prev : [...prev, photoId]));
  };

  const visibleExistingPhotos = existingPhotos.filter((photo) => !deletedPhotoIds.includes(photo.id));

  const saveForm = async (): Promise<boolean> => {
    setError(null);

    if (!title.trim()) {
      setError("Indique o título do álbum.");
      return false;
    }
    if (formMode === "add" && !coverFile) {
      setError("Selecione a foto de capa do álbum.");
      return false;
    }

    setSaving(true);
    try {
      if (formMode === "add") {
        await createGalleryAlbum({
          title: title.trim(),
          subtitle: subtitle.trim(),
          cover: coverFile!,
          photos: pendingPhotos.map((photo) => photo.file),
        });
      } else if (formMode === "edit" && editingSlug) {
        await updateGalleryAlbum(editingSlug, {
          title: title.trim(),
          subtitle: subtitle.trim(),
          cover: coverFile,
          photos: pendingPhotos.map((photo) => photo.file),
          deletedPhotoIds,
        });
      } else {
        return false;
      }
      resetForm();
      await loadAlbums({ silent: true });
      return true;
    } catch (err: any) {
      setError(err.message || "Erro ao guardar álbum.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  useImperativeHandle(ref, () => ({
    isEditing: () => formMode !== "hidden",
    discard: resetForm,
    save: saveForm,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveForm();
  };

  const handleDelete = async (album: SiteDriveAlbum) => {
    const label = album.title || album.name;
    if (!window.confirm(`Eliminar o álbum "${label}"? Esta ação remove também a pasta no Google Drive.`)) {
      return;
    }
    setError(null);
    try {
      await deleteGalleryAlbum(album.slug);
      if (editingSlug === album.slug) resetForm();
      await loadAlbums();
    } catch (err: any) {
      setError(err.message || "Erro ao eliminar álbum.");
    }
  };

  useEffect(() => {
    if (!onToolbarChange || !isActive) return;
    if (formMode !== "hidden") {
      onToolbarChange(null);
      return;
    }
    onToolbarChange(
      <>
        <AdminToolbarSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Pesquisar álbuns..."
        />
        <button
          type="button"
          onClick={openAddForm}
          className="flex flex-1 md:flex-none items-center justify-center gap-2 bg-[#a21b7e] hover:bg-[#8e176e] text-white px-4 py-2 rounded-sm text-sm font-bold shadow-sm transition-all cursor-pointer h-10"
        >
          <Plus size={16} />
          Adicionar Novo Álbum
        </button>
      </>,
    );
    return () => onToolbarChange(null);
  }, [formMode, onToolbarChange, isActive, searchQuery]);

  const formView = (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 md:p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h3 className="text-base font-bold text-gray-800 truncate">
          {formMode === "add" ? "Novo Álbum" : "Editar Álbum"}
        </h3>
        {formMode === "edit" && editingSlug && (
          <a
            href={`/galeria/${editingSlug}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-bold text-[#a21b7e] inline-flex items-center gap-1"
          >
            <ExternalLink size={14} />
            Ver no site
          </a>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-4">
          <label className="relative w-28 h-28 border-2 border-dashed border-gray-200 hover:border-[#a21b7e] rounded-lg cursor-pointer overflow-hidden bg-gray-50 flex items-center justify-center shrink-0 transition-shadow duration-200 hover:shadow-md">
            {coverPreview ? (
              <img src={coverPreview} alt="Capa" className="absolute inset-0 h-full w-full object-cover object-center" />
            ) : (
              <div className="text-center text-gray-400">
                <Upload size={20} className="mx-auto" />
                <span className="text-[10px] font-bold mt-1 block">Capa</span>
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
          </label>
          <div className="flex flex-1 min-w-0 flex-col gap-3 justify-center">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do álbum"
              className="w-1/2 max-w-full h-11 px-3 border border-gray-200 rounded-md text-sm focus:border-[#a21b7e] outline-none"
              required
            />
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Descrição do álbum"
              className="w-full h-11 px-3 border border-gray-200 rounded-md text-sm focus:border-[#a21b7e] outline-none"
            />
          </div>
        </div>

        {(formMode === "add" || loadingPhotos || visibleExistingPhotos.length > 0 || pendingPhotos.length > 0) && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              Fotos do álbum
            </p>
            {loadingPhotos && visibleExistingPhotos.length === 0 && pendingPhotos.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 size={24} className="animate-spin text-[#a21b7e]" />
              </div>
            ) : visibleExistingPhotos.length === 0 && pendingPhotos.length === 0 ? (
              <p className="text-xs text-gray-400 italic mb-3">
                Ainda sem fotos. Use &quot;Carregar fotos&quot; abaixo para adicionar imagens ao álbum.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {visibleExistingPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative group aspect-square overflow-hidden rounded-lg border border-gray-100 bg-gray-50 transition-all duration-200 hover:shadow-md hover:shadow-black/10 hover:border-[#a21b7e]/25"
                  >
                    <img
                      src={photoPreviewUrl(photo)}
                      alt={photo.name}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover object-center"
                    />
                    <button
                      type="button"
                      onClick={() => markExistingPhotoDeleted(photo.id)}
                      className="absolute top-2 right-2 px-2 py-1 rounded bg-red-600 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      Eliminar foto
                    </button>
                  </div>
                ))}
                {pendingPhotos.map((photo) => (
                  <div
                    key={photo.key}
                    className="relative group aspect-square overflow-hidden rounded-lg border border-[#a21b7e]/20 bg-gray-50 transition-all duration-200 hover:shadow-md hover:shadow-[#a21b7e]/15 hover:border-[#a21b7e]/40"
                  >
                    <img
                      src={photo.preview}
                      alt={photo.file.name}
                      className="absolute inset-0 h-full w-full object-cover object-center"
                    />
                    <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-[#a21b7e] text-white text-[9px] font-bold">
                      Nova
                    </span>
                    <button
                      type="button"
                      onClick={() => removePendingPhoto(photo.key)}
                      className="absolute top-2 right-2 px-2 py-1 rounded bg-red-600 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      Eliminar foto
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
          <label className="inline-flex items-center justify-center gap-2 h-10 px-4 border border-gray-300 rounded-sm text-sm font-bold text-gray-600 bg-transparent hover:border-[#a21b7e] hover:text-[#a21b7e] cursor-pointer shrink-0">
            <Upload size={16} />
            Carregar fotos
            <input type="file" accept="image/*" multiple onChange={handleBulkPhotos} className="hidden" />
          </label>
          <button
            type="button"
            onClick={resetForm}
            className="h-10 px-4 border border-gray-300 text-gray-700 bg-transparent hover:border-gray-400 rounded-sm text-sm font-bold transition-all cursor-pointer shrink-0"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-10 px-4 bg-[#a21b7e] hover:bg-[#8e176e] text-white rounded-sm text-sm font-bold transition-all disabled:opacity-50 cursor-pointer inline-flex items-center justify-center gap-2 shrink-0"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {formMode === "add" ? "Criar Álbum" : "Guardar Alterações"}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="space-y-6 min-h-[420px]">
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {formMode !== "hidden" ? (
        formView
      ) : loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-[#a21b7e]" />
        </div>
      ) : filteredAlbums.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-100 p-12 text-center text-gray-400 italic">
          {searchQuery
            ? "Nenhum álbum corresponde à sua pesquisa."
            : 'Nenhum álbum cadastrado. Clique em "Adicionar Novo Álbum" para começar.'}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleAlbums.map((album) => {
            const cover = albumCoverUrl(album);
            return (
              <div
                key={album.slug}
                role="button"
                tabIndex={0}
                onClick={() => openEditForm(album)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openEditForm(album);
                  }
                }}
                className="group bg-white rounded-lg border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-stretch overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-[#a21b7e]/10 hover:border-[#a21b7e]/20 cursor-pointer"
              >
                <div className="relative w-full h-32 sm:w-20 sm:h-auto shrink-0 self-stretch overflow-hidden bg-gray-100">
                  {cover ? (
                    <img
                      src={cover}
                      alt={album.title || album.name}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover object-center"
                    />
                  ) : (
                    <div className="flex h-full min-h-[4.5rem] w-full items-center justify-center text-gray-300">
                      <ImageIcon size={24} />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 min-w-0 flex-col gap-3 py-3 px-3 sm:flex-row sm:items-center sm:gap-3 sm:py-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-800 truncate">{album.title || album.name}</h4>
                    <p className="text-sm text-gray-500 truncate">{album.subtitle || `${album.photoCount} fotos`}</p>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">{album.photoCount} fotos</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <a
                    href={`/galeria/${album.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="px-3 py-2 text-xs font-bold text-green-600/50 border border-green-600/25 bg-transparent rounded-sm hover:text-green-700 hover:border-green-600 transition-colors inline-flex items-center gap-1"
                  >
                    <ExternalLink size={14} />
                    Ver
                  </a>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditForm(album);
                    }}
                    className="px-3 py-2 text-xs font-bold text-sky-600/50 border border-sky-600/25 bg-transparent rounded-sm hover:text-sky-700 hover:border-sky-600 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Pencil size={14} />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(album);
                    }}
                    className="px-3 py-2 text-xs font-bold text-red-600/50 border border-red-600/25 bg-transparent rounded-sm hover:text-red-700 hover:border-red-600 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                </div>
                </div>
              </div>
            );
          })}
          {hasMoreAlbums && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setVisibleAlbumCount((count) => count + ALBUMS_LOAD_MORE_COUNT)}
                className="inline-flex h-10 items-center justify-center px-5 rounded-sm border border-gray-300 bg-transparent text-sm font-bold text-gray-700 transition-colors hover:border-[#a21b7e] hover:text-[#a21b7e] cursor-pointer"
              >
                Carregar mais álbuns
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
