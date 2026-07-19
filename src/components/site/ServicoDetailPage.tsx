import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SiteShell from "./SiteShell";
import ServiceRequestForm from "./ServiceRequestForm";
import { getServiceBySlug } from "../../lib/sitePages";
import { applyDriveServiceImages, fetchSiteServiceImages } from "../../lib/siteGalleryApi";
import { driveDisplayUrl } from "../../lib/driveImageUrl";

export default function ServicoDetailPage() {
  const { slug } = useParams();
  const baseService = slug ? getServiceBySlug(slug) : undefined;
  const [serviceImage, setServiceImage] = useState(baseService?.image || "");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!baseService) return;
    setServiceImage(baseService.image);
    fetchSiteServiceImages().then((images) => {
      const merged = applyDriveServiceImages([baseService], images);
      if (merged[0]?.image) setServiceImage(merged[0].image);
    });
  }, [baseService]);

  if (!baseService) {
    return (
      <SiteShell
        title="Serviços"
        breadcrumbs={[{ label: "Início", href: "/" }, { label: "Serviços", href: "/servicos" }, { label: "Serviço" }]}
      >
        <p className="text-center text-gray-500">Serviço não encontrado.</p>
        <p className="text-center mt-4">
          <Link to="/servicos" className="text-[#a21b7e] hover:underline">
            Voltar aos serviços
          </Link>
        </p>
      </SiteShell>
    );
  }

  const openForm = () => setShowForm(true);

  return (
    <SiteShell
      title="Serviços"
      breadcrumbs={[
        { label: "Início", href: "/" },
        { label: "Serviços", href: "/servicos" },
        { label: baseService.title },
      ]}
      bannerImage={serviceImage}
    >
      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">
        <div className="relative rounded-2xl overflow-hidden shadow-lg bg-gray-100 min-h-[340px] lg:min-h-0 lg:h-full">
          <img
            src={driveDisplayUrl(serviceImage, "lg")}
            alt={baseService.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>

        <div className="flex flex-col justify-center text-left py-2 lg:py-3">
          <h2 className="site-section-title text-gray-900">{baseService.title}</h2>
          <p className="text-[#a21b7e] italic text-base md:text-lg mb-4">{baseService.subtitle}</p>
          <p className="text-gray-600 text-sm md:text-base leading-relaxed mb-5">{baseService.description}</p>

          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 mb-3">
            O que incluímos
          </h3>
          <ul className="space-y-2 mb-6">
            {baseService.items.map((item) => (
              <li key={item} className="flex gap-3 text-sm md:text-base">
                <span className="shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-[#a21b7e]" />
                <span className="text-gray-700">{item}</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={openForm}
            className="self-start inline-flex items-center justify-center bg-[#a21b7e] text-white px-8 py-3 rounded-full text-sm hover:bg-[#8e176e] transition-colors"
          >
            Solicitar informações
          </button>
        </div>
      </div>

      <section className="w-screen relative left-1/2 -translate-x-1/2 bg-[#a21b7e]/[0.04] -mb-14 mt-14">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {baseService.itemDetails.map((detail) => (
              <article key={detail.title} className="text-left">
                <h4 className="text-base md:text-lg font-bold text-gray-900 mb-2 flex gap-3 items-start">
                  <span className="shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-[#a21b7e]" />
                  {detail.title}
                </h4>
                <p className="text-gray-600 text-sm md:text-base leading-relaxed pl-5">{detail.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {showForm && (
        <ServiceRequestForm
          serviceTitle={baseService.title}
          serviceSlug={baseService.slug}
          onClose={() => setShowForm(false)}
        />
      )}
    </SiteShell>
  );
}
