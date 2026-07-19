import { Eye, Target, Heart } from "lucide-react";
import { cn } from "../../lib/utils";
import type { HomeContent } from "../../lib/homeContent";
import OptimizedDriveImage from "./OptimizedDriveImage";

const ABOUT_ICONS = {
  mission: Target,
  vision: Eye,
  values: Heart,
} as const;

interface AboutSectionProps {
  content: HomeContent;
}

export default function AboutSection({ content }: AboutSectionProps) {
  const { about } = content;

  const aboutItems = [
    { key: "mission" as const, title: about.missionTitle, text: about.mission },
    { key: "vision" as const, title: about.visionTitle, text: about.vision },
    { key: "values" as const, title: about.valuesTitle, text: about.values },
  ];

  return (
    <section id="sobre" className="scroll-mt-[75px] p-6 sm:p-8 lg:p-10">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-stretch">
        <div className="relative h-[380px] sm:h-[420px] lg:h-[500px]">
          <OptimizedDriveImage
            src={content.aboutImage}
            alt="Equipa ProVisual Corporate"
            size="md"
            className="h-full w-full rounded-2xl object-cover"
          />
        </div>

        <div className="flex h-full flex-col justify-center tracking-[0.01em] lg:min-h-[500px]">
          <div className="site-section-kicker">
            <span className="site-section-kicker-line site-section-kicker-line--dark" />
            <p className="site-antetitle whitespace-nowrap text-[#a21b7e]">Sobre nós</p>
          </div>

          <h2 className="site-section-title text-[#333]">
            Quem <span className="font-light">somos?</span>
          </h2>
          <p className="site-section-desc mb-4 text-gray-600">
            Entre qualidade e <span className="font-light">eficiência</span>
          </p>

          <div className="rounded-2xl bg-white py-4 pl-5 pr-5 shadow-[5px_5px_6px_rgba(0,0,0,0.06)] sm:pl-7 sm:pr-9">
            <ul className="relative pb-1">
              <span
                className="absolute bottom-[20px] left-[30px] top-[60px] w-px bg-[#a21b7e]"
                aria-hidden="true"
              />
              {aboutItems.map((item, index) => {
                const Icon = ABOUT_ICONS[item.key];
                return (
                  <li
                    key={item.key}
                    className={cn(
                      "flex gap-5",
                      index === 1 && "mt-[10px]",
                      index === 2 && "mt-[25px]",
                    )}
                  >
                    <div className="relative flex shrink-0 flex-col items-center">
                      <div className="relative z-10 flex h-[60px] w-[60px] items-center justify-center rounded-[10px] bg-gradient-to-br from-[#a21b7e] to-[#3d001d] text-white shadow-md shadow-[#a21b7e]/20">
                        <Icon size={28} strokeWidth={1.5} />
                      </div>
                    </div>
                    <div className="pt-0.5">
                      <h3 className="mb-0.5 text-[21px] font-semibold leading-7 text-[#333]">
                        {item.title}
                      </h3>
                      <p className="text-[15px] font-medium leading-[18px] text-gray-500">
                        {item.text}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
