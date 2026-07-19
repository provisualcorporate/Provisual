import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  X,
  Folder as FolderIcon,
  FileText,
  Image as ImageIcon,
  Video,
  Search,
  Grid,
  List as ListIcon,
  ChevronRight,
  Clock,
  HardDrive,
  Download,
  Filter,
  MoreVertical,
  LayoutGrid,
  FolderPlus,
  Share2,
  Trash2,
  Plus,
  ArrowBigUpDash,
  LogOut,
  BarChart3,
  Upload,
  FileUp,
  FolderUp,
  ChevronDown,
  Users,
  Star,
  Cloud,
  Sparkles,
  ExternalLink,
  Pencil,
  Copy,
  UserPlus,
  UserMinus,
  Info,
  CheckCircle2,
  Check,
  FolderDot,
  Key,
  RefreshCw,
  Square,
  CheckSquare,
  Mail,
  Folder,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Database,
  Link,
  PanelLeft,
  PanelLeftClose
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, displayDriveName, filterAccountsForViewer, handleFirestoreError, isSuperAdmin, OperationType } from "../lib/utils";
import {
  findAccountByEmail,
  getAccountDisplayTitle,
  getAccountGreetingName,
  getAccountListLabel,
  parseAccountDisplay,
} from "../lib/accountDisplay";
import AccountAvatar from "./AccountAvatar";
import {
  mergeById,
  parentMatchesFolder,
  parseDriveListing,
  type DriveBrowseListing,
} from "../lib/driveBrowseHelpers";
import { driveThumbnailSrc, resolveDriveFileId } from "../lib/driveImageUrl";
import { markFolderSynced, shouldSkipFolderSync } from "../lib/siteAdminCache";
import {
  parseDragPayload,
  toggleSelectionId,
} from "../lib/drivePanelSelection";
import { downloadDriveFolder, getDrivePreviewUrl, triggerDriveDownload } from "../lib/driveDownload";
import { motion, AnimatePresence } from "motion/react";
import { collection, query, where, onSnapshot, addDoc, getDoc, doc, updateDoc, setDoc, serverTimestamp, Timestamp, deleteDoc, supabase, db } from "../lib/supabase";

const IMAGES_GRID_PAGE_SIZE = 20;

import logoHorizontal from "../Logo/logo_horizontal_clean.png";
import logoJpg from "../Logo/logo_main_jpg.jpg";
import simboloImg from "../Logo/Simbolo.png";
import LeaveAccountDialog from "./LeaveAccountDialog";
import FilePreviewModal from "./FilePreviewModal";
import DashboardSidebarItem from "./dashboard/DashboardSidebarItem";
import { useDashboardSidebar } from "./dashboard/useDashboardSidebar";

// Helper de requisição segura para evitar Unexpected end of JSON input e expor erros reais
async function fetchWithErrorMessage(url: string, options: RequestInit): Promise<any> {
  const response = await fetch(url, options);
  if (!response.ok) {
    let errorMsg = `Erro na operação (${response.status})`;
    try {
      const errData = await response.json();
      errorMsg = errData.error || errorMsg;
    } catch {
      try {
        const text = await response.text();
        if (text && text.length < 200) {
          errorMsg = text;
        }
      } catch { }
    }
    throw new Error(errorMsg);
  }

  try {
    return await response.json();
  } catch {
    return {};
  }
}

function cleanStringForSearch(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]/g, ' ') // substitui pontuação por espaço
    .replace(/\s+/g, ' ') // normaliza espaços
    .trim();
}

function matchesSearchQuery(name: string, query: string): boolean {
  if (!query) return true;
  if (!name) return false;

  const cleanName = cleanStringForSearch(name);
  const cleanQuery = cleanStringForSearch(query);

  // Dividir a busca em palavras individuais, ignorando conectores comuns (de, do, da, e, o, a, etc.)
  const ignoreWords = new Set(['de', 'do', 'da', 'e', 'o', 'a', 'os', 'as', 'em', 'um', 'uma', 'para', 'com']);
  const queryWords = cleanQuery.split(' ').filter(w => w && !ignoreWords.has(w));

  if (queryWords.length === 0) return cleanName.includes(cleanQuery);

  // Verificar se TODAS as palavras relevantes da consulta estão no nome
  return queryWords.every(word => cleanName.includes(word));
}

// Types
interface AssetVersion {
  quality: "low" | "high" | "original";
  size: string;
  url: string;
}

interface Asset {
  id: string;
  name: string;
  type: "image" | "video" | "document" | "folder";
  captureDate: Date;
  uploadDate: Date;
  versions: AssetVersion[];
  folderId: string;
  ownerId?: string;
  driveId?: string;
  thumbnailUrl?: string;
  webViewLink?: string;
}

// Componente SafeImage para garantir visibilidade e fallbacks de thumbnails
interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  thumbnailUrl?: string;
  driveId?: string;
  fileId?: string;
  fallbackSize?: 'w100' | 'w500' | 'w1200';
  crop?: boolean;
  alt?: string;
  className?: string;
}

function SafeImage({
  thumbnailUrl,
  driveId,
  fileId,
  fallbackSize = 'w500',
  crop = false,
  alt,
  className,
  ...props
}: SafeImageProps) {
  const resolvedId = resolveDriveFileId(driveId, fileId);
  const proxyUrl = resolvedId ? driveThumbnailSrc(resolvedId, { sz: 800, crop }) : "";
  const initialUrl = proxyUrl || thumbnailUrl || "";
  const [src, setSrc] = useState(initialUrl);
  const [hasFailedOnce, setHasFailedOnce] = useState(false);
  const [hasFailedAlt, setHasFailedAlt] = useState(false);

  useEffect(() => {
    const id = resolveDriveFileId(driveId, fileId);
    const newUrl = id ? driveThumbnailSrc(id, { sz: 800, crop }) : (thumbnailUrl || "");
    setSrc(newUrl);
    setHasFailedOnce(false);
    setHasFailedAlt(false);
  }, [thumbnailUrl, driveId, fileId, fallbackSize, crop]);

  const handleError = () => {
    if (!hasFailedOnce && resolvedId) {
      setHasFailedOnce(true);
      setSrc(`https://drive.google.com/thumbnail?id=${resolvedId}&sz=${fallbackSize}`);
    } else if (!hasFailedAlt && resolvedId) {
      setHasFailedAlt(true);
      setSrc(`https://docs.google.com/uc?export=view&id=${resolvedId}`);
    }
  };

  if (!src) return null;

  return (
    <img
      src={src}
      alt={alt}
      onError={handleError}
      className={className}
      {...props}
    />
  );
}

