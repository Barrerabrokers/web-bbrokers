/** Recognize an affordability objection without changing the customer's requirements. */
export function asksBudgetAlternative(text:string) {
  const t=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/no (?:me )?(?:escribas|contactes)|dar(?:me)? de baja/.test(t))return false;
  if(/(?:m[²2]|metro cuadrado)/.test(t)&&/caro|precio alto|valor alto/.test(t)&&!/no (?:me )?(?:alcanza|llego)|otra opcion|alternativa/.test(t))return false;
  return /no (?:me )?(?:alcanza|llego)|fuera de (?:mi )?presupuesto|demasiado caro|que (?:me )?alcanza|otra opcion|alternativas?/.test(t);
}
const amount=(s:string)=>Number(s.replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.'));
export function salesBudgetLimits(text:string|undefined) {
  const down=text?.match(/anticipo\s*(?:de\s*)?(?:u\$s|usd|us\$|\$)?\s*([\d.,]+)/i);
  const monthly=text?.match(/(?:cuotas?|pagos?|mensual(?:es)?)\s*(?:de\s*)?(?:u\$s|usd|us\$|\$)?\s*([\d.,]+)/i);
  return {down:down?amount(down[1]):undefined,monthly:monthly?amount(monthly[1]):undefined};
}
export function fitsSalesBudget(unit:any,budget:ReturnType<typeof salesBudgetLimits>) {
  const monthly=unit.monthlyPaymentReference??unit.monthlyPayment;
  return unit.currency==='USD' && Number(unit.downPayment)>0 && Number(monthly)>0 && Number(unit.months)>0 && (!budget.down || unit.downPayment<=budget.down) && (!budget.monthly || monthly<=budget.monthly);
}
