import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Eye, EyeOff, HelpCircle, Phone, Mail, MessageSquare, ExternalLink, Home } from "lucide-react";
import { cn } from "../lib/utils";
import { supabase, db } from "../lib/supabase";
import {
  fetchLoginProfiles,
  prefetchLoginProfiles,
  readLoginProfilesCache,
  upsertLoginProfileCache,
} from "../lib/loginProfilesCache";
import { prefetchAdminPanelData } from "../lib/siteGalleryApi";

import { doc, setDoc, getDoc, serverTimestamp } from "../lib/supabase";
import simboloImg from "../Logo/Simbolo.png";

function normalizeLoginIdentifier(value: string) {
  return value.trim().toLowerCase();
}

const MASTER_ADMIN_EMAIL = "silva.chamo@gmail.com";
const MASTER_ADMIN_PASSWORD = "SilvaPro#2026";

function normalizeUserProfile(row: Record<string, unknown> | null | undefined) {
  if (!row) return null;
  return {
    id: String(row.id ?? ""),
    email: String(row.email ?? ""),
    password: String(row.password ?? ""),
    role: String(row.role ?? "cliente"),
    displayName: String(row.display_name || row.displayName || row.email || ""),
  };
}

function matchesAccountIdentifier(userData: Record<string, unknown>, identifier: string) {
  const search = normalizeLoginIdentifier(identifier);
  if (!search) return false;

  const email = String(userData.email || "").toLowerCase();
  if (email === search) return true;

  const emailPrefix = email.split("@")[0];
  if (emailPrefix === search || emailPrefix.includes(search)) return true;

  const displayName = String(userData.display_name || userData.displayName || "");
  const parts = displayName.split("|");
  const responsible = parts[0]?.trim().toLowerCase() || "";
  const company = parts[1]?.trim().toLowerCase() || "";

  if (responsible && (responsible === search || responsible.includes(search))) return true;
  if (company && (company === search || company.includes(search))) return true;

  const plainName = displayName.replace(/\|/g, " ").trim().toLowerCase();
  if (plainName && (plainName === search || plainName.includes(search))) return true;

  return false;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showSupport, setShowSupport] = useState(false);

  useEffect(() => {
    prefetchLoginProfiles();
    prefetchAdminPanelData();

    if (sessionStorage.getItem("prov_master_provisioned_v1")) return;

    const timer = window.setTimeout(() => {
      const provisionAdmin = async () => {
        try {
          const adminDocRef = doc(db, "users", "admin_master_silva");
          const adminDoc = await getDoc(adminDocRef);
          const existing = adminDoc.exists() ? adminDoc.data() : null;
          // Só cria a conta master se ainda não existir. Nunca repõe a
          // password sobre uma conta já existente — o dono do site tem de
          // poder mudar a password livremente sem ela reverter sozinha.
          if (!existing) {
            await setDoc(adminDocRef, {
              email: MASTER_ADMIN_EMAIL,
              displayName: "Silva Chamo (Admin Master)",
              password: MASTER_ADMIN_PASSWORD,
              role: "admin",
              adminToken: "Silva_Chamo_Master_Admin_2026",
              createdAt: serverTimestamp(),
            });
          }
          sessionStorage.setItem("prov_master_provisioned_v1", "1");
        } catch (err) {
          console.warn("Erro ao auto-provisionar administrador master:", err);
        }
      };
      provisionAdmin();
    }, 2500);

    return () => window.clearTimeout(timer);
  }, []);

  const completeCorporateLogin = (userData: NonNullable<ReturnType<typeof normalizeUserProfile>>) => {
    const simulatedUser = {
      uid: userData.id,
      email: userData.email,
      displayName: userData.displayName || userData.email.split("@")[0],
      role: userData.role || "cliente",
    };
    localStorage.setItem("provisual_local_admin", JSON.stringify(simulatedUser));
    if (simulatedUser.role === "admin") {
      prefetchAdminPanelData();
    }
    window.location.href = simulatedUser.role === "admin" ? "/dashboard" : "/arquivo";
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (isSignUp) {
        const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });
        if (authErr) throw authErr;
        const user = authData.user;

        if (user) {
          await setDoc(doc(db, "users", user.id), {
            email: user.email,
            role: "admin",
            createdAt: serverTimestamp(),
            adminToken: "Silva_Chamo_Master_Admin_2026",
          });
        }
        return;
      }

      const identifier = email.trim();
      const pwd = password.trim();
      const looksLikeEmail = identifier.includes("@");

      const cachedProfiles = readLoginProfilesCache();
      if (cachedProfiles?.length) {
        const cachedMatch = looksLikeEmail
          ? cachedProfiles.find((p) => p.email === identifier.toLowerCase())
          : cachedProfiles.find((p) => matchesAccountIdentifier(p, identifier));
        if (cachedMatch) {
          if (cachedMatch.password === pwd) {
            completeCorporateLogin(normalizeUserProfile(cachedMatch)!);
            return;
          }
          setError("Senha de acesso incorreta para esta conta.");
          setIsLoading(false);
          return;
        }
      }

      if (looksLikeEmail) {
        const { data, error: dbErr } = await supabase
          .from("user_profiles")
          .select("id,email,password,role,display_name")
          .eq("email", identifier.toLowerCase())
          .maybeSingle();
        if (dbErr) throw dbErr;

        if (data) {
          upsertLoginProfileCache(data as Record<string, unknown>);
          const userData = normalizeUserProfile(data as Record<string, unknown>);
          if (userData?.password === pwd) {
            completeCorporateLogin(userData);
            return;
          }
          setError("Senha de acesso incorreta para esta conta.");
          setIsLoading(false);
          return;
        }

        setError("Esta conta de e-mail não está cadastrada na plataforma.");
        setIsLoading(false);
        return;
      }

      const profiles = await fetchLoginProfiles();
      const profileRow =
        profiles.find((profile) => matchesAccountIdentifier(profile, identifier)) || null;
      const userData = normalizeUserProfile(profileRow);

      if (!userData) {
        setError("Esta conta não está cadastrada na plataforma.");
        setIsLoading(false);
        return;
      }

      if (userData.password !== pwd) {
        setError("Senha de acesso incorreta para esta conta.");
        setIsLoading(false);
        return;
      }

      completeCorporateLogin(userData);
    } catch (dbErr: any) {
      console.error("Erro ao verificar credenciais:", dbErr);
      setError(`Erro ao validar credenciais no banco: ${dbErr.message || dbErr}`);
      setIsLoading(false);
    }
  };



  return (
    <div className="flex min-h-screen font-sans bg-white">
      {/* Left side - Branding Section */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#a21b7e] flex-col items-center justify-center text-white px-12 relative overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center z-10"
        >
          <div className="relative inline-block mx-auto mb-8">
            <div className="w-32 h-32 rounded-full border-2 border-white/30 flex items-center justify-center bg-white/10 backdrop-blur-sm mx-auto shadow-2xl p-4">
              <img src={simboloImg} alt="ProVisual Simbolo" className="w-full h-full object-contain" />
            </div>
          </div>
          <h1 className="text-6xl font-bold mb-4 tracking-tight">ProVisual Corporate</h1>
          <p className="text-xl font-medium max-w-md mx-auto leading-relaxed text-center">
            Bem-vindo ao portal corporativo de ativos visuais da ProVisual Corporate.
          </p>
          <div className="flex justify-center mt-5 mb-12">
            <Link
              to="/"
              className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/40 text-white hover:bg-white/10 transition-colors"
              aria-label="Voltar à página inicial"
              title="Página inicial"
            >
              <Home size={18} />
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-[#fafafa]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="border border-gray-200 p-8 md:p-10 rounded-2xl bg-white shadow-md transition-all duration-300">
            {!showSupport ? (
              <form onSubmit={handleEmailAuth} className="space-y-6 animate-fade-in">
                {error && (
                  <div className="bg-red-50 text-red-600 p-3 text-xs font-bold border border-red-100">
                    {error}
                  </div>
                )}

                {successMessage && (
                  <div className="bg-green-50 text-green-600 p-3 text-xs font-bold border border-green-100 mb-4">
                    {successMessage}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-2 ml-1" htmlFor="email">
                    {isSignUp ? "EMAIL" : "EMAIL, RESPONSÁVEL OU EMPRESA"}
                  </label>
                  <input
                    id="email"
                    type={isSignUp ? "email" : "text"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={isSignUp ? "seu@email.com" : "email, responsável ou empresa"}
                    className="w-full h-12 bg-gray-50 border border-gray-100 px-4 text-sm text-gray-800 focus:border-[#a21b7e] placeholder:text-gray-300/70 placeholder:font-light transition-all outline-none rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-2 ml-1" htmlFor="password">
                    {isSignUp ? "CRIAR SENHA" : "SENHA DE ACESSO"}
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-12 bg-gray-50 border border-gray-100 px-4 text-sm text-gray-800 focus:border-[#a21b7e] placeholder:text-gray-300/70 placeholder:font-light transition-all outline-none rounded-lg"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                    "w-full h-14 bg-[#a21b7e] text-white text-sm font-bold shadow-lg shadow-[#a21b7e]/20 hover:bg-[#8e176e] active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-widest mt-8 rounded-lg",
                    isLoading && "opacity-80"
                  )}
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    isSignUp ? "Registrar agora" : "Entrar no Console"
                  )}
                </button>

                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => setShowSupport(true)}
                    className="w-full h-12 border border-gray-100 bg-white text-gray-400 hover:text-[#a21b7e] hover:border-[#a21b7e]/20 text-[10px] font-bold uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 rounded-lg mt-3"
                  >
                    <HelpCircle size={14} className="shrink-0 animate-pulse" />
                    <span>Suporte Técnico</span>
                  </button>
                )}
              </form>
            ) : (
              <div className="animate-fade-in flex flex-col items-center">
                {/* Header Icon */}
                <div className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center text-[#a21b7e] mb-4">
                  <HelpCircle size={28} />
                </div>

                <h3 className="text-base font-bold text-gray-800 tracking-tight text-center">Suporte ProVisual</h3>
                <p className="text-[11px] text-gray-400 mt-1.5 mb-6 text-center leading-relaxed px-2">
                  Precisa de ajuda com credenciais ou assistência corporativa? Entre em contato conosco pelos canais abaixo:
                </p>

                <div className="w-full space-y-3">
                  {/* WhatsApp Support */}
                  <a
                    href="https://wa.me/258843131130"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between p-3.5 border border-gray-200/70 bg-[#fafafa]/40 rounded-xl hover:bg-white hover:border-[#a21b7e]/25 hover:shadow-sm active:scale-[0.98] transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-50/80 text-emerald-600 flex items-center justify-center shrink-0">
                        <MessageSquare size={16} />
                      </div>
                      <div className="leading-tight text-left">
                        <div className="text-xs font-bold text-gray-800">WhatsApp Oficial</div>
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">+258 84 313 1130</div>
                      </div>
                    </div>
                    <ExternalLink size={11} className="text-gray-300 group-hover:text-[#a21b7e] transition-colors" />
                  </a>

                  {/* Email Support */}
                  <a
                    href="mailto:suporte@provisualcorporate.co.mz"
                    className="w-full flex items-center justify-between p-3.5 border border-gray-200/70 bg-[#fafafa]/40 rounded-xl hover:bg-white hover:border-[#a21b7e]/25 hover:shadow-sm active:scale-[0.98] transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-50/80 text-blue-600 flex items-center justify-center shrink-0">
                        <Mail size={16} />
                      </div>
                      <div className="leading-tight text-left">
                        <div className="text-xs font-bold text-gray-800">E-mail de Suporte</div>
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">suporte@provisualcorporate.co.mz</div>
                      </div>
                    </div>
                    <ExternalLink size={11} className="text-gray-300 group-hover:text-[#a21b7e] transition-colors" />
                  </a>

                  {/* Phone Contact */}
                  <a
                    href="tel:+258843131130"
                    className="w-full flex items-center justify-between p-3.5 border border-gray-200/70 bg-[#fafafa]/40 rounded-xl hover:bg-white hover:border-[#a21b7e]/25 hover:shadow-sm active:scale-[0.98] transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-purple-50/80 text-[#a21b7e] flex items-center justify-center shrink-0">
                        <Phone size={16} />
                      </div>
                      <div className="leading-tight text-left">
                        <div className="text-xs font-bold text-gray-800">Telefone Corporativo</div>
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">+258 84 313 1130</div>
                      </div>
                    </div>
                    <ExternalLink size={11} className="text-gray-300 group-hover:text-[#a21b7e] transition-colors" />
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSupport(false)}
                  className="mt-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-[#a21b7e] transition-colors active:scale-[0.98]"
                >
                  Voltar ao Login
                </button>
              </div>
            )}
          </div>

          <Link
            to="/"
            className="lg:hidden mt-6 mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#a21b7e]/30 text-[#a21b7e] hover:bg-[#a21b7e]/5 transition-colors"
            aria-label="Voltar à página inicial"
            title="Página inicial"
          >
            <Home size={20} />
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
