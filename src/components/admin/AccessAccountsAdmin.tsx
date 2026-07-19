import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react";
import { cn, filterAccountsForViewer } from "../../lib/utils";
import {
  createAdminAccount,
  deleteAdminAccount,
  fetchAdminAccounts,
  updateAdminAccount,
} from "../../lib/siteGalleryApi";
import { ADMIN_CACHE_KEYS, readAdminCache } from "../../lib/siteAdminCache";
import type { AdminNavState } from "./AdminBreadcrumb";
import AdminToolbarSearch from "./AdminToolbarSearch";
import { parseAccountDisplay } from "../../lib/accountDisplay";
import AccountAvatar from "../AccountAvatar";

function generateStrongPassword() {
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
  for (let i = 0; i < 6; i++) {
    pass += allChars[Math.floor(Math.random() * allChars.length)];
  }
  return pass.split("").sort(() => 0.5 - Math.random()).join("");
}

/** Evita carregar logos base64 gigantes na tabela (causa ecrã branco / freeze). */
function normalizeAccountRow(row: Record<string, unknown>) {
  const fullDisplayName = String(row.displayName || row.display_name || "");
  const parsed = parseAccountDisplay(fullDisplayName);
  return {
    id: String(row.id ?? ""),
    email: String(row.email ?? ""),
    password: String(row.password ?? ""),
    role: String(row.role ?? "cliente"),
    clientId: String(row.clientId || row.client_id || row.id || ""),
    displayNameFull: fullDisplayName,
    displayName: `${parsed.responsible}|${parsed.companyName}|`,
    responsible: parsed.responsible,
    companyName: parsed.companyName,
  };
}

interface AccessAccountsAdminProps {
  isActive?: boolean;
  viewerProfile?: { email?: string; id?: string; uid?: string; displayName?: string } | null;
  onToolbarChange?: (actions: React.ReactNode) => void;
  onNavChange?: (state: AdminNavState) => void;
}

function loadAccountsFromCache() {
  const cached = readAdminCache<Record<string, unknown>[]>(ADMIN_CACHE_KEYS.accounts);
  if (!cached?.length) return { accounts: [] as ReturnType<typeof normalizeAccountRow>[], loaded: false };
  return {
    accounts: cached.map((row) => normalizeAccountRow(row)),
    loaded: true,
  };
}

