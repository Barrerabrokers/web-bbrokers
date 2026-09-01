const ITEMS = [
  ["Proyecto", "#resumen"],
  ["Galería", "#galeria"],
  ["Ubicación", "#ubicacion"],
  ["Unidades", "#unidades"],
  ["Amenities", "#amenities"],
  ["Financiación", "#financiacion"],
  ["Contacto", "#contacto-desarrollo"],
] as const;

export function DevelopmentNavigation() {
  return (
    <nav className="sticky top-0 z-30 border-b border-[#070707]/10 bg-[#efe6d8]/94 px-4 py-3 backdrop-blur-xl md:px-8">
      <div className="mx-auto flex max-w-[1500px] gap-2 overflow-x-auto text-[10px] font-semibold uppercase tracking-[0.16em] text-[#070707]/66">
        {ITEMS.map(([label, href]) => (
          <a
            key={href}
            href={href}
            className="shrink-0 rounded-full border border-[#070707]/12 px-4 py-2.5 transition-colors hover:border-[#070707]/32 hover:text-[#070707] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3a1d17]"
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}
