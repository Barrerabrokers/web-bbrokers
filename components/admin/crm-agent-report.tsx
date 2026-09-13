"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Mail, MessageCircle, Phone, RefreshCw, Users } from "lucide-react";
import { argentinaDateKey, ARGENTINA_TIME_ZONE } from "@/lib/argentina-time";
import { chartBuckets, REPORT_CHANNELS, REPORT_PERIODS, responseRate, type AgentReport, type ReportChannel, type ReportPeriod } from "@/lib/crm-agent-report";

const channels = {
  llamada: { label: "Llamadas", color: "#ffa382", icon: Phone },
  correo: { label: "Correos enviados", color: "#c4b3f4", icon: Mail },
  whatsapp: { label: "WhatsApp", color: "#ffdda0", icon: MessageCircle },
  reunion: { label: "Reuniones", color: "#40cccc", icon: CalendarDays },
  respuesta: { label: "Respuestas por correo", color: "#92b7e5", icon: Mail },
};
const number = (value: number) => new Intl.NumberFormat("es-AR").format(value);
const percent = (value: number | null) => value === null ? "—" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value)} %`;
const dayLabel = (value: string, month = false) => new Intl.DateTimeFormat("es-AR", { timeZone: ARGENTINA_TIME_ZONE, ...(month ? { month: "short" as const } : { day: "2-digit" as const, month: "short" as const }) }).format(new Date(`${value}T12:00:00-03:00`));
const dateTime = (value: string) => new Intl.DateTimeFormat("es-AR", { timeZone: ARGENTINA_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const control = "min-h-11 rounded-lg border border-ink/20 bg-white px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[#006b6b]/40 disabled:opacity-50";

function CommunicationsChart({ data, onSelectAgent }: { data: AgentReport; onSelectAgent: (id: string) => void }) {
  const [view, setView] = useState<"agents" | "dates">("agents");
  const [visible, setVisible] = useState<ReportChannel[]>([...REPORT_CHANNELS]);
  const [focused, setFocused] = useState<number | null>(null);
  const { buckets, mode } = useMemo(() => chartBuckets(data.range, data.days), [data.range, data.days]);
  const rows = useMemo(() => view === "agents"
    ? [...data.team].sort((a,b) => REPORT_CHANNELS.reduce((n,k) => n+b[k]-a[k],0) || a.name.localeCompare(b.name)).map(item => ({ ...item, key: item.id || "unattributed", label: item.name }))
    : buckets.map(item => ({ ...item, id: null, key: item.day, label: dayLabel(item.day, mode === "mes") })), [data.team, buckets, mode, view]);
  useEffect(() => { setFocused(null); }, [data, view]);
  const max = Math.max(1, ...rows.map(row => visible.reduce((sum, key) => sum + row[key], 0)));
  const magnitude = 10 ** Math.floor(Math.log10(max / 4));
  const step = Math.max(1, [1,2,5,10].find(n => n * magnitude >= max / 4)! * magnitude);
  const ceil = Math.ceil(max / step) * step;
  const width = Math.max(960, rows.length * (view === "agents" ? 140 : 48) + 100);
  const plotW = width - 105, plotH = 300, left = 80, top = 40;
  const slot = plotW / Math.max(1, rows.length), barW = Math.min(72, slot * .52);
  const active = focused === null ? null : rows[focused];
  const stackOrder = (["whatsapp", "correo", "reunion", "respuesta", "llamada"] as const).filter(key => visible.includes(key));
  const nameLines = (label: string) => {
    const words = label.split(/\s+/); const lines: string[] = []; let line = "";
    for (const word of words) { if (line && (line + " " + word).length > 17) { lines.push(line); line = word; } else line += (line ? " " : "") + word; }
    if (line) lines.push(line); return lines;
  };
  const labelHeight = Math.max(2, ...rows.map(row => nameLines(row.label).length)) * 18;
  return <section aria-labelledby="communications-chart-title" className="rounded-[24px] border-2 border-[#cecece] bg-white p-4 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h2 id="communications-chart-title" className="text-xl font-semibold text-[#006566] sm:text-2xl">{view === "agents" ? (data.admin ? "Resumen de actividad del equipo" : "Resumen de mi actividad") : `Comunicaciones por ${mode}`}</h2>
      <div className="inline-flex rounded-full bg-[#f0f0f0] p-1" aria-label="Agrupar gráfico">{([["agents","Por agente"],["dates","Por fecha"]] as const).map(([key,label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)} className={`min-h-10 rounded-full px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#006566] ${view === key ? "bg-[#006566] text-white" : "text-[#333] hover:bg-white"}`}>{label}</button>)}</div>
    </div>
    <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold text-[#444]"><span className="rounded-full bg-[#f0f0f0] px-4 py-2">{dayLabel(data.range.from)} al {dayLabel(data.range.to)} · {data.range.to.slice(0,4)}</span><span className="rounded-full bg-[#f0f0f0] px-4 py-2">{view === "agents" ? `${rows.length} ${rows.length === 1 ? "agente" : "agentes"}` : "Hora de Buenos Aires"}</span></div>
    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2" aria-label="Canales visibles en el gráfico">{REPORT_CHANNELS.map(key => <button key={key} type="button" aria-pressed={visible.includes(key)} onClick={() => setVisible(old => old.includes(key) ? old.filter(item => item !== key) : [...old, key])} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#006566] sm:text-base ${visible.includes(key) ? "text-[#333]" : "text-[#666] line-through"}`}><span aria-hidden="true" className="h-4 w-4 rounded-full" style={{ background: channels[key].color }} />{channels[key].label}</button>)}</div>
    <div className="mt-3 overflow-x-auto" tabIndex={0} aria-label="Gráfico de actividades, desplazable en pantallas pequeñas">
      <svg viewBox={`0 0 ${width} ${plotH + top + labelHeight + 65}`} style={{ minWidth: width > 1500 ? width : Math.min(width, 1100) }} className="h-auto w-full" role="group" aria-label={`Actividades registradas por ${view === "agents" ? "agente" : mode}. Seleccioná una barra para ver el detalle.`}>
        {Array.from({length: Math.round(ceil/step)+1},(_,tick) => <g key={tick}><line x1={left} x2={left + plotW} y1={top + plotH - tick * step / ceil * plotH} y2={top + plotH - tick * step / ceil * plotH} stroke="#999" strokeDasharray={tick ? "4 3" : undefined} /><text x={left - 18} y={top + plotH - tick * step / ceil * plotH + 5} textAnchor="end" fontSize="14" fill="#444">{number(step * tick)}</text></g>)}
        <text transform={`translate(20 ${top + plotH/2}) rotate(-90)`} textAnchor="middle" fontSize="15" fontWeight="600" fill="#333">Cantidad de actividades</text>
        {rows.map((row, index) => {
          let height = 0; const total = visible.reduce((sum,key) => sum + row[key], 0);
          const description = `${row.label}: ${visible.map(key => `${channels[key].label} ${number(row[key])}`).join(", ")}`;
          return <g key={row.key} tabIndex={0} role="button" aria-label={description} onFocus={() => setFocused(index)} onMouseEnter={() => setFocused(index)} onClick={() => setFocused(index)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setFocused(index); } }} style={{ cursor: "pointer", outline: "none" }}>
            <title>{description}</title><rect x={left + index * slot + 4} y={top-25} width={slot-8} height={plotH+labelHeight+40} rx="6" fill={focused === index ? "#f6f8f8" : "transparent"} stroke={focused === index ? "#006566" : "none"} />
            {stackOrder.map(key => { const h = row[key] / ceil * plotH; height += h; return <rect key={key} x={left + index * slot + (slot - barW) / 2} y={top + plotH - height} width={barW} height={h} fill={channels[key].color} />; })}
            <text x={left + (index + .5) * slot} y={top + plotH - total / ceil * plotH - 11} textAnchor="middle" fontSize="15" fontWeight="700" fill="#333">{number(total)}</text>
            <text x={left + (index + .5) * slot} y={top + plotH + 25} textAnchor="middle" fontSize="13" fill="#333">{nameLines(row.label).map((line,i) => <tspan key={i} x={left+(index+.5)*slot} dy={i ? 18 : 0}>{line}</tspan>)}</text>
          </g>;
        })}
        <text x={left+plotW/2} y={top+plotH+labelHeight+45} textAnchor="middle" fontSize="15" fontWeight="600" fill="#333">{view === "agents" ? "Actividad registrada por agente" : "Fecha de actividad"}</text>
      </svg>
    </div>
    {active ? <div className="mt-4 rounded-xl border border-[#d5dddd] bg-[#f8faf9] p-4" aria-live="polite"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold text-[#006566]">{active.label}</h3>{view === "agents" && active.id && <button type="button" onClick={() => onSelectAgent(active.id!)} className="min-h-10 rounded-lg border border-[#006566] px-3 text-sm font-medium text-[#006566] hover:bg-white">Ver actividades de este agente</button>}</div><dl className="mt-3 flex flex-wrap gap-x-7 gap-y-3">{REPORT_CHANNELS.map(key => <div key={key}><dt className="flex items-center gap-2 text-xs text-[#444]"><span className="h-3 w-3 rounded-full" style={{background:channels[key].color}} />{channels[key].label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-[#333]">{number(active[key])}</dd></div>)}</dl></div> : <p className="mt-3 text-sm text-[#555]">Seleccioná la barra de un agente para ver el detalle. Usá la leyenda para mostrar u ocultar actividades.</p>}
    {!rows.length && <p className="py-6 text-center text-sm text-[#555]">No hay actividad registrada en este período.</p>}
    <details className="mt-3 text-sm text-[#555]"><summary className="cursor-pointer py-2 font-medium">Ver valores del gráfico en tabla</summary><div className="overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Cantidades por {view === "agents" ? "agente" : mode}</caption><thead><tr><th className="p-2">{view === "agents" ? "Agente" : "Período"}</th>{REPORT_CHANNELS.map(key => <th className="p-2" key={key}>{channels[key].label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.key} className="border-t border-ink/10"><th className="p-2 font-normal">{row.label}</th>{REPORT_CHANNELS.map(key => <td key={key} className="p-2 tabular-nums">{number(row[key])}</td>)}</tr>)}</tbody></table></div></details>
  </section>;
}

export function CrmAgentReport({ admin, currentUserId, currentUserName }: { admin: boolean; currentUserId: string; currentUserName: string }) {
  const today = argentinaDateKey(new Date());
  const [period, setPeriod] = useState<ReportPeriod>("today"), [date, setDate] = useState(today), [from, setFrom] = useState(today), [to, setTo] = useState(today), [year, setYear] = useState(today.slice(0,4));
  const [agent, setAgent] = useState(admin ? "all" : currentUserId), [channel, setChannel] = useState("all"), [page, setPage] = useState(1), [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<AgentReport | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [agents, setAgents] = useState<AgentReport["agents"]>([]);
  const query = new URLSearchParams({ period, channel, page: String(page), ...(admin ? { agent } : {}), ...(period === "date" ? { date } : {}), ...(period === "range" ? { from, to } : {}), ...(period === "year" ? { year } : {}) }).toString();
  useEffect(() => {
    const abort = new AbortController(); setLoading(true); setError(""); setData(null);
    fetch(`/api/crm/agent-report?${query}`, { cache: "no-store", signal: abort.signal }).then(async response => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "No se pudo cargar el panel."); if (!abort.signal.aborted) { setData(payload); setAgents(payload.agents); } }).catch(cause => { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudo cargar el panel."); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [query, refresh]);
  useEffect(() => { const update = () => { if (!document.hidden) setRefresh(value => value + 1); }; window.addEventListener("focus",update); return () => window.removeEventListener("focus",update); }, []);
  const changePeriod = (value: ReportPeriod) => { setPeriod(value); setPage(1); };
  const changeChannel = (value: string) => { setChannel(value); setPage(1); };
  const title = admin ? "Panel de agentes" : "Mi actividad";
  return <div className="mx-auto max-w-[1600px] space-y-5 p-4 pb-12 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-ink/75">{admin ? "Consultá la actividad comercial de todo el equipo o de un agente." : `${currentUserName}, este panel muestra únicamente tu actividad registrada.`}</p></div><button type="button" onClick={() => setRefresh(value => value + 1)} disabled={loading} className={`${control} inline-flex items-center gap-2`}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} />Actualizar</button></header>
    <section aria-label="Filtros de actividad" className="rounded-xl border border-ink/15 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap gap-2" aria-label="Período">{REPORT_PERIODS.map(([value,label]) => <button key={value} type="button" aria-pressed={period === value} onClick={() => changePeriod(value)} className={`min-h-10 rounded-lg border px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#006b6b] ${period === value ? "border-[#006b6b] bg-[#006b6b] text-white" : "border-ink/15 bg-white text-ink hover:bg-cream-50"}`}>{label}</button>)}</div>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        {admin && <label className="grid min-w-[220px] flex-1 gap-1.5 text-xs font-semibold text-ink/80">Agente<select className={control} value={agent} onChange={event => { setAgent(event.target.value); setPage(1); }}><option value="all">Todos los agentes</option>{agents.map(item => <option key={item.id} value={item.id}>{item.name}{!item.active ? " · inactivo" : ""}</option>)}</select></label>}
        {period === "date" && <label className="grid gap-1.5 text-xs font-semibold text-ink/80">Fecha<input type="date" className={control} value={date} onChange={event => { setDate(event.target.value); setPage(1); }} /></label>}
        {period === "range" && <><label className="grid gap-1.5 text-xs font-semibold text-ink/80">Desde<input type="date" className={control} value={from} onChange={event => { setFrom(event.target.value); setPage(1); }} /></label><label className="grid gap-1.5 text-xs font-semibold text-ink/80">Hasta<input type="date" className={control} value={to} onChange={event => { setTo(event.target.value); setPage(1); }} /></label></>}
        {period === "year" && <label className="grid gap-1.5 text-xs font-semibold text-ink/80">Año<input type="number" min="2000" max="2100" className={`${control} w-28`} value={year} onChange={event => { setYear(event.target.value); setPage(1); }} /></label>}
        <p className="py-2 text-xs text-ink/70">{data ? `${dayLabel(data.range.from)} al ${dayLabel(data.range.to)} de ${data.range.to.slice(0,4)} · Buenos Aires` : "Los períodos se calculan con la hora de Buenos Aires."}</p>
      </div>
    </section>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button type="button" onClick={() => setRefresh(value => value+1)} className="ml-3 min-h-10 font-semibold underline">Reintentar</button></div>}
    {loading && <div role="status" aria-label="Cargando actividad" className="space-y-4"><div className="h-28 animate-pulse rounded-xl bg-white motion-reduce:animate-none" /><div className="h-80 animate-pulse rounded-xl bg-white motion-reduce:animate-none" /><span className="sr-only">Cargando actividad…</span></div>}
    {data && <>
      <section aria-label="Resumen de actividad" className="rounded-xl border border-ink/15 bg-white px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-x-5 lg:grid-cols-4">{(["llamada","correo","whatsapp","reunion"] as const).map(key => { const Icon = channels[key].icon; return <button key={key} type="button" onClick={() => changeChannel(key)} className="border-b border-ink/10 py-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#006b6b]"><span className="flex items-center gap-2 text-sm font-medium text-ink/75"><Icon className="h-4 w-4" style={{ color: channels[key].color }} />{key === "reunion" ? "Reuniones agendadas" : channels[key].label}</span><span className="mt-1 block text-3xl font-semibold tabular-nums text-ink">{number(data.totals[key])}</span><span className="mt-1 block text-xs text-ink/70">{key === "correo" ? "Envíos registrados; sin contar aperturas" : key === "whatsapp" ? "Mensajes y registros del historial" : key === "llamada" ? "Llamadas registradas en el CRM" : "Según la fecha programada"}</span></button>; })}</div>
        <div className="flex flex-wrap items-baseline justify-between gap-3 py-4"><p className="text-sm text-ink"><strong className="font-semibold">Tasa de respuesta por correo: {percent(data.responseRate)}</strong><span className="ml-2 text-ink/75">{number(data.replied)} de {number(data.contacted)} contactos por agente respondieron.</span></p><span className="text-xs text-ink/70">Actualizado {dateTime(data.generatedAt)}</span></div>
      </section>
      <CommunicationsChart data={data} onSelectAgent={id => { if (admin) setAgent(id); setPage(1); setChannel("all"); document.getElementById("activity-detail")?.scrollIntoView({ block: "start", behavior: "smooth" }); }} />
      {admin && <section className="rounded-xl border border-ink/15 bg-white p-4 sm:p-6" aria-labelledby="agent-breakdown"><h2 id="agent-breakdown" className="flex items-center gap-2 text-lg font-semibold text-ink"><Users className="h-5 w-5 text-[#006b6b]" />Actividad por agente</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[690px] text-left text-sm"><thead className="border-b border-ink/15 text-xs text-ink/75"><tr><th className="px-2 py-3 font-medium">Agente</th>{["Llamadas","Correos","WhatsApp","Reuniones","Respuesta"].map(label => <th key={label} className="px-2 py-3 text-right font-medium">{label}</th>)}</tr></thead><tbody>{data.team.map(item => <tr key={item.id || "unattributed"} className="border-b border-ink/10 last:border-0"><th className="px-2 py-3 font-medium">{item.id ? <button type="button" onClick={() => { setAgent(item.id!); setPage(1); }} className="min-h-9 text-[#006b6b] underline-offset-4 hover:underline">{item.name}</button> : item.name}</th>{(["llamada","correo","whatsapp","reunion"] as const).map(key => <td key={key} className="px-2 py-3 text-right tabular-nums">{number(item[key])}</td>)}<td className="px-2 py-3 text-right tabular-nums">{percent(responseRate(item.replied,item.contacted))}</td></tr>)}</tbody></table></div>{!data.team.length && <p className="py-6 text-sm text-ink/70">Todavía no hay actividad registrada en este período.</p>}</section>}
      <section className="rounded-xl border border-ink/15 bg-white p-4 sm:p-6" aria-labelledby="activity-detail"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="activity-detail" className="text-lg font-semibold text-ink">Detalle de actividades</h2><p className="mt-1 text-xs text-ink/70">{number(data.totalActivities)} registros con los filtros seleccionados</p></div><label className="grid gap-1 text-xs font-medium text-ink/75">Tipo de actividad<select value={channel} onChange={event => changeChannel(event.target.value)} className={control}><option value="all">Todas las comunicaciones</option>{REPORT_CHANNELS.map(key => <option key={key} value={key}>{channels[key].label}</option>)}</select></label></div>
        <ul className="mt-4 divide-y divide-ink/10">{data.activities.map(activity => { const Icon = channels[activity.channel].icon; return <li key={activity.id} className="py-4"><div className="grid gap-3 sm:grid-cols-[150px_1fr] lg:grid-cols-[150px_160px_1fr]"><time className="text-xs leading-6 text-ink/75" dateTime={activity.at}>{dateTime(activity.at)}</time><span className="flex items-start gap-2 text-xs font-medium leading-6" style={{ color: "#394544" }}><span className="mt-1 h-4 w-4 shrink-0 rounded-full" style={{ background: channels[activity.channel].color }} aria-hidden="true" />{channels[activity.channel].label}</span><div className="min-w-0"><p className="break-words text-sm font-semibold text-ink">{activity.canOpen && activity.leadId ? <Link href={`/admin/crm/${activity.leadId}?activity=${activity.channel === "respuesta" ? "correo" : activity.channel}`} className="text-[#006b6b] underline-offset-4 hover:underline">{activity.contact}</Link> : activity.contact}</p><p className="mt-1 break-words text-sm text-ink/80">{activity.title}</p>{admin && <p className="mt-1 text-xs text-ink/70">{activity.agent}</p>}{activity.body && <details className="mt-2"><summary className="cursor-pointer py-1 text-xs font-medium text-[#006b6b]">{activity.channel === "llamada" ? "Ver resultado de la llamada" : "Ver detalle"}</summary><p className="mt-2 whitespace-pre-wrap break-words rounded-md bg-cream-50 p-3 text-sm leading-6 text-ink/85">{activity.body}</p></details>}</div></div></li>; })}</ul>
        {!data.activities.length && <div className="py-12 text-center"><BarChart3 className="mx-auto h-8 w-8 text-[#006b6b]" /><p className="mt-3 font-medium text-ink">No hay registros para esta selección</p><p className="mt-1 text-sm text-ink/70">Probá otro período o registrá una actividad desde la ficha de un contacto.</p></div>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-4"><p className="text-xs text-ink/70">Página {data.page} de {Math.max(1,Math.ceil(data.totalActivities/data.pageSize))}</p><div className="flex gap-2"><button type="button" disabled={page<=1} onClick={() => setPage(value=>value-1)} className={`${control} inline-flex items-center gap-1`}><ChevronLeft className="h-4 w-4" />Anterior</button><button type="button" disabled={page*data.pageSize>=data.totalActivities} onClick={() => setPage(value=>value+1)} className={`${control} inline-flex items-center gap-1`}>Siguiente<ChevronRight className="h-4 w-4" /></button></div></div>
      </section>
      <details className="rounded-lg border border-ink/15 bg-white p-4 text-sm text-ink/75"><summary className="cursor-pointer font-medium text-ink">Cómo se calculan estos datos</summary><ul className="mt-3 max-w-4xl list-disc space-y-2 pl-5 text-xs leading-6"><li>La actividad se atribuye al autor del registro o al agente que envió el mensaje, no al propietario actual del contacto. Los registros sin autor aparecen solo en la vista de administradores.</li><li>Se usa la fecha de actividad o de reunión. Cuando falta, se usa la fecha de registro. WhatsApp incluye únicamente mensajes y actividades guardados en el CRM; un registro manual puede representar una conversación, y un historial importado sin fecha se cuenta al registrarse.</li><li>Los correos enviados excluyen las aperturas y las respuestas. La tasa es contactos con alguna respuesta registrada después de un envío en el período, dividido por contactos a los que cada agente envió correo en ese período. Varias respuestas del mismo contacto cuentan una sola vez. No se presume qué mensaje concreto respondió. En la vista de todo el equipo, un contacto atendido por dos agentes se cuenta para cada agente.</li><li>Las respuestas dependen de la sincronización de la cuenta de correo. Las reuniones son reservas o actividades agendadas, no una confirmación de asistencia.</li></ul></details>
    </>}
  </div>;
}
