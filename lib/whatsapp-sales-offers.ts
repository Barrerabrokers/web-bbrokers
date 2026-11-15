/** Recognizes the published Anticipo/Cuotas table only when its payment arithmetic agrees. */
export function extractVerifiedPaymentRows(text: string) {
  const months = Number(text.match(/Anticipo\s+Cuotas\s*\n\s*\d+(?:[.,]\d+)?%\s+(\d{1,3})\b/i)?.[1]);
  if (!months || months > 120) return [];
  return text.split(/\r?\n/).flatMap(line => {
    const unit = line.match(/^\s*(UF\s*\d+[A-Z]?)\b/i)?.[1];
    // Four USD columns: price/m², total price, down payment, monthly installment.
    const amounts = Array.from(line.matchAll(/\bUSD\s+([\d.]+(?:,\d{1,2})?)/gi)).map(m => Number(m[1].replace(/\./g, "").replace(",", ".")));
    if (!unit || amounts.length !== 4 || !/\bLibre\s*$/i.test(line)) return [];
    const [,price,downPayment,monthlyPayment] = amounts;
    if (![price,downPayment,monthlyPayment].every(n => Number.isFinite(n) && n > 0) || downPayment >= price || Math.abs(price-downPayment-months*monthlyPayment) > months*0.51+1) return [];
    return [{ unit:unit.replace(/\s/g,""),rooms:Number(line.match(/^\s*UF\s*\d+[A-Z]?\s+(?:Frente\s+)?(\d)\s/i)?.[1]) || undefined,currency:"USD",price,downPayment,months,monthlyPayment,
      availability:"Libre según la lista; confirmar antes de reservar",sourceRow:line.trim() }];
  });
}