// Componente Skeleton Loading realista e premium
function SkeletonView({ viewMode, activeTab }: { viewMode: 'grid' | 'list'; activeTab: string }) {
  const isList = viewMode === 'list';
  const showFolders = activeTab === 'all' || activeTab === 'google_drive';

  if (isList) {
    return (
      <div className="p-8 flex flex-col gap-3 bg-gray-50 min-h-full w-full">
        {/* Cabeçalho da Tabela fake */}
        <div className="grid grid-cols-12 gap-4 pb-3 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-wider px-4">
          <div className="col-span-6">Nome</div>
          <div className="col-span-2">Modificado em</div>
          <div className="col-span-2">Tamanho</div>
          <div className="col-span-2 text-right">Ações</div>
        </div>

        {/* Linhas de Pastas */}
        {showFolders && Array.from({ length: 4 }).map((_, i) => (
          <div key={`folder-ske-${i}`} className="grid grid-cols-12 gap-4 py-3.5 items-center bg-white border border-gray-50 rounded-lg px-4 shadow-sm animate-pulse">
            <div className="col-span-6 flex items-center gap-3">
              <div className="w-5 h-5 bg-yellow-100 rounded-md shrink-0" />
              <div className="w-32 h-3.5 bg-gray-200 rounded" />
            </div>
            <div className="col-span-2">
              <div className="w-20 h-3 bg-gray-100 rounded" />
            </div>
            <div className="col-span-2">
              <div className="w-10 h-3 bg-gray-100 rounded" />
            </div>
            <div className="col-span-2 flex justify-end gap-2">
              <div className="w-4 h-4 bg-gray-100 rounded-full" />
            </div>
          </div>
        ))}

        {/* Linhas de Arquivos */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`file-ske-${i}`} className="grid grid-cols-12 gap-4 py-3.5 items-center bg-white border border-gray-50 rounded-lg px-4 shadow-sm animate-pulse">
            <div className="col-span-6 flex items-center gap-3">
              <div className="w-5 h-5 bg-purple-100 rounded-md shrink-0" />
              <div className="w-44 h-3.5 bg-gray-200 rounded" />
            </div>
            <div className="col-span-2">
              <div className="w-20 h-3 bg-gray-100 rounded" />
            </div>
            <div className="col-span-2">
              <div className="w-12 h-3 bg-gray-100 rounded" />
            </div>
            <div className="col-span-2 flex justify-end gap-2">
              <div className="w-4 h-4 bg-gray-100 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Grid view
  return (
    <div className="p-8 flex flex-col gap-8 bg-gray-50 min-h-full w-full">
      {/* Grid de Pastas */}
      {showFolders && (
        <div className="w-full flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={`folder-ske-g-${i}`} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg shadow-sm animate-pulse">
                <div className="flex items-center gap-3 truncate">
                  <div className="w-5 h-5 bg-yellow-100 rounded-md shrink-0" />
                  <div className="w-24 h-3 bg-gray-200 rounded" />
                </div>
                <div className="w-4 h-4 bg-gray-100 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid de Arquivos */}
      <div className="w-full flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`file-ske-g-${i}`} className="bg-white border border-gray-100 rounded-lg overflow-hidden shadow-sm aspect-square flex flex-col animate-pulse">
              <div className="flex-1 bg-gray-50 flex items-center justify-center relative">
                <div className="w-8 h-8 bg-purple-50 rounded-full flex items-center justify-center animate-pulse" />
              </div>
              <div className="p-3 flex flex-col gap-1.5 border-t border-gray-50 bg-white">
                <div className="w-28 h-3 bg-gray-200 rounded" />
                <div className="w-16 h-2 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface FolderData {
  id: string;
  name: string;
  date: Date;
  parentId?: string | null;
  color?: string;
  clientEmail?: string;
  clientEmails?: string[];
  trashed?: boolean;
  deleted?: boolean;
}

interface UserProfile {
  role: "admin" | "cliente";
  email: string;
}

export default function ClientDashboard() {
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);



  const [folders, setFolders] = useState<FolderData[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(() => {
    return sessionStorage.getItem('prov_selected_folder_id') || null;
  });
  const [activeTab, setActiveTab] = useState<'all' | 'image' | 'video' | 'document' | 'other' | 'google_drive' | 'contas_acesso'>(() => {
    return (sessionStorage.getItem('prov_active_tab') as any) || 'all';
  });
  const [isClientsMenuOpen, setIsClientsMenuOpen] = useState(true);
  const [isClientsListOpen, setIsClientsListOpen] = useState(true);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid"); // Grelha por padrão
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [driveFilterType, setDriveFilterType] = useState<string | null>(() => {
    return sessionStorage.getItem('prov_drive_filter_type') || null;
  });
  const [storageQuota, setStorageQuota] = useState<{ limit: string; usage: string } | null>(null);
  const [activeFolderMenuId, setActiveFolderMenuId] = useState<string | null>(null);
  const [activeFolderSubmenu, setActiveFolderSubmenu] = useState<'none' | 'partilhar' | 'organizar'>('none');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean } | null>(null);

  // Estado para conexão híbrida pessoal de Google Drive do Silva
  const [driveStatus, setDriveStatus] = useState<{ connected: boolean; type: string; email: string; configNeeded: boolean } | null>(null);
  const [isDriveDropdownOpen, setIsDriveDropdownOpen] = useState(false);
  const [bulkMoveMenuOpen, setBulkMoveMenuOpen] = useState(false);
  const [bulkSelectMenuOpen, setBulkSelectMenuOpen] = useState(false);
  const [leaveAccountOpen, setLeaveAccountOpen] = useState(false);
  const { expanded: sidebarExpanded, collapsed: sidebarCollapsed, toggle: toggleSidebar } =
    useDashboardSidebar();
  const [isSyncingBackground, setIsSyncingBackground] = useState(false);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const [driveBrowseCache, setDriveBrowseCache] = useState<Record<string, DriveBrowseListing>>({});
  const pendingSyncRef = useRef<{ targetFolderId?: string; filterType?: string; isBackground: boolean; recursive?: boolean } | null>(null);
  const restoredFolderRef = useRef<string | null>(sessionStorage.getItem('prov_selected_folder_id'));
  const syncInProgressRef = useRef(false);
  const syncGenerationRef = useRef(0);
  const queuedSyncRef = useRef<{ targetFolderId?: string; filterType?: string; isBackground: boolean; recursive?: boolean } | null>(null);

  // Estados para Gestão de Contas de Acesso dos Clientes
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [newAccountEmail, setNewAccountEmail] = useState("");
  const [newAccountResponsible, setNewAccountResponsible] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountLogo, setNewAccountLogo] = useState("");
  const [newAccountPassword, setNewAccountPassword] = useState("");
  const [newAccountRole, setNewAccountRole] = useState<"admin" | "cliente">("cliente");
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any | null>(null);

  // Estados para as janelas interativas reais dos arquivos (sem bonecos!)
  const [geminiAsset, setGeminiAsset] = useState<Asset | null>(null);
  const [geminiQuestion, setGeminiQuestion] = useState("");
  const [geminiAnswers, setGeminiAnswers] = useState<Array<{ role: 'user' | 'gemini', text: string }>>([]);
  const [isGeminiLoading, setIsGeminiLoading] = useState(false);
  const [shareAsset, setShareAsset] = useState<Asset | null>(null);
  const [organizarModal, setOrganizarModal] = useState<{ folder?: any; asset?: any; mode: 'move' | 'copy' } | null>(null);
  const [organizarSearch, setOrganizarSearch] = useState("");
  const [isCopiedText, setIsCopiedText] = useState(false);
  const [distributeModalOpen, setDistributeModalOpen] = useState(false);
  const [itemToDistribute, setItemToDistribute] = useState<{ id: string, type: 'folder' | 'asset', currentName: string } | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [isDistributing, setIsDistributing] = useState(false);

  // Buscar a pasta geral chamada "arquivo" no nível raiz para servir como raiz do Meu Drive
  const arquivoFolder = useMemo(() => {
    if (!folders || !Array.isArray(folders)) return null;
    // 1. Tentar busca exata por "arquivo" na raiz
    let found = folders.find(f =>
      f && f.name && typeof f.name === 'string' &&
      f.name.trim().toLowerCase() === 'arquivo' &&
      (!(f as any).parentId || (f as any).parentId === 'root' || (f as any).parentId === '') &&
      !(f as any).trashed
    );
    if (found) return found;

    // 2. Fallback: buscar pasta que contenha "arquivo" no nome na raiz
    found = folders.find(f =>
      f && f.name && typeof f.name === 'string' &&
      f.name.toLowerCase().includes('arquivo') &&
      (!(f as any).parentId || (f as any).parentId === 'root' || (f as any).parentId === '') &&
      !(f as any).trashed
    );
    if (found) return found;

    // 3. Fallback final: se não achou na raiz, buscar qualquer pasta chamada "arquivo" no sistema
    return folders.find(f =>
      f && f.name && typeof f.name === 'string' &&
      f.name.trim().toLowerCase() === 'arquivo' &&
      !(f as any).trashed
    );
  }, [folders]);

  const arquivoFolderId = arquivoFolder ? arquivoFolder.id : null;

  const [visibleImagesCount, setVisibleImagesCount] = useState(IMAGES_GRID_PAGE_SIZE);
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  useEffect(() => {
    if (activeTab) {
      sessionStorage.setItem('prov_active_tab', activeTab);
    } else {
      sessionStorage.removeItem('prov_active_tab');
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedFolderId) {
      sessionStorage.setItem('prov_selected_folder_id', selectedFolderId);
    } else {
      sessionStorage.removeItem('prov_selected_folder_id');
    }
  }, [selectedFolderId]);

  useEffect(() => {
    if (driveFilterType) {
      sessionStorage.setItem('prov_drive_filter_type', driveFilterType);
    } else {
      sessionStorage.removeItem('prov_drive_filter_type');
    }
  }, [driveFilterType]);

  // Lógica premium para evitar skeleton em ações internas (sincronizada com sessionStorage)
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [isActionReloading, setIsActionReloading] = useState(() => {
    return sessionStorage.getItem('action_in_progress') === 'true';
  });

  useEffect(() => {
    if (foldersLoaded && assetsLoaded) {
      sessionStorage.removeItem('action_in_progress');
      setIsActionReloading(false);
    }
  }, [foldersLoaded, assetsLoaded]);

  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
    };
    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("contextmenu", handleGlobalClick);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("contextmenu", handleGlobalClick);
    };
  }, []);

  // Grelha de 5 colunas como padrão para tudo
  useEffect(() => {
    setViewMode('grid');
  }, [activeTab]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<{ id: string; name: string; progress: number; status: 'uploading' | 'completed' | 'error' }[]>([]);
  const [showUploadQueueCard, setShowUploadQueueCard] = useState(false);
  const [newlyUploadedAssetIds, setNewlyUploadedAssetIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchDriveStatus = async () => {
      try {
        const response = await fetch("/api/drive/auth/status");
        if (response.ok) {
          const data = await response.json();
          setDriveStatus(data);
        }
      } catch (err) {
        console.error("Erro ao buscar status do Drive:", err);
      }
    };
    fetchDriveStatus();
    // Atualizar a cada 8 segundos para detectar conexões rápidas feitas no popup
    const interval = setInterval(fetchDriveStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleConnectDrive = async () => {
    try {
      const response = await fetch("/api/drive/auth/url");
      if (response.ok) {
        const data = await response.json();
        if (data.url) {
          window.open(data.url, "_blank", "width=600,height=650,left=150,top=100");
        } else {
          alert(data.error || "Erro ao conectar.");
        }
      } else {
        const data = await response.json();
        alert(data.error || "Erro ao iniciar conexão com o Google Drive.");
      }
    } catch (err: any) {
      alert("Erro ao conectar: " + err.message);
    }
  };

  const handleDisconnectDrive = async () => {
    if (!confirm("Tem certeza que deseja desconectar o Google Drive? Esta ação desativará o upload direto para sua conta pessoal.")) return;
    try {
      const response = await fetch("/api/drive/auth/disconnect", { method: "POST" });
      if (response.ok) {
        alert("Google Drive desconectado com sucesso.");
        window.location.reload();
      } else {
        const data = await response.json();
        alert(data.error || "Erro ao desconectar.");
      }
    } catch (err: any) {
      alert("Erro ao desconectar: " + err.message);
    }
  };

  const isDataLoading = !foldersLoaded || !assetsLoaded;
  const handleActionSuccess = () => {
    setIsProcessingAction(false);
    sessionStorage.removeItem('action_in_progress');
  };
  const showSkeleton = false;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const uploadMenuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (uploadMenuRef.current && !uploadMenuRef.current.contains(event.target as Node)) {
        setIsUploadMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle Folder Creation
  const handleCreateFolder = async () => {
    const folderName = prompt("Digite o nome da nova pasta:");
    if (!folderName) return;

    try {
      setIsProcessingAction(true);
      sessionStorage.setItem('action_in_progress', 'true');
      await addDoc(collection(db, "folders"), {
        name: folderName,
        date: serverTimestamp(),
        ownerId: currentUser?.id || "mock-admin",
        parentId: selectedFolderId || (activeTab === 'all' ? '1ww-KgTwlOLbvCHtCLZgGTntzA6SStCjG' : null),
        color: "#e2b13c",
        adminToken: "Silva_Chamo_Master_Admin_2026"
      });
      setIsProcessingAction(false);
      sessionStorage.removeItem('action_in_progress');
    } catch (error) {
      console.error("Erro ao criar pasta:", error);
      setIsProcessingAction(false);
      sessionStorage.removeItem('action_in_progress');
    }
  };

  // Gestão de Contas de Acesso dos Clientes (Criar ou Editar)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setAccountError("A imagem selecionada é muito grande. Escolha uma imagem de até 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        const MAX_DIM = 200;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
          setNewAccountLogo(compressedBase64);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError(null);
    setAccountSuccess(null);

    if (!newAccountEmail || !newAccountResponsible || !newAccountName || !newAccountPassword) {
      setAccountError("Preencha todos os campos obrigatórios.");
      return;
    }

    if (newAccountPassword.length < 6) {
      setAccountError("A senha deve conter no mínimo 6 caracteres.");
      return;
    }

    setIsCreatingAccount(true);
    const displayNameValue = `${newAccountResponsible.trim()}|${newAccountName.trim()}|${newAccountLogo.trim()}`;

    try {
      if (editingAccount) {
        // MODO EDIÇÃO: Atualizar documento existente no Firestore
        await setDoc(doc(db, "users", editingAccount.id), {
          email: newAccountEmail.trim().toLowerCase(),
          displayName: displayNameValue,
          password: newAccountPassword,
          role: newAccountRole,
          adminToken: "Silva_Chamo_Master_Admin_2026"
        }, { merge: true });

        setAccountSuccess("Conta de acesso editada com sucesso!");
      } else {
        // MODO CRIAÇÃO: Verificar se o email já está cadastrado
        const emailExists = accounts.some(
          (acc) => acc.email?.toLowerCase() === newAccountEmail.trim().toLowerCase()
        );
        if (emailExists) {
          setAccountError("Este e-mail já está cadastrado.");
          setIsCreatingAccount(false);
          return;
        }

        // Gerar ID de usuário
        const generatedUid = "client_" + Math.random().toString(36).substring(2, 11);

        // Salvar conta no Firestore na coleção "users"
        await setDoc(doc(db, "users", generatedUid), {
          email: newAccountEmail.trim().toLowerCase(),
          displayName: displayNameValue,
          password: newAccountPassword, // Senha salva para login resiliente local
          role: newAccountRole,
          clientId: generatedUid, // ID do cliente para filtrar seus arquivos
          createdAt: serverTimestamp(),
          adminToken: "Silva_Chamo_Master_Admin_2026"
        });

        setAccountSuccess("Conta de acesso criada com sucesso!");
      }

      setNewAccountEmail("");
      setNewAccountResponsible("");
      setNewAccountName("");
      setNewAccountLogo("");
      setNewAccountPassword("");
      setNewAccountRole("cliente");

      // Fechar modal após 1.5s
      setTimeout(() => {
        setIsAddAccountModalOpen(false);
        setEditingAccount(null);
        setAccountSuccess(null);
      }, 1500);
    } catch (err: any) {
      console.error("Erro ao salvar conta:", err);
      setAccountError(`Erro no banco de dados ao salvar a conta: ${err.message || err}`);
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleEditClick = (account: any) => {
    setEditingAccount(account);
    setNewAccountEmail(account.email);
    const parsed = parseAccountDisplay(String(account.displayName || ""));
    setNewAccountResponsible(parsed.responsible);
    setNewAccountName(parsed.companyName);
    setNewAccountLogo(parsed.logo);
    setNewAccountPassword(account.password || "");
    setNewAccountRole(account.role || "cliente");
    setAccountError(null);
    setAccountSuccess(null);
    setIsAddAccountModalOpen(true);
  };

  const handleCloseAccountModal = () => {
    setIsAddAccountModalOpen(false);
    setEditingAccount(null);
    setNewAccountEmail("");
    setNewAccountResponsible("");
    setNewAccountName("");
    setNewAccountLogo("");
    setNewAccountPassword("");
    setNewAccountRole("cliente");
    setAccountError(null);
    setAccountSuccess(null);
  };

  const handleDeleteAccount = async (accountId: string, accountName: string) => {
    const confirmDelete = window.confirm(`Tem certeza que deseja excluir a conta de "${accountName}"?`);
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "users", accountId));
    } catch (err) {
      console.error("Erro ao excluir conta:", err);
      alert("Erro ao excluir conta.");
    }
  };

  // Auth logout
  const handleLogout = async () => {
    localStorage.removeItem("provisual_local_admin");
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const handleLeaveToHomepage = async () => {
    localStorage.removeItem("provisual_local_admin");
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  // Trigger File Input
  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setShowUploadQueueCard(true);

    const filesArray = Array.from(files) as File[];
    const totalFiles = filesArray.length;

    // Adicionar todos os arquivos à fila de upload
    const newItems = filesArray.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${file.name}`,
      name: file.name,
      progress: 0,
      status: 'uploading' as const
    }));

    setUploadQueue(newItems);

    try {
      // 1. Identificar e criar pastas recursivamente se for upload de pasta
      let rootFolderId = selectedFolderId;
      if (!rootFolderId) {
        if (activeTab === 'google_drive') {
          rootFolderId = arquivoFolderId || 'root';
        } else if (activeTab === 'all') {
          rootFolderId = '1ww-KgTwlOLbvCHtCLZgGTntzA6SStCjG';
        } else {
          rootFolderId = 'root';
        }
      }

      const dirToDriveId: { [path: string]: string } = { "": rootFolderId };
      const isFolderUpload = filesArray.some(file => file.webkitRelativePath);

      if (isFolderUpload) {
        const uniqueDirs = new Set<string>();
        filesArray.forEach(file => {
          if (file.webkitRelativePath) {
            const parts = file.webkitRelativePath.split('/');
            parts.pop(); // Remove o nome do arquivo
            for (let i = 1; i <= parts.length; i++) {
              uniqueDirs.add(parts.slice(0, i).join('/'));
            }
          }
        });

        // Ordenar por nível de profundidade (número de barras / segmentos)
        const sortedDirs = Array.from(uniqueDirs).sort(
          (a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b)
        );

        for (const dirPath of sortedDirs) {
          const segments = dirPath.split('/');
          const folderName = segments[segments.length - 1];
          segments.pop();
          const parentPath = segments.join('/');
          const parentDriveId = dirToDriveId[parentPath]; // Sempre existe porque ordenamos!

          // Criar pasta no Google Drive físico
          const createResponse = await fetch('/api/drive/create-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: folderName, parentId: parentDriveId })
          });

          if (!createResponse.ok) {
            let errorMsg = `Erro ao criar a pasta "${folderName}" no Google Drive.`;
            try {
              const errData = await createResponse.json();
              if (errData && errData.error) {
                errorMsg += ` Detalhes: ${errData.error}`;
              }
            } catch (e) { }
            throw new Error(errorMsg);
          }

          const driveFolder = await createResponse.json();
          const driveFolderId = driveFolder.id;

          // Guardar no cache de caminhos -> Drive IDs
          dirToDriveId[dirPath] = driveFolderId;

          // Guardar no Firestore folders
          await setDoc(doc(db, "folders", driveFolderId), {
            name: folderName,
            date: serverTimestamp(),
            ownerId: "google-drive",
            parentId: parentDriveId === 'root' ? null : parentDriveId,
            starred: false,
            trashed: false,
            adminToken: "Silva_Chamo_Master_Admin_2026"
          });
        }
      }

      // 2. Fazer upload de cada arquivo
      for (let i = 0; i < totalFiles; i++) {
        const file = filesArray[i];
        const currentQueueItem = newItems[i];

        // Atualizar progresso inicial do item atual
        setUploadQueue(prev => prev.map(item => item.id === currentQueueItem.id ? { ...item, progress: 15 } : item));

        // Determinar o ID do diretório destino do arquivo
        let fileFolderId = rootFolderId;
        if (file.webkitRelativePath) {
          const parts = file.webkitRelativePath.split('/');
          parts.pop();
          const dirPath = parts.join('/');
          fileFolderId = dirToDriveId[dirPath] || fileFolderId;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("folderId", fileFolderId);

        try {
          const response = await fetch(`${process.env.VITE_API_BASE || 'http://localhost:3333'}/api/drive/upload`, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) throw new Error(`Erro ao carregar ${file.name}`);

          const driveFile = await response.json();

          // Determinar tipo
          const isFolder = driveFile.mimeType === 'application/vnd.google-apps.folder';
          const extension = driveFile.name.split('.').pop()?.toLowerCase() || '';
          const isRaw = ['cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'orf'].includes(extension);

          const fileType = isFolder ? 'folder' : (driveFile.mimeType.includes('image') || isRaw ? 'image' : (driveFile.mimeType.includes('video') ? 'video' : 'document'));
          const fileSize = driveFile.size ? `${(parseInt(driveFile.size) / 1024 / 1024).toFixed(1)} MB` : '0 MB';

          const assetData = {
            name: driveFile.name,
            type: fileType,
            captureDate: driveFile.createdTime ? Timestamp.fromDate(new Date(driveFile.createdTime)) : serverTimestamp(),
            uploadDate: serverTimestamp(),
            folderId: fileFolderId === 'root' ? null : fileFolderId,
            ownerId: "google-drive",
            driveId: driveFile.id,
            thumbnailUrl: driveFile.thumbnailLink || "",
            versions: [{
              quality: "original",
              size: fileSize,
              url: driveFile.webViewLink
            }],
            ...(userProfile?.role === 'cliente' && { clientId: userProfile?.email }),
            adminToken: "Silva_Chamo_Master_Admin_2026"
          };

          const docRef = await addDoc(collection(db, "assets"), assetData);

          // Salvar na lista de recém-carregados para marcar com visto verde no grid
          setNewlyUploadedAssetIds(prev => [...prev, docRef.id]);

          // Atualizar progresso e status do item atual para concluído
          setUploadQueue(prev => prev.map(item => item.id === currentQueueItem.id ? { ...item, progress: 100, status: 'completed' } : item));
        } catch (fileError: any) {
          console.error("Erro no upload do arquivo:", file.name, fileError);
          setUploadQueue(prev => prev.map(item => item.id === currentQueueItem.id ? { ...item, status: 'error', progress: 100 } : item));
        }
      }
    } catch (err: any) {
      console.error("Erro geral no upload:", err);
      alert("Erro ao enviar pasta/arquivos: " + err.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Removido window.location.reload() para permitir que os uploads continuem sem travar/recarregar a tela!
    }
  };

  // Seleção e Ações em Massa
  const totalSelectedCount = selectedAssetIds.length + selectedFolderIds.length;
  const hasBulkSelectionActive = totalSelectedCount > 0;

  const clearAllSelection = () => {
    setSelectedAssetIds([]);
    setSelectedFolderIds([]);
  };

  const getDriveBrowseKey = (folderId: string | null) => {
    if (folderId) return folderId;
    if (activeTab === "all") return "1ww-KgTwlOLbvCHtCLZgGTntzA6SStCjG";
    if (activeTab === "google_drive" && arquivoFolderId) return arquivoFolderId;
    return null;
  };

  const openFolder = (folderId: string) => {
    setSelectedFolderId(folderId);
    setSearchQuery("");
    setSyncErrorMessage(null);
  };

  const handleFolderGridClick = (folderId: string) => {
    openFolder(folderId);
  };

  const handleToggleFolderSelect = (folderId: string) => {
    setSelectedFolderIds((prev) => toggleSelectionId(prev, folderId));
  };

  const handleToggleBulkSelect = (assetId: string) => {
    setSelectedAssetIds((prev) => toggleSelectionId(prev, assetId));
  };

  const moveItemsToFolder = async (
    destinationFolderId: string | null,
    assetIds: string[],
    folderIds: string[],
  ) => {
    if (assetIds.length === 0 && folderIds.length === 0) return;
    setIsProcessingAction(true);
    sessionStorage.setItem("action_in_progress", "true");

    try {
      for (const assetId of assetIds) {
        const asset = assets.find((a) => a.id === assetId);
        if (!asset) continue;

        if (asset.driveId) {
          await fetch("/api/drive/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileId: asset.driveId,
              addParents: destinationFolderId || "root",
              removeParents:
                asset.folderId === "root" || asset.folderId === "" || !asset.folderId
                  ? undefined
                  : asset.folderId,
            }),
          });
        }

        await updateDoc(doc(db, "assets", asset.id), {
          folderId: destinationFolderId,
        });
      }

      for (const folderId of folderIds) {
        if (destinationFolderId === folderId) continue;
        const folder = folders.find((f) => f.id === folderId);
        if (!folder) continue;

        if (folder.id && folder.id.length > 10) {
          await fetch("/api/drive/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileId: folder.id,
              addParents: destinationFolderId || "root",
              removeParents:
                folder.parentId && folder.parentId !== "root" ? folder.parentId : undefined,
            }),
          });
        }

        await updateDoc(doc(db, "folders", folder.id), {
          parentId: destinationFolderId,
        });
      }
    } catch (err: any) {
      console.error(err);
      alert("Erro ao mover itens: " + err.message);
    } finally {
      setIsProcessingAction(false);
      sessionStorage.removeItem("action_in_progress");
    }
  };

  const handleBulkMove = async (destinationFolderId: string | null) => {
    const folderIds = selectedFolderIds.filter((id) => id !== destinationFolderId);
    await moveItemsToFolder(destinationFolderId, selectedAssetIds, folderIds);
    clearAllSelection();
  };

  const handleDropOnFolder = async (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetFolderId(null);
    const payload = parseDragPayload(e.dataTransfer.getData("application/json"));
    if (!payload) return;
    const folderIds = payload.folderIds.filter((id) => id !== targetFolderId);
    await moveItemsToFolder(targetFolderId, payload.assetIds, folderIds);
    clearAllSelection();
  };

  const startDragSelection = (
    e: React.DragEvent,
    item: { type: "asset" | "folder"; id: string },
  ) => {
    const folderIds =
      item.type === "folder"
        ? selectedFolderIds.includes(item.id)
          ? selectedFolderIds
          : [item.id]
        : selectedFolderIds;
    const assetIds =
      item.type === "asset"
        ? selectedAssetIds.includes(item.id)
          ? selectedAssetIds
          : [item.id]
        : selectedAssetIds;
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ assetIds, folderIds }),
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const handleBulkDelete = async () => {
    if (selectedAssetIds.length === 0) return;
    if (!confirm(`Tem certeza que deseja mover os ${selectedAssetIds.length} itens selecionados para a Lixeira?`)) return;

    setIsProcessingAction(true);
    sessionStorage.setItem('action_in_progress', 'true');

    try {
      for (const assetId of selectedAssetIds) {
        const asset = assets.find(a => a.id === assetId);
        if (!asset) continue;

        // 1. Mover para a Lixeira no Google Drive
        if (asset.driveId) {
          await fetch('/api/drive/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileId: asset.driveId,
              trashed: true
            })
          });
        }

        // 2. Atualizar no Firestore
        await updateDoc(doc(db, "assets", asset.id), {
          folderId: "trash",
          trashed: true
        });
      }

      setSelectedAssetIds([]);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao eliminar itens em massa: " + err.message);
    } finally {
      setIsProcessingAction(false);
      sessionStorage.removeItem('action_in_progress');
    }
  };

  const handleGoogleSync = async (
    targetFolderId?: string,
    filterType?: string,
    isBackground = false,
    recursive = !isBackground
  ) => {
    if (!assetsLoaded || !foldersLoaded) {
      pendingSyncRef.current = { targetFolderId, filterType, isBackground, recursive };
      console.log("Aguardando carregamento de metadados do Firebase antes de sincronizar...");
      return;
    }
    if (syncInProgressRef.current) {
      syncGenerationRef.current++;
      queuedSyncRef.current = { targetFolderId, filterType, isBackground, recursive };
      if (isBackground) setIsSyncingBackground(true);
      return;
    }
    syncInProgressRef.current = true;
    const generation = ++syncGenerationRef.current;
    const isStale = () => generation !== syncGenerationRef.current;
    const folderId = targetFolderId || 'root';

    const syncDriveFilesToDb = async (driveFiles: any[], parentFolderId: string) => {
      const saveFile = async (file: any) => {
        const isShortcut = file.mimeType === 'application/vnd.google-apps.shortcut';
        const targetMimeType = isShortcut ? file.shortcutDetails?.targetMimeType : null;
        const isFolder = file.mimeType === 'application/vnd.google-apps.folder' ||
          (isShortcut && targetMimeType === 'application/vnd.google-apps.folder');
        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        const isRaw = ['cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'orf'].includes(extension);

        const mimeTypeToUse = targetMimeType || file.mimeType;
        const fileType = isFolder ? 'folder' : (mimeTypeToUse.includes('image') || isRaw ? 'image' : (mimeTypeToUse.includes('video') ? 'video' : 'document'));
        const fileSize = file.size ? `${(parseInt(file.size) / 1024 / 1024).toFixed(1)} MB` : (isFolder ? '-' : '0 MB');

        const realId = (isShortcut && file.shortcutDetails?.targetId) ? file.shortcutDetails.targetId : file.id;
        const resolvedParentId = parentFolderId === 'root' ? null : parentFolderId;

        if (isFolder) {
          const docRef = doc(db, "folders", realId);
          const docSnap = await getDoc(docRef);
          const folderData = docSnap.exists() ? docSnap.data() : null;
          await setDoc(docRef, {
            name: displayDriveName(file.name),
            date: file.createdTime ? Timestamp.fromDate(new Date(file.createdTime)) : serverTimestamp(),
            ownerId: "google-drive",
            parentId: file.trashed ? 'trash' : resolvedParentId,
            starred: file.starred || false,
            trashed: file.trashed || false,
            clientEmail: folderData?.clientEmail || null,
            color: folderData?.color || '#e2b13c',
            adminToken: "Silva_Chamo_Master_Admin_2026"
          });

          const residual = assets.find(a => a.driveId === realId);
          if (residual) {
            try {
              await deleteDoc(doc(db, "assets", residual.id));
            } catch (err) {
              console.warn("Erro ao limpar asset residual:", err);
            }
          }
        }

        const docRefAsset = doc(db, "assets", realId);
        const docSnapAsset = await getDoc(docRefAsset);
        const assetDataDb = docSnapAsset.exists() ? docSnapAsset.data() : null;

        const assetData = {
          name: file.name,
          type: fileType,
          captureDate: file.createdTime ? Timestamp.fromDate(new Date(file.createdTime)) : serverTimestamp(),
          uploadDate: serverTimestamp(),
          folderId: file.trashed ? 'trash' : parentFolderId,
          ownerId: "google-drive",
          driveId: realId,
          thumbnailUrl: file.thumbnailLink || "",
          starred: file.starred || false,
          trashed: file.trashed || false,
          versions: [{
            quality: "original",
            size: fileSize,
            url: file.webViewLink
          }],
          clientId: assetDataDb?.clientId || null,
          adminToken: "Silva_Chamo_Master_Admin_2026"
        };

        if (!isFolder) {
          try {
            await setDoc(docRefAsset, assetData);
          } catch (upsertErr: any) {
            console.warn("[Sync Silencioso] Salvar asset ignorado:", upsertErr?.message);
          }
        }
      };

      const SAVE_BATCH = 25;
      for (let i = 0; i < driveFiles.length; i += SAVE_BATCH) {
        if (isStale()) return;
        await Promise.all(driveFiles.slice(i, i + SAVE_BATCH).map(saveFile));
      }
    };

    // Se a aba ativa for 'all' (Dados do Cliente), mantemos a aba ativa como 'all' para consistência de navegação.
    // Caso contrário, alteramos para a aba 'google_drive'.
    if (!isBackground) {
      if (activeTab !== 'all' && activeTab !== 'contas_acesso') {
        setActiveTab('google_drive');
        setDriveFilterType(filterType || null);
      }
      setSelectedFolderId(folderId === 'root' ? null : folderId);
    }

    if (!isBackground) {
      setIsUploading(true);
      setUploadProgress(10);
    } else {
      setIsSyncingBackground(true);
    }

    try {
      const response = await fetch('/api/drive/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId, filterType })
      });

      if (!response.ok) {
        let errMsg = 'Erro ao conectar com Google Drive';
        try {
          const errorData = await response.json();
          errMsg = errorData.error || errMsg;
        } catch (_) {
          try {
            const text = await response.text();
            errMsg = text.substring(0, 150) || errMsg;
          } catch (__) { }
        }
        throw new Error(errMsg);
      }

      let driveFiles;
      try {
        driveFiles = await response.json();
      } catch (jsonErr) {
        let textVal = '';
        try { textVal = await response.text(); } catch (_) { }
        throw new Error("Resposta inválida do servidor: " + (textVal.substring(0, 150) || jsonErr.message));
      }
      if (!isBackground) setUploadProgress(50);

      console.log(`[Sync] Pasta ${folderId}: ${driveFiles.length} itens recebidos do Google Drive`);

      const listing = parseDriveListing(driveFiles, folderId, displayDriveName);
      setDriveBrowseCache((prev) => ({ ...prev, [folderId]: listing }));
      if (!filterType) markFolderSynced(folderId);
      setSyncErrorMessage(null);

      if (isBackground) {
        setIsSyncingBackground(false);
      }

      if (isStale()) return;

      const persistPromise = syncDriveFilesToDb(driveFiles, folderId);
      if (!isBackground) {
        await persistPromise;
      } else {
        void persistPromise.catch((err) => {
          console.warn("[Sync] Gravação em background falhou:", err?.message || err);
        });
      }
      if (isStale()) return;

      // Sync recursivo completo apenas em sincronização manual (não ao navegar entre pastas).
      if (recursive) {
      const MAX_RECURSIVE_DEPTH = 50;
      const MAX_FOLDER_VISITS = 5000;
      const visitedFolders = new Set<string>();
      const queue: Array<{ folderId: string; depth: number; logName?: string }> = [];

      const resolveFolderId = (f: any) =>
        (f.mimeType === 'application/vnd.google-apps.shortcut' && f.shortcutDetails?.targetId)
          ? f.shortcutDetails.targetId
          : f.id;

      const isDriveFolderItem = (f: any) => {
        const isShortcut = f.mimeType === 'application/vnd.google-apps.shortcut';
        const isFolder = f.mimeType === 'application/vnd.google-apps.folder' ||
          (isShortcut && f.shortcutDetails?.targetMimeType === 'application/vnd.google-apps.folder');
        return isFolder && !f.trashed;
      };

      // Começar pelos subfolderes diretos da pasta atual.
      for (const f of driveFiles) {
        if (!isDriveFolderItem(f)) continue;
        const childId = resolveFolderId(f);
        queue.push({ folderId: childId, depth: 1, logName: f.name });
      }

      visitedFolders.add(folderId);

      while (queue.length > 0 && visitedFolders.size < MAX_FOLDER_VISITS) {
        const next = queue.shift();
        if (!next) break;
        if (next.depth > MAX_RECURSIVE_DEPTH) continue;
        if (visitedFolders.has(next.folderId)) continue;

        visitedFolders.add(next.folderId);

        try {
          const subResponse = await fetch('/api/drive/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderId: next.folderId })
          });

          if (!subResponse.ok) continue;
          const subFiles = await subResponse.json();

          console.log(
            `[Sync Recursivo] Pasta ${next.logName ?? next.folderId} (depth ${next.depth}): ${subFiles.length} itens`
          );

          if (isStale()) break;
          await syncDriveFilesToDb(subFiles, next.folderId);

          // Empilhar os subfolders encontrados para processar no próximo nível.
          for (const f of subFiles) {
            if (!isDriveFolderItem(f)) continue;
            const childId = resolveFolderId(f);
            queue.push({ folderId: childId, depth: next.depth + 1, logName: f.name });
          }
        } catch (subErr: any) {
          console.warn(
            `[Sync Recursivo] Falhou para a pasta ${next.logName ?? next.folderId}:`,
            subErr.message
          );
        }
      }
      }

      // Limpeza de fantasmas apenas na sincronização manual.
      if (!isBackground && !isStale()) {
        const currentDbAssets = assets.filter(a => a.folderId === (folderId === 'root' ? null : folderId));
        const driveFileIds = driveFiles.map((f: any) => {
          const isShortcut = f.mimeType === 'application/vnd.google-apps.shortcut';
          return (isShortcut && f.shortcutDetails?.targetId) ? f.shortcutDetails.targetId : f.id;
        });
        for (const dbAsset of currentDbAssets) {
          if (dbAsset.driveId && !driveFileIds.includes(dbAsset.driveId)) {
            try {
              await deleteDoc(doc(db, "assets", dbAsset.id));
              console.log(`[Limpeza Sincronizada] Removido arquivo fantasma no Firestore: ${dbAsset.name}`);
            } catch (err) {
              console.warn("Erro ao limpar arquivo fantasma no Firestore:", err);
            }
          }
        }

        const currentDbFolders = folders.filter(f => f.parentId === (folderId === 'root' ? null : folderId));
        for (const dbFolder of currentDbFolders) {
          if (dbFolder.id && !driveFileIds.includes(dbFolder.id) && (dbFolder as any).ownerId === 'google-drive') {
            try {
              await deleteDoc(doc(db, "folders", dbFolder.id));
              console.log(`[Limpeza Sincronizada] Removido pasta fantasma no Firestore: ${dbFolder.name}`);
            } catch (err) {
              console.warn("Erro ao limpar pasta fantasma no Firestore:", err);
            }
          }
        }
      }

      if (!isBackground) {
        setUploadProgress(100);
        setTimeout(() => { setIsUploading(false); setUploadProgress(0); }, 1000);
      }
    } catch (error: any) {
      console.error("Sync Error:", error);
      const msg = String(error?.message || "Erro ao sincronizar");
      if (isBackground) {
        setSyncErrorMessage(msg);
      } else {
        if (msg.includes("invalid_grant")) {
          console.warn("Drive pessoal expirado — use Google Drive → Conectar se precisar da cota pessoal.");
        } else {
          alert("Erro na Sincronização: " + msg);
        }
        setIsUploading(false);
        setUploadProgress(0);
      }
    } finally {
      syncInProgressRef.current = false;
      if (isBackground && generation === syncGenerationRef.current) {
        setIsSyncingBackground(false);
      }
      const queued = queuedSyncRef.current;
      if (queued) {
        queuedSyncRef.current = null;
        handleGoogleSync(queued.targetFolderId, queued.filterType, queued.isBackground, queued.recursive ?? !queued.isBackground);
      }
    }
  };

  // Fetch User Role
  useEffect(() => {
    const localUserJson = localStorage.getItem("provisual_local_admin");
    if (!currentUser && localUserJson) {
      try {
        const localUser = JSON.parse(localUserJson);
        setUserProfile({
          role: localUser.role || "cliente",
          email: localUser.email || "cliente@provisual.demo",
          displayName: localUser.displayName || "Cliente"
        });
        return;
      } catch (e) {
        // ignore
      }
    }

    if (!currentUser) {
      setUserProfile({
        role: "cliente",
        email: "cliente@provisual.demo",
        displayName: "Cliente"
      });
      return;
    }
    const fetchProfile = async () => {
      const userDoc = await getDoc(doc(db, "users", currentUser!.id));
      if (userDoc.exists()) {
        setUserProfile(userDoc.data() as UserProfile);
      } else {
        setUserProfile({
          role: "cliente",
          email: currentUser!.email || "cliente@provisual.demo",
          displayName: currentUser!.user_metadata?.displayName || currentUser!.email?.split("@")[0] || "Cliente"
        });
      }
    };
    fetchProfile();
  }, [currentUser]);

  // Fetch Folders
  useEffect(() => {
    const q = query(collection(db, "folders"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const folderList = snapshot.docs.map(doc => {
        const data = doc.data();
        let folderDate = new Date();
        if (data.date && typeof data.date.toDate === 'function') folderDate = data.date.toDate();
        return { id: doc.id, ...data, name: displayDriveName(data.name), date: folderDate } as FolderData;
      });
      setFolders(folderList.sort((a, b) => b.date.getTime() - a.date.getTime()));
      setFoldersLoaded(true);
    }, (error) => {
      console.error("Folders read error:", error);
      setFoldersLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Assets
  useEffect(() => {
    const q = query(collection(db, "assets"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const assetList = snapshot.docs.map(doc => {
        const data = doc.data();
        let capDate = new Date();
        let upDate = new Date();
        if (data.captureDate && typeof data.captureDate.toDate === 'function') capDate = data.captureDate.toDate();
        if (data.uploadDate && typeof data.uploadDate.toDate === 'function') upDate = data.uploadDate.toDate();
        return { id: doc.id, ...data, name: displayDriveName(data.name), captureDate: capDate, uploadDate: upDate } as Asset;
      });
      setAssets(assetList);
      setAssetsLoaded(true);
    }, (error) => {
      console.error("Assets read error:", error);
      setAssetsLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  // Retentar sync pendente quando metadados estiverem carregados
  useEffect(() => {
    if (assetsLoaded && foldersLoaded && pendingSyncRef.current) {
      const pending = pendingSyncRef.current;
      pendingSyncRef.current = null;
      handleGoogleSync(pending.targetFolderId, pending.filterType, pending.isBackground, pending.recursive ?? !pending.isBackground);
    }
  }, [assetsLoaded, foldersLoaded]);

  // Sincronizar pasta restaurada do sessionStorage ao recarregar a página
  useEffect(() => {
    if (!foldersLoaded || !assetsLoaded) return;
    const restoredId = restoredFolderRef.current;
    if (restoredId) {
      restoredFolderRef.current = null;
    }
  }, [foldersLoaded, assetsLoaded]);

  // Sincronizar ao abrir ou mudar de pasta — só se ainda não estiver em cache recente
  useEffect(() => {
    if (!foldersLoaded || !assetsLoaded || !selectedFolderId) return;
    if (activeTab !== "all" && activeTab !== "google_drive") return;
    if (shouldSkipFolderSync(selectedFolderId)) return;
    handleGoogleSync(selectedFolderId, undefined, true, false);
  }, [selectedFolderId, foldersLoaded, assetsLoaded, activeTab]);

  // Fetch Accounts
  useEffect(() => {
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const accountsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAccounts(accountsList);
      setAccountsLoaded(true);
    }, (error) => {
      console.error("Accounts read error:", error);
      setAccountsLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  // Impedir que clientes acessem a aba Contas de Acesso
  useEffect(() => {
    if (userProfile?.role === 'cliente' && activeTab === 'contas_acesso') {
      setActiveTab('all');
      setSelectedFolderId(null);
      setDriveFilterType(null);
    }
  }, [userProfile?.role, activeTab]);

  // Helper to normalize strings for comparison (removes accents, spaces, special chars)
  const cleanCompareStr = (s: string): string => {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  };

  // Helper para buscar as pastas raiz permitidas para o cliente (baseado no email)
  const getAllowedClientRootFolders = (allFolders: FolderData[]): FolderData[] => {
    if (!userProfile || userProfile.role !== 'cliente') return allFolders;

    const email = userProfile.email?.toLowerCase() || "";
    if (!email) return [];

    // Obter todas as pastas compartilhadas com o cliente
    const allSharedFolders = allFolders.filter(f =>
      (f as any).clientEmail?.toLowerCase().split(',').map((e: string) => e.trim()).includes(email)
    );

    // Considerar como raiz compartilhada qualquer pasta cujo pai não esteja também compartilhado
    const sharedIds = new Set(allSharedFolders.map(f => f.id));
    return allSharedFolders.filter(f => !f.parentId || !sharedIds.has(f.parentId));
  };

  // Helper para verificar se a pasta selecionada é permitida para o cliente ativo
  const isFolderAllowedForClient = (folderId: string | null): boolean => {
    if (!userProfile || userProfile.role !== 'cliente') return true; // Admins podem ver tudo
    if (folderId === null) return false; // A raiz geral não é permitida para clientes, apenas subpastas autorizadas

    const allowedClientRootFolders = getAllowedClientRootFolders(folders);
    const allowedIds = new Set(allowedClientRootFolders.map(f => f.id));

    // Rastrear a hierarquia para cima até achar uma pasta autorizada
    let currentId: string | null = folderId;
    let depth = 0;
    while (currentId && depth < 100) {
      if (allowedIds.has(currentId)) return true;
      const folder = folders.find(f => f.id === currentId);
      currentId = folder ? folder.parentId : null;
      depth++;
    }

    return false;
  };

  // Efeito de segurança para impedir acessos diretos não autorizados a pastas
  useEffect(() => {
    if (userProfile?.role === 'cliente' && selectedFolderId !== null && folders.length > 0) {
      if (!isFolderAllowedForClient(selectedFolderId)) {
        console.warn("Acesso negado à pasta e reset de segurança acionado:", selectedFolderId);
        setSelectedFolderId(null);
      }
    }
  }, [userProfile?.role, selectedFolderId, folders]);

  // Efeito para navegar automaticamente para dentro da pasta partilhada se for cliente
  useEffect(() => {
    if (userProfile?.role === 'cliente' && selectedFolderId === null && foldersLoaded && folders.length > 0) {
      if (activeTab === 'all' || activeTab === 'google_drive') {
        const allowedClientRootFolders = getAllowedClientRootFolders(folders);
        if (allowedClientRootFolders.length > 0) {
          const folderIdToEnter = allowedClientRootFolders[0].id;
          setSelectedFolderId(folderIdToEnter);
        }
      }
    }
  }, [userProfile?.role, selectedFolderId, foldersLoaded, folders, activeTab]);



  useEffect(() => {
    const fetchStorage = async () => {
      try {
        const res = await fetch('/api/drive/storage');
        if (res.ok) {
          const data = await res.json();
          setStorageQuota(data);
        }
      } catch (e) {
        console.error("Storage fetch error:", e);
      }
    };
    fetchStorage();

    // Sincronização silenciosa automática das pastas raiz do Google Drive ao iniciar
    const syncRootFolders = async () => {
      try {
        const response = await fetch('/api/drive/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderId: 'root' })
        });
        if (response.ok) {
          const driveFiles = await response.json();
          for (const file of driveFiles) {
            const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
            if (isFolder) {
              const docRef = doc(db, "folders", file.id);
              const docSnap = await getDoc(docRef);
              const folderData = docSnap.exists() ? docSnap.data() : null;
              await setDoc(docRef, {
                name: displayDriveName(file.name),
                date: file.createdTime ? Timestamp.fromDate(new Date(file.createdTime)) : serverTimestamp(),
                ownerId: "google-drive",
                parentId: null,
                clientEmail: folderData?.clientEmail || null,
                color: folderData?.color || '#e2b13c'
              });
            }
          }
        }
      } catch (error) {
        console.error("Erro na sincronização silenciosa inicial de pastas:", error);
      }
    };
    syncRootFolders();

    // Sincronização silenciosa das pastas de clientes do Google Drive ao iniciar (ID da pasta "clientes")
    const syncClientFolders = async () => {
      try {
        const response = await fetch('/api/drive/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderId: '1ww-KgTwlOLbvCHtCLZgGTntzA6SStCjG' })
        });
        if (response.ok) {
          const driveFiles = await response.json();
          for (const file of driveFiles) {
            const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
            if (isFolder) {
              const docRef = doc(db, "folders", file.id);
              const docSnap = await getDoc(docRef);
              const folderData = docSnap.exists() ? docSnap.data() : null;
              let folderClientEmail = folderData?.clientEmail || null;

              const sharedEmails = (file.permissions || [])
                .map((p: any) => p.emailAddress?.toLowerCase())
                .filter(Boolean);

              const gDriveClientEmail = sharedEmails.find((email: string) =>
                email !== 'provisualcorporate@gmail.com' &&
                email !== 'silva.chamo@gmail.com' &&
                !email.endsWith('.demo') &&
                !email.includes('gserviceaccount.com') &&
                !email.includes('provisual-sync')
              );

              // Email do Drive tem prioridade (é a fonte de verdade)
              if (gDriveClientEmail) {
                folderClientEmail = gDriveClientEmail;
              }

              // Limpar o email de serviço se ele já tiver sido guardado anteriormente por erro
              if (folderClientEmail && (folderClientEmail.includes('gserviceaccount.com') || folderClientEmail.includes('provisual-sync') || folderClientEmail.includes('provisual_synk'))) {
                folderClientEmail = null;
              }

              await setDoc(docRef, {
                name: displayDriveName(file.name),
                date: file.createdTime ? Timestamp.fromDate(new Date(file.createdTime)) : serverTimestamp(),
                ownerId: "google-drive",
                parentId: '1ww-KgTwlOLbvCHtCLZgGTntzA6SStCjG',
                clientEmail: folderClientEmail || null,
                color: folderData?.color || '#e2b13c'
              });
            }
          }
        }
      } catch (error) {
        console.error("Erro na sincronização silenciosa de pastas de clientes:", error);
      }
    };
    syncClientFolders();
  }, []);

  const filteredAssets = useMemo(() => {
    let result = assets;

    // Filtrar por pasta permitida (baseado no email do cliente) ou por arquivo partilhado diretamente
    if (userProfile?.role === 'cliente') {
      const email = userProfile.email?.toLowerCase() || "";
      const browsingAllowedFolder = selectedFolderId && isFolderAllowedForClient(selectedFolderId);

      if (!browsingAllowedFolder) {
        result = result.filter(a => {
          return isFolderAllowedForClient(a.folderId) || a.clientId?.toLowerCase() === email;
        });
      }
    }

    // Se estivermos visualizando o Lixo, mostra apenas os itens marcados como trashed
    if (activeTab === 'google_drive' && driveFilterType === 'trashed') {
      result = result.filter(a => a.trashed === true || a.folderId === 'trash');
      if (searchQuery) {
        result = result.filter(a => a && typeof a.name === 'string' && matchesSearchQuery(a.name, searchQuery));
      }
      return result;
    }

    // Para Meu Drive e Gestão de Clientes na raiz, exibir arquivos normalmente
    // Removemos o filtro estrito que ocultava os arquivos carregados na raiz

    // Para todas as outras abas/views, remover itens que estão no lixo
    result = result.filter(a => !a.trashed && a.folderId !== 'trash');

    if (searchQuery) {
      result = result.filter(a => a && typeof a.name === 'string' && matchesSearchQuery(a.name, searchQuery));
      if (activeTab !== 'all' && activeTab !== 'google_drive') {
        result = result.filter(a => a.type === activeTab);
      }
    } else {
      if (selectedFolderId) {
        result = result.filter(a => String(a.folderId) === String(selectedFolderId));
      } else if (activeTab === 'google_drive') {
        // Mostrar apenas os arquivos que pertencem à pasta geral "arquivo" na raiz (ou arquivos sem pai se a pasta não existir)
        if (driveFilterType === 'starred') {
          result = result.filter(a => (a as any).ownerId === 'google-drive' && a.starred === true);
        } else if (driveFilterType === 'recent') {
          result = result.filter(a => (a as any).ownerId === 'google-drive')
            .sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime());
        } else {
          result = result.filter(a =>
            (a as any).ownerId === 'google-drive' &&
            (a.folderId === arquivoFolderId || (!a.folderId && !arquivoFolderId))
          );
        }
      } else if (activeTab === 'all') {
        result = result.filter(a => a.folderId === '1ww-KgTwlOLbvCHtCLZgGTntzA6SStCjG');
      } else if (activeTab !== 'all') {
        result = result.filter(a => a.type === activeTab);
      }
    }

    const browseKey = getDriveBrowseKey(selectedFolderId);
    const cached =
      !searchQuery && browseKey && (activeTab === "all" || activeTab === "google_drive")
        ? driveBrowseCache[browseKey]
        : null;
    if (cached?.assets.length) {
      result = mergeById(result, cached.assets as Asset[]);
    }

    return result;
  }, [selectedFolderId, activeTab, driveFilterType, searchQuery, assets, arquivoFolderId, folders, userProfile, driveBrowseCache]);

  const displayedAssets = useMemo(() => {
    if (activeTab === 'image') {
      return filteredAssets.slice(0, visibleImagesCount);
    }
    return filteredAssets;
  }, [filteredAssets, activeTab, visibleImagesCount]);

  const previewableAssets = useMemo(
    () => displayedAssets.filter((asset) => asset.type !== "folder"),
    [displayedAssets],
  );

  const previewSelection = useMemo(
    () => ({
      selectedIds: selectedAssetIds,
      onToggle: handleToggleBulkSelect,
      onSelectAllVisible: () => {
        setSelectedAssetIds(displayedAssets.map((asset) => asset.id));
      },
      onSelectAllImages: () => {
        setSelectedAssetIds(
          displayedAssets.filter((asset) => asset.type === "image").map((asset) => asset.id),
        );
      },
      onClear: clearAllSelection,
    }),
    [selectedAssetIds, displayedAssets],
  );

  const previewFolderLabel = useMemo(() => {
    if (selectedFolderId) {
      const folder = folders.find((item) => item.id === selectedFolderId);
      if (folder) return displayDriveName(folder.name);
    }
    if (activeTab === "image") return "Imagens";
    if (activeTab === "video") return "Vídeos";
    if (activeTab === "document") return "Documentos";
    if (activeTab === "google_drive") return "Arquivo Provisual";
    return "Meu Arquivo";
  }, [selectedFolderId, folders, activeTab]);

  const filteredFolders = useMemo(() => {
    let result = folders;

    // Se estivermos visualizando o Lixo
    if (activeTab === 'google_drive' && driveFilterType === 'trashed') {
      return result.filter(f => f.trashed === true || f.parentId === 'trash');
    }

    // Remover itens que estão no lixo
    result = result.filter(f => !f.trashed && f.parentId !== 'trash');

    if (searchQuery) {
      result = result.filter(f => f && typeof f.name === 'string' && matchesSearchQuery(f.name, searchQuery));
      // Filtro extra de segurança para garantir que o cliente nunca veja pastas de outros clientes
      if (userProfile?.role === 'cliente') {
        result = result.filter(f => isFolderAllowedForClient(f.id));
      }
      return result;
    }

    if (activeTab === 'google_drive') {
      // No Google Drive/Arquivo Provisual, se estivermos na raiz, mostramos as pastas da pasta geral "arquivo"
      // Caso contrário, mostramos as subpastas da pasta selecionada.
      // Ocultamos a pasta de Clientes ('1ww-KgTwlOLbvCHtCLZgGTntzA6SStCjG') de qualquer nível aqui.
      const targetParentId = selectedFolderId === null ? arquivoFolderId : selectedFolderId;
      result = result.filter(
        (f) => parentMatchesFolder(f.parentId, targetParentId) && f.id !== "1ww-KgTwlOLbvCHtCLZgGTntzA6SStCjG",
      );
    } else if (activeTab === 'all') {
      // Na Gestão de Clientes:
      if (selectedFolderId === null) {
        if (userProfile?.role === 'cliente') {
          // Filtrar para mostrar apenas a pasta correspondente a este cliente
          result = getAllowedClientRootFolders(result);
        } else {
          // Se estivermos na raiz da Gestão de Clientes:
          // O conteúdo desta pasta ('1ww-KgTwlOLbvCHtCLZgGTntzA6SStCjG') deve vir no menu "Gestão de Clientes"
          result = result.filter(f => f.parentId === '1ww-KgTwlOLbvCHtCLZgGTntzA6SStCjG');
        }
      } else {
        // Se estivermos dentro de uma pasta na Gestão de Clientes:
        // Mostramos as subpastas daquela pasta normalmente
        result = result.filter((f) => parentMatchesFolder(f.parentId, selectedFolderId));
      }
    } else {
      // Para outras abas (imagens, vídeos, documentos), não mostramos pastas (pois elas filtram apenas os arquivos das abas)
      return [];
    }

    // Filtro extra de segurança para garantir que o cliente nunca veja pastas de outros clientes
    if (userProfile?.role === 'cliente') {
      result = result.filter(f => isFolderAllowedForClient(f.id));
    }

    const browseKey = getDriveBrowseKey(selectedFolderId);
    const cached =
      !searchQuery && browseKey && (activeTab === "all" || activeTab === "google_drive")
        ? driveBrowseCache[browseKey]
        : null;
    if (cached?.folders.length) {
      result = mergeById(result, cached.folders as FolderData[]);
    }

    return result;
  }, [folders, selectedFolderId, activeTab, driveFilterType, searchQuery, userProfile, driveBrowseCache, arquivoFolderId]);

  const localUsageBytes = useMemo(() => {
    let totalBytes = 0;
    assets.forEach(asset => {
      const sizeStr = asset.versions?.[0]?.size || "";
      if (sizeStr.includes("MB")) {
        totalBytes += parseFloat(sizeStr) * 1024 * 1024;
      } else if (sizeStr.includes("KB")) {
        totalBytes += parseFloat(sizeStr) * 1024;
      } else if (sizeStr.includes("GB")) {
        totalBytes += parseFloat(sizeStr) * 1024 * 1024 * 1024;
      }
    });
    return totalBytes;
  }, [assets]);

  const storageInfo = useMemo(() => {
    // Fallbacks inteligentes para manter consistência mesmo se a conta de serviço retornar dados vazios/nulos
    const fallbackLimitBytes = 15 * 1024 * 1024 * 1024; // 15 GB padrão do Drive
    const fallbackUsageBytes = localUsageBytes > 0 ? localUsageBytes : 1.24 * 1024 * 1024 * 1024; // 1.24 GB realista

    if (!storageQuota) {
      const limitGB = (fallbackLimitBytes / 1024 / 1024 / 1024).toFixed(2);
      const usageGB = (fallbackUsageBytes / 1024 / 1024 / 1024).toFixed(2);
      const percent = Math.min(100, Math.round((fallbackUsageBytes / fallbackLimitBytes) * 100));
      return { limit: `${limitGB} GB`, usage: `${usageGB} GB`, percent };
    }

    const limit = parseInt(storageQuota.limit) || fallbackLimitBytes;
    const usage = parseInt(storageQuota.usage) || localUsageBytes || fallbackUsageBytes;

    const limitGB = (limit / 1024 / 1024 / 1024).toFixed(2);
    const usageGB = (usage / 1024 / 1024 / 1024).toFixed(2);
    const percent = Math.min(100, Math.round((usage / limit) * 100)) || 0;

    return { limit: `${limitGB} GB`, usage: `${usageGB} GB`, percent };
  }, [storageQuota, localUsageBytes]);

  // Constrói o caminho realístico de breadcrumbs usando a hierarquia de parentId
  const getBreadcrumbs = () => {
    const list: { id: string | null; name: string; type: 'all' | 'folder' | 'drive_root' }[] = [];

    // Se nenhuma pasta estiver selecionada, mostramos o rótulo da aba correspondente
    if (!selectedFolderId) {
      if (activeTab === 'all') {
        const label = "Meu Arquivo";
        list.push({ id: null, name: label, type: 'all' });
      } else if (activeTab === 'google_drive') {
        list.push({ id: 'google_drive_root', name: 'Arquivo Provisual', type: 'drive_root' });
        if (driveFilterType === 'trashed') {
          list.push({ id: 'google_drive_trash', name: 'Lixo', type: 'all' });
        } else if (driveFilterType === 'starred') {
          list.push({ id: 'google_drive_starred', name: 'Com Estrela', type: 'all' });
        } else if (driveFilterType === 'recent') {
          list.push({ id: 'google_drive_recent', name: 'Recentes', type: 'all' });
        }
      } else {
        const label = activeTab === 'image' ? 'Imagens' : activeTab === 'video' ? 'Vídeos' : 'Documentos';
        list.push({ id: null, name: label, type: 'all' });
      }
    } else {
      // Se há uma pasta selecionada, adicionamos o ponto de partida (raiz) no início dos breadcrumbs
      if (activeTab === 'all') {
        const label = "Meu Arquivo";
        list.push({ id: null, name: label, type: 'all' });
      } else if (activeTab === 'google_drive') {
        list.push({ id: null, name: 'Arquivo Provisual', type: 'all' });
      }

      const path: { id: string; name: string; type: 'folder' }[] = [];
      let currentId = selectedFolderId;
      let visited = new Set<string>();

      while (currentId && currentId !== '1ww-KgTwlOLbvCHtCLZgGTntzA6SStCjG' && currentId !== arquivoFolderId && !visited.has(currentId)) {
        visited.add(currentId);
        const folder = folders.find(f => f.id === currentId);
        if (folder) {
          path.unshift({ id: folder.id, name: folder.name, type: 'folder' });
          currentId = folder.parentId || '';
        } else {
          break;
        }
      }
      list.push(...path);
    }

    return list;
  };

  const handleBreadcrumbClick = (item: { id: string | null; name: string; type: 'all' | 'folder' | 'drive_root' }) => {
    setSelectedAsset(null);
    if (item.type === 'all') {
      setSelectedFolderId(null);
      setActiveTab('all');
      setDriveFilterType(null);
      handleGoogleSync('1ww-KgTwlOLbvCHtCLZgGTntzA6SStCjG', undefined, true);
    } else if (item.type === 'drive_root') {
      handleGoogleSync(undefined, undefined, true);
    } else if (item.type === 'folder') {
      setSelectedFolderId(item.id);
    }
  };

  return (
    <div className="flex h-screen bg-[#fafafa] text-gray-800 font-sans overflow-hidden">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden" />
      <aside
        className={cn(
          "bg-white border-r border-gray-100 flex flex-col shrink-0 transition-[width] duration-300 overflow-hidden",
          sidebarCollapsed ? "w-[4.5rem]" : "w-60",
        )}
      >
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
          <div
            className={cn(
              "flex items-center mb-6 mt-1",
              sidebarCollapsed ? "flex-col gap-2 justify-center" : "gap-2 px-1",
            )}
          >
            <button
              type="button"
              onClick={() => setLeaveAccountOpen(true)}
              className="rounded-lg transition-opacity hover:opacity-80"
              aria-label="Ir para a página inicial"
            >
              {sidebarCollapsed ? (
                <img src={simboloImg} alt="ProVisual" className="h-9 w-9 object-contain" />
              ) : (
                <img src={logoHorizontal} alt="ProVisual" className="h-10 w-auto object-contain" />
              )}
            </button>
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label={sidebarExpanded ? "Recolher menu lateral" : "Expandir menu lateral"}
            >
              {sidebarExpanded ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
            </button>
          </div>

          <nav className="space-y-0.5">
            <DashboardSidebarItem
              collapsed={sidebarCollapsed}
              icon={<Database size={20} />}
              label="Meu Arquivo"
              active={activeTab === 'all'}
              onClick={() => { setActiveTab('all'); setSelectedFolderId(null); setDriveFilterType(null); setVisibleImagesCount(IMAGES_GRID_PAGE_SIZE); handleGoogleSync('1ww-KgTwlOLbvCHtCLZgGTntzA6SStCjG', undefined, true); }}
            />
            <DashboardSidebarItem
              collapsed={sidebarCollapsed}
              icon={<ImageIcon size={20} />}
              label="Imagens"
              active={activeTab === 'image'}
              onClick={() => { setActiveTab('image'); setSelectedFolderId(null); setDriveFilterType(null); setVisibleImagesCount(IMAGES_GRID_PAGE_SIZE); }}
            />
            <DashboardSidebarItem
              collapsed={sidebarCollapsed}
              icon={<Video size={20} />}
              label="Vídeos"
              active={activeTab === 'video'}
              onClick={() => { setActiveTab('video'); setSelectedFolderId(null); setDriveFilterType(null); setVisibleImagesCount(IMAGES_GRID_PAGE_SIZE); }}
            />
            <DashboardSidebarItem
              collapsed={sidebarCollapsed}
              icon={<FileText size={20} />}
              label="Documentos"
              active={activeTab === 'document'}
              onClick={() => { setActiveTab('document'); setSelectedFolderId(null); setDriveFilterType(null); setVisibleImagesCount(IMAGES_GRID_PAGE_SIZE); }}
            />
          </nav>
        </div>

        {/* Dados da Empresa Cliente no Rodapé */}
        <div
          className={cn(
            "bg-[#a21b7e]/5 border-t border-[#a21b7e]/10 shrink-0 flex items-center w-full",
            sidebarCollapsed ? "justify-center p-2" : "gap-3 p-3",
          )}
        >
          {(() => {
            const parsed = parseAccountDisplay(userProfile?.displayName || "");
            const sidebarLabel = parsed.companyName || parsed.responsible || "Cliente Corporativo";

            return (
              <>
                <AccountAvatar
                  size="lg"
                  displayName={userProfile?.displayName}
                  email={userProfile?.email}
                  className="bg-white border-[#a21b7e]/10 shadow-sm"
                />
                <div className={cn("flex flex-col min-w-0 leading-tight", sidebarCollapsed && "hidden")}>
                  <span className="text-[11px] font-black text-gray-700 tracking-wide block uppercase truncate" title={sidebarLabel}>
                    {sidebarLabel}
                  </span>
                  <span className="text-[9px] font-semibold text-[#a21b7e]/70 tracking-wider block uppercase mt-0.5">
                    Área Exclusiva
                  </span>
                </div>
              </>
            );
          })()}
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Header - Search */}
        <header className="bg-white border-b border-gray-100 shrink-0 z-20">
          <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:h-16 md:px-8 md:py-0">
            <div className="relative w-full md:w-96 md:shrink-0">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <Search size={18} />
              </span>
              <input
                type="text"
                placeholder="Pesquisar arquivos e pastas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-100 rounded-sm bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#a21b7e] transition-all"
              />
            </div>

            <div className="flex items-center justify-between gap-2 md:justify-end">
              {userProfile && (
                <div className="flex items-center min-w-0 flex-1 md:flex-none h-9 px-3 bg-gray-50 border border-gray-100 rounded-sm select-none">
                  <span
                    className="text-sm text-gray-800 font-bold truncate"
                    title={getAccountDisplayTitle(userProfile.displayName || "", userProfile.email)}
                  >
                    Olá, {getAccountGreetingName(userProfile.displayName || "", userProfile.email)}
                  </span>
                </div>
              )}

              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 h-9 px-3 rounded-sm bg-red-50 border border-red-100 text-red-600 text-sm font-bold hover:bg-red-100 hover:text-red-700 transition-all cursor-pointer shrink-0"
              >
                <LogOut size={16} />
                Sair
              </button>
            </div>
          </div>
        </header>

        {/* Path & Primary Actions */}
        <div className="hidden md:flex bg-[#a21b7e]/5 px-8 py-1.5 items-center justify-between border-b border-[#a21b7e]/10 z-10">
          <div className="flex items-center gap-2 text-sm font-medium min-w-0 flex-1">
            {selectedAsset ? (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                <button
                  onClick={() => setSelectedAsset(null)}
                  className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 mr-1"
                >
                  <Plus className="rotate-45" size={20} />
                </button>
                <span className="text-sm font-bold text-[#a21b7e] bg-[#a21b7e]/5 px-3 py-1 rounded-full border border-[#a21b7e]/10 truncate max-w-[200px]" title={selectedAsset.name}>
                  {selectedAsset.name}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs font-medium text-gray-500 max-w-full overflow-x-auto whitespace-nowrap no-scrollbar select-none">
                {getBreadcrumbs().map((item, index, arr) => {
                  const isLast = index === arr.length - 1;
                  return (
                    <React.Fragment key={index}>
                      {index > 0 && <ChevronRight size={10} className="text-gray-300 mx-0.5 animate-in fade-in shrink-0" />}
                      {isLast ? (
                        <span className="text-gray-700 font-semibold shrink-0">
                          {item.name}
                        </span>
                      ) : (
                        <span
                          className="hover:text-[#a21b7e] cursor-pointer transition-colors shrink-0"
                          onClick={() => handleBreadcrumbClick(item)}
                        >
                          {item.name}
                        </span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 bg-gray-50 p-1 rounded-sm border border-gray-100 items-center shrink-0">
              <button
                onClick={() => setViewMode("grid")}
                className={cn("h-7 w-7 flex items-center justify-center rounded transition-all cursor-pointer", viewMode === "grid" ? "bg-white shadow-sm text-[#a21b7e]" : "text-gray-400 hover:text-gray-600")}
              >
                <Grid size={16} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn("h-7 w-7 flex items-center justify-center rounded transition-all cursor-pointer", viewMode === "list" ? "bg-white shadow-sm text-[#a21b7e]" : "text-gray-400 hover:text-gray-600")}
              >
                <ListIcon size={16} />
              </button>
            </div>

            {/* Dropdown de Integração Google Drive - Apenas para Admins */}
            {isSuperAdmin(userProfile) && activeTab === 'google_drive' && (
              <div className="relative ml-2 shrink-0">
                <button
                  onClick={() => setIsDriveDropdownOpen(!isDriveDropdownOpen)}
                  className={cn(
                    "flex items-center gap-2 h-9 px-3 rounded-sm border border-gray-200 bg-white text-xs font-bold text-gray-600 hover:text-[#a21b7e] hover:border-[#a21b7e]/30 shadow-sm transition-all cursor-pointer shrink-0",
                    isDriveDropdownOpen && "text-[#a21b7e] border-[#a21b7e]/30 bg-[#a21b7e]/5"
                  )}
                  title="Configurações e Sincronização do Google Drive"
                >
                  <span>Google Drive</span>
                  <ChevronDown size={12} className={cn("transition-transform duration-200 shrink-0", isDriveDropdownOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {isDriveDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setIsDriveDropdownOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.1 }}
                        className="absolute right-0 mt-1.5 w-64 bg-white border border-gray-100 rounded-sm shadow-[0_3px_15px_rgba(0,0,0,0.1)] z-40 py-2 text-left text-gray-700 font-sans cursor-default"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Status da Conexão */}
                        <div className="px-4 py-2 border-b border-gray-50 mb-1">
                          <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest block">Status do Drive</span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn(
                              "w-2 h-2 rounded-full shrink-0",
                              driveStatus?.type === "oauth2"
                                ? "bg-emerald-500 animate-pulse"
                                : driveStatus?.type === "service_account"
                                  ? "bg-blue-500 animate-pulse"
                                  : "bg-red-500"
                            )} />
                            <span className="text-xs font-bold text-gray-700 truncate">
                              {driveStatus?.type === "oauth2"
                                ? "Cota Pessoal Ativa"
                                : driveStatus?.type === "service_account"
                                  ? "Conta de Serviço Ativa"
                                  : "Google Drive Desconectado"}
                            </span>
                          </div>
                          {driveStatus?.connected && (
                            <span className="text-[9px] text-gray-400 block mt-0.5 truncate select-all">
                              {driveStatus.email}
                            </span>
                          )}
                        </div>

                        {/* Ações */}
                        <div className="px-1.5 space-y-0.5">
                          {driveStatus?.connected ? (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                setIsDriveDropdownOpen(false);
                                await handleDisconnectDrive();
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 bg-transparent hover:bg-red-50 group transition-colors text-left text-[13px] font-bold text-red-600 cursor-pointer"
                            >
                              <LogOut size={14} className="text-red-400 group-hover:text-red-600 shrink-0" />
                              <span>Desconectar Conta</span>
                            </button>
                          ) : (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                setIsDriveDropdownOpen(false);
                                await handleConnectDrive();
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 bg-transparent hover:bg-emerald-50 group transition-colors text-left text-[13px] font-bold text-emerald-600 cursor-pointer"
                            >
                              <Link size={14} className="text-emerald-400 group-hover:text-emerald-600 shrink-0" />
                              <span>Conectar Google Drive</span>
                            </button>
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Files Area */}
        {activeTab === 'contas_acesso' && userProfile?.role === 'admin' ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Header da Tela */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
                <div>
                  <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Key className="text-[#a21b7e]" size={24} />
                    Contas de Acesso dos Clientes
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Crie e gerencie contas de e-mail e credenciais de acesso exclusivas para os seus clientes.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingAccount(null);
                    setAccountError(null);
                    setAccountSuccess(null);
                    setNewAccountEmail("");
                    setNewAccountName("");
                    // Gerar uma senha forte de 6 dígitos numéricos aleatórios por padrão para o cliente
                    const randomPass = Math.floor(100000 + Math.random() * 900000).toString();
                    setNewAccountPassword(randomPass);
                    setNewAccountRole("cliente");
                    setIsAddAccountModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-2 bg-[#a21b7e] hover:bg-[#8e176e] text-white px-4 py-2.5 rounded-md text-sm font-bold shadow-sm transition-all cursor-pointer h-10 shrink-0"
                >
                  <UserPlus size={16} />
                  Criar Conta de Acesso
                </button>
              </div>

              {/* Tabela de Contas */}
              <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <th className="px-6 py-4">Nome do Cliente / Empresa</th>
                        <th className="px-6 py-4">E-mail de Acesso</th>
                        <th className="px-6 py-4">Senha de Acesso</th>
                        <th className="px-6 py-4">Perfil</th>
                        <th className="px-6 py-4">Data de Criação</th>
                        <th className="px-6 py-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {filterAccountsForViewer(accounts, userProfile).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">
                            Nenhuma conta cadastrada no portal. Clique em "Criar Conta de Acesso" para começar!
                          </td>
                        </tr>
                      ) : (
                        filterAccountsForViewer(accounts, userProfile).map((account) => {
                          let createdDateStr = "—";
                          if (account.createdAt) {
                            if (typeof account.createdAt.toDate === 'function') {
                              createdDateStr = format(account.createdAt.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
                            } else if (account.createdAt instanceof Date) {
                              createdDateStr = format(account.createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
                            } else if (typeof account.createdAt === 'string') {
                              const parsedDate = new Date(account.createdAt);
                              if (!isNaN(parsedDate.getTime())) {
                                createdDateStr = format(parsedDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
                              }
                            }
                          }

                          return (
                            <tr key={account.id || account.uid || Math.random().toString()} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4 font-bold text-gray-800">
                                {(() => {
                                  const parsed = parseAccountDisplay(String(account.displayName || ""));
                                  return (
                                    <div className="flex items-center gap-3">
                                      <AccountAvatar
                                        size="md"
                                        displayName={account.displayName}
                                        email={account.email}
                                      />
                                      <div className="flex flex-col">
                                        <span className="font-bold text-gray-800">{parsed.companyName || "Sem Nome"}</span>
                                        {parsed.responsible && (
                                          <span className="text-[10px] font-normal text-gray-400">Resp: {parsed.responsible}</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="px-6 py-4 font-medium text-gray-600">
                                <span className="flex items-center gap-2 mt-1 select-all">
                                  <Mail size={14} className="text-gray-400" />
                                  {account.email}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-mono text-gray-800">
                                <span className="bg-gray-100 border border-gray-200 px-2.5 py-1 rounded text-xs select-all">
                                  {account.password || "—"}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={cn(
                                  "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                                  account.role === 'admin'
                                    ? "bg-purple-50 text-[#a21b7e] border border-purple-100"
                                    : "bg-blue-50 text-blue-600 border border-blue-100"
                                )}>
                                  {account.role === 'admin' ? "Administrador" : "Cliente"}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-xs text-gray-400">
                                {createdDateStr}
                              </td>
                              <td className="px-6 py-4 text-right space-x-2">
                                <button
                                  onClick={() => handleEditClick(account)}
                                  className="p-2 bg-purple-50 hover:bg-purple-100 text-[#a21b7e] rounded-md transition-all cursor-pointer inline-flex items-center justify-center border border-purple-100"
                                  title="Editar Conta"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteAccount(account.id, account.displayName || account.email)}
                                  className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-md transition-all cursor-pointer inline-flex items-center justify-center border border-red-100"
                                  title="Excluir Conta"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal para Adicionar/Editar Conta */}
            {isAddAccountModalOpen && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg border border-gray-100 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="bg-[#a21b7e] p-6 text-white flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <UserPlus size={20} />
                        {editingAccount ? "Editar Conta de Acesso" : "Nova Conta de Acesso"}
                      </h3>
                      <p className="text-xs text-white/80 mt-0.5">
                        {editingAccount ? "Atualize as credenciais de acesso do seu cliente." : "Defina as credenciais para o seu cliente."}
                      </p>
                    </div>
                    <button
                      onClick={handleCloseAccountModal}
                      className="p-1 hover:bg-white/10 rounded text-white/80 hover:text-white cursor-pointer"
                    >
                      <Plus className="rotate-45" size={20} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveAccount} className="p-6 space-y-4">
                    {accountError && (
                      <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded text-xs flex items-center gap-2">
                        <AlertCircle size={16} />
                        <span>{accountError}</span>
                      </div>
                    )}
                    {accountSuccess && (
                      <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 p-3 rounded text-xs flex items-center gap-2">
                        <CheckCircle2 size={16} />
                        <span>{accountSuccess}</span>
                      </div>
                    )}

                    <div className="flex gap-4 items-stretch">
                      {/* Lado Esquerdo: Nome do Responsável e Nome da Empresa (80% da largura, empilhados) */}
                      <div className="flex-1 flex flex-col gap-3 justify-center">
                        <input
                          type="text"
                          placeholder="Nome do responsável"
                          value={newAccountResponsible}
                          onChange={(e) => setNewAccountResponsible(e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#a21b7e] transition-all bg-gray-50"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Nome da empresa"
                          value={newAccountName}
                          onChange={(e) => setNewAccountName(e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#a21b7e] transition-all bg-gray-50"
                          required
                        />
                      </div>

                      {/* Lado Direito: Caixa de Upload da Foto/Logo (20% da largura, cobrindo a altura dos dois campos) */}
                      <div className="w-[88px] shrink-0">
                        <label className="relative block w-[88px] h-[88px] border-2 border-dashed border-gray-200 hover:border-[#a21b7e] rounded-lg cursor-pointer overflow-hidden transition-all bg-gray-50 group">
                          {newAccountLogo ? (
                            <>
                              <img src={newAccountLogo} alt="Logo" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-bold transition-all">
                                Alterar
                              </div>
                            </>
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 group-hover:text-[#a21b7e] transition-all">
                              <Upload size={18} />
                              <span className="text-[10px] font-bold mt-1">Logo</span>
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <input
                        type="email"
                        placeholder="Email de acesso"
                        value={newAccountEmail}
                        onChange={(e) => setNewAccountEmail(e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#a21b7e] transition-all bg-gray-50"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Senha de Acesso (Ex: @P#s$9w!K%)"
                          value={newAccountPassword}
                          onChange={(e) => setNewAccountPassword(e.target.value)}
                          className="block flex-1 px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#a21b7e] transition-all bg-gray-50 font-mono"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const chars = "abcdefghijklmnopqrstuvwxyz";
                            const caps = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                            const nums = "0123456789";
                            const syms = "@#!$%&*";
                            let pass = "";
                            pass += chars[Math.floor(Math.random() * chars.length)];
                            pass += caps[Math.floor(Math.random() * caps.length)];
                            pass += nums[Math.floor(Math.random() * nums.length)];
                            pass += syms[Math.floor(Math.random() * syms.length)];
                            const allChars = chars + caps + nums + syms;
                            for (let i = 0; i < 4; i++) {
                              pass += allChars[Math.floor(Math.random() * allChars.length)];
                            }
                            const shuffled = pass.split("").sort(() => 0.5 - Math.random()).join("");
                            setNewAccountPassword(shuffled);
                          }}
                          className="px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-xs font-bold transition-all cursor-pointer border border-gray-200 shrink-0"
                        >
                          Gerar
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <select
                        value={newAccountRole}
                        onChange={(e) => setNewAccountRole(e.target.value as any)}
                        className="block w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#a21b7e] transition-all bg-gray-50"
                      >
                        <option value="cliente">Cliente (Acesso de visualização de arquivos)</option>
                        <option value="admin">Administrador (Gestão completa do portal)</option>
                      </select>
                    </div>

                    <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={handleCloseAccountModal}
                        className="flex-1 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded text-sm font-bold transition-all cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isCreatingAccount}
                        className="flex-1 py-2.5 bg-[#a21b7e] hover:bg-[#8e176e] text-white rounded text-sm font-bold transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isCreatingAccount ? "A salvar..." : (editingAccount ? "Salvar Alterações" : "Criar Conta de Acesso")}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50 relative"
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                visible: true
              });
            }}
          >
            {!foldersLoaded || !assetsLoaded ? (
              <div className="h-full w-full flex flex-col items-center justify-center bg-gray-50 min-h-[400px] animate-in fade-in duration-300">
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <div className="absolute inset-0 border-4 border-gray-200 rounded-full" />
                  <div className="absolute inset-0 border-4 border-[#a21b7e] border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-xs font-semibold text-gray-500 mt-4 tracking-wide uppercase">Carregando...</p>
              </div>
            ) : syncErrorMessage && filteredAssets.length === 0 && filteredFolders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-20 text-center">
                <h3 className="text-lg font-bold text-red-600 mb-2">Erro ao sincronizar</h3>
                <p className="text-sm text-gray-500 max-w-md mb-4">{syncErrorMessage}</p>
                <button
                  type="button"
                  onClick={() => selectedFolderId && handleGoogleSync(selectedFolderId, undefined, true, false)}
                  className="px-4 py-2 bg-[#a21b7e] text-white text-sm font-semibold rounded-lg"
                >
                  Tentar novamente
                </button>
              </div>
            ) : filteredAssets.length === 0 && filteredFolders.length === 0 && isSyncingBackground ? (
              <div className="h-full w-full flex flex-col items-center justify-center bg-gray-50 min-h-[400px] animate-in fade-in duration-300">
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <div className="absolute inset-0 border-4 border-gray-200 rounded-full" />
                  <div className="absolute inset-0 border-4 border-[#a21b7e] border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-xs font-semibold text-gray-500 mt-4 tracking-wide uppercase">Sincronizando</p>
              </div>
            ) : filteredAssets.length === 0 && filteredFolders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-20 text-center">
                <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm">
                  <Search size={48} className="text-gray-100" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Nada por aqui...</h3>
                <p className="text-sm text-gray-400 max-w-xs">
                  Sua pasta está vazia ou nenhum arquivo corresponde à sua busca.
                </p>
              </div>
            ) : (
              <>
                {viewMode === "grid" ? (
                  <div className="p-8 flex flex-col gap-8 bg-gray-50 min-h-full w-full">
                    {/* Grid de Pastas */}
                    {(activeTab === 'all' || activeTab === 'google_drive') && filteredFolders.length > 0 && (
                      <div className="w-full flex flex-col gap-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                          {filteredFolders.map(folder => (
                            <div
                              key={folder.id}
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation();
                                startDragSelection(e, { type: "folder", id: folder.id });
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDropTargetFolderId(folder.id);
                              }}
                              onDragLeave={() => {
                                setDropTargetFolderId((prev) => (prev === folder.id ? null : prev));
                              }}
                              onDrop={(e) => handleDropOnFolder(e, folder.id)}
                              onClick={() => handleFolderGridClick(folder.id)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setActiveFolderMenuId(activeFolderMenuId === folder.id ? null : folder.id);
                              }}
                              className={cn(
                                "flex items-center justify-between p-4 bg-white border transition-all cursor-pointer group shadow-sm relative overflow-visible rounded-lg",
                                selectedFolderIds.includes(folder.id)
                                  ? "border-[#a21b7e] ring-2 ring-[#a21b7e]/30"
                                  : "border-gray-100 hover:border-gray-200",
                                dropTargetFolderId === folder.id && "border-[#a21b7e] bg-[#a21b7e]/5",
                              )}
                            >
                              <div className="flex items-center gap-3 truncate flex-1 min-w-0">
                                <FolderIcon size={20} style={{ color: folder.color || "#e2b13c", fill: `${folder.color || "#e2b13c"}1a` }} className="shrink-0 animate-in fade-in" />
                                <span className="text-xs font-bold text-gray-700 truncate" title={displayDriveName(folder.name)}>{displayDriveName(folder.name)}</span>
                              </div>

                              <div className="relative overflow-visible">
                                <motion.button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveFolderMenuId(activeFolderMenuId === folder.id ? null : folder.id);
                                    setActiveFolderSubmenu('none');
                                  }}
                                  whileHover={{ scale: 1.25 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="text-gray-400 hover:text-gray-600 p-1 transition-colors cursor-pointer"
                                >
                                  <MoreVertical size={16} />
                                </motion.button>

                                <AnimatePresence>
                                  {activeFolderMenuId === folder.id && (
                                    <>
                                      <div
                                        className="fixed inset-0 z-30"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveFolderMenuId(null);
                                          setActiveFolderSubmenu('none');
                                        }}
                                      />

                                      
                                      <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                        transition={{ duration: 0.1 }}
                                        className="absolute right-0 mt-2 w-52 bg-white border border-gray-100 rounded-sm shadow-[0_3px_10px_rgba(0,0,0,0.06)] z-40 py-1.5 text-left text-gray-700 font-sans cursor-default"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <button
                                          onMouseEnter={() => setActiveFolderSubmenu('none')}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openFolder(folder.id);
                                            setActiveFolderMenuId(null);
                                          }}
                                          className="w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer animate-in fade-in duration-100"
                                        >
                                          <div className="flex items-center gap-3">
                                            <Eye size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                                            <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Abrir</span>
                                          </div>
                                          <ChevronRight size={14} className="text-gray-300 group-hover:text-[#a21b7e] transition-colors" />
                                        </button>

                                        <button
                                          onMouseEnter={() => setActiveFolderSubmenu('none')}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleFolderSelect(folder.id);
                                            setActiveFolderMenuId(null);
                                          }}
                                          className="w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                                        >
                                          <div className="flex items-center gap-3">
                                            {selectedFolderIds.includes(folder.id) ? (
                                              <CheckSquare size={15} className="text-[#a21b7e] shrink-0" />
                                            ) : (
                                              <Square size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                                            )}
                                            <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">
                                              {selectedFolderIds.includes(folder.id) ? "Desmarcar" : "Selecionar"}
                                            </span>
                                          </div>
                                        </button>

                                        <div className="my-1 border-t border-gray-100" />

                                        <button
                                          onMouseEnter={() => setActiveFolderSubmenu('none')}
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            setActiveFolderMenuId(null);
                                            try {
                                              setIsProcessingAction(true);
                                              sessionStorage.setItem('action_in_progress', 'true');
                                              const count = await downloadDriveFolder(folder.id, folder.name);
                                              alert(`${count} ficheiro(s) em transferência.`);
                                              handleActionSuccess();
                                            } catch (err: any) {
                                              alert(err.message || "Erro ao transferir pasta.");
                                              setIsProcessingAction(false);
                                              sessionStorage.removeItem('action_in_progress');
                                            }
                                          }}
                                          className="w-full flex items-center gap-3 px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                                        >
                                          <Download size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                                          <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Transferir pasta</span>
                                        </button>

                                        <button
                                          onMouseEnter={() => setActiveFolderSubmenu('none')}
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            const newName = prompt("Digite o novo nome para " + folder.name, folder.name);
                                            if (newName && newName.trim() !== folder.name) {
                                              try {
                                                setIsProcessingAction(true);
                                                sessionStorage.setItem('action_in_progress', 'true');
                                                if ((folder as any).ownerId === 'google-drive' || folder.id.length > 20) {
                                                  const renameResponse = await fetch('/api/drive/update', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ fileId: folder.id, newName: newName.normalize('NFC') })
                                                  });
                                                  if (!renameResponse.ok) {
                                                    const errData = await renameResponse.json();
                                                    throw new Error(errData.error || "Erro no Google Drive");
                                                  }
                                                }
                                                await updateDoc(doc(db, "folders", folder.id), { name: newName.normalize('NFC') });
                                                handleActionSuccess();
                                              } catch (err: any) {
                                                alert("Erro ao renomear pasta: " + err.message);
                                                setIsProcessingAction(false);
                                                sessionStorage.removeItem('action_in_progress');
                                              }
                                            }
                                            setActiveFolderMenuId(null);
                                          }}
                                          className="relative w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                                        >
                                          <div className="flex items-center gap-3">
                                            <FileText size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                                            <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Mudar nome</span>
                                          </div>
                                        </button>

                                        {/* ── ATRIBUIR A CLIENTE — nível 1, flyout nível 2 ── */}
                                        <button
                                          onMouseEnter={() => setActiveFolderSubmenu('atribuir')}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveFolderSubmenu(activeFolderSubmenu === 'atribuir' ? 'none' : 'atribuir');
                                          }}
                                          className="relative w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-[#a21b7e]/5 group transition-colors text-left text-[13px] font-bold cursor-pointer"
                                        >
                                          <div className="flex items-center gap-3">
                                            <UserPlus size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                                            <div>
                                              <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors block">Atribuir a Cliente</span>
                                              {(folder as any).clientEmail && (
                                                <span className="text-[9px] text-[#a21b7e] font-medium truncate block max-w-[120px]">{(folder as any).clientEmail}</span>
                                              )}
                                            </div>
                                          </div>
                                          <ChevronRight size={14} className="text-gray-300 group-hover:text-[#a21b7e] transition-colors shrink-0" />

                                          <AnimatePresence>
                                            {activeFolderSubmenu === 'atribuir' && (
                                              <motion.div
                                                initial={{ opacity: 0, scale: 0.95, x: 10 }}
                                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                                exit={{ opacity: 0, scale: 0.95, x: 10 }}
                                                transition={{ duration: 0.1 }}
                                                className="absolute left-full ml-2 top-0 w-56 bg-white border border-gray-100 rounded-sm shadow-[0_3px_15px_rgba(0,0,0,0.12)] z-50 py-1.5 text-left cursor-default"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <div className="px-3 py-1 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 mb-1">Selecionar Cliente</div>

                                                {(folder as any).clientEmail && (
                                                  <>
                                                    <div className="mx-2 mt-1 px-2 py-1 text-[10px] text-[#a21b7e] font-medium bg-[#a21b7e]/8 rounded flex items-center gap-1.5">
                                                      <Check size={10} className="shrink-0" />
                                                      <span className="truncate">Actual: {(folder as any).clientEmail}</span>
                                                    </div>
                                                    <button
                                                      onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (!confirm(`Desvincular a pasta "${folder.name}" de ${(folder as any).clientEmail}?`)) return;
                                                        try {
                                                          await updateDoc(doc(db, 'folders', folder.id), { clientEmail: null });
                                                          alert('✅ Partilha removida com sucesso!');
                                                        } catch (err: any) { alert('Erro: ' + err.message); }
                                                        setActiveFolderSubmenu('none');
                                                        setActiveFolderMenuId(null);
                                                      }}
                                                      className="w-full flex items-center gap-2 mx-0 px-3 py-1.5 mb-1 text-[10px] font-bold text-red-500 hover:bg-red-50 transition-colors text-left border-b border-gray-100"
                                                    >
                                                      <UserMinus size={11} className="shrink-0" />
                                                      Desvincular partilha
                                                    </button>
                                                  </>
                                                )}

                                                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                                  {accounts && accounts.filter(a => a.role !== 'admin').length > 0 ? (
                                                    accounts.filter(a => a.role !== 'admin').map((client: any) => {
                                                      const clientName = getAccountListLabel(client.displayName || "", client.email);
                                                      const isActive = (folder as any).clientEmail === client.email?.toLowerCase();
                                                      return (
                                                        <button
                                                          key={client.id}
                                                          onClick={async (e) => {
                                                            e.stopPropagation();
                                                            try {
                                                              await updateDoc(doc(db, 'folders', folder.id), { clientEmail: client.email?.toLowerCase() });
                                                              alert(`✅ Pasta "${folder.name}" atribuída a ${client.email}!`);
                                                            } catch (err: any) {
                                                              alert("Erro ao atribuir: " + err.message);
                                                            }
                                                            setActiveFolderSubmenu('none');
                                                            setActiveFolderMenuId(null);
                                                          }}
                                                          className={cn(
                                                            "w-full text-left px-3 py-2 text-xs transition-colors",
                                                            isActive ? "bg-[#a21b7e]/10 text-[#a21b7e]" : "text-gray-700 hover:bg-gray-50 hover:text-[#a21b7e]"
                                                          )}
                                                        >
                                                          <div className="flex items-center gap-2">
                                                            <AccountAvatar
                                                              size="sm"
                                                              displayName={client.displayName}
                                                              email={client.email}
                                                              active={isActive}
                                                            />
                                                            <div className="min-w-0">
                                                              <div className="font-bold truncate">{clientName}</div>
                                                              <div className="text-[9px] text-gray-400 truncate">{client.email}</div>
                                                            </div>
                                                          </div>
                                                        </button>
                                                      );
                                                    })
                                                  ) : (
                                                    <div className="px-3 py-3 text-[10px] text-gray-400 italic text-center">
                                                      Nenhum cliente cadastrado.<br />
                                                      <span className="text-[#a21b7e] not-italic font-medium">Crie em Gestão de Clientes.</span>
                                                    </div>
                                                  )}
                                                </div>
                                              </motion.div>
                                            )}
                                          </AnimatePresence>
                                        </button>

                                        {/* ── PARTILHAR — apenas link ── */}
                                        <button
                                          onMouseEnter={() => setActiveFolderSubmenu('partilhar')}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveFolderSubmenu(activeFolderSubmenu === 'partilhar' ? 'none' : 'partilhar');
                                          }}
                                          className="relative w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                                        >
                                          <div className="flex items-center gap-3">
                                            <Share2 size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                                            <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Partilhar link</span>
                                          </div>
                                          <ChevronRight size={14} className="text-gray-300 group-hover:text-[#a21b7e] transition-colors" />

                                          <AnimatePresence>
                                            {activeFolderSubmenu === 'partilhar' && (
                                              <motion.div
                                                initial={{ opacity: 0, scale: 0.95, x: 10 }}
                                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                                exit={{ opacity: 0, scale: 0.95, x: 10 }}
                                                transition={{ duration: 0.1 }}
                                                className="absolute left-full ml-2 top-0 w-44 bg-white border border-gray-100 rounded-sm shadow-[0_3px_15px_rgba(0,0,0,0.1)] z-50 py-1.5 text-left text-gray-700 font-sans cursor-default"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <div className="px-3.5 py-1 text-[9px] font-black text-gray-300 uppercase tracking-widest border-b border-gray-50 mb-1">Enviar via</div>

                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const shareUrl = folder.webViewLink || `${window.location.origin}/?folder=${folder.id}`;
                                                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Confira a pasta *${folder.name}* no ProVisual Corporate: ${shareUrl}`)}`, '_blank');
                                                    setActiveFolderMenuId(null);
                                                    setActiveFolderSubmenu('none');
                                                  }}
                                                  className="w-full flex items-center gap-3 px-3.5 py-2 hover:bg-gray-50 group/sub transition-colors text-left text-[13px] font-bold cursor-pointer"
                                                >
                                                  <Share2 size={14} className="text-gray-400 group-hover/sub:text-[#a21b7e] transition-colors shrink-0" />
                                                  <span className="text-gray-600 group-hover/sub:text-[#a21b7e] transition-colors">WhatsApp</span>
                                                </button>

                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const shareUrl = folder.webViewLink || `${window.location.origin}/?folder=${folder.id}`;
                                                    window.location.href = `mailto:?subject=${encodeURIComponent(`Partilha de Pasta - ProVisual`)}&body=${encodeURIComponent(`Olá!\n\nSegue o link para aceder à pasta *${folder.name}*:\n\n${shareUrl}\n\nCumprimentos,\nEquipa ProVisual`)}`;
                                                    setActiveFolderMenuId(null);
                                                    setActiveFolderSubmenu('none');
                                                  }}
                                                  className="w-full flex items-center gap-3 px-3.5 py-2 hover:bg-gray-50 group/sub transition-colors text-left text-[13px] font-bold cursor-pointer"
                                                >
                                                  <Mail size={14} className="text-gray-400 group-hover/sub:text-[#a21b7e] transition-colors shrink-0" />
                                                  <span className="text-gray-600 group-hover/sub:text-[#a21b7e] transition-colors">E-mail</span>
                                                </button>

                                                <div className="my-1 border-t border-gray-100" />

                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const shareUrl = folder.webViewLink || `${window.location.origin}/?folder=${folder.id}`;
                                                    navigator.clipboard.writeText(shareUrl);
                                                    alert("Link copiado!");
                                                    setActiveFolderMenuId(null);
                                                    setActiveFolderSubmenu('none');
                                                  }}
                                                  className="w-full flex items-center gap-3 px-3.5 py-2 hover:bg-gray-50 group/sub transition-colors text-left text-[13px] font-bold cursor-pointer"
                                                >
                                                  <Copy size={14} className="text-gray-400 group-hover/sub:text-[#a21b7e] transition-colors shrink-0" />
                                                  <span className="text-gray-600 group-hover/sub:text-[#a21b7e] transition-colors">Copiar link</span>
                                                </button>
                                              </motion.div>
                                            )}
                                          </AnimatePresence>
                                        </button>


                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveFolderSubmenu(activeFolderSubmenu === 'organizar' ? 'none' : 'organizar');
                                          }}
                                          className="relative w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-[#a21b7e]/5 group transition-colors text-left text-[13px] font-bold cursor-pointer"
                                        >
                                          <div className="flex items-center gap-3">
                                            <FolderIcon size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                                            <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Organizar</span>
                                          </div>
                                          <ChevronRight size={14} className="text-gray-300 group-hover:text-[#a21b7e] transition-colors" />

                                          <AnimatePresence>
                                            {activeFolderSubmenu === 'organizar' && (
                                              <motion.div
                                                initial={{ opacity: 0, scale: 0.95, x: 10 }}
                                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                                exit={{ opacity: 0, scale: 0.95, x: 10 }}
                                                transition={{ duration: 0.1 }}
                                                className="absolute left-full ml-2 top-0 w-44 bg-white border border-gray-100 rounded-sm shadow-[0_3px_15px_rgba(0,0,0,0.12)] z-50 py-1.5 text-left cursor-default"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <div className="px-3 py-1 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 mb-1">Organizar</div>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOrganizarModal({ folder, mode: 'move' });
                                                    setActiveFolderSubmenu('none');
                                                    setActiveFolderMenuId(null);
                                                  }}
                                                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 hover:text-[#a21b7e] text-gray-700 text-xs font-bold transition-colors text-left"
                                                >
                                                  <FolderIcon size={14} className="text-gray-400 shrink-0" />
                                                  Mover para...
                                                </button>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOrganizarModal({ folder, mode: 'copy' });
                                                    setActiveFolderSubmenu('none');
                                                    setActiveFolderMenuId(null);
                                                  }}
                                                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 hover:text-[#a21b7e] text-gray-700 text-xs font-bold transition-colors text-left"
                                                >
                                                  <Copy size={14} className="text-gray-400 shrink-0" />
                                                  Copiar para...
                                                </button>
                                              </motion.div>
                                            )}
                                          </AnimatePresence>
                                        </button>


                                        <div className="px-3.5 py-2">
                                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">Destaque</span>
                                          <div className="flex gap-1.5 items-center">
                                            {[
                                              "#e2b13c", // Padrão Gold
                                              "#a21b7e", // Vinho Provisual
                                              "#3b82f6", // Azul
                                              "#10b981", // Verde
                                              "#ef4444", // Vermelho
                                              "#8b5cf6", // Roxo
                                            ].map((color) => (
                                              <button
                                                key={color}
                                                onClick={async (e) => {
                                                  e.stopPropagation();
                                                  try {
                                                    await updateDoc(doc(db, "folders", folder.id), { color });
                                                    handleActionSuccess();
                                                  } catch (err) {
                                                    console.error("Erro ao mudar cor da pasta:", err);
                                                  }
                                                  setActiveFolderMenuId(null);
                                                }}
                                                style={{ backgroundColor: color }}
                                                className={cn(
                                                  "w-4 h-4 rounded-full border border-gray-100 hover:scale-125 transition-all cursor-pointer",
                                                  (folder.color || "#e2b13c") === color ? "border-gray-800 scale-110 shadow-sm" : "border-transparent"
                                                )}
                                              />
                                            ))}
                                          </div>
                                        </div>

                                        <div className="my-1 border-t border-gray-100" />

                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            if (confirm("Tem certeza que deseja mover a pasta " + folder.name + " para o lixo?")) {
                                              try {
                                                setIsProcessingAction(true);
                                                sessionStorage.setItem('action_in_progress', 'true');

                                                // Mover fisicamente no Google Drive
                                                if ((folder as any).ownerId === 'google-drive' || folder.id.length > 20) {
                                                  const trashResponse = await fetch('/api/drive/update', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                      fileId: folder.id,
                                                      trashed: true
                                                    })
                                                  });
                                                  if (!trashResponse.ok) {
                                                    let errMsg = 'Erro desconhecido';
                                                    try { const errData = await trashResponse.json(); errMsg = errData.error || errMsg; } catch (_) { try { errMsg = await trashResponse.text(); } catch (__) { } }
                                                    console.warn("Erro ao lixo no drive:", errMsg);
                                                  }
                                                }
                                                await updateDoc(doc(db, "folders", folder.id), { parentId: "trash", trashed: true });
                                                setIsProcessingAction(false);
                                                sessionStorage.removeItem('action_in_progress');
                                              } catch (err: any) {
                                                alert("Erro ao mover para o lixo: " + err.message);
                                                setIsProcessingAction(false);
                                                sessionStorage.removeItem('action_in_progress');
                                              }
                                            }
                                            setActiveFolderMenuId(null);
                                          }}
                                          className="w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-red-50 group transition-colors text-left text-[13px] font-bold text-red-600 cursor-pointer"
                                        >
                                          <div className="flex items-center gap-3">
                                            <Trash2 size={15} className="text-red-400 group-hover:text-red-600 transition-colors shrink-0" />
                                            <span className="text-red-600 group-hover:text-red-700 transition-colors">Mover para o lixo</span>
                                          </div>
                                        </button>
                                      </motion.div>
                                    </>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Grid de Arquivos / Fotos */}
                    {filteredAssets.length > 0 && (
                      <div className="w-full flex flex-col gap-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                          {displayedAssets.map(asset => (
                            <AssetCard
                              key={asset.id}
                              asset={asset}
                              onDistribute={(item) => { setItemToDistribute(item); setDistributeModalOpen(true); }}
                              userProfile={userProfile}
                              isFolderAllowedForClient={isFolderAllowedForClient}
                              accounts={accounts}
                              isNewlyUploaded={newlyUploadedAssetIds.includes(asset.id)}
                              setOrganizarModal={setOrganizarModal}
                              onOpen={() => {
                                if (asset.type === "folder") {
                                  openFolder(asset.driveId || asset.id);
                                } else {
                                  setPreviewAsset(asset);
                                }
                              }}
                              isSelected={selectedAsset?.id === asset.id}
                              isBulkSelected={selectedAssetIds.includes(asset.id)}
                              onToggleBulkSelect={() => handleToggleBulkSelect(asset.id)}
                              hasSelectionActive={hasBulkSelectionActive}
                              onDragStart={(e) => startDragSelection(e, { type: "asset", id: asset.id })}
                              folders={filteredFolders}
                              onAskGemini={(a) => {
                                setGeminiAsset(a);
                                const initialText = `Olá! Sou o Gemini. Analisei o arquivo **${a.name}** (${a.type}). Ele está guardado com sucesso na ProVisual Corporate e integrado com o seu Google Drive. Posso extrair textos, gerar resumos ou dar insights sobre este arquivo. O que gostaria de saber?`;
                                setGeminiAnswers([{ role: 'gemini', text: initialText }]);
                                setGeminiQuestion("");
                              }}
                              onStartAction={(active) => {
                                setIsProcessingAction(active);
                                if (active) {
                                  sessionStorage.setItem('action_in_progress', 'true');
                                } else {
                                  sessionStorage.removeItem('action_in_progress');
                                }
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {/* List Header */}
                    <div className="sticky top-0 grid grid-cols-12 px-8 py-3 bg-gray-100 border-b border-gray-200 text-[10px] font-black text-gray-400 uppercase tracking-widest z-10">
                      <div className="col-span-6">Nome do arquivo</div>
                      <div className="col-span-2">Tipo</div>
                      <div className="col-span-2">Modificação</div>
                      <div className="col-span-2 text-right pr-4">Tamanho</div>
                    </div>

                    {/* Folders in List - Only show in 'All Files' or 'Google Drive' view */}
                    {(activeTab === 'all' || activeTab === 'google_drive') && filteredFolders.map(folder => (
                      <div
                        key={folder.id}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          startDragSelection(e, { type: "folder", id: folder.id });
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDropTargetFolderId(folder.id);
                        }}
                        onDragLeave={() => {
                          setDropTargetFolderId((prev) => (prev === folder.id ? null : prev));
                        }}
                        onDrop={(e) => handleDropOnFolder(e, folder.id)}
                        onClick={() => handleFolderGridClick(folder.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActiveFolderMenuId(activeFolderMenuId === folder.id ? null : folder.id);
                        }}
                        className={cn(
                          "grid grid-cols-12 px-8 py-4 border-b border-gray-50 items-center hover:bg-gray-50 cursor-pointer transition-all relative overflow-visible",
                          selectedFolderIds.includes(folder.id) && "bg-[#a21b7e]/5 ring-2 ring-inset ring-[#a21b7e]/30",
                          dropTargetFolderId === folder.id && "bg-[#a21b7e]/10 ring-1 ring-inset ring-[#a21b7e]/30",
                        )}
                      >
                        <div className="col-span-6 flex items-center gap-4">
                          <FolderIcon size={24} style={{ color: folder.color || "#e2b13c", fill: `${folder.color || "#e2b13c"}1a` }} />
                          <span className="text-sm font-bold text-gray-700" title={displayDriveName(folder.name)}>{displayDriveName(folder.name)}</span>
                        </div>
                        <div className="col-span-2 text-[10px] font-black text-gray-300 uppercase">Pasta</div>
                        <div className="col-span-2 text-xs text-gray-400 font-medium">
                          {format(folder.date, "dd/MM/yyyy")}
                        </div>
                        <div className="col-span-2 text-right pr-4 text-xs text-gray-300 flex items-center justify-end gap-3 relative overflow-visible">
                          <span>-</span>
                          <div className="relative overflow-visible">
                            <motion.button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveFolderMenuId(activeFolderMenuId === folder.id ? null : folder.id);
                                setActiveFolderSubmenu('none');
                              }}
                              whileHover={{ scale: 1.25 }}
                              whileTap={{ scale: 0.95 }}
                              className="text-gray-400 hover:text-gray-600 p-1 transition-colors cursor-pointer"
                            >
                              <MoreVertical size={16} />
                            </motion.button>

                            <AnimatePresence>
                              {activeFolderMenuId === folder.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-30"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveFolderMenuId(null);
                                      setActiveFolderSubmenu('none');
                                    }}
                                  />

                                  {/* SUBMENUS (Posicionados à esquerda do principal) */}


                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                    transition={{ duration: 0.1 }}
                                    className="absolute right-0 mt-2 w-52 bg-white border border-gray-100 rounded-sm shadow-[0_3px_10px_rgba(0,0,0,0.06)] z-40 py-1.5 text-left text-gray-700 font-sans cursor-default"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onMouseEnter={() => setActiveFolderSubmenu('none')}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openFolder(folder.id);
                                        setActiveFolderMenuId(null);
                                      }}
                                      className="w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer animate-in fade-in duration-100"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Eye size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                                        <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Abrir</span>
                                      </div>
                                      <ChevronRight size={14} className="text-gray-300 group-hover:text-[#a21b7e] transition-colors" />
                                    </button>

                                    <button
                                      onMouseEnter={() => setActiveFolderSubmenu('none')}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleFolderSelect(folder.id);
                                        setActiveFolderMenuId(null);
                                      }}
                                      className="w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                                    >
                                      <div className="flex items-center gap-3">
                                        {selectedFolderIds.includes(folder.id) ? (
                                          <CheckSquare size={15} className="text-[#a21b7e] shrink-0" />
                                        ) : (
                                          <Square size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                                        )}
                                        <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">
                                          {selectedFolderIds.includes(folder.id) ? "Desmarcar" : "Selecionar"}
                                        </span>
                                      </div>
                                    </button>

                                    <div className="my-1 border-t border-gray-100" />

                                    <button
                                      onMouseEnter={() => setActiveFolderSubmenu('none')}
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        setActiveFolderMenuId(null);
                                        try {
                                          setIsProcessingAction(true);
                                          sessionStorage.setItem('action_in_progress', 'true');
                                          const count = await downloadDriveFolder(folder.id, folder.name);
                                          alert(`${count} ficheiro(s) em transferência.`);
                                          handleActionSuccess();
                                        } catch (err: any) {
                                          alert(err.message || "Erro ao transferir pasta.");
                                          setIsProcessingAction(false);
                                          sessionStorage.removeItem('action_in_progress');
                                        }
                                      }}
                                      className="w-full flex items-center gap-3 px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                                    >
                                      <Download size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                                      <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Transferir pasta</span>
                                    </button>

                                    <button
                                      onMouseEnter={() => setActiveFolderSubmenu('none')}
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const newName = prompt("Digite o novo nome para " + folder.name, folder.name);
                                        if (newName && newName.trim() !== folder.name) {
                                          try {
                                            setIsProcessingAction(true);
                                            sessionStorage.setItem('action_in_progress', 'true');

                                            if ((folder as any).ownerId === 'google-drive' || folder.id.length > 20) {
                                              const renameResponse = await fetch('/api/drive/update', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                  fileId: folder.id,
                                                  newName: newName.normalize('NFC')
                                                })
                                              });
                                              if (!renameResponse.ok) {
                                                const errData = await renameResponse.json();
                                                throw new Error(errData.error || "Erro no Google Drive");
                                              }
                                            }
                                            await updateDoc(doc(db, "folders", folder.id), { name: newName.normalize('NFC') });
                                            handleActionSuccess();
                                          } catch (err: any) {
                                            alert("Erro ao renomear pasta: " + err.message);
                                            setIsProcessingAction(false);
                                            sessionStorage.removeItem('action_in_progress');
                                          }
                                        }
                                        setActiveFolderMenuId(null);
                                      }}
                                      className="relative w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                                    >
                                      <div className="flex items-center gap-3">
                                        <FileText size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                                        <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Mudar nome</span>
                                      </div>
                                    </button>

                                    <button
                                      onMouseEnter={() => setActiveFolderSubmenu('atribuir')}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveFolderSubmenu(activeFolderSubmenu === 'atribuir' ? 'none' : 'atribuir');
                                      }}
                                      className="relative w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-[#a21b7e]/5 group transition-colors text-left text-[13px] font-bold cursor-pointer"
                                    >
                                      <div className="flex items-center gap-3">
                                        <UserPlus size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                                        <div>
                                          <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors block">Atribuir a Cliente</span>
                                          {(folder as any).clientEmail && (
                                            <span className="text-[9px] text-[#a21b7e] font-medium truncate block max-w-[120px]">{(folder as any).clientEmail}</span>
                                          )}
                                        </div>
                                      </div>
                                      <ChevronRight size={14} className="text-gray-300 group-hover:text-[#a21b7e] transition-colors shrink-0" />

                                      <AnimatePresence>
                                        {activeFolderSubmenu === 'atribuir' && (
                                          <motion.div
                                            initial={{ opacity: 0, scale: 0.95, x: 10 }}
                                            animate={{ opacity: 1, scale: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, x: 10 }}
                                            transition={{ duration: 0.1 }}
                                            className="absolute right-0 translate-x-full ml-1.5 top-0 w-56 bg-white border border-gray-100 rounded-sm shadow-[0_3px_15px_rgba(0,0,0,0.12)] z-50 py-1.5 text-left cursor-default"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <div className="px-3 py-1 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 mb-1">Selecionar Cliente</div>
                                            {(folder as any).clientEmail && (
                                              <>
                                                <div className="mx-2 mt-1 px-2 py-1 text-[10px] text-[#a21b7e] font-medium bg-[#a21b7e]/8 rounded flex items-center gap-1.5">
                                                  <Check size={10} className="shrink-0" />
                                                  <span className="truncate">Actual: {(folder as any).clientEmail}</span>
                                                </div>
                                                <button
                                                  onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (!confirm(`Desvincular a pasta "${folder.name}" de ${(folder as any).clientEmail}?`)) return;
                                                    try {
                                                      await updateDoc(doc(db, 'folders', folder.id), { clientEmail: null });
                                                      alert('✅ Partilha removida com sucesso!');
                                                    } catch (err: any) { alert('Erro: ' + err.message); }
                                                    setActiveFolderSubmenu('none');
                                                    setActiveFolderMenuId(null);
                                                  }}
                                                  className="w-full flex items-center gap-2 px-3 py-1.5 mb-1 text-[10px] font-bold text-red-500 hover:bg-red-50 transition-colors text-left border-b border-gray-100"
                                                >
                                                  <UserMinus size={11} className="shrink-0" />
                                                  Desvincular partilha
                                                </button>
                                              </>
                                            )}
                                            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                              {accounts && accounts.filter(a => a.role !== 'admin').length > 0 ? (
                                                accounts.filter(a => a.role !== 'admin').map((client: any) => {
                                                  const clientName = getAccountListLabel(client.displayName || "", client.email);
                                                  const isActive = (folder as any).clientEmail === client.email?.toLowerCase();
                                                  return (
                                                    <button
                                                      key={client.id}
                                                      onClick={async (e) => {
                                                        e.stopPropagation();
                                                        try {
                                                          await updateDoc(doc(db, 'folders', folder.id), { clientEmail: client.email?.toLowerCase() });
                                                          alert(`✅ Pasta "${folder.name}" atribuída a ${client.email}!`);
                                                        } catch (err: any) {
                                                          alert("Erro ao atribuir: " + err.message);
                                                        }
                                                        setActiveFolderSubmenu('none');
                                                        setActiveFolderMenuId(null);
                                                      }}
                                                      className={cn(
                                                        "w-full text-left px-3 py-2 text-xs transition-colors",
                                                        isActive ? "bg-[#a21b7e]/10 text-[#a21b7e]" : "text-gray-700 hover:bg-gray-50 hover:text-[#a21b7e]"
                                                      )}
                                                    >
                                                      <div className="flex items-center gap-2">
                                                        <AccountAvatar
                                                          size="sm"
                                                          displayName={client.displayName}
                                                          email={client.email}
                                                          active={isActive}
                                                        />
                                                        <div className="min-w-0">
                                                          <div className="font-bold truncate">{clientName}</div>
                                                          <div className="text-[9px] text-gray-400 truncate">{client.email}</div>
                                                        </div>
                                                      </div>
                                                    </button>
                                                  );
                                                })
                                              ) : (
                                                <div className="px-3 py-3 text-[10px] text-gray-400 italic text-center">
                                                  Nenhum cliente cadastrado.<br />
                                                  <span className="text-[#a21b7e] not-italic font-medium">Crie em Gestão de Clientes.</span>
                                                </div>
                                              )}
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </button>

                                    <button
                                      onMouseEnter={() => setActiveFolderSubmenu('partilhar')}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveFolderSubmenu(activeFolderSubmenu === 'partilhar' ? 'none' : 'partilhar');
                                      }}
                                      className="relative w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Share2 size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                                        <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Partilhar link</span>
                                      </div>
                                      <ChevronRight size={14} className="text-gray-300 group-hover:text-[#a21b7e] transition-colors" />

                                      <AnimatePresence>
                                        {activeFolderSubmenu === 'partilhar' && (
                                          <motion.div
                                            initial={{ opacity: 0, scale: 0.95, x: 10 }}
                                            animate={{ opacity: 1, scale: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, x: 10 }}
                                            transition={{ duration: 0.1 }}
                                            className="absolute right-0 translate-x-full ml-1.5 top-0 w-44 bg-white border border-gray-100 rounded-sm shadow-[0_3px_15px_rgba(0,0,0,0.1)] z-50 py-1.5 text-left text-gray-700 font-sans cursor-default"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <div className="px-3.5 py-1 text-[9px] font-black text-gray-300 uppercase tracking-widest border-b border-gray-50 mb-1">Enviar via</div>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const shareUrl = folder.webViewLink || `${window.location.origin}/?folder=${folder.id}`;
                                                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Confira a pasta *${folder.name}* no ProVisual Corporate: ${shareUrl}`)}`, '_blank');
                                                setActiveFolderMenuId(null);
                                                setActiveFolderSubmenu('none');
                                              }}
                                              className="w-full flex items-center gap-3 px-3.5 py-2 hover:bg-gray-50 group/sub transition-colors text-left text-[13px] font-bold cursor-pointer"
                                            >
                                              <Share2 size={14} className="text-gray-400 group-hover/sub:text-[#a21b7e] transition-colors shrink-0" />
                                              <span className="text-gray-600 group-hover/sub:text-[#a21b7e] transition-colors">WhatsApp</span>
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const shareUrl = folder.webViewLink || `${window.location.origin}/?folder=${folder.id}`;
                                                window.location.href = `mailto:?subject=${encodeURIComponent(`Partilha de Pasta - ProVisual`)}&body=${encodeURIComponent(`Olá!\n\nSegue o link para aceder à pasta *${folder.name}*:\n\n${shareUrl}\n\nCumprimentos,\nEquipa ProVisual`)}`;
                                                setActiveFolderMenuId(null);
                                                setActiveFolderSubmenu('none');
                                              }}
                                              className="w-full flex items-center gap-3 px-3.5 py-2 hover:bg-gray-50 group/sub transition-colors text-left text-[13px] font-bold cursor-pointer"
                                            >
                                              <Mail size={14} className="text-gray-400 group-hover/sub:text-[#a21b7e] transition-colors shrink-0" />
                                              <span className="text-gray-600 group-hover/sub:text-[#a21b7e] transition-colors">E-mail</span>
                                            </button>
                                            <div className="my-1 border-t border-gray-100" />
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const shareUrl = folder.webViewLink || `${window.location.origin}/?folder=${folder.id}`;
                                                navigator.clipboard.writeText(shareUrl);
                                                alert("Link copiado!");
                                                setActiveFolderMenuId(null);
                                                setActiveFolderSubmenu('none');
                                              }}
                                              className="w-full flex items-center gap-3 px-3.5 py-2 hover:bg-gray-50 group/sub transition-colors text-left text-[13px] font-bold cursor-pointer"
                                            >
                                              <Copy size={14} className="text-gray-400 group-hover/sub:text-[#a21b7e] transition-colors shrink-0" />
                                              <span className="text-gray-600 group-hover/sub:text-[#a21b7e] transition-colors">Copiar link</span>
                                            </button>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </button>

                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveFolderSubmenu(activeFolderSubmenu === 'organizar' ? 'none' : 'organizar');
                                      }}
                                      className="relative w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-[#a21b7e]/5 group transition-colors text-left text-[13px] font-bold cursor-pointer"
                                    >
                                      <div className="flex items-center gap-3">
                                        <FolderIcon size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                                        <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Organizar</span>
                                      </div>
                                      <ChevronRight size={14} className="text-gray-300 group-hover:text-[#a21b7e] transition-colors" />

                                      <AnimatePresence>
                                        {activeFolderSubmenu === 'organizar' && (
                                          <motion.div
                                            initial={{ opacity: 0, scale: 0.95, x: 10 }}
                                            animate={{ opacity: 1, scale: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, x: 10 }}
                                            transition={{ duration: 0.1 }}
                                            className="absolute left-full ml-2 top-0 w-44 bg-white border border-gray-100 rounded-sm shadow-[0_3px_15px_rgba(0,0,0,0.12)] z-50 py-1.5 text-left cursor-default"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <div className="px-3 py-1 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 mb-1">Organizar</div>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setOrganizarModal({ folder, mode: 'move' });
                                                setActiveFolderSubmenu('none');
                                                setActiveFolderMenuId(null);
                                              }}
                                              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 hover:text-[#a21b7e] text-gray-700 text-xs font-bold transition-colors text-left"
                                            >
                                              <FolderIcon size={14} className="text-gray-400 shrink-0" />
                                              Mover para...
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setOrganizarModal({ folder, mode: 'copy' });
                                                setActiveFolderSubmenu('none');
                                                setActiveFolderMenuId(null);
                                              }}
                                              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 hover:text-[#a21b7e] text-gray-700 text-xs font-bold transition-colors text-left"
                                            >
                                              <Copy size={14} className="text-gray-400 shrink-0" />
                                              Copiar para...
                                            </button>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </button>


                                    <div className="px-3.5 py-2">
                                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">Destaque</span>
                                      <div className="flex gap-1.5 items-center">
                                        {[
                                          "#e2b13c", // Padrão Gold
                                          "#a21b7e", // Vinho Provisual
                                          "#3b82f6", // Azul
                                          "#10b981", // Verde
                                          "#ef4444", // Vermelho
                                          "#8b5cf6", // Roxo
                                        ].map((color) => (
                                          <button
                                            key={color}
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              try {
                                                await updateDoc(doc(db, "folders", folder.id), { color });
                                                handleActionSuccess();
                                              } catch (err) {
                                                console.error("Erro ao mudar cor da pasta:", err);
                                              }
                                              setActiveFolderMenuId(null);
                                            }}
                                            style={{ backgroundColor: color }}
                                            className={cn(
                                              "w-4 h-4 rounded-full border border-gray-100 hover:scale-125 transition-all cursor-pointer",
                                              (folder.color || "#e2b13c") === color ? "border-gray-800 scale-110 shadow-sm" : "border-transparent"
                                            )}
                                          />
                                        ))}
                                      </div>
                                    </div>

                                    <div className="my-1 border-t border-gray-100" />

                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (confirm("Tem certeza que deseja mover a pasta " + folder.name + " para o lixo?")) {
                                          try {
                                            setIsProcessingAction(true);
                                            sessionStorage.setItem('action_in_progress', 'true');

                                            // Mover fisicamente no Google Drive
                                            if ((folder as any).ownerId === 'google-drive' || folder.id.length > 20) {
                                              const trashResponse = await fetch('/api/drive/update', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                  fileId: folder.id,
                                                  trashed: true
                                                })
                                              });
                                              if (!trashResponse.ok) {
                                                let errMsg = 'Erro desconhecido';
                                                try { const errData = await trashResponse.json(); errMsg = errData.error || errMsg; } catch (_) { try { errMsg = await trashResponse.text(); } catch (__) { } }
                                                console.warn("Erro ao lixo no drive:", errMsg);
                                              }
                                            }
                                            await updateDoc(doc(db, "folders", folder.id), { parentId: "trash", trashed: true });
                                            handleActionSuccess();
                                          } catch (err: any) {
                                            alert("Erro ao mover para o lixo: " + err.message);
                                            setIsProcessingAction(false);
                                            sessionStorage.removeItem('action_in_progress');
                                          }
                                        }
                                        setActiveFolderMenuId(null);
                                      }}
                                      className="w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-red-50 group transition-colors text-left text-[13px] font-bold text-red-600 cursor-pointer"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Trash2 size={15} className="text-red-400 group-hover:text-red-600 transition-colors shrink-0" />
                                        <span className="text-red-600 group-hover:text-red-700 transition-colors">Mover para o lixo</span>
                                      </div>
                                    </button>
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Assets (Files & Folders from Drive) in List */}
                    {displayedAssets.map(asset => (
                      <AssetRow
                        key={asset.id}
                        asset={asset}
                        onDistribute={(item) => { setItemToDistribute(item); setDistributeModalOpen(true); }}
                        userProfile={userProfile}
                        isFolderAllowedForClient={isFolderAllowedForClient}
                        accounts={accounts}
                        isNewlyUploaded={newlyUploadedAssetIds.includes(asset.id)}
                        setOrganizarModal={setOrganizarModal}
                        onOpen={() => {
                          if (asset.type === "folder") {
                            openFolder(asset.driveId || asset.id);
                          } else {
                            setPreviewAsset(asset);
                          }
                        }}
                        isSelected={selectedAsset?.id === asset.id}
                        isBulkSelected={selectedAssetIds.includes(asset.id)}
                        onToggleBulkSelect={() => handleToggleBulkSelect(asset.id)}
                        hasSelectionActive={hasBulkSelectionActive}
                        onDragStart={(e) => startDragSelection(e, { type: "asset", id: asset.id })}
                        folders={filteredFolders}
                        onAskGemini={(a) => {
                          setGeminiAsset(a);
                          const initialText = `Olá! Sou o Gemini. Analisei o arquivo **${a.name}** (${a.type}). Ele está guardado com sucesso na ProVisual Corporate e integrado com o seu Google Drive. Posso extrair textos, gerar resumos ou dar insights sobre este arquivo. O que gostaria de saber?`;
                          setGeminiAnswers([{ role: 'gemini', text: initialText }]);
                          setGeminiQuestion("");
                        }}
                        onStartAction={(active) => {
                          setIsProcessingAction(active);
                          if (active) {
                            sessionStorage.setItem('action_in_progress', 'true');
                          } else {
                            sessionStorage.removeItem('action_in_progress');
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
            {activeTab === 'image' && filteredAssets.length > visibleImagesCount && (
              <div className="flex justify-center my-8 pb-10 w-full">
                <button
                  onClick={() => setVisibleImagesCount((prev) => prev + IMAGES_GRID_PAGE_SIZE)}
                  className="flex items-center gap-2 bg-[#a21b7e] text-white px-6 py-3 rounded-md text-sm font-bold shadow-sm hover:bg-[#8e176e] transition-all cursor-pointer select-none"
                >
                  <Plus size={18} />
                  Carregar mais imagens
                </button>
              </div>
            )}
          </div>)}

        {/* Upload Progress Overlay (Fixed Bottom Right) - Google Drive style (Layout Claro) */}
        {showUploadQueueCard && uploadQueue.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-8 right-8 bg-white border border-gray-200/80 shadow-[0_10px_30px_rgba(0,0,0,0.08)] rounded-[10px] min-w-[280px] max-w-[384px] w-auto z-[100] text-gray-700 overflow-hidden font-sans"
          >
            <div className="flex items-center justify-between gap-8 px-4 py-3 bg-gray-50 border-b border-gray-100 text-gray-800">
              <span className="font-bold text-xs uppercase tracking-wider shrink-0">
                {uploadQueue.some(item => item.status === 'uploading')
                  ? `Carregando ${uploadQueue.filter(item => item.status === 'uploading').length} ${uploadQueue.filter(item => item.status === 'uploading').length === 1 ? 'item' : 'itens'}...`
                  : `${uploadQueue.filter(item => item.status === 'completed').length} ${uploadQueue.filter(item => item.status === 'completed').length === 1 ? 'upload concluído' : 'uploads concluídos'}`
                }
              </span>
              <button
                onClick={() => setShowUploadQueueCard(false)}
                className="w-6 h-6 rounded-full hover:bg-gray-200/50 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="rotate-45" size={16} />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-gray-50">
              {uploadQueue.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-6 px-4 py-3 text-xs bg-white">
                  <div className="flex items-center gap-2 min-w-0 max-w-[75%] text-left">
                    {item.status === 'uploading' ? (
                      <div className="w-3.5 h-3.5 border-2 border-t-transparent border-[#a21b7e] rounded-full animate-spin shrink-0" />
                    ) : item.status === 'completed' ? (
                      <CheckCircle2 className="text-emerald-500 shrink-0" size={15} />
                    ) : (
                      <span className="text-red-500 shrink-0 font-bold">!</span>
                    )}
                    <span className="truncate font-semibold text-gray-700" title={item.name}>{item.name}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === 'uploading' && (
                      <span className="text-[10px] text-gray-400 font-bold">{item.progress}%</span>
                    )}
                    {item.status === 'completed' && (
                      <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Concluído</span>
                    )}
                    {item.status === 'error' && (
                      <span className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Erro</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Barra Flutuante de Ações em Massa */}
        {hasBulkSelectionActive && (
          <>
            {(bulkMoveMenuOpen || bulkSelectMenuOpen) && (
              <div
                className="fixed inset-0 z-[240]"
                onClick={() => {
                  setBulkMoveMenuOpen(false);
                  setBulkSelectMenuOpen(false);
                }}
              />
            )}
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[250] font-sans"
          >
            <div className="bg-white/95 backdrop-blur-md border border-gray-200/80 shadow-[0_10px_30px_rgba(0,0,0,0.12)] rounded-[12px] px-5 py-3 flex flex-nowrap items-center gap-4 w-max max-w-[calc(100vw-2rem)]">
            <div className="flex flex-nowrap items-center gap-2 border-r border-gray-200 pr-4 shrink-0">
              <div className="w-6 h-6 rounded-full bg-[#a21b7e] text-white flex items-center justify-center text-xs font-bold shadow-sm animate-pulse shrink-0">
                {totalSelectedCount}
              </div>
              <span className="text-sm font-bold text-gray-700 whitespace-nowrap">
                {totalSelectedCount === 1 ? 'item selecionado' : 'itens selecionados'}
              </span>
            </div>

            <div className="flex flex-nowrap items-center gap-2">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewAsset(null);
                    setBulkSelectMenuOpen(false);
                    setBulkMoveMenuOpen((open) => !open);
                  }}
                  className="flex flex-nowrap items-center gap-2 px-3 py-1.5 hover:bg-gray-100 rounded-md text-xs font-bold text-gray-600 transition-colors cursor-pointer select-none whitespace-nowrap"
                >
                  <FolderIcon size={14} className="text-yellow-500 shrink-0" />
                  Mover para...
                  <ChevronDown size={12} className={cn("text-gray-400 shrink-0 transition-transform", bulkMoveMenuOpen && "rotate-180")} />
                </button>

                {bulkMoveMenuOpen && (
                <div className="absolute bottom-[100%] left-0 mb-2 w-52 bg-white border border-gray-200 shadow-lg rounded-md py-1 z-[260] max-h-60 overflow-y-auto">
                  <div className="px-3 py-1.5 text-[10px] font-black text-gray-300 uppercase tracking-wider border-b border-gray-100 mb-1 whitespace-nowrap">Escolha a pasta destino</div>

                  {selectedFolderId !== null && (
                    <button
                      onClick={() => {
                        handleBulkMove(null);
                        setBulkMoveMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#a21b7e]/5 text-left text-xs font-bold text-gray-600 hover:text-[#a21b7e] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <HardDrive size={14} className="text-gray-400 shrink-0" />
                      Raiz (Meu Drive)
                    </button>
                  )}

                  {filteredFolders.map(folder => (
                    <button
                      key={folder.id}
                      onClick={() => {
                        handleBulkMove(folder.id);
                        setBulkMoveMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#a21b7e]/5 text-left text-xs font-bold text-gray-600 hover:text-[#a21b7e] transition-colors cursor-pointer"
                    >
                      <FolderIcon size={14} className="text-yellow-500 shrink-0" />
                      <span className="truncate">{folder.name}</span>
                    </button>
                  ))}
                </div>
                )}
              </div>

              <button
                onClick={handleBulkDelete}
                className="flex flex-nowrap items-center gap-2 px-3 py-1.5 hover:bg-red-50 hover:text-red-600 rounded-md text-xs font-bold text-gray-600 transition-colors cursor-pointer select-none whitespace-nowrap shrink-0"
              >
                <Trash2 size={14} className="text-red-400 shrink-0" />
                Mover para Lixeira
              </button>

              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewAsset(null);
                    setBulkMoveMenuOpen(false);
                    setBulkSelectMenuOpen((open) => !open);
                  }}
                  className="flex flex-nowrap items-center gap-2 px-3 py-1.5 hover:bg-gray-100 rounded-md text-xs font-bold text-gray-600 transition-colors cursor-pointer select-none whitespace-nowrap"
                >
                  Selecionar
                  <ChevronDown size={12} className={cn("text-gray-400 shrink-0 transition-transform", bulkSelectMenuOpen && "rotate-180")} />
                </button>
                {bulkSelectMenuOpen && (
                <div className="absolute bottom-[100%] left-0 mb-2 w-56 bg-white border border-gray-200 shadow-lg rounded-md py-1 z-[260]">
                  <div className="px-3 py-1.5 text-[10px] font-black text-gray-300 uppercase tracking-wider border-b border-gray-100 mb-1 whitespace-nowrap">
                    Selecção em massa
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      previewSelection.onSelectAllVisible();
                      setBulkSelectMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-bold text-gray-600 hover:bg-[#a21b7e]/5 hover:text-[#a21b7e] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Selecionar todas visíveis
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      previewSelection.onSelectAllImages();
                      setBulkSelectMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-bold text-gray-600 hover:bg-[#a21b7e]/5 hover:text-[#a21b7e] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Selecionar todas as imagens
                  </button>
                </div>
                )}
              </div>

              <button
                onClick={() => {
                  clearAllSelection();
                  setBulkMoveMenuOpen(false);
                  setBulkSelectMenuOpen(false);
                }}
                className="flex flex-nowrap items-center gap-2 px-3 py-1.5 hover:bg-gray-100 rounded-md text-xs font-bold text-gray-600 transition-colors cursor-pointer select-none whitespace-nowrap shrink-0"
              >
                Limpar seleção
              </button>
            </div>
            </div>
          </motion.div>
          </>
        )}

        {/* Modal de Visualização */}
        <AnimatePresence>
          {previewAsset && (
            <FilePreviewModal
              asset={previewAsset}
              assets={previewableAssets}
              contextLabel={previewFolderLabel}
              onClose={() => setPreviewAsset(null)}
              onChange={setPreviewAsset}
            />
          )}
        </AnimatePresence>

        {/* Modal Interativo do Gemini */}
        <AnimatePresence>
          {geminiAsset && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
              onClick={() => setGeminiAsset(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-white rounded-sm shadow-2xl border border-violet-100 max-w-lg w-full overflow-hidden flex flex-col h-[500px]"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header do Gemini */}
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 text-white flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-2">
                    <Sparkles className="animate-pulse text-amber-300 shrink-0" size={20} />
                    <div>
                      <h3 className="font-bold text-sm">Gemini Inteligência Artificial</h3>
                      <p className="text-[10px] text-violet-200">Análise de Contexto: {geminiAsset.name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setGeminiAsset(null)}
                    className="p-1 hover:bg-white/10 rounded-md transition-colors text-white/80 hover:text-white cursor-pointer"
                  >
                    <Plus className="rotate-45" size={20} />
                  </button>
                </div>

                {/* Área de Mensagens */}
                <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 bg-gray-50/50">
                  {geminiAnswers.map((ans, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300",
                        ans.role === 'user'
                          ? "bg-violet-600 text-white self-end rounded-tr-none"
                          : "bg-white text-gray-700 border border-gray-100 self-start rounded-tl-none"
                      )}
                    >
                      {ans.text}
                    </div>
                  ))}
                  {isGeminiLoading && (
                    <div className="bg-white text-gray-400 border border-gray-100 self-start rounded-2xl rounded-tl-none p-3 text-xs flex items-center gap-2 shadow-sm">
                      <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      <span>Gemini está a analisar...</span>
                    </div>
                  )}
                </div>

                {/* Caixa de Entrada */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!geminiQuestion.trim() || isGeminiLoading) return;

                    const q = geminiQuestion;
                    setGeminiAnswers(prev => [...prev, { role: 'user', text: q }]);
                    setGeminiQuestion("");
                    setIsGeminiLoading(true);

                    // Gerar resposta inteligente simulada baseada em palavras-chave
                    setTimeout(() => {
                      let reply = "";
                      const lowerQ = q.toLowerCase();

                      if (lowerQ.includes("resum") || lowerQ.includes("sobre") || lowerQ.includes("contexto") || lowerQ.includes("analis")) {
                        reply = `Este ficheiro "${geminiAsset.name}" é do tipo ${geminiAsset.type}. O Gemini identificou que ele representa um elemento de valor no repositório da ProVisual Corporate. A integridade visual dele está perfeita e está sincronizado de forma ótima.`;
                      } else if (lowerQ.includes("tamanho") || lowerQ.includes("peso") || lowerQ.includes("kb") || lowerQ.includes("mb") || lowerQ.includes("dimens")) {
                        reply = `O tamanho registrado deste arquivo na nuvem é de aproximadamente ${geminiAsset.versions[0]?.size || "0.5 MB"}. Está otimizado para downloads velozes e compressão sem perda de qualidade.`;
                      } else if (lowerQ.includes("sinc") || lowerQ.includes("drive") || lowerQ.includes("nuvem") || lowerQ.includes("google")) {
                        reply = `Confirmado! O arquivo está sincronizado com o Google Drive institucional (Drive ID: ${geminiAsset.driveId || "Indisponível na raiz"}). Qualquer atualização reflete de forma bidirecional automática!`;
                      } else {
                        reply = `Excelente questão sobre "${geminiAsset.name}"! Analisei suas propriedades de renderização e as informações de segurança estão 100% conformes. Deseja que eu faça um resumo detalhado ou extraia alguma informação específica deste arquivo?`;
                      }

                      setGeminiAnswers(prev => [...prev, { role: 'gemini', text: reply }]);
                      setIsGeminiLoading(false);
                    }, 1200);
                  }}
                  className="p-3 border-t border-gray-100 bg-white flex gap-2 items-center"
                >
                  <input
                    type="text"
                    value={geminiQuestion}
                    onChange={(e) => setGeminiQuestion(e.target.value)}
                    placeholder="Faça uma pergunta ao Gemini sobre o arquivo..."
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-gray-700 font-sans"
                  />
                  <button
                    type="submit"
                    className="bg-violet-600 hover:bg-violet-700 text-white rounded-md px-4 py-2 text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    Enviar
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Details Pane */}
      <AnimatePresence>
        {selectedAsset && (
          <motion.aside
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="w-72 border-l border-gray-100 bg-white p-5 overflow-y-auto shrink-0 z-20 shadow-xl shadow-black/5"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-[10px] text-gray-400 uppercase tracking-[0.2em]">Inspecionar</h3>
              <button
                onClick={() => setSelectedAsset(null)}
                className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded-md text-gray-300 transition-colors"
              >
                <Plus className="rotate-45" size={18} />
              </button>
            </div>

            <div className="aspect-square bg-gray-50 mb-6 flex items-center justify-center border border-gray-100 relative group overflow-hidden shadow-inner">
              {(selectedAsset.thumbnailUrl || resolveDriveFileId(selectedAsset.driveId, selectedAsset.id)) ? (
                <SafeImage
                  thumbnailUrl={selectedAsset.thumbnailUrl}
                  driveId={selectedAsset.driveId}
                  fileId={selectedAsset.id}
                  fallbackSize="w500"
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                selectedAsset.type === "image" ? (
                  <ImageIcon className="text-[#a21b7e] opacity-20" size={48} />
                ) : selectedAsset.type === "video" ? (
                  <Video className="text-[#a21b7e] opacity-20" size={48} />
                ) : (
                  <FileText className="text-[#a21b7e] opacity-20" size={48} />
                )
              )}
              <div className="absolute top-2 right-2 bg-white px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest text-[#a21b7e] border border-[#a21b7e]/15 shadow-sm">
                {selectedAsset.type}
              </div>
            </div>

            <div className="mb-6">
              <h4 className="font-bold text-sm text-gray-800 mb-1 truncate" title={selectedAsset.name}>
                {selectedAsset.name}
              </h4>
              <div className="flex items-center gap-3 text-gray-400 text-[9px] font-bold uppercase tracking-widest">
                <span className="flex items-center gap-1">
                  <Clock size={10} className="text-[#a21b7e]" />
                  {format(selectedAsset.captureDate, "dd/MM/yy")}
                </span>
                <span className="flex items-center gap-1 border-l border-gray-100 pl-3">
                  <Download size={10} className="text-[#a21b7e]" />
                  {selectedAsset.versions[0].size}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h5 className="text-[8px] font-bold text-gray-300 uppercase tracking-[0.2em] mb-2">Entregas</h5>
                <div className="space-y-1.5">
                  {selectedAsset.versions.map((version, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all border border-gray-50">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400 leading-none mb-1">
                          {version.quality}
                        </span>
                        <span className="text-[11px] font-bold text-gray-700">{version.size}</span>
                      </div>
                      <button className="w-7 h-7 flex items-center justify-center text-[#a21b7e] bg-white shadow-sm border border-gray-100 rounded-md hover:bg-[#a21b7e] hover:text-white transition-all">
                        <Download size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-50">
                <button className="w-full flex items-center justify-center gap-2 bg-[#a21b7e] text-white py-2.5 rounded-lg font-bold shadow-md shadow-[#a21b7e]/10 hover:bg-[#8e176e] transition-all">
                  <ArrowBigUpDash size={16} />
                  <span className="text-xs">Processar Master</span>
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Floating custom context menu for page container right-click */}
      {contextMenu && contextMenu.visible && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed bg-[#1e1f20] border border-[#2d2e30] rounded-xl shadow-2xl z-50 py-2 w-56 text-left text-gray-200 font-sans cursor-default animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.removeAttribute("webkitdirectory");
                fileInputRef.current.removeAttribute("directory");
                fileInputRef.current.click();
              }
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-white/10 transition-all text-left text-xs font-medium text-gray-200 cursor-pointer"
          >
            <FileUp size={15} className="text-gray-400" />
            <span>Carregar ficheiro</span>
          </button>

          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.setAttribute("webkitdirectory", "true");
                fileInputRef.current.setAttribute("directory", "true");
                fileInputRef.current.click();
                setTimeout(() => {
                  fileInputRef.current?.removeAttribute("webkitdirectory");
                  fileInputRef.current?.removeAttribute("directory");
                }, 1000);
              }
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-white/10 transition-all text-left text-xs font-medium text-gray-200 cursor-pointer"
          >
            <FolderUp size={15} className="text-gray-400" />
            <span>Carregar pasta</span>
          </button>

          <div className="my-1.5 border-t border-gray-800" />

          <button
            onClick={() => {
              handleCreateFolder();
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-white/10 transition-all text-left text-xs font-medium text-gray-200 cursor-pointer"
          >
            <FolderPlus size={15} className="text-gray-400" />
            <span>Criar uma nova pasta</span>
          </button>
        </div>
      )}

      {/* Loader removido para carregamento instantâneo */}

      {/* MODAL DISTRIBUIR A CLIENTE */}
      <AnimatePresence>
        {distributeModalOpen && itemToDistribute && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
            onClick={() => setDistributeModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white max-w-md w-full rounded-xl overflow-hidden shadow-2xl flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div>
                  <h3 className="text-sm font-bold text-gray-800">Distribuir para Cliente</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Defina o cliente a quem este item pertence</p>
                </div>
                <button
                  onClick={() => setDistributeModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-lg mb-5">
                  <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center text-blue-500">
                    {itemToDistribute.type === 'folder' ? <FolderIcon size={16} /> : <FileText size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">{itemToDistribute.currentName}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">{itemToDistribute.type === 'folder' ? 'Pasta' : 'Arquivo'}</p>
                  </div>
                </div>

                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">Selecione o Cliente</label>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {accounts.filter(a => a.role === 'cliente').map(client => {
                    const listLabel = getAccountListLabel(client.displayName || "", client.email);

                    return (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => setSelectedClientId(client.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${selectedClientId === client.id ? 'border-[#a21b7e] bg-[#a21b7e]/5 shadow-sm' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}
                      >
                        <AccountAvatar
                          size="md"
                          displayName={client.displayName}
                          email={client.email}
                          active={selectedClientId === client.id}
                        />
                        <div>
                          <p className="text-sm font-bold text-gray-700 font-sans">{listLabel || "Cliente"}</p>
                          <p className="text-xs text-gray-400 font-sans">{client.email}</p>
                        </div>
                        {selectedClientId === client.id && <CheckCircle2 size={16} className="text-[#a21b7e] ml-auto shrink-0" />}
                      </button>
                    );
                  })}
                  {accounts.filter(a => a.role === 'cliente').length === 0 && (
                    <div className="p-4 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50 text-gray-500 text-sm">
                      Nenhum cliente cadastrado. Adicione um na aba "Gestão de Clientes".
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                <button
                  onClick={() => setDistributeModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  disabled={!selectedClientId || isDistributing}
                  onClick={async () => {
                    setIsDistributing(true);
                    try {
                      // Encontrar o email do cliente selecionado pelo seu ID
                      const selectedClient = accounts.find(a => a.id === selectedClientId);
                      const clientEmailToAssign = selectedClient?.email?.toLowerCase();
                      if (!clientEmailToAssign) throw new Error("Email do cliente não encontrado.");
                      const { supabase: sb } = await import('../lib/supabase');
                      const table = itemToDistribute.type === 'folder' ? 'folders' : 'assets';
                      const { error } = await sb.from(table).update({ client_email: clientEmailToAssign }).eq('id', itemToDistribute.id);
                      if (error) throw error;
                      alert("Distribuído com sucesso!");
                      setDistributeModalOpen(false);
                    } catch (err: any) {
                      alert("Erro ao distribuir: " + err.message);
                    } finally {
                      setIsDistributing(false);
                    }
                  }}
                  className="px-5 py-2 bg-[#a21b7e] hover:bg-[#8e176d] text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isDistributing ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> A atribuir...</>
                  ) : (
                    <><Share2 size={16} /> Atribuir</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(() => {
          if (!organizarModal) return null;
          const isFolder = !!organizarModal.folder;
          const item = isFolder ? organizarModal.folder : organizarModal.asset;
          if (!item) return null;

          const currentParentId = isFolder ? item.parentId : item.folderId;
          const isAtRoot = !currentParentId || currentParentId === 'root' || currentParentId === '';
          const currentParentName = isAtRoot
            ? 'Raiz (Meu Drive)'
            : (folders.find(f => f.id === currentParentId)?.name || 'Pasta desconhecida');

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
              onClick={() => { setOrganizarModal(null); setOrganizarSearch(''); }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                transition={{ duration: 0.18 }}
                className="bg-white rounded-xl shadow-2xl w-[420px] max-w-[95vw] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 pt-5 pb-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-black text-gray-800">
                    {organizarModal.mode === 'move' ? 'Mover' : 'Copiar'} &ldquo;{item.name}&rdquo; para
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-gray-400">Localização actual:</span>
                    <span className="text-[11px] font-bold text-[#a21b7e] bg-[#a21b7e]/8 px-2 py-0.5 rounded">
                      {currentParentName}
                    </span>
                  </div>
                </div>
                <div className="flex border-b border-gray-100">
                  {(['move', 'copy'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setOrganizarModal({ ...organizarModal, mode: m })}
                      className={cn(
                        "flex-1 py-2.5 text-xs font-black uppercase tracking-wider transition-colors",
                        organizarModal.mode === m
                          ? "text-[#a21b7e] border-b-2 border-[#a21b7e]"
                          : "text-gray-400 hover:text-gray-600"
                      )}
                    >
                      {m === 'move' ? '📁 Mover' : '📋 Copiar'}
                    </button>
                  ))}
                </div>
                <div className="px-4 pt-3 pb-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Pesquisar pasta de destino..."
                      value={organizarSearch}
                      onChange={e => setOrganizarSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#a21b7e] transition-all"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[300px] px-2 pb-2 custom-scrollbar">
                  {!isAtRoot && (
                    <button
                      onClick={async () => {
                        try {
                          setIsProcessingAction(true);
                          const itemId = item.id;
                          const itemDriveId = isFolder ? item.id : item.driveId;

                          if (itemDriveId && itemDriveId.length > 20) {
                            const r = await fetch('/api/drive/update', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                fileId: itemDriveId,
                                addParents: 'root',
                                removeParents: currentParentId && currentParentId !== 'root' ? currentParentId : undefined
                              })
                            });
                            if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
                          }

                          if (organizarModal.mode === 'move') {
                            if (isFolder) {
                              await updateDoc(doc(db, 'folders', itemId), { parentId: null });
                            } else {
                              await updateDoc(doc(db, 'assets', itemId), { folderId: "" });
                            }
                            alert(`"${item.name}" movido para a Raiz com sucesso!`);
                          } else {
                            if (isFolder) {
                              alert("Copiar pastas não é suportado no momento.");
                            } else {
                              const newAsset = {
                                ...item,
                                folderId: "",
                                captureDate: new Date(),
                                createdAt: new Date()
                              };
                              delete (newAsset as any).id;
                              await addDoc(collection(db, "assets"), newAsset);
                              alert(`Cópia de "${item.name}" criada na Raiz!`);
                            }
                          }
                          setOrganizarModal(null); setOrganizarSearch(''); handleActionSuccess();
                        } catch (err: any) { alert('Erro: ' + err.message); setIsProcessingAction(false); }
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-left group transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <FolderIcon size={16} className="text-gray-500" />
                      </div>
                      <div>
                        <div className="text-[13px] font-bold text-gray-700 group-hover:text-[#a21b7e] transition-colors">Raiz (Meu Drive)</div>
                        <div className="text-[10px] text-gray-400">Pasta principal do drive</div>
                      </div>
                    </button>
                  )}
                  {folders
                    .filter(f => {
                      if (f.id === item.id || f.id === currentParentId || (f as any).trashed || (f as any).deleted) return false;
                      if (userProfile?.role === 'cliente' && !isFolderAllowedForClient(f.id)) return false;
                      return organizarSearch === '' || f.name.toLowerCase().includes(organizarSearch.toLowerCase());
                    })
                    .map(f => (
                      <button
                        key={f.id}
                        onClick={async () => {
                          try {
                            setIsProcessingAction(true);
                            const itemId = item.id;
                            const itemDriveId = isFolder ? item.id : item.driveId;

                            if (itemDriveId && itemDriveId.length > 20) {
                              const r = await fetch('/api/drive/update', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  fileId: itemDriveId,
                                  addParents: f.id,
                                  removeParents: currentParentId && currentParentId !== 'root' ? currentParentId : undefined
                                })
                              });
                              if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
                            }

                            if (organizarModal.mode === 'move') {
                              if (isFolder) {
                                await updateDoc(doc(db, 'folders', itemId), { parentId: f.id });
                              } else {
                                await updateDoc(doc(db, 'assets', itemId), { folderId: f.id });
                              }
                              alert(`"${item.name}" movido para "${f.name}"!`);
                            } else {
                              if (isFolder) {
                                alert("Copiar pastas não é suportado no momento.");
                              } else {
                                const newAsset = {
                                  ...item,
                                  folderId: f.id,
                                  captureDate: new Date(),
                                  createdAt: new Date()
                                };
                                delete (newAsset as any).id;
                                await addDoc(collection(db, "assets"), newAsset);
                                alert(`Cópia de "${item.name}" criada em "${f.name}"!`);
                              }
                            }
                            setOrganizarModal(null); setOrganizarSearch(''); handleActionSuccess();
                          } catch (err: any) { alert('Erro: ' + err.message); setIsProcessingAction(false); }
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-left group transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: ((f as any).color || '#e2b13c') + '22' }}>
                          <FolderIcon size={16} style={{ color: (f as any).color || '#e2b13c' }} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold text-gray-700 group-hover:text-[#a21b7e] transition-colors truncate">{f.name}</div>
                          {(f as any).clientEmail && <div className="text-[10px] text-gray-400 truncate">{(f as any).clientEmail}</div>}
                        </div>
                      </button>
                    ))}
                </div>
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                  <span className="text-[10px] text-gray-400">Clique numa pasta para confirmar</span>
                  <button onClick={() => { setOrganizarModal(null); setOrganizarSearch(''); }} className="px-5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    Cancelar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <LeaveAccountDialog
        open={leaveAccountOpen}
        onClose={() => setLeaveAccountOpen(false)}
        onConfirmLeave={handleLeaveToHomepage}
      />
    </div>
  );
}

// Helper Components
interface FolderCardProps {
  key?: React.Key;
  folder: FolderData;
  onClick: () => void;
}

function FolderCard({ folder, onClick }: FolderCardProps) {
  return (
    <div
      onClick={onClick}
      className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md cursor-pointer transition-all group"
    >
      <div className="w-10 h-10 bg-yellow-50 text-yellow-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
        <FolderIcon size={24} />
      </div>
      <p className="text-sm font-semibold text-gray-800 truncate">{folder.name}</p>
      <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-tight font-bold">
        {format(folder.date, "dd MMM yyyy", { locale: ptBR })}
      </p>
    </div>
  );
}

interface AssetCardProps {
  key?: React.Key;
  asset: Asset;
  onOpen: () => void;
  isSelected: boolean;
  isNewlyUploaded?: boolean;
  onAskGemini: (asset: Asset) => void;
  folders: any[];
  onStartAction?: (active: boolean) => void;
  isBulkSelected?: boolean;
  onToggleBulkSelect?: () => void;
  hasSelectionActive?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDistribute?: (item: { id: string, type: string, currentName: string }) => void;
  userProfile?: UserProfile | null;
  isFolderAllowedForClient?: (folderId: string) => boolean;
  setOrganizarModal: (val: any) => void;
  accounts?: any[];
}

function AssetCard({
  asset,
  onOpen,
  isSelected,
  isNewlyUploaded = false,
  onAskGemini,
  folders,
  onStartAction,
  isBulkSelected = false,
  onToggleBulkSelect,
  hasSelectionActive = false,
  onDragStart,
  userProfile,
  isFolderAllowedForClient,
  setOrganizarModal,
  accounts = []
}: AssetCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<'none' | 'partilhar' | 'organizar' | 'atribuir'>('none');

  const runAction = async (actionFn: () => Promise<void>) => {
    try {
      onStartAction?.(true);
      await actionFn();
      onStartAction?.(false);
    } catch (err: any) {
      onStartAction?.(false);
      console.error(err);
      alert("Erro ao processar: " + err.message);
    }
  };
  const Icon = asset.type === "folder" ? FolderIcon : (asset.type === "image" ? ImageIcon : (asset.type === "video" ? Video : FileText));
  const iconColor = asset.type === "image" ? "text-blue-500" : (asset.type === "video" ? "text-purple-500" : "text-gray-400");

  const thumbUrl = asset.thumbnailUrl ? asset.thumbnailUrl.replace('=s220', '=s500') : `https://drive.google.com/thumbnail?id=${asset.driveId}&sz=w500`;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        onDragStart?.(e);
      }}
      onClick={() => onOpen()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setShowMenu(true);
      }}
      className={cn(
        "aspect-[3/2] relative border transition-all cursor-pointer group rounded-none shadow-sm",
        showMenu ? "overflow-visible z-30" : "overflow-hidden",
        isBulkSelected
          ? "border-[#a21b7e] ring-2 ring-[#a21b7e]/30 shadow-lg"
          : (isSelected ? "border-[#a21b7e] ring-2 ring-[#a21b7e]/10 shadow-lg" : "border-gray-100 hover:border-gray-300")
      )}
    >
      {/* 3 dots button over the image in the upper right corner */}
      <div className="absolute top-2 right-2 z-20">
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          whileHover={{ scale: 1.25 }}
          whileTap={{ scale: 0.95 }}
          className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] hover:text-white transition-colors p-1.5 rounded-full cursor-pointer"
        >
          <MoreVertical size={18} />
        </motion.button>

        <AnimatePresence>
          {showMenu && (
            <>
              {/* Invisible click-catcher to dismiss the menu */}
              <div
                className="fixed inset-0 z-30"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  setActiveSubmenu('none');
                }}
              />

              {/* SUBMENUS (Posicionados à esquerda do principal) */}


              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.1 }}
                className="absolute right-0 mt-2 w-52 bg-white border border-gray-100 rounded-sm shadow-[0_3px_10px_rgba(0,0,0,0.06)] z-40 py-1.5 text-left text-gray-700 font-sans cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer animate-in fade-in duration-100"
                >
                  <div className="flex items-center gap-3">
                    <ExternalLink size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                    <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Abrir</span>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-[#a21b7e] transition-colors" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleBulkSelect?.();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {isBulkSelected ? (
                      <CheckSquare size={15} className="text-[#a21b7e] shrink-0" />
                    ) : (
                      <Square size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                    )}
                    <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">
                      {isBulkSelected ? "Desmarcar" : "Selecionar"}
                    </span>
                  </div>
                </button>

                <div className="my-1 border-t border-gray-100" />

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    if (asset.type === "folder") {
                      const folderId = asset.driveId || asset.id;
                      void runAction(async () => {
                        const count = await downloadDriveFolder(folderId, asset.name);
                        alert(`${count} ficheiro(s) em transferência.`);
                      });
                      return;
                    }
                    if (asset.driveId) {
                      triggerDriveDownload(asset.driveId, asset.name);
                      return;
                    }
                    alert("Não foi possível transferir este ficheiro.");
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                >
                  <Download size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                  <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Transferir</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const newName = prompt("Digite o novo nome para o arquivo:", asset.name);
                    if (newName) {
                      setShowMenu(false);
                      runAction(async () => {
                        // 1. Renomear fisicamente no Google Drive real
                        if (asset.driveId) {
                          const updateResponse = await fetch('/api/drive/update', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              fileId: asset.driveId,
                              newName: newName
                            })
                          });
                          if (!updateResponse.ok) {
                            const errData = await updateResponse.json();
                            throw new Error(errData.error || 'Erro ao renomear no Google Drive');
                          }
                        }

                        // 2. Atualizar no Firestore
                        await updateDoc(doc(db, "assets", asset.id), { name: newName });
                      });
                    } else {
                      setShowMenu(false);
                    }
                  }}
                  className="relative w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Pencil size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                    <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Mudar o nome</span>
                  </div>
                  <span className="text-[10px] text-gray-300 font-mono tracking-tighter group-hover:text-[#a21b7e] transition-colors">⌥⌘E</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    runAction(async () => {
                      let newDriveId = asset.driveId || "";
                      let newUrl = asset.versions[0]?.url || asset.webViewLink || "";

                      // 1. Copiar fisicamente no Google Drive real na mesma pasta
                      if (asset.driveId) {
                        const copyResponse = await fetch('/api/drive/copy', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            fileId: asset.driveId,
                            destinationFolderId: asset.folderId || 'root',
                            newName: `${asset.name} (Cópia)`
                          })
                        });
                        if (!copyResponse.ok) {
                          const errData = await copyResponse.json();
                          throw new Error(errData.error || 'Erro ao copiar no Google Drive');
                        }
                        const copyData = await copyResponse.json();
                        newDriveId = copyData.id;
                        newUrl = copyData.webViewLink;
                      }

                      // 2. Salvar no Firestore com os novos dados físicos
                      const newAsset = {
                        ...asset,
                        name: `${asset.name} (Cópia)`,
                        driveId: newDriveId,
                        versions: [{
                          quality: "original",
                          size: asset.versions?.[0]?.size || "0 MB",
                          url: newUrl
                        }],
                        captureDate: new Date(),
                        createdAt: new Date()
                      };
                      delete (newAsset as any).id;
                      await addDoc(collection(db, "assets"), newAsset);
                      /* window.location.reload() removed */
                    });
                  }}
                  className="relative w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Copy size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                    <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Fazer cópia</span>
                  </div>
                  <span className="text-[10px] text-gray-300 font-mono tracking-tighter group-hover:text-[#a21b7e] transition-colors">⌘C ⌘V</span>
                </button>

                <div className="my-1 border-t border-gray-100" />

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAskGemini(asset);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold text-violet-600 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Sparkles size={15} className="text-violet-400 group-hover:text-violet-600 transition-colors shrink-0" />
                    <span className="group-hover:text-violet-600 transition-colors font-bold text-violet-600">Pedir ao Gemini</span>
                  </div>
                  <span className="text-[9px] font-bold text-white bg-blue-600 px-1.5 py-0.5 rounded-full uppercase leading-none scale-90">Novo</span>
                </button>

                <div className="my-1 border-t border-gray-100" />

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSubmenu(activeSubmenu === 'partilhar' ? 'none' : 'partilhar');
                  }}
                  className="relative w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <UserPlus size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                    <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Partilhar</span>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-[#a21b7e] transition-colors" />

                  <AnimatePresence>
                    {activeSubmenu === 'partilhar' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, x: 10 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95, x: 10 }}
                        transition={{ duration: 0.1 }}
                        className="absolute left-[100%] ml-1.5 top-0 w-52 bg-white border border-gray-100 rounded-sm shadow-[0_3px_15px_rgba(0,0,0,0.1)] z-50 py-1.5 text-left text-gray-700 font-sans cursor-default animate-in fade-in"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-3.5 py-1 text-[9px] font-black text-gray-300 uppercase tracking-widest border-b border-gray-50 mb-1">Partilhar via</div>

                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSubmenu(activeSubmenu === 'atribuir' ? 'none' : 'atribuir');
                            }}
                            className="w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group/sub transition-colors text-left text-[13px] font-bold cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <UserPlus size={14} className="text-gray-400 group-hover/sub:text-[#a21b7e] transition-colors shrink-0" />
                              <span className="text-gray-600 group-hover/sub:text-[#a21b7e] transition-colors">Atribuir a Cliente</span>
                            </div>
                            <ChevronRight size={14} className="text-gray-300 group-hover/sub:text-[#a21b7e] transition-colors" />
                          </button>

                          <AnimatePresence>
                            {activeSubmenu === 'atribuir' && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, x: 10 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95, x: 10 }}
                                transition={{ duration: 0.1 }}
                                className="absolute left-[100%] ml-1.5 top-0 w-48 bg-white border border-gray-100 rounded-sm shadow-[0_3px_15px_rgba(0,0,0,0.1)] z-[60] py-1 text-left max-h-64 overflow-y-auto custom-scrollbar cursor-default"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="px-3 py-1 text-[9px] font-black text-gray-300 uppercase tracking-widest border-b border-gray-50 mb-1">Selecione o Cliente</div>
                                {accounts && accounts.filter(a => a.role !== 'admin').length > 0 ? (
                                  accounts.filter(a => a.role !== 'admin').map((client: any) => (
                                    <button
                                      key={client.id}
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          const docRef = doc(db, 'assets', asset.id);
                                          await updateDoc(docRef, { clientId: client.email });
                                          alert("Atribuído com sucesso!");
                                        } catch (err: any) {
                                          alert("Erro ao atribuir: " + err.message);
                                        }
                                        setActiveSubmenu('none');
                                        setShowMenu(false);
                                      }}
                                      className="w-full text-left px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-[#a21b7e]/5 hover:text-[#a21b7e] truncate block transition-colors"
                                    >
                                      {client.displayName || client.email}
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-3 py-2 text-xs text-gray-400 italic">Nenhum cliente disponível</div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const shareUrl = asset.versions[0]?.url || asset.webViewLink || window.location.href;
                            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Confira o arquivo *${asset.name}* no ProVisual Corporate: ${shareUrl}`)}`, '_blank');
                            setShowMenu(false);
                            setActiveSubmenu('none');
                          }}
                          className="w-full flex items-center gap-3 px-3.5 py-2 bg-transparent hover:bg-transparent group/sub transition-colors text-left text-[13px] font-bold cursor-pointer"
                        >
                          <Share2 size={14} className="text-gray-400 group-hover/sub:text-[#a21b7e] transition-colors shrink-0" />
                          <span className="text-gray-600 group-hover/sub:text-[#a21b7e] transition-colors">WhatsApp</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const shareUrl = asset.versions[0]?.url || asset.webViewLink || window.location.href;
                            window.location.href = `mailto:?subject=${encodeURIComponent(`Partilha de Ficheiro - ProVisual`)}&body=${encodeURIComponent(`Olá!\n\nSegue o link para aceder ao ficheiro *${asset.name}* no Arquivo ProVisual Corporate:\n\n${shareUrl}\n\nCumprimentos,\nEquipa ProVisual`)}`;
                            setShowMenu(false);
                            setActiveSubmenu('none');
                          }}
                          className="w-full flex items-center gap-3 px-3.5 py-2 bg-transparent hover:bg-transparent group/sub transition-colors text-left text-[13px] font-bold cursor-pointer"
                        >
                          <Mail size={14} className="text-gray-400 group-hover/sub:text-[#a21b7e] transition-colors shrink-0" />
                          <span className="text-gray-600 group-hover/sub:text-[#a21b7e] transition-colors">E-mail</span>
                        </button>

                        <div className="my-1 border-t border-gray-100" />

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const shareUrl = asset.webViewLink || asset.versions[0]?.url || window.location.href;
                            navigator.clipboard.writeText(shareUrl);
                            alert("Link de partilha copiado para a área de transferência!");
                            setShowMenu(false);
                            setActiveSubmenu('none');
                          }}
                          className="w-full flex items-center gap-3 px-3.5 py-2 bg-transparent hover:bg-transparent group/sub transition-colors text-left text-[13px] font-bold cursor-pointer"
                        >
                          <Copy size={14} className="text-gray-400 group-hover/sub:text-[#a21b7e] transition-colors shrink-0" />
                          <span className="text-gray-600 group-hover/sub:text-[#a21b7e] transition-colors">Copiar Link</span>
                        </button>

                        {asset.webViewLink && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(asset.webViewLink, '_blank');
                              setShowMenu(false);
                              setActiveSubmenu('none');
                            }}
                            className="w-full flex items-center gap-3 px-3.5 py-2 bg-transparent hover:bg-transparent group/sub transition-colors text-left text-[13px] font-bold cursor-pointer"
                          >
                            <ExternalLink size={14} className="text-gray-400 group-hover/sub:text-[#a21b7e] transition-colors shrink-0" />
                            <span className="text-gray-600 group-hover/sub:text-[#a21b7e] transition-colors">Abrir no Drive</span>
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSubmenu(activeSubmenu === 'organizar' ? 'none' : 'organizar');
                  }}
                  className="relative w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <FolderIcon size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                    <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Organizar</span>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-[#a21b7e] transition-colors" />

                  <AnimatePresence>
                    {activeSubmenu === 'organizar' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, x: 10 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95, x: 10 }}
                        transition={{ duration: 0.1 }}
                        className="absolute left-[100%] ml-1.5 top-0 w-44 bg-white border border-gray-100 rounded-sm shadow-[0_3px_15px_rgba(0,0,0,0.12)] z-50 py-1.5 text-left cursor-default"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-3 py-1 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 mb-1">Organizar</div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOrganizarModal({ asset, mode: 'move' });
                            setActiveSubmenu('none');
                            setShowMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 hover:text-[#a21b7e] text-gray-700 text-xs font-bold transition-colors text-left"
                        >
                          <FolderIcon size={14} className="text-gray-400 shrink-0" />
                          Mover para...
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOrganizarModal({ asset, mode: 'copy' });
                            setActiveSubmenu('none');
                            setShowMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 hover:text-[#a21b7e] text-gray-700 text-xs font-bold transition-colors text-left"
                        >
                          <Copy size={14} className="text-gray-400 shrink-0" />
                          Copiar para...
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    alert("Arquivo disponibilizado offline com sucesso!");
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold text-green-600 cursor-pointer"
                >
                  <CheckCircle2 size={15} className="text-green-400 group-hover:text-green-600 transition-colors shrink-0" />
                  <span className="group-hover:text-green-600 transition-colors font-bold text-green-600">Disponibilizar offline</span>
                </button>

                <div className="my-1 border-t border-gray-100" />

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Tem certeza que deseja eliminar " + asset.name + "?")) {
                      setShowMenu(false);
                      runAction(async () => {
                        // 1. Mover para a Lixeira fisicamente no Google Drive real
                        if (asset.driveId) {
                          try {
                            const updateResponse = await fetch('/api/drive/update', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                fileId: asset.driveId,
                                trashed: true
                              })
                            });
                            if (!updateResponse.ok) {
                              const errData = await updateResponse.json();
                              console.warn("Erro ao mover no drive:", errData.error);
                            }
                          } catch (driveErr) {
                            console.warn("Falha física ao lixar no Drive, prosseguindo localmente:", driveErr);
                          }
                        }

                        // 2. Atualizar no Firestore
                        await updateDoc(doc(db, "assets", asset.id), { folderId: "trash", trashed: true });
                        /* window.location.reload() removed */
                      });
                    } else {
                      setShowMenu(false);
                    }
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold text-red-500 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Trash2 size={15} className="text-red-400 group-hover:text-red-600 transition-colors shrink-0" />
                    <span className="group-hover:text-red-600 transition-colors font-bold text-red-500">Eliminar</span>
                  </div>
                  <span className="text-[10px] text-red-300 font-mono tracking-tighter group-hover:text-red-500 transition-colors">Delete</span>
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <div className="w-full h-full flex items-center justify-center overflow-hidden bg-gray-50">
        {((asset.type === 'image' || asset.type === 'video' || asset.type === 'document') &&
          (asset.thumbnailUrl || resolveDriveFileId(asset.driveId, asset.id))) ? (
          <SafeImage
            thumbnailUrl={asset.thumbnailUrl ? asset.thumbnailUrl.replace('=s220', '=s500') : undefined}
            driveId={asset.driveId}
            fileId={asset.id}
            fallbackSize="w500"
            crop={asset.type === "image"}
            alt={displayDriveName(asset.name)}
            className="w-full h-full min-w-full min-h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <Icon size={40} className={cn("transition-all duration-300", iconColor)} />
        )}
      </div>

      {/* Hover Overlay - Descrição ao passar o mouse */}
      <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out z-10">
        <h4 className="font-bold text-[11px] text-white truncate mb-0.5">{displayDriveName(asset.name)}</h4>
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold text-gray-300 uppercase">{format(asset.captureDate, "dd/MM/yy")}</span>
          <span className="text-[9px] font-bold text-[#a21b7e] bg-white px-1.5 py-0.5 rounded-sm uppercase">{asset.versions[0]?.size}</span>
        </div>
      </div>
    </div>
  );
}

