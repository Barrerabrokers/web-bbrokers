export type MapProject = {
  id: string;
  name: string;
  neighborhood: string;
  x: number;
  y: number;
  status: string;
  href: string;
};

export const mapProjects: MapProject[] = [
  { id: "alto-grande-cabrera", name: "Alto Grande Cabrera", neighborhood: "Palermo", x: 43, y: 35, status: "En obra", href: "/#desarrollos" },
  { id: "alto-grande-moldes", name: "Alto Grande Moldes", neighborhood: "Belgrano", x: 29, y: 24, status: "En pozo", href: "/#desarrollos" },
  { id: "alto-grande-montserrat", name: "Alto Grande Montserrat", neighborhood: "Centro", x: 61, y: 62, status: "En comercialización", href: "/#desarrollos" }
];