export default function AccessAccountsAdmin({
  isActive = true,
  viewerProfile = null,
  onToolbarChange,
  onNavChange,
}: AccessAccountsAdminProps) {
  const initial = loadAccountsFromCache();
  const [accounts, setAccounts] = useState<ReturnType<typeof normalizeAccountRow>[]>(initial.accounts);
  const [accountsLoaded, setAccountsLoaded] = useState(initial.loaded);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ReturnType<typeof normalizeAccountRow> | null>(null);
  const [newAccountEmail, setNewAccountEmail] = useState("");
  const [newAccountResponsible, setNewAccountResponsible] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountLogo, setNewAccountLogo] = useState("");
  const [newAccountPassword, setNewAccountPassword] = useState("");
  const [newAccountRole, setNewAccountRole] = useState<"admin" | "cliente">("cliente");
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  const reloadAccounts = useCallback(async (options?: { force?: boolean }) => {
    if (!options?.force) {
      const cached = readAdminCache<Record<string, unknown>[]>(ADMIN_CACHE_KEYS.accounts);
      if (cached?.length) {
        setAccounts(cached.map((row) => normalizeAccountRow(row)));
        setAccountsLoaded(true);
      }
    }
    try {
      const accountsList = await fetchAdminAccounts({ force: options?.force });
      setAccounts(accountsList.map((row) => normalizeAccountRow(row)));
      setAccountsLoaded(true);
      setAccountError(null);
    } catch (error: unknown) {
      console.error("Accounts read error:", error);
      if (!accounts.length) {
        setAccountError(
          error instanceof Error ? error.message : "Erro ao carregar contas de acesso.",
        );
      }
      setAccountsLoaded(true);
    }
  }, [accounts.length]);

  useEffect(() => {
    reloadAccounts();
  }, [reloadAccounts]);

  useEffect(() => {
    if (!onNavChange || !isActive) return;
    onNavChange({
      crumbs: [{ label: "Gestão do Site" }, { label: "Contas de Acesso" }],
    });
  }, [onNavChange, isActive]);

  const visibleAccounts = useMemo(
    () => filterAccountsForViewer(accounts, viewerProfile),
    [accounts, viewerProfile],
  );

  const filteredAccounts = useMemo(() => {
    if (!searchQuery) return visibleAccounts;
    const q = searchQuery.toLowerCase();
    return visibleAccounts.filter((account) => {
      const name = `${account.responsible} ${account.companyName}`.toLowerCase();
      const email = account.email.toLowerCase();
      const clientId = account.clientId.toLowerCase();
      return name.includes(q) || email.includes(q) || clientId.includes(q);
    });
  }, [visibleAccounts, searchQuery]);

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

  const openAddForm = () => {
    setEditingAccount(null);
    setAccountError(null);
    setAccountSuccess(null);
    setNewAccountEmail("");
    setNewAccountResponsible("");
    setNewAccountName("");
    setNewAccountLogo("");
    setNewAccountPassword(generateStrongPassword());
    setNewAccountRole("cliente");
    setIsAddAccountModalOpen(true);
  };

  useEffect(() => {
    if (!onToolbarChange || !isActive) return;
    if (isAddAccountModalOpen) {
      onToolbarChange(null);
      return;
    }
    onToolbarChange(
      <>
        <AdminToolbarSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Pesquisar contas..."
        />
        <button
          type="button"
          onClick={openAddForm}
          className="flex flex-1 md:flex-none items-center justify-center gap-2 bg-[#a21b7e] hover:bg-[#8e176e] text-white px-4 py-2 rounded-sm text-sm font-bold shadow-sm transition-all cursor-pointer h-10"
        >
          <UserPlus size={16} />
          Criar Conta de Acesso
        </button>
      </>,
    );
    return () => onToolbarChange(null);
  }, [onToolbarChange, isAddAccountModalOpen, isActive, searchQuery]);

  const openEditForm = (account: ReturnType<typeof normalizeAccountRow>) => {
    const parsed = parseAccountDisplay(account.displayNameFull);
    setEditingAccount(account);
    setNewAccountEmail(account.email);
    setNewAccountResponsible(parsed.responsible);
    setNewAccountName(parsed.companyName);
    setNewAccountLogo(parsed.logo);
    setNewAccountPassword(account.password || "");
    setNewAccountRole((account.role as "admin" | "cliente") || "cliente");
    setAccountError(null);
    setAccountSuccess(null);
    setIsAddAccountModalOpen(true);
  };

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
          setNewAccountLogo(canvas.toDataURL("image/jpeg", 0.7));
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
      let nextAccounts: Awaited<ReturnType<typeof fetchAdminAccounts>>;
      if (editingAccount) {
        nextAccounts = await updateAdminAccount(editingAccount.id, {
          email: newAccountEmail.trim().toLowerCase(),
          displayName: displayNameValue,
          password: newAccountPassword,
          role: newAccountRole,
        });
        setAccountSuccess("Conta de acesso editada com sucesso!");
      } else {
        const emailExists = accounts.some(
          (acc) => acc.email.toLowerCase() === newAccountEmail.trim().toLowerCase(),
        );
        if (emailExists) {
          setAccountError("Este e-mail já está cadastrado.");
          setIsCreatingAccount(false);
          return;
        }

        const generatedUid = "client_" + Math.random().toString(36).substring(2, 11);
        nextAccounts = await createAdminAccount({
          email: newAccountEmail.trim().toLowerCase(),
          displayName: displayNameValue,
          password: newAccountPassword,
          role: newAccountRole,
          clientId: generatedUid,
        });
        setAccountSuccess("Conta de acesso criada com sucesso!");
      }

      setAccounts(nextAccounts.map((row) => normalizeAccountRow(row)));
      setTimeout(handleCloseAccountModal, 1500);
    } catch (err: unknown) {
      console.error("Erro ao salvar conta:", err);
      const message = err instanceof Error ? err.message : String(err);
      setAccountError(`Erro no banco de dados ao salvar a conta: ${message}`);
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleDeleteAccount = async (accountId: string, accountName: string) => {
    const confirmDelete = window.confirm(`Tem certeza que deseja excluir a conta de "${accountName}"?`);
    if (!confirmDelete) return;

    try {
      const nextAccounts = await deleteAdminAccount(accountId);
      setAccounts(nextAccounts.map((row) => normalizeAccountRow(row)));
    } catch (err) {
      console.error("Erro ao excluir conta:", err);
      alert("Erro ao excluir conta.");
    }
  };

  const accountModal =
    isAddAccountModalOpen && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-lg border border-gray-100 shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-[#a21b7e] p-6 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <UserPlus size={20} />
                    {editingAccount ? "Editar Conta de Acesso" : "Nova Conta de Acesso"}
                  </h3>
                  <p className="text-xs text-white/80 mt-0.5">
                    {editingAccount
                      ? "Atualize as credenciais de acesso do seu cliente."
                      : "Defina as credenciais para o seu cliente."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseAccountModal}
                  className="p-1 hover:bg-white/10 rounded text-white/80 hover:text-white cursor-pointer"
                  aria-label="Fechar"
                >
                  <Plus className="rotate-45" size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveAccount} className="p-6 space-y-3">
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

                <div className="flex gap-2 items-stretch">
                  <div className="flex-1 flex flex-col gap-2 justify-center">
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
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                <input
                  type="email"
                  placeholder="Email de acesso"
                  value={newAccountEmail}
                  onChange={(e) => setNewAccountEmail(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#a21b7e] transition-all bg-gray-50"
                  required
                />

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
                    onClick={() => setNewAccountPassword(generateStrongPassword())}
                    className="px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-xs font-bold transition-all cursor-pointer border border-gray-200 shrink-0"
                  >
                    Gerar Senha
                  </button>
                </div>

                <select
                  value={newAccountRole}
                  onChange={(e) => setNewAccountRole(e.target.value as "admin" | "cliente")}
                  className="block w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#a21b7e] transition-all bg-gray-50"
                >
                  <option value="cliente">Cliente (Acesso de visualização de arquivos)</option>
                  <option value="admin">Administrador (Gestão completa do portal)</option>
                </select>

                <div className="flex gap-2 pt-4 border-t border-gray-200">
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
                    {isCreatingAccount
                      ? "A salvar..."
                      : editingAccount
                        ? "Salvar Alterações"
                        : "Criar Conta de Acesso"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="space-y-6 min-h-[420px]">
      {accountError && !isAddAccountModalOpen && (
        <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{accountError}</span>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Nome da Empresa</th>
                <th className="px-4 py-3">E-mail de Acesso</th>
                <th className="px-4 py-3">Senha de Acesso</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {!accountsLoaded ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={18} className="animate-spin text-[#a21b7e]" />
                      A carregar contas...
                    </span>
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400 italic">
                    {searchQuery
                      ? "Nenhuma conta corresponde à sua pesquisa."
                      : 'Nenhuma conta cadastrada no portal. Clique em "Criar Conta de Acesso" para começar!'}
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      <div className="flex items-center gap-3">
                        <AccountAvatar
                          size="md"
                          displayName={account.displayNameFull}
                          email={account.email}
                        />
                        <span className="font-bold text-gray-800">{account.responsible || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {account.companyName || "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-600">
                      <span className="flex items-center gap-2 mt-1 select-all">
                        <Mail size={14} className="text-gray-400" />
                        {account.email}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-800">
                      <span className="bg-gray-100 border border-gray-200 px-2.5 py-1 rounded text-xs select-all">
                        {account.password || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                          account.role === "admin"
                            ? "bg-purple-50 text-[#a21b7e] border border-purple-100"
                            : "bg-blue-50 text-blue-600 border border-blue-100",
                        )}
                      >
                        {account.role === "admin" ? "Administrador" : "Cliente"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(account)}
                        className="p-2 bg-purple-50 hover:bg-purple-100 text-[#a21b7e] rounded-md transition-all cursor-pointer inline-flex items-center justify-center border border-purple-100"
                        title="Editar Conta"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAccount(account.id, account.companyName || account.email)}
                        className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-md transition-all cursor-pointer inline-flex items-center justify-center border border-red-100"
                        title="Excluir Conta"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {accountModal}
    </div>
  );
}