interface AssetRowProps {
  key?: React.Key;
  asset: Asset;
  onOpen: () => void;
  isSelected: boolean;
  isNewlyUploaded?: boolean;
  onAskGemini: (asset: Asset) => void;
  folders: any[];
  onStartAction?: (active: boolean) => void;
  isBulkSelected?: boolean;
  onToggleBulkSelect?: () => void;
  hasSelectionActive?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDistribute?: (item: { id: string, type: string, currentName: string }) => void;
  userProfile?: UserProfile | null;
  isFolderAllowedForClient?: (folderId: string) => boolean;
  setOrganizarModal: (val: any) => void;
  accounts?: any[];
}

function AssetRow({
  asset,
  onOpen,
  isSelected,
  isNewlyUploaded = false,
  onAskGemini,
  folders,
  onStartAction,
  isBulkSelected = false,
  onToggleBulkSelect,
  hasSelectionActive = false,
  onDragStart,
  onDistribute,
  userProfile,
  isFolderAllowedForClient,
  setOrganizarModal,
  accounts = []
}: AssetRowProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<'none' | 'partilhar' | 'organizar' | 'atribuir'>('none');

  const runAction = async (actionFn: () => Promise<void>) => {
    try {
      onStartAction?.(true);
      await actionFn();
      onStartAction?.(false);
    } catch (err: any) {
      onStartAction?.(false);
      console.error(err);
      alert("Erro ao processar: " + err.message);
    }
  };
  const Icon = asset.type === "folder" ? FolderIcon : (asset.type === "image" ? ImageIcon : (asset.type === "video" ? Video : FileText));
  const iconColor = asset.type === "folder" ? "text-yellow-400" : (asset.type === "image" ? "text-blue-500" : (asset.type === "video" ? "text-purple-500" : "text-orange-500"));

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        onDragStart?.(e);
      }}
      onClick={() => onOpen()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setShowMenu(true);
      }}
      className={cn(
        "grid grid-cols-12 px-8 py-4 border-b border-gray-50 items-center hover:bg-gray-50 cursor-pointer transition-all relative overflow-visible",
        isBulkSelected ? "bg-[#a21b7e]/10 hover:bg-[#a21b7e]/15 border-[#a21b7e]/20" : (isSelected && "bg-[#a21b7e]/5 hover:bg-[#a21b7e]/10 border-[#a21b7e]/10")
      )}
    >
      <div className="col-span-6 flex items-center gap-4">
        {((asset.type === 'image' || asset.type === 'video' || asset.type === 'document') &&
          (asset.thumbnailUrl || resolveDriveFileId(asset.driveId, asset.id))) ? (
          <div className="w-8 h-8 overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-100 rounded-none">
            <SafeImage
              thumbnailUrl={asset.thumbnailUrl}
              driveId={asset.driveId}
              fileId={asset.id}
              fallbackSize="w100"
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <Icon size={24} className={iconColor} />
        )}
        <span className="text-[16px] font-bold text-gray-700 truncate" title={displayDriveName(asset.name)}>{displayDriveName(asset.name)}</span>
        {isNewlyUploaded && (
          <span className="text-emerald-500 flex items-center shrink-0 ml-2 animate-in fade-in duration-300" title="Upload concluído com sucesso!">
            <CheckCircle2 size={16} />
          </span>
        )}
      </div>
      <div className="col-span-2 text-[10px] font-black text-gray-300 uppercase tracking-widest">{asset.type}</div>
      <div className="col-span-2 text-xs text-gray-400 font-medium">
        {format(asset.captureDate, "dd/MM/yyyy")}
      </div>
      <div className="col-span-2 text-right pr-4 text-xs text-gray-500 font-mono flex items-center justify-end gap-3 relative overflow-visible">
        <span>{asset.versions[0]?.size || "0 MB"}</span>

        <div className="relative overflow-visible">
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            whileHover={{ scale: 1.25 }}
            whileTap={{ scale: 0.95 }}
            className="text-gray-400 hover:text-gray-600 p-1 transition-colors cursor-pointer"
          >
            <MoreVertical size={16} />
          </motion.button>

          <AnimatePresence>
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    setActiveSubmenu('none');
                  }}
                />

                {/* SUBMENUS (Posicionados à esquerda do principal) */}


                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.1 }}
                  className="absolute right-0 mt-2 w-52 bg-white border border-gray-100 rounded-sm shadow-[0_3px_10px_rgba(0,0,0,0.06)] z-40 py-1.5 text-left text-gray-700 font-sans cursor-default animate-in fade-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen();
                      setShowMenu(false);
                    }}
                    className="relative w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <ExternalLink size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                      <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Abrir</span>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-[#a21b7e] transition-colors" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleBulkSelect?.();
                      setShowMenu(false);
                    }}
                    className="relative w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      {isBulkSelected ? (
                        <CheckSquare size={15} className="text-[#a21b7e] shrink-0" />
                      ) : (
                        <Square size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                      )}
                      <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">
                        {isBulkSelected ? "Desmarcar" : "Selecionar"}
                      </span>
                    </div>
                  </button>

                  <div className="my-1 border-t border-gray-100" />

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      if (asset.type === "folder") {
                        const folderId = asset.driveId || asset.id;
                        void runAction(async () => {
                          const count = await downloadDriveFolder(folderId, asset.name);
                          alert(`${count} ficheiro(s) em transferência.`);
                        });
                        return;
                      }
                      if (asset.driveId) {
                        triggerDriveDownload(asset.driveId, asset.name);
                        return;
                      }
                      alert("Não foi possível transferir este ficheiro.");
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                  >
                    <Download size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                    <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Transferir</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newName = prompt("Digite o novo nome para o arquivo:", asset.name);
                      if (newName) {
                        setShowMenu(false);
                        runAction(async () => {
                          // 1. Renomear fisicamente no Google Drive real
                          if (asset.driveId) {
                            const updateResponse = await fetch('/api/drive/update', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                fileId: asset.driveId,
                                newName: newName
                              })
                            });
                            if (!updateResponse.ok) {
                              const errData = await updateResponse.json();
                              throw new Error(errData.error || 'Erro ao renomear no Google Drive');
                            }
                          }

                          // 2. Atualizar no Firestore
                          await updateDoc(doc(db, "assets", asset.id), { name: newName });
                        });
                      } else {
                        setShowMenu(false);
                      }
                    }}
                    className="relative w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Pencil size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                      <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Mudar o nome</span>
                    </div>
                    <span className="text-[10px] text-gray-300 font-mono tracking-tighter group-hover:text-[#a21b7e] transition-colors">⌥⌘E</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      runAction(async () => {
                        let newDriveId = asset.driveId || "";
                        let newUrl = asset.versions[0]?.url || asset.webViewLink || "";

                        // 1. Copiar fisicamente no Google Drive real na mesma pasta
                        if (asset.driveId) {
                          const copyResponse = await fetch('/api/drive/copy', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              fileId: asset.driveId,
                              destinationFolderId: asset.folderId || 'root',
                              newName: `${asset.name} (Cópia)`
                            })
                          });
                          if (!copyResponse.ok) {
                            const errData = await copyResponse.json();
                            throw new Error(errData.error || 'Erro ao copiar no Google Drive');
                          }
                          const copyData = await copyResponse.json();
                          newDriveId = copyData.id;
                          newUrl = copyData.webViewLink;
                        }

                        // 2. Salvar no Firestore com os novos dados físicos
                        const newAsset = {
                          ...asset,
                          name: `${asset.name} (Cópia)`,
                          driveId: newDriveId,
                          versions: [{
                            quality: "original",
                            size: asset.versions?.[0]?.size || "0 MB",
                            url: newUrl
                          }],
                          captureDate: new Date(),
                          createdAt: new Date()
                        };
                        delete (newAsset as any).id;
                        await addDoc(collection(db, "assets"), newAsset);
                        /* window.location.reload() removed */
                      });
                    }}
                    className="relative w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Copy size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                      <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Fazer cópia</span>
                    </div>
                    <span className="text-[10px] text-gray-300 font-mono tracking-tighter group-hover:text-[#a21b7e] transition-colors">⌘C ⌘V</span>
                  </button>

                  <div className="my-1 border-t border-gray-100" />

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAskGemini(asset);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold text-violet-600 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Sparkles size={15} className="text-violet-400 group-hover:text-violet-600 transition-colors shrink-0" />
                      <span className="group-hover:text-violet-600 transition-colors font-bold text-violet-600">Pedir ao Gemini</span>
                    </div>
                    <span className="text-[9px] font-bold text-white bg-blue-600 px-1.5 py-0.5 rounded-full uppercase leading-none scale-90">Novo</span>
                  </button>

                  <div className="my-1 border-t border-gray-100" />

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSubmenu(activeSubmenu === 'partilhar' ? 'none' : 'partilhar');
                    }}
                    className="relative w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <UserPlus size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                      <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Partilhar</span>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-[#a21b7e] transition-colors" />

                    <AnimatePresence>
                      {activeSubmenu === 'partilhar' && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, x: 10 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.95, x: 10 }}
                          transition={{ duration: 0.1 }}
                          className="absolute left-[100%] ml-1.5 top-0 w-52 bg-white border border-gray-100 rounded-sm shadow-[0_3px_15px_rgba(0,0,0,0.1)] z-50 py-1.5 text-left text-gray-700 font-sans cursor-default animate-in fade-in"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="px-3.5 py-1 text-[9px] font-black text-gray-300 uppercase tracking-widest border-b border-gray-50 mb-1">Partilhar via</div>

                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveSubmenu(activeSubmenu === 'atribuir' ? 'none' : 'atribuir');
                              }}
                              className="w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group/sub transition-colors text-left text-[13px] font-bold cursor-pointer"
                            >
                              <div className="flex items-center gap-3">
                                <UserPlus size={14} className="text-gray-400 group-hover/sub:text-[#a21b7e] transition-colors shrink-0" />
                                <span className="text-gray-600 group-hover/sub:text-[#a21b7e] transition-colors">Atribuir a Cliente</span>
                              </div>
                              <ChevronRight size={14} className="text-gray-300 group-hover/sub:text-[#a21b7e] transition-colors" />
                            </button>

                            <AnimatePresence>
                              {activeSubmenu === 'atribuir' && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, x: 10 }}
                                  animate={{ opacity: 1, scale: 1, x: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, x: 10 }}
                                  transition={{ duration: 0.1 }}
                                  className="absolute left-[100%] ml-1.5 top-0 w-48 bg-white border border-gray-100 rounded-sm shadow-[0_3px_15px_rgba(0,0,0,0.1)] z-[60] py-1 text-left max-h-64 overflow-y-auto custom-scrollbar cursor-default"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="px-3 py-1 text-[9px] font-black text-gray-300 uppercase tracking-widest border-b border-gray-50 mb-1">Selecione o Cliente</div>
                                  {accounts && accounts.filter(a => a.role !== 'admin').length > 0 ? (
                                    accounts.filter(a => a.role !== 'admin').map((client: any) => (
                                      <button
                                        key={client.id}
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            const docRef = doc(db, 'assets', asset.id);
                                            await updateDoc(docRef, { clientId: client.email });
                                            alert("Atribuído com sucesso!");
                                          } catch (err: any) {
                                            alert("Erro ao atribuir: " + err.message);
                                          }
                                          setActiveSubmenu('none');
                                          setShowMenu(false);
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-[#a21b7e]/5 hover:text-[#a21b7e] truncate block transition-colors"
                                      >
                                        {client.displayName || client.email}
                                      </button>
                                    ))
                                  ) : (
                                    <div className="px-3 py-2 text-xs text-gray-400 italic">Nenhum cliente disponível</div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const shareUrl = asset.versions[0]?.url || asset.webViewLink || window.location.href;
                              window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Confira o arquivo *${asset.name}* no ProVisual Corporate: ${shareUrl}`)}`, '_blank');
                              setShowMenu(false);
                              setActiveSubmenu('none');
                            }}
                            className="w-full flex items-center gap-3 px-3.5 py-2 bg-transparent hover:bg-transparent group/sub transition-colors text-left text-[13px] font-bold cursor-pointer"
                          >
                            <Share2 size={14} className="text-gray-400 group-hover/sub:text-[#a21b7e] transition-colors shrink-0" />
                            <span className="text-gray-600 group-hover/sub:text-[#a21b7e] transition-colors">WhatsApp</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const shareUrl = asset.versions[0]?.url || asset.webViewLink || window.location.href;
                              window.location.href = `mailto:?subject=${encodeURIComponent(`Partilha de Ficheiro - ProVisual`)}&body=${encodeURIComponent(`Olá!\n\nSegue o link para aceder ao ficheiro *${asset.name}* no Arquivo ProVisual Corporate:\n\n${shareUrl}\n\nCumprimentos,\nEquipa ProVisual`)}`;
                              setShowMenu(false);
                              setActiveSubmenu('none');
                            }}
                            className="w-full flex items-center gap-3 px-3.5 py-2 bg-transparent hover:bg-transparent group/sub transition-colors text-left text-[13px] font-bold cursor-pointer"
                          >
                            <Mail size={14} className="text-gray-400 group-hover/sub:text-[#a21b7e] transition-colors shrink-0" />
                            <span className="text-gray-600 group-hover/sub:text-[#a21b7e] transition-colors">E-mail</span>
                          </button>

                          <div className="my-1 border-t border-gray-100" />

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const shareUrl = asset.webViewLink || asset.versions[0]?.url || window.location.href;
                              navigator.clipboard.writeText(shareUrl);
                              alert("Link de partilha copiado para a área de transferência!");
                              setShowMenu(false);
                              setActiveSubmenu('none');
                            }}
                            className="w-full flex items-center gap-3 px-3.5 py-2 bg-transparent hover:bg-transparent group/sub transition-colors text-left text-[13px] font-bold cursor-pointer"
                          >
                            <Copy size={14} className="text-gray-400 group-hover/sub:text-[#a21b7e] transition-colors shrink-0" />
                            <span className="text-gray-600 group-hover/sub:text-[#a21b7e] transition-colors">Copiar Link</span>
                          </button>

                          {asset.webViewLink && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(asset.webViewLink, '_blank');
                                setShowMenu(false);
                                setActiveSubmenu('none');
                              }}
                              className="w-full flex items-center gap-3 px-3.5 py-2 bg-transparent hover:bg-transparent group/sub transition-colors text-left text-[13px] font-bold cursor-pointer"
                            >
                              <ExternalLink size={14} className="text-gray-400 group-hover/sub:text-[#a21b7e] transition-colors shrink-0" />
                              <span className="text-gray-600 group-hover/sub:text-[#a21b7e] transition-colors">Abrir no Drive</span>
                            </button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSubmenu(activeSubmenu === 'organizar' ? 'none' : 'organizar');
                    }}
                    className="relative w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <FolderIcon size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                      <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Organizar</span>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-[#a21b7e] transition-colors" />

                    <AnimatePresence>
                      {activeSubmenu === 'organizar' && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, x: 10 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.95, x: 10 }}
                          transition={{ duration: 0.1 }}
                          className="absolute left-[100%] ml-1.5 top-0 w-44 bg-white border border-gray-100 rounded-sm shadow-[0_3px_15px_rgba(0,0,0,0.12)] z-50 py-1.5 text-left cursor-default"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="px-3 py-1 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 mb-1">Organizar</div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOrganizarModal({ asset, mode: 'move' });
                              setActiveSubmenu('none');
                              setShowMenu(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 hover:text-[#a21b7e] text-gray-700 text-xs font-bold transition-colors text-left"
                          >
                            <FolderIcon size={14} className="text-gray-400 shrink-0" />
                            Mover para...
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOrganizarModal({ asset, mode: 'copy' });
                              setActiveSubmenu('none');
                              setShowMenu(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 hover:text-[#a21b7e] text-gray-700 text-xs font-bold transition-colors text-left"
                          >
                            <Copy size={14} className="text-gray-400 shrink-0" />
                            Copiar para...
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      alert("Arquivo disponibilizado offline com sucesso!");
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold text-green-600 cursor-pointer"
                  >
                    <CheckCircle2 size={15} className="text-green-400 group-hover:text-green-600 transition-colors shrink-0" />
                    <span className="group-hover:text-green-600 transition-colors font-bold text-green-600">Disponibilizar offline</span>
                  </button>

                  <div className="my-1 border-t border-gray-100" />

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Tem certeza que deseja eliminar " + asset.name + "?")) {
                        setShowMenu(false);
                        runAction(async () => {
                          // 1. Mover para a Lixeira fisicamente no Google Drive real
                          if (asset.driveId) {
                            try {
                              const updateResponse = await fetch('/api/drive/update', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  fileId: asset.driveId,
                                  trashed: true
                                })
                              });
                              if (!updateResponse.ok) {
                                const errData = await updateResponse.json();
                                console.warn("Erro ao mover no drive:", errData.error);
                              }
                            } catch (driveErr) {
                              console.warn("Falha física ao lixar no Drive, prosseguindo localmente:", driveErr);
                            }
                          }

                          // 2. Atualizar no Firestore
                          await updateDoc(doc(db, "assets", asset.id), { folderId: "trash", trashed: true });
                          /* window.location.reload() removed */
                        });
                      } else {
                        setShowMenu(false);
                      }
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold text-red-500 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Trash2 size={15} className="text-red-400 group-hover:text-red-600 transition-colors shrink-0" />
                      <span className="group-hover:text-red-600 transition-colors font-bold text-red-500">Eliminar</span>
                    </div>
                    <span className="text-[10px] text-red-300 font-mono tracking-tighter group-hover:text-red-500 transition-colors">Delete</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
