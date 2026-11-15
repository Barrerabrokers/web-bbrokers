"use client";

import { useState } from "react";
import { CAC_HISTORY, CAC_SERIES, cacNumber, cacPercent, cacPeriod, type CacSeries } from "@/lib/cac";

export function CacHistory() {
  const rows = CAC_HISTORY.rows;
  const years = [...new Set(rows.map(row => row.period.slice(0, 4)))].reverse();
  const [year, setYear] = useState(years[0]);
  const [series, setSeries] = useState<CacSeries>("general");
  const selected = rows.filter(row => row.period.startsWith(year));
  const min = Math.min(...selected.map(row => row[series]));
  const max = Math.max(...selected.map(row => row[series]));
  const range = max - min || 1;
  const points = selected.map((row, index) => `${50 + index * 760 / Math.max(selected.length - 1, 1)},${190 - (row[series] - min) / range * 145}`).join(" ");
  const seriesLabel = CAC_SERIES.find(item => item.value === series)!.label;
  return <section id="historico" className="cac-history" aria-labelledby="cac-history-heading">
    <div className="cac-section-header"><div><h2 id="cac-history-heading">Histórico del índice CAC</h2><p>189 períodos, desde enero de 2011 hasta septiembre de 2026. Base diciembre de 2014 = 100.</p></div><label>Año<select value={year} onChange={event => setYear(event.target.value)}>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>
    <div className="cac-chart-header"><h3>{seriesLabel} · {year}</h3><label>Serie<select value={series} onChange={event => setSeries(event.target.value as CacSeries)}>{CAC_SERIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>
    <figure className="cac-chart"><svg viewBox="0 0 860 240" role="img" aria-labelledby="cac-chart-title cac-chart-description"><title id="cac-chart-title">{`Evolución de ${seriesLabel.toLowerCase()} en ${year}`}</title><desc id="cac-chart-description">Índice desde {cacNumber(selected[0][series])} hasta {cacNumber(selected[selected.length - 1][series])}. Los valores mensuales se detallan en la tabla.</desc><line x1="50" y1="190" x2="810" y2="190" stroke="#c8b8aa" /><line x1="50" y1="45" x2="810" y2="45" stroke="#c8b8aa" strokeDasharray="3 6" /><text x="50" y="25" fontSize="13" fill="#63564b">{cacNumber(max)} puntos</text><text x="50" y="220" fontSize="13" fill="#63564b">{cacPeriod(selected[0].period)}</text><text x="810" y="220" textAnchor="end" fontSize="13" fill="#63564b">{cacPeriod(selected[selected.length - 1].period)}</text><polyline points={points} fill="none" stroke="#8b3128" strokeWidth="3" strokeLinejoin="round" />{selected.map((row, index) => <circle key={row.period} cx={50 + index * 760 / Math.max(selected.length - 1, 1)} cy={190 - (row[series] - min) / range * 145} r="4" fill="#8b3128"><title>{`${cacPeriod(row.period)}: ${cacNumber(row[series])}`}</title></circle>)}</svg><figcaption>Escala del gráfico ajustada al rango de valores del año seleccionado.</figcaption></figure>
    <div className="cac-table-scroll" tabIndex={0} role="region" aria-label={`Tabla del índice CAC de ${year}; desplazamiento horizontal disponible`}><table className="cac-table"><caption>Valores del índice y variación respecto del mes anterior · {year}</caption><thead><tr><th rowSpan={2} scope="col">Período</th><th colSpan={2} scope="colgroup">Costo de construcción</th><th colSpan={2} scope="colgroup">Materiales</th><th colSpan={2} scope="colgroup">Mano de obra</th></tr><tr>{["general", "materials", "labor"].map(key => <th key={`${key}-index`} scope="col">Índice</th>).flatMap((element, index) => [element, <th key={`variation-${index}`} scope="col">Var. mensual</th>])}</tr></thead><tbody>{selected.map(row => <tr key={row.period}><th scope="row">{cacPeriod(row.period)}{row.provisional && <abbr title="Dato provisorio"> *</abbr>}</th><td>{cacNumber(row.general)}</td><td>{cacPercent(row.generalMonthly)}</td><td>{cacNumber(row.materials)}</td><td>{cacPercent(row.materialsMonthly)}</td><td>{cacNumber(row.labor)}</td><td>{cacPercent(row.laborMonthly)}</td></tr>)}</tbody></table></div>
    <p className="cac-table-note">* Provisorio según la fuente. Las variaciones son las publicadas, no la suma de porcentajes. El histórico comienza en el primer período disponible en la planilla compartida; no representa el inicio de la publicación del indicador.</p>
    <a href="/blog/indice-cac/historico.csv" className="journal-text-link" download>Descargar histórico completo en CSV ↗</a>
  </section>;
}
