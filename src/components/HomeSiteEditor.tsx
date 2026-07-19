import React, { useEffect, useRef, useState } from "react";
import { Globe, Save, RefreshCw, ExternalLink, Upload, Image as ImageIcon } from "lucide-react";
import { cn } from "../lib/utils";
import {
  DEFAULT_HOME_CONTENT,
  type HomeContent,
} from "../lib/homeContent";
import { fetchSiteHomeContent, fetchSiteLibrary, uploadSiteMedia } from "../lib/siteGalleryApi";

function ImageUrlField({
  label,
  value,
  onChange,
  subpath,
  uploading,
  onUpload,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  subpath: string;
  uploading: boolean;
  onUpload: (file: File, subpath: string, onUrl: (url: string) => void) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-11 px-3 border border-gray-100 rounded-lg text-sm focus:border-[#a21b7e] outline-none"
        />
        <label className="shrink-0 h-11 px-3 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:border-[#a21b7e]/40 inline-flex items-center gap-1 cursor-pointer">
          <Upload size={14} />
          Drive
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file, subpath, onChange);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}

async function fetchHomeContent(): Promise<HomeContent> {
  return fetchSiteHomeContent();
}

export default function HomeSiteEditor() {
  const [content, setContent] = useState<HomeContent>(DEFAULT_HOME_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [libraryCount, setLibraryCount] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const heroUploadRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      setContent(await fetchHomeContent());
    } catch (e: any) {
      setMessage({ type: "err", text: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    fetchSiteLibrary()
      .then((photos) => setLibraryCount(photos.length))
      .catch(() => setLibraryCount(null));
  }, []);

  const handleSiteUpload = async (file: File, subpath: string, onUrl?: (url: string) => void) => {
    setUploading(true);
    setMessage(null);
    try {
      const uploaded = await uploadSiteMedia(file, subpath);
      if (onUrl) onUrl(uploaded.url);
      const library = await fetchSiteLibrary();
      setLibraryCount(library.length);
      setMessage({ type: "ok", text: `Imagem "${uploaded.name}" guardada no Google Drive (pasta site).` });
    } catch (e: any) {
      setMessage({ type: "err", text: e.message });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/site/home", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao guardar.");
      }
      setMessage({ type: "ok", text: "Página inicial actualizada com sucesso." });
    } catch (e: any) {
      setMessage({ type: "err", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const updateHero = (field: keyof HomeContent["hero"], value: string) => {
    setContent((c) => ({ ...c, hero: { ...c.hero, [field]: value } }));
  };

  const updateAbout = (field: keyof HomeContent["about"], value: string | string[]) => {
    setContent((c) => ({ ...c, about: { ...c.about, [field]: value } }));
  };

  const updateContact = (field: keyof HomeContent["contact"], value: string | string[]) => {
    setContent((c) => ({ ...c, contact: { ...c.contact, [field]: value } }));
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-[#a21b7e]/30 border-t-[#a21b7e] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Globe className="text-[#a21b7e]" size={24} />
              Página Inicial do Site
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Edite os textos e contactos exibidos em{" "}
              <a href="/" target="_blank" rel="noopener noreferrer" className="text-[#a21b7e] font-bold inline-flex items-center gap-1">
                provisualcorporate.co.mz <ExternalLink size={12} />
              </a>
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={load}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-md text-sm font-bold text-gray-600 hover:border-[#a21b7e]/40"
            >
              <RefreshCw size={16} />
              Recarregar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className={cn(
                "flex items-center gap-2 bg-[#a21b7e] hover:bg-[#8e176e] text-white px-4 py-2.5 rounded-md text-sm font-bold shadow-sm",
                saving && "opacity-70"
              )}
            >
              <Save size={16} />
              {saving ? "A guardar..." : "Guardar alterações"}
            </button>
          </div>
        </div>

        {message && (
          <div
            className={cn(
              "p-4 rounded-lg text-sm font-bold border",
              message.type === "ok"
                ? "bg-green-50 text-green-700 border-green-100"
                : "bg-red-50 text-red-700 border-red-100"
            )}
          >
            {message.text}
          </div>
        )}

        <section className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-[#a21b7e] uppercase tracking-widest">Hero</h3>
          {(
            [
              ["eyebrow", "Linha superior (ex: Nós somos)"],
              ["title", "Título principal"],
              ["tagline", "Subtítulo"],
              ["ctaPrimary", "Botão principal"],
              ["ctaSecondary", "Botão secundário"],
              ["backgroundImage", "URL da imagem de fundo"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
                {label}
              </label>
              <div className="flex gap-2">
                <input
                  value={content.hero[key]}
                  onChange={(e) => updateHero(key, e.target.value)}
                  className="flex-1 h-11 px-3 border border-gray-100 rounded-lg text-sm focus:border-[#a21b7e] outline-none"
                />
                {key === "backgroundImage" && (
                  <>
                    <input
                      ref={heroUploadRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSiteUpload(file, "hero", (url) => updateHero("backgroundImage", url));
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => heroUploadRef.current?.click()}
                      className="shrink-0 h-11 px-3 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:border-[#a21b7e]/40 inline-flex items-center gap-1"
                    >
                      <Upload size={14} />
                      Drive
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </section>

        <section className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-[#a21b7e] uppercase tracking-widest">Slides do banner</h3>
          {content.slides.map((slide, index) => (
            <div key={index} className="p-4 rounded-lg border border-gray-100 space-y-3">
              <p className="text-xs font-bold text-gray-500">Slide {index + 1}</p>
              <input
                value={slide.category}
                onChange={(e) =>
                  setContent((c) => ({
                    ...c,
                    slides: c.slides.map((s, i) => (i === index ? { ...s, category: e.target.value } : s)),
                  }))
                }
                placeholder="Categoria"
                className="w-full h-10 px-3 border border-gray-100 rounded-lg text-sm"
              />
              <ImageUrlField
                label="Imagem do slide"
                value={slide.image}
                onChange={(url) =>
                  setContent((c) => ({
                    ...c,
                    slides: c.slides.map((s, i) => (i === index ? { ...s, image: url } : s)),
                  }))
                }
                subpath="hero"
                uploading={uploading}
                onUpload={handleSiteUpload}
              />
            </div>
          ))}
        </section>

        <section className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-[#a21b7e] uppercase tracking-widest">Imagens da homepage</h3>
          <ImageUrlField
            label="Imagem secção Sobre nós"
            value={content.aboutImage}
            onChange={(url) => setContent((c) => ({ ...c, aboutImage: url }))}
            subpath="home"
            uploading={uploading}
            onUpload={handleSiteUpload}
          />
          <ImageUrlField
            label="Fundo secção Processo criativo"
            value={content.processBackground}
            onChange={(url) => setContent((c) => ({ ...c, processBackground: url }))}
            subpath="home"
            uploading={uploading}
            onUpload={handleSiteUpload}
          />
          <ImageUrlField
            label="Banner equipa de especialistas"
            value={content.teamBanner}
            onChange={(url) => setContent((c) => ({ ...c, teamBanner: url }))}
            subpath="home"
            uploading={uploading}
            onUpload={handleSiteUpload}
          />
        </section>

        <section className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-[#a21b7e] uppercase tracking-widest">Equipa</h3>
          {content.teamMembers.map((member, index) => (
            <div key={member.name} className="p-4 rounded-lg border border-gray-100 space-y-3">
              <p className="text-xs font-bold text-gray-500">{member.name}</p>
              <ImageUrlField
                label="Foto"
                value={member.image}
                onChange={(url) =>
                  setContent((c) => ({
                    ...c,
                    teamMembers: c.teamMembers.map((m, i) => (i === index ? { ...m, image: url } : m)),
                  }))
                }
                subpath="home/equipa"
                uploading={uploading}
                onUpload={handleSiteUpload}
              />
            </div>
          ))}
        </section>

        <section className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-[#a21b7e] uppercase tracking-widest flex items-center gap-2">
            <ImageIcon size={16} />
            Galeria e biblioteca (Google Drive)
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            Todas as imagens do site vão para a pasta <strong>site</strong> no Google Drive.
            Hero (banner + slides): <code className="text-xs bg-gray-100 px-1 rounded">site/hero/</code> — todas numa pasta.
            Galeria: <code className="text-xs bg-gray-100 px-1 rounded">site/galeria/nome-do-album</code>.
            Serviços: <code className="text-xs bg-gray-100 px-1 rounded">site/servicos/slug-do-servico</code>.
          </p>
          {libraryCount !== null && (
            <p className="text-xs font-bold text-gray-500">
              {libraryCount} imagem{libraryCount === 1 ? "" : "ns"} na biblioteca do site.
            </p>
          )}
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])];
              for (const file of files) {
                await handleSiteUpload(file, "galeria");
              }
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => uploadInputRef.current?.click()}
            className="inline-flex items-center gap-2 bg-[#3d001d] hover:bg-[#2a0014] text-white px-4 py-2.5 rounded-md text-sm font-bold"
          >
            <Upload size={16} />
            {uploading ? "A carregar..." : "Carregar fotos para site/galeria"}
          </button>
        </section>

        <section className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-[#a21b7e] uppercase tracking-widest">Sobre nós</h3>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
              Título história (AMIC)
            </label>
            <input
              value={content.about.historyTitle ?? ""}
              onChange={(e) => updateAbout("historyTitle", e.target.value)}
              className="w-full h-11 px-3 border border-gray-100 rounded-lg text-sm focus:border-[#a21b7e] outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
              Texto história
            </label>
            <textarea
              value={content.about.history ?? ""}
              onChange={(e) => updateAbout("history", e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm focus:border-[#a21b7e] outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
              URL PDF estatutos
            </label>
            <input
              value={content.about.documents?.[0]?.pdfUrl ?? ""}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  about: {
                    ...prev.about,
                    documents: [
                      {
                        title: prev.about.documents?.[0]?.title ?? "Estatutos",
                        pdfUrl: e.target.value,
                        previewImage: prev.about.documents?.[0]?.previewImage,
                      },
                    ],
                  },
                }))
              }
              className="w-full h-11 px-3 border border-gray-100 rounded-lg text-sm focus:border-[#a21b7e] outline-none"
            />
          </div>
          {(
            [
              ["missionTitle", "Título missão"],
              ["mission", "Texto missão"],
              ["visionTitle", "Título visão"],
              ["vision", "Texto visão"],
              ["valuesTitle", "Título valores"],
              ["values", "Texto valores"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
                {label}
              </label>
              <textarea
                value={content.about[key]}
                onChange={(e) => updateAbout(key, e.target.value)}
                rows={key.includes("mission") || key.includes("vision") || key === "values" ? 3 : 1}
                className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm focus:border-[#a21b7e] outline-none resize-none"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
              Pilares (separados por vírgula)
            </label>
            <input
              value={content.about.valuesPills.join(", ")}
              onChange={(e) =>
                updateAbout(
                  "valuesPills",
                  e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                )
              }
              className="w-full h-11 px-3 border border-gray-100 rounded-lg text-sm focus:border-[#a21b7e] outline-none"
            />
          </div>
        </section>

        <section className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-[#a21b7e] uppercase tracking-widest">Contactos</h3>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
              Telefones (um por linha)
            </label>
            <textarea
              value={content.contact.phones.join("\n")}
              onChange={(e) =>
                updateContact(
                  "phones",
                  e.target.value.split("\n").map((s) => s.trim()).filter(Boolean)
                )
              }
              rows={2}
              className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm focus:border-[#a21b7e] outline-none resize-none"
            />
          </div>
          {(
            [
              ["email", "Email"],
              ["whatsapp", "WhatsApp (apenas números)"],
              ["address", "Endereço"],
              ["ctaTitle", "Título CTA contactos"],
              ["ctaSubtitle", "Subtítulo CTA"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
                {label}
              </label>
              <input
                value={content.contact[key] as string}
                onChange={(e) => updateContact(key, e.target.value)}
                className="w-full h-11 px-3 border border-gray-100 rounded-lg text-sm focus:border-[#a21b7e] outline-none"
              />
            </div>
          ))}
        </section>

        <section className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-[#a21b7e] uppercase tracking-widest">
            Introdução serviços
          </h3>
          <textarea
            value={content.servicesIntro}
            onChange={(e) => setContent((c) => ({ ...c, servicesIntro: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm focus:border-[#a21b7e] outline-none resize-none"
          />
        </section>

        <p className="text-xs text-gray-400 text-center pb-8">
          Todas as imagens carregadas via Drive são guardadas em site/ no Google Drive.
          Guarde as alterações para reflectir na página em /.
        </p>
      </div>
    </div>
  );
}
