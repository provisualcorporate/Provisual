import React, { useEffect, useRef, useState } from "react";
import { Images, Key, Video } from "lucide-react";
import { cn } from "../lib/utils";
import AdminBreadcrumb, { type AdminNavState } from "./admin/AdminBreadcrumb";
import { prefetchAdminPanelData } from "../lib/siteGalleryApi";
import AlbumsAdminTab from "./admin/AlbumsAdminTab";
import VideosAdminTab from "./admin/VideosAdminTab";
import AccessAccountsAdmin from "./admin/AccessAccountsAdmin";
import UnsavedChangesDialog from "./admin/UnsavedChangesDialog";
import type { AdminEditorHandle } from "./admin/AdminEditorHandle";

type HomeAdminTab = "albuns" | "videos" | "contas";

type ViewerProfile = {
  email?: string;
  id?: string;
  uid?: string;
  displayName?: string;
};

interface SiteHomeAdminPanelProps {
  viewerProfile?: ViewerProfile | null;
}

const TABS: { id: HomeAdminTab; label: string; icon: React.ReactNode }[] = [
  { id: "albuns", label: "Álbuns", icon: <Images size={16} /> },
  { id: "videos", label: "Vídeos", icon: <Video size={16} /> },
  { id: "contas", label: "Contas de Acesso", icon: <Key size={16} /> },
];

export default function SiteHomeAdminPanel({ viewerProfile = null }: SiteHomeAdminPanelProps) {
  const [activeTab, setActiveTab] = useState<HomeAdminTab>("albuns");
  const [pendingTab, setPendingTab] = useState<HomeAdminTab | null>(null);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [unsavedSaving, setUnsavedSaving] = useState(false);
  const [toolbarActions, setToolbarActions] = useState<React.ReactNode>(null);
  const [adminNav, setAdminNav] = useState<AdminNavState>({
    crumbs: [{ label: "Gestão do Site" }, { label: "Álbuns" }],
  });
  const editorRef = useRef<AdminEditorHandle | null>(null);

  useEffect(() => {
    prefetchAdminPanelData();
  }, []);

  const requestTabChange = (tab: HomeAdminTab) => {
    if (tab === activeTab) return;

    const editor = editorRef.current;
    if (editor?.isEditing()) {
      setPendingTab(tab);
      setUnsavedOpen(true);
      return;
    }

    setActiveTab(tab);
  };

  const closeUnsavedDialog = () => {
    if (unsavedSaving) return;
    setUnsavedOpen(false);
    setPendingTab(null);
  };

  const continueEditing = () => {
    closeUnsavedDialog();
  };

  const leaveWithoutSaving = () => {
    editorRef.current?.discard();
    if (pendingTab) setActiveTab(pendingTab);
    setUnsavedOpen(false);
    setPendingTab(null);
  };

  const saveAndSwitch = async () => {
    const editor = editorRef.current;
    if (!editor) return;

    setUnsavedSaving(true);
    try {
      const saved = await editor.save();
      if (!saved) return;
      if (pendingTab) setActiveTab(pendingTab);
      setUnsavedOpen(false);
      setPendingTab(null);
    } finally {
      setUnsavedSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-3 md:space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => requestTabChange(tab.id)}
                className="px-2 py-1.5 text-sm font-bold transition-colors cursor-pointer bg-transparent border-0"
              >
                <span
                  className={cn(
                    "relative inline-flex items-center gap-1.5 after:content-[''] after:absolute after:-bottom-1.5 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:transition-colors",
                    activeTab === tab.id
                      ? "text-[#a21b7e] after:bg-[#a21b7e]"
                      : "text-gray-500 hover:text-[#a21b7e] after:bg-transparent hover:after:bg-[#a21b7e]",
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
          {toolbarActions && (
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto md:ml-auto justify-end">
              {toolbarActions}
            </div>
          )}
        </div>

        <AdminBreadcrumb crumbs={adminNav.crumbs} onBack={adminNav.onBack} compact />

        <div className="min-h-[420px]">
          <div className={activeTab === "albuns" ? "" : "hidden"}>
            <AlbumsAdminTab
              ref={activeTab === "albuns" ? editorRef : undefined}
              isActive={activeTab === "albuns"}
              onToolbarChange={setToolbarActions}
              onNavChange={setAdminNav}
            />
          </div>
          <div className={activeTab === "videos" ? "" : "hidden"}>
            <VideosAdminTab
              ref={activeTab === "videos" ? editorRef : undefined}
              isActive={activeTab === "videos"}
              onToolbarChange={setToolbarActions}
              onNavChange={setAdminNav}
            />
          </div>
          <div className={activeTab === "contas" ? "" : "hidden"}>
            <AccessAccountsAdmin
              isActive={activeTab === "contas"}
              viewerProfile={viewerProfile}
              onToolbarChange={setToolbarActions}
              onNavChange={setAdminNav}
            />
          </div>
        </div>
      </div>

      <UnsavedChangesDialog
        open={unsavedOpen}
        saving={unsavedSaving}
        onCancel={continueEditing}
        onDiscard={leaveWithoutSaving}
        onSave={saveAndSwitch}
      />
    </div>
  );
}
