/** Unit renders/photos precede floor plans across cards, galleries and PDFs. */
export function orderUnitImages<T extends { type?: string; displayOrder?: number; isPrimary?: boolean }>(images: T[]): T[] {
  const rank = (image: T) => image.type === 'render' ? 0 : image.type === 'plano' ? 2 : 1;
  return [...images].sort((a,b) => rank(a)-rank(b) || Number(!!b.isPrimary)-Number(!!a.isPrimary) || (a.displayOrder||0)-(b.displayOrder||0))
    .map((image,index) => ({...image,displayOrder:index,isPrimary:index===0}));
}
