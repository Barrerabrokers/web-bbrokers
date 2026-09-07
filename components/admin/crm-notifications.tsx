"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, MailOpen, X } from "lucide-react";

type NotificationItem = {
  id: string;
  recipientAgentName?: string;
  title: string;
  body: string;
  href: string;
  unread: boolean;
  createdAt: string;
};

export function CrmNotifications() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<NotificationItem | null>(null);
  const initialized = useRef(false);
  const knownIds = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/crm/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { notifications?: NotificationItem[] };
      const next = Array.isArray(data.notifications) ? data.notifications : [];
      if (initialized.current) {
        const newest = next.find((item) => item.unread && !knownIds.current.has(item.id));
        if (newest) setToast(newest);
      }
      next.forEach((item) => knownIds.current.add(item.id));
      initialized.current = true;
      setItems(next);
    } catch {}
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 15_000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 8_000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function openNotification(item: NotificationItem) {
    if (item.unread) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, unread: false } : entry));
      await fetch("/api/crm/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: item.id }),
      }).catch(() => undefined);
    }
    setToast(null);
    setOpen(false);
    router.push(item.href);
  }

  const unreadCount = items.filter((item) => item.unread).length;

  return <div className="relative">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label={unreadCount ? `${unreadCount} notificaciones sin leer` : "Notificaciones"} aria-expanded={open} className="relative flex h-10 w-10 items-center justify-center rounded-lg text-ink/65 transition-colors hover:bg-white/70 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006b6b]/35">
      <Bell className="h-[18px] w-[18px]" />
      {unreadCount > 0 && <span className="absolute right-0.5 top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-[#006b6b] px-1 text-[9px] font-bold leading-none text-white">{Math.min(unreadCount, 99)}</span>}
    </button>

    {open && <section aria-label="Notificaciones del CRM" className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl bg-white shadow-[0_8px_24px_rgba(22,20,18,0.18)] ring-1 ring-ink/10">
      <header className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
        <div><strong className="block text-sm text-ink">Notificaciones</strong><span className="text-xs text-ink/55">Aperturas de correos de tus clientes</span></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar notificaciones" className="grid h-8 w-8 place-items-center rounded-lg text-ink/55 hover:bg-cream-100"><X className="h-4 w-4" /></button>
      </header>
      <div className="max-h-[420px] overflow-y-auto">
        {items.length ? items.map((item) => <button key={item.id} type="button" onClick={() => void openNotification(item)} className={`flex w-full gap-3 border-b border-ink/8 px-4 py-3 text-left transition-colors last:border-0 hover:bg-[#f2f8f7] ${item.unread ? "bg-[#f6fbfa]" : "bg-white"}`}>
          <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg ${item.unread ? "bg-[#006b6b] text-white" : "bg-cream-100 text-ink/55"}`}><MailOpen className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><strong className="block text-sm font-semibold text-ink">{item.title}</strong><span className="mt-1 block truncate text-xs text-ink/58">{item.body}</span>{item.recipientAgentName && <span className="mt-1 block text-[10px] text-ink/45">Agente: {item.recipientAgentName}</span>}</span>
          {item.unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#006b6b]" aria-label="Sin leer" />}
        </button>) : <div className="px-5 py-8 text-center"><Check className="mx-auto h-5 w-5 text-[#006b6b]" /><p className="mt-2 text-sm font-medium text-ink">Todo al día</p><p className="mt-1 text-xs text-ink/52">Las nuevas aperturas aparecerán acá.</p></div>}
      </div>
    </section>}

    {toast && <div role="status" aria-live="polite" className="fixed right-4 top-20 z-50 flex w-[min(380px,calc(100vw-32px))] items-start gap-3 rounded-xl bg-[#132f2d] p-4 text-white shadow-[0_8px_24px_rgba(0,0,0,0.24)]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/12"><MailOpen className="h-5 w-5" /></span>
      <button type="button" onClick={() => void openNotification(toast)} className="min-w-0 flex-1 text-left"><strong className="block text-sm font-semibold">{toast.title}</strong><span className="mt-1 block text-xs leading-relaxed text-white/75">{toast.body}</span><span className="mt-2 block text-xs font-semibold text-[#8de1d4]">Ver cliente</span></button>
      <button type="button" onClick={() => setToast(null)} aria-label="Cerrar aviso" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
    </div>}
  </div>;
}
