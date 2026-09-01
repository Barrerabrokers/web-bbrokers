import { MessageCircle, Rows3 } from "lucide-react";

interface DevelopmentMobileActionsProps {
  developmentName: string;
  locationLabel: string;
}

export function DevelopmentMobileActions({
  developmentName,
  locationLabel,
}: DevelopmentMobileActionsProps) {
  const message = `Hola, quiero recibir información sobre ${developmentName} en ${locationLabel}.`;

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 flex gap-2 rounded-full border border-[#070707]/12 bg-[#f8f5ef]/94 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl md:hidden">
      <a
        href="#unidades"
        className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[#070707]/12 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#070707]"
      >
        <Rows3 className="h-4 w-4" />
        Unidades
      </a>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#070707] px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f8f5ef]"
      >
        <MessageCircle className="h-4 w-4" />
        WhatsApp
      </a>
    </div>
  );
}
