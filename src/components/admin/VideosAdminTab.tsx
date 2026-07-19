import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import type { VideoItem } from "../../lib/sitePages";
import {
  addSiteVideo,
  deleteSiteVideo,
  fetchAdminSiteVideos,
  updateSiteVideo,
} from "../../lib/siteGalleryApi";
import { parseYoutubeVideoId, youtubeThumbnail } from "../../lib/youtubeEmbed";
import { ADMIN_CACHE_KEYS, readAdminCache } from "../../lib/siteAdminCache";
import type { AdminEditorHandle } from "./AdminEditorHandle";
import type { AdminNavState } from "./AdminBreadcrumb";
import AdminListPagination, { ADMIN_LIST_PAGE_SIZE, paginateList } from "./AdminListPagination";
import AdminToolbarSearch from "./AdminToolbarSearch";

type FormMode = "hidden" | "add" | "edit";

type FormState = {
  formMode: FormMode;
  editingSlug: string | null;
  title: string;
  url: string;
};

interface VideosAdminTabProps {
  isActive?: boolean;
  onToolbarChange?: (actions: React.ReactNode) => void;
  onNavChange?: (state: AdminNavState) => void;
}

export default forwardRef<AdminEditorHandle, VideosAdminTabProps>(function VideosAdminTab(
  { isActive = true, onToolbarChange, onNavChange },
  ref,
) {
  const [videos, setVideos] = useState<VideoItem[]>(
    () => readAdminCache<VideoItem[]>(ADMIN_CACHE_KEYS.videos) ?? [],
  );
  const [loading, setLoading] = useState(
    () => !readAdminCache<VideoItem[]>(ADMIN_CACHE_KEYS.videos)?.length,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>("hidden");
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [listPage, setListPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const formStateRef = useRef<FormState>({
    formMode: "hidden",
    editingSlug: null,
    title: "",
    url: "",
  });

  formStateRef.current = { formMode, editingSlug, title, url };

  const loadVideos = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      const cached = readAdminCache<VideoItem[]>(ADMIN_CACHE_KEYS.videos);
      if (cached?.length) {
        setVideos(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
    }
    setError(null);
    try {
      const data = await fetchAdminSiteVideos();
      setVideos(data);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar vídeos.");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, []);

  const filteredVideos = searchQuery.trim()
    ? videos.filter((video) => {
        const q = searchQuery.toLowerCase();
        return (
          (video.title || "").toLowerCase().includes(q) ||
          video.slug.toLowerCase().includes(q) ||
          video.youtubeId.toLowerCase().includes(q)
        );
      })
    : videos;

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredVideos.length / ADMIN_LIST_PAGE_SIZE));
    if (listPage >= totalPages) setListPage(Math.max(0, totalPages - 1));
  }, [filteredVideos.length, listPage]);

  useEffect(() => {
    setListPage(0);
  }, [searchQuery]);

  const paginatedVideos = paginateList<VideoItem>(filteredVideos, listPage);

  const resetForm = () => {
    setFormMode("hidden");
    setEditingSlug(null);
    setTitle("");
    setUrl("");
  };

  useEffect(() => {
    if (!onNavChange || !isActive) return;
    if (formMode === "hidden") {
      onNavChange({ crumbs: [{ label: "Gestão do Site" }, { label: "Vídeos" }] });
      return;
    }
    if (formMode === "add") {
      onNavChange({
        crumbs: [
          { label: "Gestão do Site" },
          { label: "Vídeos", onClick: resetForm },
          { label: "Novo vídeo" },
        ],
        onBack: resetForm,
      });
      return;
    }
    onNavChange({
      crumbs: [
        { label: "Gestão do Site" },
        { label: "Vídeos", onClick: resetForm },
        { label: title.trim() || "Editar vídeo" },
      ],
      onBack: resetForm,
    });
  }, [formMode, title, onNavChange, isActive]);

  const openAddForm = () => {
    resetForm();
    setError(null);
    setSuccess(null);
    setFormMode("add");
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
          placeholder="Pesquisar vídeos..."
        />
        <button
          type="button"
          onClick={openAddForm}
          className="flex flex-1 md:flex-none items-center justify-center gap-2 bg-[#a21b7e] hover:bg-[#8e176e] text-white px-4 py-2 rounded-sm text-sm font-bold shadow-sm transition-all cursor-pointer h-10"
        >
          <Plus size={16} />
          Adicionar Vídeo
        </button>
      </>,
    );
    return () => onToolbarChange(null);
  }, [formMode, onToolbarChange, isActive, searchQuery]);

  const openEditForm = (video: VideoItem) => {
    setError(null);
    setSuccess(null);
    setFormMode("edit");
    setEditingSlug(video.slug);
    setTitle(video.title || "");
    setUrl(video.youtubeId ? `https://www.youtube.com/watch?v=${video.youtubeId}` : "");
  };

  const saveForm = async (): Promise<boolean> => {
    const { formMode: mode, editingSlug: slug, title: nextTitle, url: nextUrl } = formStateRef.current;
    setError(null);
    setSuccess(null);

    if (!nextUrl.trim()) {
      setError("Indique o link do YouTube.");
      return false;
    }
    if (!parseYoutubeVideoId(nextUrl)) {
      setError("Link do YouTube inválido.");
      return false;
    }

    setSaving(true);
    try {
      if (mode === "add") {
        const next = await addSiteVideo(nextTitle.trim(), nextUrl.trim());
        setVideos(next);
        resetForm();
        setSuccess("Vídeo adicionado com sucesso.");
      } else if (mode === "edit" && slug) {
        const next = await updateSiteVideo(slug, nextTitle.trim(), nextUrl.trim());
        setVideos(next);
        resetForm();
        setSuccess("Vídeo atualizado com sucesso.");
      } else {
        setError("Não foi possível identificar o vídeo em edição.");
        return false;
      }
      return true;
    } catch (err: any) {
      setError(err.message || "Erro ao guardar vídeo.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  useImperativeHandle(ref, () => ({
    isEditing: () => formStateRef.current.formMode !== "hidden",
    discard: resetForm,
    save: saveForm,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveForm();
  };

  const handleDelete = async (video: VideoItem) => {
    if (!window.confirm(`Eliminar o vídeo "${video.title}"?`)) return;
    setError(null);
    setSuccess(null);
    try {
      const next = await deleteSiteVideo(video.slug);
      setVideos(next);
      if (editingSlug === video.slug) resetForm();
      setSuccess("Vídeo eliminado com sucesso.");
    } catch (err: any) {
      setError(err.message || "Erro ao eliminar vídeo.");
    }
  };

  const previewId = parseYoutubeVideoId(url);

  const formView = (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 p-3 rounded text-sm flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4 items-start">
          <h3 className="text-base font-bold text-gray-800 truncate lg:col-start-1 lg:row-start-1">
            {formMode === "add" ? "Novo Vídeo (YouTube)" : "Editar Vídeo"}
          </h3>

          <div className="space-y-4 lg:col-start-1 lg:row-start-2 order-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
                Título do vídeo
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: ProVisual Corporate — Institucional"
                className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm focus:border-[#a21b7e] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
                Link do YouTube
              </label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm focus:border-[#a21b7e] outline-none"
                required
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="h-10 px-4 border border-gray-300 text-gray-700 bg-transparent hover:border-gray-400 rounded-sm text-sm font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-10 px-4 border border-[#a21b7e] text-[#a21b7e] bg-transparent hover:text-[#8e176e] hover:border-[#8e176e] rounded-sm text-sm font-bold transition-all disabled:opacity-50 cursor-pointer inline-flex items-center justify-center gap-2"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {formMode === "add" ? "Adicionar Vídeo" : "Guardar Alterações"}
              </button>
            </div>
          </div>

          {previewId ? (
            <div className="aspect-video w-full overflow-hidden border border-gray-200 bg-gray-100 shadow-sm lg:col-start-2 lg:row-start-1 lg:row-span-2 order-3">
              <img
                src={youtubeThumbnail(previewId)}
                alt="Pré-visualização do vídeo"
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="hidden lg:block aspect-video w-full border border-dashed border-gray-200 bg-gray-50 lg:col-start-2 lg:row-start-1 lg:row-span-2" />
          )}
        </div>
      </form>
    </div>
  );

  return (
    <div className="space-y-6 min-h-[420px]">
      {error && formMode === "hidden" && (
        <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && formMode === "hidden" && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 p-3 rounded text-sm flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      {formMode !== "hidden" ? (
        formView
      ) : loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-[#a21b7e]" />
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-100 p-12 text-center text-gray-400 italic">
          {searchQuery
            ? "Nenhum vídeo corresponde à sua pesquisa."
            : 'Nenhum vídeo cadastrado. Clique em "Adicionar Vídeo" para começar.'}
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedVideos.map((video) => (
            <div
              key={`${video.slug}-${video.youtubeId}`}
              role="button"
              tabIndex={0}
              onClick={() => openEditForm(video)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openEditForm(video);
                }
              }}
              className="bg-white border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-stretch overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-[#a21b7e]/10 hover:border-[#a21b7e]/20 cursor-pointer"
            >
              <div className="relative w-full h-32 sm:w-28 sm:h-auto shrink-0 self-stretch overflow-hidden bg-gray-100">
                <img
                  src={video.image || youtubeThumbnail(video.youtubeId)}
                  alt={video.title}
                  className="absolute inset-0 h-full w-full object-cover object-center"
                />
              </div>
              <div className="flex flex-1 min-w-0 flex-col gap-3 py-3 px-3 sm:flex-row sm:items-center sm:gap-3 sm:py-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-800 truncate">{video.title}</h4>
                  <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-1">
                    <Video size={12} />
                    {video.youtubeId}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                <a
                  href="/videos"
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="px-3 py-2 text-xs font-bold text-green-600/50 border border-green-600/25 bg-transparent rounded-sm hover:text-green-700 hover:border-green-600 transition-colors inline-flex items-center gap-1"
                >
                  <ExternalLink size={14} />
                  Ver no site
                </a>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditForm(video);
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
                    handleDelete(video);
                  }}
                  className="px-3 py-2 text-xs font-bold text-red-600/50 border border-red-600/25 bg-transparent rounded-sm hover:text-red-700 hover:border-red-600 transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={14} />
                  Eliminar
                </button>
                </div>
              </div>
            </div>
          ))}
          <AdminListPagination
            page={listPage}
            totalItems={filteredVideos.length}
            onPageChange={setListPage}
          />
        </div>
      )}
    </div>
  );
});
