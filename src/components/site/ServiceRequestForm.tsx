import { type FormEvent, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import FormAntiSpamFields from "../FormAntiSpamFields";
import {
  formSpamUserMessage,
  recordFormSubmit,
  shouldBlockFormSubmit,
} from "../../lib/formSpamGuard";
import { buildMailtoUrl, SERVICE_REQUEST_EMAIL } from "../../lib/siteContact";

interface ServiceRequestFormProps {
  serviceTitle: string;
  serviceSlug: string;
  onClose: () => void;
}

export default function ServiceRequestForm({ serviceTitle, serviceSlug, onClose }: ServiceRequestFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const formStartedAt = useRef(Date.now());

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const blocked = shouldBlockFormSubmit(
      form,
      formStartedAt.current,
      `service-request-${serviceSlug}`,
    );
    if (blocked) {
      const message = formSpamUserMessage(blocked);
      if (message) setFormNotice(message);
      return;
    }
    setFormNotice(null);

    const data = new FormData(form);

    const institution = String(data.get("instituicao") || "").trim();
    const nif = String(data.get("nif") || "").trim();
    const responsavel = String(data.get("responsavel") || "").trim();
    const cargo = String(data.get("cargo") || "").trim();
    const email = String(data.get("email") || "").trim();
    const telefone = String(data.get("telefone") || "").trim();
    const assunto = String(data.get("assunto") || "").trim();
    const detalhes = String(data.get("detalhes") || "").trim();
    const preferencia = String(data.get("preferencia") || "").trim();
    const horario = String(data.get("horario") || "").trim();

    const subject = assunto || `Solicitação de serviço — ${serviceTitle}`;
    const body = [
      "SOLICITAÇÃO DE SERVIÇO — PROVISUAL CORPORATE",
      "",
      `Serviço: ${serviceTitle} (${serviceSlug})`,
      "",
      "DADOS DA INSTITUIÇÃO",
      `Instituição / Empresa: ${institution}`,
      nif ? `NIF / NUEL: ${nif}` : null,
      "",
      "CONTACTO",
      `Responsável: ${responsavel}`,
      cargo ? `Cargo / Função: ${cargo}` : null,
      `Email: ${email}`,
      `Telefone / WhatsApp: ${telefone}`,
      preferencia ? `Preferência de contacto: ${preferencia}` : null,
      horario ? `Horário preferencial: ${horario}` : null,
      "",
      "DETALHES DA SOLICITAÇÃO",
      detalhes,
      "",
      "---",
      "Enviado via formulário do site ProVisual Corporate.",
    ]
      .filter(Boolean)
      .join("\n");

    recordFormSubmit(`service-request-${serviceSlug}`);
    window.location.href = buildMailtoUrl(SERVICE_REQUEST_EMAIL, subject, body);
    setSubmitted(true);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="solicitacao-servico-titulo"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/90 text-gray-600 flex items-center justify-center hover:bg-white transition-colors shadow-sm"
          aria-label="Fechar formulário"
        >
          <X size={18} />
        </button>

        <div className="bg-[#a21b7e]/[0.06] px-6 md:px-8 pt-6 md:pt-8 pb-5 rounded-t-2xl text-center border-b-2 border-[#a21b7e]">
          <h3 id="solicitacao-servico-titulo" className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
            Solicitar este serviço
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed max-w-xl mx-auto">
            Preencha os dados da sua instituição. A sua solicitação será recebida pela nossa equipa,
            para que possamos entrar em contacto consigo, confirmar o pedido e dar seguimento ao serviço
            solicitado.
          </p>
        </div>

        <div className="p-6 md:p-8 pt-5">
          {submitted ? (
            <p className="text-sm text-gray-600 bg-[#a21b7e]/5 border border-[#a21b7e]/15 rounded-xl px-5 py-4">
              Se o seu cliente de email não abriu automaticamente, envie a mensagem manualmente para{" "}
              <a href={`mailto:${SERVICE_REQUEST_EMAIL}`} className="text-[#a21b7e] hover:underline">
                {SERVICE_REQUEST_EMAIL}
              </a>
              .
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="relative space-y-5">
              <FormAntiSpamFields idPrefix={`service-${serviceSlug}`} />
              <input type="hidden" name="servico" value={serviceTitle} />

              {formNotice && (
                <p className="text-sm text-[#a21b7e] bg-[#a21b7e]/5 border border-[#a21b7e]/15 rounded-xl px-4 py-3" role="status">
                  {formNotice}
                </p>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Instituição / Empresa *
                  </label>
                  <input
                    name="instituicao"
                    required
                    className="w-full h-11 px-4 border border-gray-200 rounded-lg bg-white focus:border-[#a21b7e] outline-none text-sm"
                    placeholder="Nome da instituição ou empresa"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                    NIF / NUEL
                  </label>
                  <input
                    name="nif"
                    className="w-full h-11 px-4 border border-gray-200 rounded-lg bg-white focus:border-[#a21b7e] outline-none text-sm"
                    placeholder="Identificação fiscal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Serviço
                  </label>
                  <input
                    readOnly
                    value={serviceTitle}
                    className="w-full h-11 px-4 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Responsável *
                  </label>
                  <input
                    name="responsavel"
                    required
                    className="w-full h-11 px-4 border border-gray-200 rounded-lg bg-white focus:border-[#a21b7e] outline-none text-sm"
                    placeholder="Nome completo"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Cargo / Função
                  </label>
                  <input
                    name="cargo"
                    className="w-full h-11 px-4 border border-gray-200 rounded-lg bg-white focus:border-[#a21b7e] outline-none text-sm"
                    placeholder="Ex.: Director de Comunicação"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Email institucional *
                  </label>
                  <input
                    name="email"
                    type="email"
                    required
                    className="w-full h-11 px-4 border border-gray-200 rounded-lg bg-white focus:border-[#a21b7e] outline-none text-sm"
                    placeholder="contacto@empresa.co.mz"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Telefone / WhatsApp *
                  </label>
                  <input
                    name="telefone"
                    type="tel"
                    required
                    className="w-full h-11 px-4 border border-gray-200 rounded-lg bg-white focus:border-[#a21b7e] outline-none text-sm"
                    placeholder="+258 84 000 0000"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Assunto *
                  </label>
                  <input
                    name="assunto"
                    required
                    defaultValue={`Solicitação — ${serviceTitle}`}
                    className="w-full h-11 px-4 border border-gray-200 rounded-lg bg-white focus:border-[#a21b7e] outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Preferência de contacto
                  </label>
                  <select
                    name="preferencia"
                    className="w-full h-11 px-4 border border-gray-200 rounded-lg bg-white focus:border-[#a21b7e] outline-none text-sm"
                    defaultValue=""
                  >
                    <option value="">Selecionar</option>
                    <option value="Telefone">Telefone</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Email">Email</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Horário preferencial
                  </label>
                  <input
                    name="horario"
                    className="w-full h-11 px-4 border border-gray-200 rounded-lg bg-white focus:border-[#a21b7e] outline-none text-sm"
                    placeholder="Ex.: Manhã, 09h–12h"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Detalhes da solicitação *
                  </label>
                  <textarea
                    name="detalhes"
                    required
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white focus:border-[#a21b7e] outline-none text-sm resize-none"
                    placeholder="Descreva o projecto, prazos, objectivos e qualquer informação relevante."
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto inline-flex items-center justify-center bg-[#a21b7e] text-white px-8 py-3 rounded-full text-sm font-semibold hover:bg-[#8e176e] transition-colors"
              >
                Enviar solicitação
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
