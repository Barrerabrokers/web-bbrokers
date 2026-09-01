"use client";

import Link from "next/link";
import type {
  ChangeEvent,
  DragEvent as ReactDragEvent,
  FormEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock3,
  CloudDownload,
  FileSpreadsheet,
  FileText,
  GripVertical,
  Home,
  LayoutGrid,
  ListChecks,
  Loader2,
  Mail,
  MessageCircle,
  NotebookPen,
  Phone,
  Plus,
  Save,
  Search,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { CrmActivity, CrmActivityType, CrmLead, CrmLeadStatus, CrmLeadTemperature } from "@/lib/db";
import {
  HUBSPOT_LEAD_STATUS_OPTIONS,
  leadStatusLabel,
} from "@/lib/crm-statuses";
import { shouldShowHubSpotContactField } from "@/lib/hubspot-fields";
import { PHONE_COUNTRIES, normalizeDialCode } from "@/lib/phone-countries";
import { CrmContactAssistant } from "@/components/admin/crm-contact-assistant";

type CrmAgent = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};

type CrmDevelopment = {
  id: string;
  name: string;
};

type HubSpotImportOption = {
  id: string;
  name: string;
  email?: string;
};

type HubSpotImportStatusOption = {
  value: string;
  label: string;
};

type HubSpotImportOptions = {
  owners: HubSpotImportOption[];
  developments: HubSpotImportOption[];
  leadStatuses: HubSpotImportStatusOption[];
};

type CrmEmailTemplateOption = {
  id: string;
  channel?: "email" | "whatsapp";
  name: string;
  category: string;
  subject: string;
  body: string;
  imageUrls: string[];
  contentBlocks?: CrmEmailTemplateContentBlock[];
};

type CrmEmailTemplateContentBlock =
  | {
      id: string;
      type: "text";
      text: string;
      html?: string;
      color?: string;
      fontFamily?: string;
      fontSize?: number;
      align?: "left" | "center" | "right";
      backgroundColor?: string;
      padding?: number;
    }
  | {
      id: string;
      type: "image";
      url: string;
      width: number;
      align?: "left" | "center" | "right";
      alt?: string;
      borderRadius?: number;
    }
  | {
      id: string;
      type: "button";
      label: string;
      url: string;
      align?: "left" | "center" | "right";
      backgroundColor?: string;
      textColor?: string;
      borderRadius?: number;
    }
  | {
      id: string;
      type: "divider";
      color?: string;
      thickness?: number;
      width?: number;
    }
  | {
      id: string;
      type: "spacer";
      height: number;
    }
  | {
      id: string;
      type: "attachment";
      url: string;
      name: string;
    };

type CrmBoardProps = {
  initialLeads: CrmLead[];
  initialActivities: CrmActivity[];
  agents: CrmAgent[];
  developments: CrmDevelopment[];
  leadStatusOptions: HubSpotImportStatusOption[];
  currentUserId: string;
  canAssignTeam: boolean;
};

type LeadFormState = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  phone: string;
  status: CrmLeadStatus;
  temperature: CrmLeadTemperature;
  source: string;
  developmentId: string;
  developmentNameText: string;
  assignedAgentId: string;
  notes: string;
};

type ActivityFormState = {
  type: CrmActivityType;
  title: string;
  body: string;
  scheduledAt: string;
};

type LeadFieldPatch = {
  firstName?: string;
  lastName?: string;
  email?: string;
  countryCode?: string;
  phone?: string;
  status?: CrmLeadStatus;
  temperature?: CrmLeadTemperature;
  developmentId?: string;
  developmentNameText?: string;
  assignedAgentId?: string;
};

type PhoneInlineEditorState = {
  leadId: string;
  column: "phone" | "whatsapp";
  countryCode: string;
  phone: string;
};

type CallSessionState = {
  startedAt: string;
  endedAt: string;
  notes: string;
};

type CrmColumnKey =
  | "select"
  | "name"
  | "email"
  | "phone"
  | "whatsapp"
  | "status"
  | "temperature"
  | "development"
  | "createdAt"
  | "owner";

type CrmSortDirection = "asc" | "desc";

type CrmSortState = {
  column: Exclude<CrmColumnKey, "select">;
  direction: CrmSortDirection;
};

const CRM_COLUMN_WIDTHS: Record<CrmColumnKey, number> = {
  select: 52,
  name: 190,
  email: 220,
  phone: 180,
  whatsapp: 180,
  status: 170,
  temperature: 140,
  development: 210,
  createdAt: 130,
  owner: 190,
};

const CRM_COLUMN_ORDER: CrmColumnKey[] = [
  "select",
  "name",
  "email",
  "phone",
  "whatsapp",
  "status",
  "temperature",
  "development",
  "createdAt",
  "owner",
];

const CRM_COLUMN_LABELS: Record<CrmColumnKey, string> = {
  select: "",
  name: "Nombre",
  email: "Correo",
  phone: "Número de teléfono",
  whatsapp: "WhatsApp",
  status: "Estado del lead",
  temperature: "Prioridad",
  development: "Desarrollo",
  createdAt: "Fecha creación",
  owner: "Propietario",
};

const CRM_VIEW_STORAGE_KEY = "barrera-crm-table-view-v1";
const CRM_PAGE_SIZE_OPTIONS = [25, 50, 100, 500] as const;
const CRM_DEFAULT_SORT: CrmSortState = {
  column: "createdAt",
  direction: "desc",
};

const CRM_COLUMN_MIN_WIDTHS: Record<CrmColumnKey, number> = {
  select: 44,
  name: 56,
  email: 76,
  phone: 76,
  whatsapp: 76,
  status: 76,
  temperature: 76,
  development: 76,
  createdAt: 76,
  owner: 76,
};

const ACTIVITY_TYPES: { value: CrmActivityType; label: string; icon: typeof NotebookPen }[] = [
  { value: "nota", label: "Nota", icon: NotebookPen },
  { value: "correo", label: "Correo", icon: Mail },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "llamada", label: "Llamada", icon: Phone },
  { value: "reunion", label: "Reunión", icon: CalendarDays },
  { value: "tarea", label: "Tarea", icon: ClipboardList },
];

const CRM_TEMPERATURE_OPTIONS: { value: CrmLeadTemperature; label: string; tone: string }[] = [
  { value: "", label: "Sin color", tone: "bg-white border-ink/18 text-ink/58" },
  { value: "frio", label: "Frío", tone: "bg-sky-50 border-sky-200 text-sky-800" },
  { value: "tibio", label: "Tibio", tone: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  { value: "caliente", label: "Caliente", tone: "bg-orange-50 border-orange-200 text-orange-800" },
];

const CRM_TEMPERATURE_ROW_CLASSES: Record<CrmLeadTemperature, { normal: string; selected: string }> = {
  "": {
    normal: "bg-white hover:bg-[#f7f7f5]",
    selected: "bg-[#e9e9e6]",
  },
  frio: {
    normal: "bg-sky-50/70 hover:bg-sky-100/65",
    selected: "bg-sky-100",
  },
  tibio: {
    normal: "bg-emerald-50/75 hover:bg-emerald-100/65",
    selected: "bg-emerald-100",
  },
  caliente: {
    normal: "bg-orange-50/85 hover:bg-orange-100/70",
    selected: "bg-orange-100",
  },
};

const EMPTY_FORM: LeadFormState = {
  id: "",
  firstName: "",
  lastName: "",
  email: "",
  countryCode: "+54",
  phone: "",
  status: "NEW",
  temperature: "",
  source: "",
  developmentId: "",
  developmentNameText: "",
  assignedAgentId: "",
  notes: "",
};

const EMPTY_ACTIVITY: ActivityFormState = {
  type: "nota",
  title: "",
  body: "",
  scheduledAt: "",
};

function leadFullName(lead: CrmLead) {
  return `${lead.firstName} ${lead.lastName}`.trim();
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CL";
}

function formatLeadDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatLeadCreationDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function isMobilePhoneDevice() {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent || "";

  return /iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|Opera Mini|IEMobile/i.test(userAgent);
}

function whatsappUrl(lead: CrmLead, message?: string, target: "mobile" | "desktop" = "desktop") {
  const digits = `${normalizeDialCode(lead.countryCode)}${lead.phone}`.replace(/\D/g, "");
  const text = encodeURIComponent(message || `Hola ${lead.firstName}, soy de Barrera Brokers.`);
  if (!digits) return "";
  return target === "mobile"
    ? `whatsapp://send?phone=${digits}&text=${text}`
    : `https://web.whatsapp.com/send?phone=${digits}&text=${text}`;
}

function formattedLeadPhone(lead: Pick<CrmLead, "countryCode" | "phone">) {
  return `${normalizeDialCode(lead.countryCode)} ${lead.phone}`.trim();
}

function phoneCallUrl(lead: Pick<CrmLead, "countryCode" | "phone">) {
  const digits = `${normalizeDialCode(lead.countryCode)}${lead.phone}`.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
}

function formatInteractionDateTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatInteractionDuration(startedAt: string, endedAt: string) {
  const diffMs = Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());
  const totalMinutes = Math.max(1, Math.round(diffMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes} min`;
}

function formatHubSpotValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function paginationItems(currentPage: number, pageCount: number) {
  if (pageCount <= 9) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set([1, 2, pageCount - 1, pageCount, currentPage - 1, currentPage, currentPage + 1]);
  const sortedPages = Array.from(pages)
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((a, b) => a - b);

  return sortedPages.reduce<Array<number | "ellipsis">>((items, page, index) => {
    const previous = sortedPages[index - 1];
    if (previous && page - previous > 1) items.push("ellipsis");
    items.push(page);
    return items;
  }, []);
}

function leadStatusOptionsForValue(options: HubSpotImportStatusOption[], value?: string) {
  if (!value || options.some((option) => option.value === value)) return options;
  return [{ value, label: value }, ...options];
}

function mergeDevelopmentOptions(
  developments: CrmDevelopment[],
  leads: CrmLead[]
): CrmDevelopment[] {
  const byId = new Map<string, CrmDevelopment>();
  const seenNames = new Set<string>();

  for (const development of developments) {
    if (!development.id || !development.name) continue;
    const normalizedName = development.name.trim().toLowerCase();
    if (seenNames.has(normalizedName)) continue;
    byId.set(development.id, development);
    seenNames.add(normalizedName);
  }

  for (const lead of leads) {
    const rawName = lead.developmentName || lead.developmentNameText || "";
    const name = rawName.trim();
    if (!name) continue;

    if (lead.developmentId && !byId.has(lead.developmentId)) {
      byId.set(lead.developmentId, { id: lead.developmentId, name });
      seenNames.add(name.toLowerCase());
      continue;
    }

    const normalizedName = name.toLowerCase();
    if (!seenNames.has(normalizedName)) {
      byId.set(`text:${normalizedName}`, { id: `text:${name}`, name });
      seenNames.add(normalizedName);
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeSortText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function crmLeadSortValue(lead: CrmLead, column: CrmSortState["column"]) {
  switch (column) {
    case "name":
      return normalizeSortText(leadFullName(lead));
    case "email":
      return normalizeSortText(lead.email);
    case "phone":
    case "whatsapp":
      return `${normalizeDialCode(lead.countryCode)}${lead.phone}`.replace(/\D/g, "");
    case "status":
      return normalizeSortText(leadStatusLabel(lead.status));
    case "temperature":
      return CRM_TEMPERATURE_OPTIONS.findIndex((option) => option.value === lead.temperature);
    case "development":
      return normalizeSortText(lead.developmentName || lead.developmentNameText || "");
    case "createdAt":
      return new Date(lead.createdAt).getTime() || 0;
    case "owner":
      return normalizeSortText(lead.assignedAgentName || "");
  }
}

function compareCrmLeads(a: CrmLead, b: CrmLead, sort: CrmSortState) {
  const aValue = crmLeadSortValue(a, sort.column);
  const bValue = crmLeadSortValue(b, sort.column);
  const direction = sort.direction === "asc" ? 1 : -1;

  if (typeof aValue === "number" && typeof bValue === "number") {
    return (aValue - bValue) * direction;
  }

  return (
    String(aValue).localeCompare(String(bValue), "es", {
      numeric: true,
      sensitivity: "base",
    }) * direction
  );
}

export function CrmBoard({
  initialLeads,
  initialActivities,
  agents,
  developments: initialDevelopments,
  leadStatusOptions,
  currentUserId,
  canAssignTeam,
}: CrmBoardProps) {
  const [leads, setLeads] = useState(initialLeads);
  const [activities, setActivities] = useState(initialActivities);
  const loadedActivityLeadIds = useRef(new Set(initialActivities.map((activity) => activity.leadId)));
  const [crmDevelopments, setCrmDevelopments] = useState(() =>
    mergeDevelopmentOptions(initialDevelopments, initialLeads)
  );
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [emailComposerLeadId, setEmailComposerLeadId] = useState("");
  const [whatsAppComposerLeadId, setWhatsAppComposerLeadId] = useState("");
  const [callSessionLeadId, setCallSessionLeadId] = useState("");
  const [ownerFilter, setOwnerFilter] = useState(canAssignTeam ? "all" : currentUserId);
  const [statusFilter, setStatusFilter] = useState<CrmLeadStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof CRM_PAGE_SIZE_OPTIONS)[number]>(50);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingActivity, setIsSavingActivity] = useState(false);
  const [isImportingHubSpot, setIsImportingHubSpot] = useState(false);
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [isHubSpotImportOpen, setIsHubSpotImportOpen] = useState(false);
  const [isLoadingHubSpotImportOptions, setIsLoadingHubSpotImportOptions] = useState(false);
  const [hubSpotImportOptions, setHubSpotImportOptions] = useState<HubSpotImportOptions>({
    owners: [],
    developments: [],
    leadStatuses: leadStatusOptions.length
      ? leadStatusOptions
      : HUBSPOT_LEAD_STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
  });
  const [hubSpotOwnerIds, setHubSpotOwnerIds] = useState<string[]>([]);
  const [hubSpotDevelopmentIds, setHubSpotDevelopmentIds] = useState<string[]>([]);
  const [hubSpotLeadStatuses, setHubSpotLeadStatuses] = useState<string[]>([]);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [updatingLeadFieldId, setUpdatingLeadFieldId] = useState("");
  const [phoneEditor, setPhoneEditor] = useState<PhoneInlineEditorState | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState(CRM_COLUMN_WIDTHS);
  const [columnOrder, setColumnOrder] = useState<CrmColumnKey[]>(CRM_COLUMN_ORDER);
  const [sortState, setSortState] = useState<CrmSortState>(CRM_DEFAULT_SORT);
  const [draggedColumn, setDraggedColumn] = useState<CrmColumnKey | null>(null);
  const [viewNotice, setViewNotice] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activityForm, setActivityForm] = useState<ActivityFormState>(EMPTY_ACTIVITY);
  const [isTouchWorkspace, setIsTouchWorkspace] = useState(false);
  const [form, setForm] = useState<LeadFormState>({
    ...EMPTY_FORM,
    assignedAgentId: canAssignTeam ? agents[0]?.id || currentUserId : currentUserId,
  });

  const activeAgents = useMemo(() => agents.filter((agent) => agent.active), [agents]);
  const effectiveLeadStatusOptions = useMemo(() => {
    const seen = new Set<string>();
    return leadStatusOptions.filter((option) => {
      if (!option.value || seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });
  }, [leadStatusOptions]);
  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) || null;
  const selectedActivities = selectedLead
    ? activities.filter((activity) => activity.leadId === selectedLead.id)
    : [];

  useEffect(() => {
    if (!selectedLeadId || loadedActivityLeadIds.current.has(selectedLeadId)) return;
    loadedActivityLeadIds.current.add(selectedLeadId);
    let cancelled = false;
    fetch(`/api/crm/activities?leadId=${encodeURIComponent(selectedLeadId)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo cargar el historial");
        if (!cancelled) {
          setActivities((current) => [
            ...current.filter((activity) => activity.leadId !== selectedLeadId),
            ...(data.activities || []),
          ]);
        }
      })
      .catch(() => {
        loadedActivityLeadIds.current.delete(selectedLeadId);
      });
    return () => { cancelled = true; };
  }, [selectedLeadId]);

  const filteredLeads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (ownerFilter !== "all" && lead.assignedAgentId !== ownerFilter) return false;
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      if (!needle) return true;

      const haystack = [
        leadFullName(lead),
        lead.email,
        lead.phone,
        lead.developmentName || "",
        lead.status,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [leads, ownerFilter, query, statusFilter]);
  const sortedLeads = useMemo(() => {
    return [...filteredLeads].sort((a, b) => compareCrmLeads(a, b, sortState));
  }, [filteredLeads, sortState]);
  const pageCount = Math.max(1, Math.ceil(sortedLeads.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const paginatedLeads = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return sortedLeads.slice(start, start + pageSize);
  }, [pageSize, safeCurrentPage, sortedLeads]);
  const pageStart = sortedLeads.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(sortedLeads.length, safeCurrentPage * pageSize);
  const tableWidth = useMemo(
    () => columnOrder.reduce((total, column) => total + columnWidths[column], 0),
    [columnOrder, columnWidths]
  );

  useEffect(() => {
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [currentPage, pageCount]);

  useEffect(() => {
    setCurrentPage(1);
  }, [ownerFilter, pageSize, query, statusFilter]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: coarse), (max-width: 1023px)");
    const syncDeviceMode = () => {
      const isCompact = mediaQuery.matches;
      setIsTouchWorkspace(isCompact);
      if (isCompact) setPageSize((current) => (current > 50 ? 25 : current));
    };

    syncDeviceMode();
    mediaQuery.addEventListener("change", syncDeviceMode);
    return () => mediaQuery.removeEventListener("change", syncDeviceMode);
  }, []);

  useEffect(() => {
    try {
      const savedView = window.localStorage.getItem(CRM_VIEW_STORAGE_KEY);
      if (!savedView) return;

      const parsed = JSON.parse(savedView) as {
        widths?: Partial<Record<CrmColumnKey, number>>;
        order?: CrmColumnKey[];
        sort?: Partial<CrmSortState>;
      };
      const nextOrder = parsed.order?.filter((column): column is CrmColumnKey =>
        CRM_COLUMN_ORDER.includes(column)
      );

      if (nextOrder?.length) {
        setColumnOrder([
          ...nextOrder,
          ...CRM_COLUMN_ORDER.filter((column) => !nextOrder.includes(column)),
        ]);
      }

      if (parsed.widths) {
        setColumnWidths((current) => {
          const nextWidths = { ...current };
          for (const column of CRM_COLUMN_ORDER) {
            const savedWidth = parsed.widths?.[column];
            if (typeof savedWidth === "number") {
              nextWidths[column] = Math.max(CRM_COLUMN_MIN_WIDTHS[column], savedWidth);
            }
          }
          return nextWidths;
        });
      }

      if (
        parsed.sort?.column &&
        CRM_COLUMN_ORDER.includes(parsed.sort.column as CrmColumnKey) &&
        (parsed.sort.direction === "asc" || parsed.sort.direction === "desc")
      ) {
        setSortState({
          column: parsed.sort.column as CrmSortState["column"],
          direction: parsed.sort.direction,
        });
      }
    } catch {
      window.localStorage.removeItem(CRM_VIEW_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    setCrmDevelopments(mergeDevelopmentOptions(initialDevelopments, leads));
  }, [initialDevelopments, leads]);

  const visiblePageLeadIds = useMemo(() => paginatedLeads.map((lead) => lead.id), [paginatedLeads]);
  const selectedVisibleLeadIds = useMemo(
    () => selectedLeadIds.filter((leadId) => visiblePageLeadIds.includes(leadId)),
    [selectedLeadIds, visiblePageLeadIds]
  );
  const allVisibleSelected =
    visiblePageLeadIds.length > 0 && selectedVisibleLeadIds.length === visiblePageLeadIds.length;
  const someVisibleSelected =
    selectedVisibleLeadIds.length > 0 && selectedVisibleLeadIds.length < visiblePageLeadIds.length;

  const update = (field: keyof LeadFormState) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setError("");
    setNotice("");
  };

  const updateActivity = (field: keyof ActivityFormState) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setActivityForm((current) => ({ ...current, [field]: event.target.value }));
    setError("");
    setNotice("");
  };

  const resetForm = () => {
    setForm({
      ...EMPTY_FORM,
      assignedAgentId: canAssignTeam ? activeAgents[0]?.id || currentUserId : currentUserId,
    });
    setIsCreating(false);
  };

  const startCreate = () => {
    resetForm();
    setIsCreating(true);
    setSelectedLeadId("");
    setNotice("");
    setError("");
  };

  const editLead = (lead: CrmLead) => {
    setForm({
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      countryCode: normalizeDialCode(lead.countryCode || "+54"),
      phone: lead.phone,
      status: lead.status,
      temperature: lead.temperature || "",
      source: lead.source || "",
      developmentId: lead.developmentId || "",
      developmentNameText: lead.developmentNameText || (!lead.developmentId ? lead.developmentName || "" : ""),
      assignedAgentId: lead.assignedAgentId || currentUserId,
      notes: lead.notes || "",
    });
    setSelectedLeadId(lead.id);
    setIsCreating(true);
    setNotice("Contacto cargado para editar.");
  };

  const openLead = (lead: CrmLead) => {
    setSelectedLeadId(lead.id);
    setIsCreating(false);
    setNotice("");
    setError("");
  };

  const openLeadEmailComposer = (lead: CrmLead) => {
    setSelectedLeadId(lead.id);
    setEmailComposerLeadId(lead.id);
    setWhatsAppComposerLeadId("");
    setIsCreating(false);
    setNotice("");
    setError("");
  };

  const openLeadWhatsAppComposer = (lead: CrmLead) => {
    setSelectedLeadId(lead.id);
    setWhatsAppComposerLeadId(lead.id);
    setEmailComposerLeadId("");
    setCallSessionLeadId("");
    setIsCreating(false);
    setNotice("");
    setError("");
  };

  const openLeadCallSession = (lead: CrmLead) => {
    setSelectedLeadId(lead.id);
    setCallSessionLeadId(lead.id);
    setEmailComposerLeadId("");
    setWhatsAppComposerLeadId("");
    setIsCreating(false);
    setNotice("");
    setError("");
  };

  const toggleLeadSelection = (leadId: string, checked: boolean) => {
    setSelectedLeadIds((current) => {
      if (checked) return current.includes(leadId) ? current : [...current, leadId];
      return current.filter((item) => item !== leadId);
    });
  };

  const toggleVisibleSelection = (checked: boolean) => {
    setSelectedLeadIds((current) => {
      if (!checked) return current.filter((leadId) => !visiblePageLeadIds.includes(leadId));
      const next = new Set(current);
      visiblePageLeadIds.forEach((leadId) => next.add(leadId));
      return Array.from(next);
    });
  };

  const refreshLeads = async () => {
    const response = await fetch("/api/crm/leads");
    const data = (await response.json().catch(() => null)) as
      | { leads?: CrmLead[]; error?: string }
      | null;

    if (!response.ok || !data?.leads) {
      throw new Error(data?.error || "No se pudo actualizar la lista de contactos");
    }

    setLeads(data.leads);
  };

  const saveInlineLeadField = async (leadId: string, field: string, payload: LeadFieldPatch) => {
    setUpdatingLeadFieldId(`${leadId}:${field}`);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/crm/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: leadId,
          ...payload,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo guardar el cambio");
      }

      await refreshLeads();
      setNotice("Contacto actualizado.");
      window.setTimeout(() => setNotice(""), 1500);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el cambio");
      return false;
    } finally {
      setUpdatingLeadFieldId("");
    }
  };

  const openPhoneEditor = (lead: CrmLead, column: "phone" | "whatsapp") => {
    setPhoneEditor({
      leadId: lead.id,
      column,
      countryCode: normalizeDialCode(lead.countryCode || "+54"),
      phone: lead.phone,
    });
    setError("");
    setNotice("");
  };

  const savePhoneEditor = async () => {
    if (!phoneEditor) return;
    const saved = await saveInlineLeadField(phoneEditor.leadId, phoneEditor.column, {
      countryCode: normalizeDialCode(phoneEditor.countryCode),
      phone: phoneEditor.phone,
    });
    if (saved) setPhoneEditor(null);
  };

  const saveLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const selectedDevelopment = crmDevelopments.find(
        (development) => development.id === form.developmentId
      );
      const leadPayload = {
        ...form,
        ...(form.developmentId.startsWith("text:")
          ? {
              developmentId: "",
              developmentNameText:
                selectedDevelopment?.name || form.developmentId.replace(/^text:/, ""),
            }
          : {
              developmentNameText: selectedDevelopment?.name || form.developmentNameText,
            }),
      };
      const response = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadPayload),
      });
      const data = (await response.json().catch(() => null)) as
        | { lead?: CrmLead; error?: string }
        | null;

      if (!response.ok || !data?.lead) {
        throw new Error(data?.error || "No se pudo guardar el contacto");
      }

      const nextLead = data.lead;
      setLeads((current) => {
        const withoutLead = current.filter((lead) => lead.id !== nextLead.id);
        return [nextLead, ...withoutLead];
      });
      setSelectedLeadId("");
      setIsCreating(false);
      setNotice(form.id ? "Contacto actualizado." : "Contacto creado y asignado.");
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el contacto");
    } finally {
      setIsSaving(false);
    }
  };

  const saveActivity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedLead) return;
    setIsSavingActivity(true);
    setError("");
    setNotice("");

    try {
      const shouldCreateGoogleEvent =
        (activityForm.type === "reunion" || activityForm.type === "tarea") &&
        Boolean(activityForm.scheduledAt);
      const payload = {
        leadId: selectedLead.id,
        ...activityForm,
        scheduledAt: activityForm.scheduledAt
          ? new Date(activityForm.scheduledAt).toISOString()
          : activityForm.scheduledAt,
      };
      const response = await fetch(shouldCreateGoogleEvent ? "/api/crm/calendar/events" : "/api/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as
        | { activity?: CrmActivity; error?: string }
        | null;

      if (!response.ok || !data?.activity) {
        throw new Error(data?.error || "No se pudo guardar la actividad");
      }

      setActivities((current) => [data.activity!, ...current]);
      setActivityForm({ ...EMPTY_ACTIVITY, type: activityForm.type });
      setNotice(shouldCreateGoogleEvent ? "Actividad registrada en el CRM y Google Calendar." : "Actividad registrada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la actividad");
    } finally {
      setIsSavingActivity(false);
    }
  };

  const setActivityType = (type: CrmActivityType) => {
    const label = ACTIVITY_TYPES.find((item) => item.value === type)?.label || "Actividad";
    setActivityForm({
      type,
      title: type === "nota" ? "Nueva nota" : `${label} con ${selectedLead?.firstName || "cliente"}`,
      body: "",
      scheduledAt: "",
    });
  };

  const loadHubSpotImportOptions = async () => {
    if (isLoadingHubSpotImportOptions) return;
    if (hubSpotImportOptions.owners.length > 0 || hubSpotImportOptions.developments.length > 0) return;

    setIsLoadingHubSpotImportOptions(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/crm/hubspot/import", { method: "GET" });
      const data = (await response.json().catch(() => null)) as
        | (HubSpotImportOptions & { error?: string })
        | null;

      if (!response.ok || !data) {
        throw new Error(data?.error || "No se pudieron cargar los filtros de HubSpot");
      }

      setHubSpotImportOptions({
        owners: data.owners || [],
        developments: data.developments || [],
        leadStatuses: data.leadStatuses?.length
          ? data.leadStatuses
          : effectiveLeadStatusOptions,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los filtros de HubSpot");
    } finally {
      setIsLoadingHubSpotImportOptions(false);
    }
  };

  const toggleHubSpotImportPanel = () => {
    setIsHubSpotImportOpen((current) => {
      const next = !current;
      if (next) void loadHubSpotImportOptions();
      return next;
    });
  };

  const toggleImportValue = (
    value: string,
    selectedValues: string[],
    setter: (values: string[]) => void
  ) => {
    setter(
      selectedValues.includes(value)
        ? selectedValues.filter((item) => item !== value)
        : [...selectedValues, value]
    );
  };

  const importHubSpotContacts = async () => {
    setIsImportingHubSpot(true);
    setError("");
    setNotice("");

    try {
      type ImportResult = {
            leads?: CrmLead[];
            imported?: number;
            created?: number;
            updated?: number;
            skipped?: number;
            skippedWithoutEmail?: number;
            skippedByDevelopment?: number;
            failed?: number;
            importedActivities?: number;
            failedActivities?: number;
            activityContactsProcessed?: number;
            activityContactsSkipped?: number;
            maxActivityContactsPerImport?: number;
            unavailableActivityTypes?: string[];
            capped?: boolean;
            maxImported?: number;
            nextAfter?: string;
            hasMore?: boolean;
            error?: string;
          };
      const totals: ImportResult = {};
      let after = "";
      let data: ImportResult | null = null;

      do {
        const response = await fetch("/api/crm/hubspot/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerIds: hubSpotOwnerIds,
            developmentIds: hubSpotDevelopmentIds,
            leadStatuses: hubSpotLeadStatuses,
            after,
          }),
        });
        data = (await response.json().catch(() => null)) as ImportResult | null;
        if (!response.ok || !data) {
          throw new Error(data?.error || "No se pudo importar desde HubSpot");
        }
        for (const key of ["imported", "created", "updated", "skipped", "skippedWithoutEmail", "skippedByDevelopment", "failed", "importedActivities", "failedActivities", "activityContactsProcessed", "activityContactsSkipped"] as const) {
          totals[key] = (totals[key] || 0) + (data[key] || 0);
        }
        totals.leads = data.leads;
        totals.unavailableActivityTypes = Array.from(new Set([...(totals.unavailableActivityTypes || []), ...(data.unavailableActivityTypes || [])]));
        after = data.nextAfter || "";
        if (after) setNotice(`Sincronizando HubSpot… ${totals.imported || 0} contactos procesados.`);
      } while (after);

      data = { ...totals, leads: data?.leads };
      if (!data.leads) throw new Error("No se pudo actualizar la lista de contactos");

      setLeads(data.leads);
      setSelectedLeadIds((current) => current.filter((leadId) => data.leads!.some((lead) => lead.id === leadId)));
      setOwnerFilter("all");
      setSortState(CRM_DEFAULT_SORT);
      setNotice(
        `HubSpot sincronizado: ${data.created || 0} nuevos, ${data.updated || 0} actualizados, ${data.skipped || 0} omitidos${
          data.skippedWithoutEmail ? ` (${data.skippedWithoutEmail} sin email)` : ""
        }${
          data.skippedByDevelopment ? `, ${data.skippedByDevelopment} fuera del desarrollo elegido` : ""
        }${
          data.failed ? `, ${data.failed} con error de guardado` : ""
        }. Actividades importadas: ${data.importedActivities || 0}${
          data.failedActivities ? ` (${data.failedActivities} no se pudieron traer)` : ""
        }${
          data.activityContactsSkipped
            ? ` Se guardaron actividades para los primeros ${data.activityContactsProcessed || data.maxActivityContactsPerImport || 0} contactos de esta tanda; el resto se puede completar en otra importación.`
            : ""
        }.${
          data.unavailableActivityTypes?.length
            ? ` HubSpot no permitió leer: ${data.unavailableActivityTypes.join(", ")}.`
            : ""
        }${data.capped ? ` Se importó hasta el máximo configurado (${data.maxImported}).` : ""}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo importar desde HubSpot");
    } finally {
      setIsImportingHubSpot(false);
    }
  };

  const importExcelContacts = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsImportingExcel(true);
    setError("");
    setNotice("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/crm/import-excel", { method: "POST", body: formData });
      const data = (await response.json().catch(() => null)) as
        | { leads?: CrmLead[]; created?: number; updated?: number; skipped?: number; errors?: string[]; error?: string }
        | null;
      if (!response.ok || !data?.leads) {
        throw new Error(data?.error || "No se pudo importar el archivo Excel");
      }

      setLeads(data.leads);
      setSelectedLeadIds([]);
      setOwnerFilter("all");
      setNotice(
        `Excel importado: ${data.created || 0} nuevos, ${data.updated || 0} actualizados, ${data.skipped || 0} omitidos.${
          data.errors?.length ? ` Primeros errores: ${data.errors.slice(0, 3).join(" ")}` : ""
        }`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo importar el archivo Excel");
    } finally {
      setIsImportingExcel(false);
    }
  };

  const deleteSelectedLeads = async () => {
    if (!canAssignTeam || selectedLeadIds.length === 0) return;

    const selectedNames = leads
      .filter((lead) => selectedLeadIds.includes(lead.id))
      .map(leadFullName)
      .filter(Boolean);
    const confirmed = window.confirm(
      `¿Estás seguro de borrar ${selectedLeadIds.length} contacto${
        selectedLeadIds.length !== 1 ? "s" : ""
      }?\n\n${selectedNames.slice(0, 6).join("\n")}${
        selectedNames.length > 6 ? `\n...y ${selectedNames.length - 6} más` : ""
      }\n\nEsta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    setIsDeletingSelected(true);
    setError("");
    setNotice("");

    try {
      for (const leadId of selectedLeadIds) {
        const response = await fetch(`/api/crm/leads?id=${encodeURIComponent(leadId)}`, {
          method: "DELETE",
        });
        const data = (await response.json().catch(() => null)) as { error?: string } | null;

        if (!response.ok) {
          throw new Error(data?.error || "No se pudo eliminar uno de los contactos");
        }
      }

      const deletedCount = selectedLeadIds.length;
      setSelectedLeadId("");
      setSelectedLeadIds([]);
      await refreshLeads();
      setNotice(`${deletedCount} contacto${deletedCount !== 1 ? "s" : ""} eliminado${deletedCount !== 1 ? "s" : ""}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron eliminar los contactos");
    } finally {
      setIsDeletingSelected(false);
    }
  };

  const startColumnResize = (column: CrmColumnKey, event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = columnWidths[column];

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.max(
        CRM_COLUMN_MIN_WIDTHS[column],
        startWidth + moveEvent.clientX - startX
      );
      setColumnWidths((current) => ({ ...current, [column]: nextWidth }));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const moveColumn = (targetColumn: CrmColumnKey) => {
    if (!draggedColumn || draggedColumn === targetColumn) return;
    setColumnOrder((current) => {
      const withoutDragged = current.filter((column) => column !== draggedColumn);
      const targetIndex = withoutDragged.indexOf(targetColumn);
      if (targetIndex < 0) return current;
      return [
        ...withoutDragged.slice(0, targetIndex),
        draggedColumn,
        ...withoutDragged.slice(targetIndex),
      ];
    });
  };

  const saveTableView = () => {
    window.localStorage.setItem(
      CRM_VIEW_STORAGE_KEY,
      JSON.stringify({
        widths: columnWidths,
        order: columnOrder,
        sort: sortState,
      })
    );
    setViewNotice("Vista guardada");
    window.setTimeout(() => setViewNotice(""), 1800);
  };

  const resetTableView = () => {
    window.localStorage.removeItem(CRM_VIEW_STORAGE_KEY);
    setColumnWidths(CRM_COLUMN_WIDTHS);
    setColumnOrder(CRM_COLUMN_ORDER);
    setSortState(CRM_DEFAULT_SORT);
    setViewNotice("Vista restaurada");
    window.setTimeout(() => setViewNotice(""), 1800);
  };

  const toggleColumnSort = (column: CrmColumnKey) => {
    if (column === "select") return;

    setSortState((current) =>
      current.column === column
        ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" }
    );
    setCurrentPage(1);
  };

  const renderColumnHeader = (column: CrmColumnKey, index: number) => (
    <ResizableTh
      key={column}
      column={column}
      label={CRM_COLUMN_LABELS[column]}
      sortable={column !== "select"}
      sortDirection={sortState.column === column ? sortState.direction : null}
      draggable={column !== "select"}
      isDragging={draggedColumn === column}
      last={index === columnOrder.length - 1}
      onDragStart={() => setDraggedColumn(column)}
      onDragEnd={() => setDraggedColumn(null)}
      onDropColumn={moveColumn}
      onSort={() => toggleColumnSort(column)}
      onResizeStart={startColumnResize}
    >
      {column === "select" && canAssignTeam && (
        <input
          type="checkbox"
          checked={allVisibleSelected}
          aria-checked={someVisibleSelected ? "mixed" : allVisibleSelected}
          onChange={(event) => toggleVisibleSelection(event.target.checked)}
          className="h-4 w-4 rounded border-ink/25 accent-[#006b6b]"
          aria-label="Seleccionar contactos visibles"
        />
      )}
    </ResizableTh>
  );

  const renderLeadCell = (lead: CrmLead, column: CrmColumnKey, isLast: boolean) => {
    const name = leadFullName(lead);
    const borderClass = isLast ? "border-b border-ink/10" : "border-b border-r border-ink/10";

    switch (column) {
      case "select":
        return (
          <td key={column} className={`${borderClass} px-4 py-3 align-middle`}>
            {canAssignTeam && (
              <input
                type="checkbox"
                checked={selectedLeadIds.includes(lead.id)}
                onChange={(event) => toggleLeadSelection(lead.id, event.target.checked)}
                onClick={(event) => event.stopPropagation()}
                className="h-4 w-4 rounded border-ink/25 accent-[#006b6b]"
                aria-label={`Seleccionar ${name}`}
              />
            )}
          </td>
        );
      case "name":
        return (
          <td key={column} className={`${borderClass} px-2 py-3 align-middle`}>
            <div className="flex min-w-0 items-center gap-1.5">
              <Link
                href={`/admin/crm/${lead.id}`}
                className="shrink-0 rounded-full p-0.5 text-ink/45 transition-colors hover:bg-ink/8 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006b6b]/35"
                aria-label={`Ver ficha de ${name}`}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink/8 text-[10px] font-semibold text-ink/68">
                {initials(name)}
              </span>
              <Link
                href={`/admin/crm/${lead.id}`}
                className="inline-flex min-w-0 items-center gap-1 truncate text-left font-semibold text-[#006b6b] underline-offset-4 transition-colors hover:text-[#004f4f] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006b6b]/35"
                title="Ver ficha del contacto"
              >
                <span className="truncate">{name}</span>
              </Link>
            </div>
          </td>
        );
      case "email":
        return (
          <td key={column} className={`${borderClass} truncate px-4 py-3 align-middle font-semibold text-[#006b6b]`}>
            <button
              type="button"
              onClick={() => openLeadEmailComposer(lead)}
              className="max-w-full truncate underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006b6b]/35"
              title="Enviar mail desde el CRM"
            >
              {lead.email}
            </button>
          </td>
        );
      case "phone":
      case "whatsapp":
        return (
          <td
            key={column}
            onClick={(event) => {
              event.stopPropagation();
              openPhoneEditor(lead, column);
            }}
            className={`${borderClass} relative cursor-text px-3 py-2 align-middle font-semibold text-[#006b6b] transition-colors hover:bg-white`}
            title={`Click en el casillero para editar ${column === "phone" ? "teléfono" : "WhatsApp"}`}
          >
            {column === "phone" ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openLeadCallSession(lead);
                }}
                onDoubleClick={(event) => event.stopPropagation()}
                className="inline-flex h-9 max-w-full min-w-0 items-center rounded-md px-2 text-left underline-offset-4 transition-colors hover:bg-[#006b6b]/8 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006b6b]/35"
                title="Iniciar llamada y registrar seguimiento"
              >
                <span className="truncate">{formattedLeadPhone(lead)}</span>
              </button>
            ) : (
              <button
                type="button"
              onClick={(event) => {
                event.stopPropagation();
                openLeadWhatsAppComposer(lead);
              }}
              onDoubleClick={(event) => event.stopPropagation()}
                className="inline-flex h-9 max-w-full min-w-0 items-center rounded-md px-2 text-left underline-offset-4 transition-colors hover:bg-[#006b6b]/8 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006b6b]/35"
                title="Preparar WhatsApp con plantilla"
              >
                <span className="truncate">{formattedLeadPhone(lead)}</span>
              </button>
            )}
            {phoneEditor?.leadId === lead.id && phoneEditor.column === column && (
              <InlinePhoneEditor
                value={phoneEditor}
                isSaving={updatingLeadFieldId === `${lead.id}:${column}`}
                onChange={setPhoneEditor}
                onSave={() => void savePhoneEditor()}
                onCancel={() => setPhoneEditor(null)}
              />
            )}
          </td>
        );
      case "status":
        return (
          <td key={column} className={`${borderClass} px-3 py-2 align-middle`}>
            <InlineTableSelect
              value={lead.status}
              disabled={updatingLeadFieldId === `${lead.id}:status`}
              options={leadStatusOptionsForValue(effectiveLeadStatusOptions, lead.status)}
              onChange={(value) =>
                void saveInlineLeadField(lead.id, "status", {
                  status: value as CrmLeadStatus,
                })
              }
              ariaLabel={`Estado del lead de ${name}`}
            />
          </td>
        );
      case "temperature":
        return (
          <td key={column} className={`${borderClass} px-3 py-2 align-middle`}>
            <InlineTableSelect
              value={lead.temperature || ""}
              disabled={updatingLeadFieldId === `${lead.id}:temperature`}
              options={CRM_TEMPERATURE_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onChange={(value) =>
                void saveInlineLeadField(lead.id, "temperature", {
                  temperature: value as CrmLeadTemperature,
                })
              }
              ariaLabel={`Prioridad de ${name}`}
            />
          </td>
        );
      case "development":
        return (
          <td key={column} className={`${borderClass} px-3 py-2 align-middle`}>
            <InlineTableSelect
              value={lead.developmentId || ""}
              disabled={updatingLeadFieldId === `${lead.id}:development`}
              options={[
                { value: "", label: lead.developmentName || "Sin definir" },
                ...crmDevelopments.map((development) => ({
                  value: development.id,
                  label: development.name,
                })),
              ]}
              onChange={(value) => {
                const selectedDevelopment = crmDevelopments.find(
                  (development) => development.id === value
                );
                void saveInlineLeadField(
                  lead.id,
                  "development",
                  value.startsWith("text:")
                    ? {
                        developmentId: "",
                        developmentNameText: selectedDevelopment?.name || value.replace(/^text:/, ""),
                      }
                    : {
                        developmentId: value,
                        developmentNameText: selectedDevelopment?.name || "",
                      }
                );
              }}
              ariaLabel={`Desarrollo consultado por ${name}`}
            />
          </td>
        );
      case "createdAt":
        return (
          <td key={column} className={`${borderClass} truncate px-4 py-3 align-middle text-ink/65`}>
            {formatLeadCreationDate(lead.createdAt)}
          </td>
        );
      case "owner":
        return (
          <td key={column} className={`${borderClass} px-3 py-2 align-middle`}>
            <InlineTableSelect
              value={lead.assignedAgentId || ""}
              disabled={!canAssignTeam || updatingLeadFieldId === `${lead.id}:owner`}
              options={[
                { value: "", label: "Sin asignar" },
                ...activeAgents.map((agent) => ({
                  value: agent.id,
                  label: agent.name || agent.email,
                })),
              ]}
              onChange={(value) =>
                void saveInlineLeadField(lead.id, "owner", {
                  assignedAgentId: value,
                })
              }
              ariaLabel={`Propietario del contacto ${name}`}
            />
          </td>
        );
    }
  };

  const renderMobileLeadCard = (lead: CrmLead) => {
    const name = leadFullName(lead);
    const phone = formattedLeadPhone(lead);
    const developmentName =
      crmDevelopments.find((development) => development.id === lead.developmentId)?.name ||
      lead.developmentNameText ||
      "Sin definir";

    return (
      <article
        key={lead.id}
        className="relative border-b border-ink/10 bg-white px-4 py-4 text-ink last:border-b-0"
      >
        <div className="flex items-start gap-3">
          {canAssignTeam && (
            <input
              type="checkbox"
              checked={selectedLeadIds.includes(lead.id)}
              onChange={(event) => toggleLeadSelection(lead.id, event.target.checked)}
              className="mt-1 h-5 w-5 rounded border-ink/25 bg-white accent-[#005c5c]"
              aria-label={`Seleccionar ${name}`}
            />
          )}
          <Link
            href={`/admin/crm/${lead.id}`}
            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream-100 text-xs font-semibold text-ink"
            aria-label={`Abrir contacto ${name}`}
          >
            {initials(name)}
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              href={`/admin/crm/${lead.id}`}
              className="block max-w-full truncate text-left text-[22px] font-semibold leading-tight text-[#005c5c] underline-offset-4 hover:underline"
            >
              {name || "Sin nombre"}
            </Link>
            <dl className="mt-2 space-y-1 text-[15px] leading-snug text-ink/72">
              <div className="min-w-0 truncate">
                <dt className="inline text-ink/48">Correo: </dt>
                <dd className="inline">{lead.email || "--"}</dd>
              </div>
              <div className="min-w-0 truncate">
                <dt className="inline text-ink/48">Número de teléfono: </dt>
                <dd className="inline">{phone || "--"}</dd>
              </div>
              <div className="min-w-0 truncate">
                <dt className="inline text-ink/48">Estado del lead: </dt>
                <dd className="inline">{leadStatusLabel(lead.status)}</dd>
              </div>
              <div className="min-w-0 truncate">
                <dt className="inline text-ink/48">Desarrollo: </dt>
                <dd className="inline">{developmentName}</dd>
              </div>
              <div className="min-w-0 truncate">
                <dt className="inline text-ink/48">Fecha de creación: </dt>
                <dd className="inline">{formatInteractionDateTime(lead.createdAt)}</dd>
              </div>
            </dl>
          </div>
          <button
            type="button"
            onClick={() => openLead(lead)}
            className="mt-1 rounded-full p-2 text-ink/38 transition-colors hover:bg-cream-100 hover:text-ink"
            aria-label={`Ver detalle de ${name}`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {phoneEditor?.leadId === lead.id && (
          <InlinePhoneEditor
            value={phoneEditor}
            isSaving={updatingLeadFieldId === `${lead.id}:${phoneEditor.column}`}
            onChange={setPhoneEditor}
            onSave={() => void savePhoneEditor()}
            onCancel={() => setPhoneEditor(null)}
          />
        )}
      </article>
    );
  };

  return (
    <div className="min-h-[calc(100vh-7rem)] rounded-lg border border-ink/12 bg-[#f7f7f5] text-ink sm:rounded-xl max-lg:-mx-3 max-lg:-my-3 max-lg:min-h-[calc(100vh-3.5rem)] max-lg:overflow-hidden max-lg:rounded-none max-lg:border-0 max-lg:bg-[#efe7da]">
      <CrmContactAssistant canViewAll={canAssignTeam} />
      <div className="border-b border-ink/10 bg-[#f4efe7] px-4 pt-6 text-ink lg:hidden">
        <div className="flex items-center justify-between">
          <span className="h-11 w-11" aria-hidden="true" />
          <h1 className="text-2xl font-semibold tracking-tight">Contactos</h1>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#005c5c] transition-colors hover:bg-white"
            aria-label="Agregar contacto"
          >
            <Plus className="h-8 w-8 stroke-[1.7]" />
          </button>
        </div>
        <div className="mt-4 flex items-end gap-4 overflow-x-auto">
          <button
            type="button"
            className="shrink-0 border-b-4 border-[#005c5c] px-1 pb-3 text-lg font-semibold text-ink"
          >
            Mis contactos
          </button>
          <button
            type="button"
            className="mb-3 shrink-0 rounded-full bg-white px-4 py-2 text-base font-semibold text-ink/48 shadow-sm"
            aria-label="Agregar vistas"
          >
            Agregar vistas (1/5)
          </button>
        </div>
      </div>

      <div className="hidden flex-col gap-4 border-b border-ink/12 bg-white px-4 py-4 lg:flex lg:flex-row lg:items-center lg:justify-between lg:px-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Contactos</h1>
            <ChevronDown className="h-4 w-4 text-ink/60" />
          </div>
          <p className="mt-1 text-sm text-ink/58">
            {isTouchWorkspace
              ? "Vista móvil optimizada para llamar, escribir y actualizar contactos."
              : "CRM de Barrera Brokers para seguimiento comercial, consultas y actividades."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAssignTeam && (
            <>
              <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-ink/15 bg-white px-5 text-sm font-medium text-ink transition-colors hover:bg-cream-100 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#005c5c]">
                {isImportingExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                {isImportingExcel ? "Importando…" : "Importar Excel"}
                <input
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="sr-only"
                  disabled={isImportingExcel}
                  onChange={importExcelContacts}
                />
              </label>
              <button
                type="button"
                onClick={toggleHubSpotImportPanel}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-ink/15 bg-white px-5 text-sm font-medium text-ink transition-colors hover:bg-cream-100"
              >
                <CloudDownload className="h-4 w-4" />
                Importar HubSpot
                <ChevronDown className={`h-4 w-4 transition-transform ${isHubSpotImportOpen ? "rotate-180" : ""}`} />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#005c5c] px-5 text-sm font-medium text-white transition-colors hover:bg-[#004949]"
          >
            <Plus className="h-4 w-4" />
            Agregar contacto
          </button>
        </div>
      </div>

      {canAssignTeam && isHubSpotImportOpen && (
        <section className="border-b border-ink/12 bg-[#f1efea] px-5 py-5">
          <div className="rounded-2xl border border-ink/12 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">
                  Importación desde HubSpot
                </p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">
                  Elegí qué contactos querés traer
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink/58">
                  Si dejás un grupo en “Todos”, se importan todos los valores de ese campo. Los contactos se ordenan por fecha de creación desde hoy hacia atrás.
                </p>
              </div>
              <button
                type="button"
                onClick={importHubSpotContacts}
                disabled={isImportingHubSpot || isLoadingHubSpotImportOptions}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#005c5c] px-5 text-sm font-medium text-white transition-colors hover:bg-[#004949] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isImportingHubSpot ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
                Importar seleccionados
              </button>
            </div>

            {isLoadingHubSpotImportOptions ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-40 animate-pulse rounded-xl border border-ink/10 bg-cream-50" />
                ))}
              </div>
            ) : (
              <div className="mt-4 grid gap-3 xl:grid-cols-3">
                <HubSpotFilterGroup
                  title="Propietario"
                  description="Elegí uno o varios propietarios del contacto."
                  allLabel="Todos los propietarios"
                  options={hubSpotImportOptions.owners.map((owner) => ({
                    value: owner.id,
                    label: owner.name,
                    detail: owner.email,
                  }))}
                  selectedValues={hubSpotOwnerIds}
                  onToggle={(value) => toggleImportValue(value, hubSpotOwnerIds, setHubSpotOwnerIds)}
                  onAll={() => setHubSpotOwnerIds([])}
                />
                <HubSpotFilterGroup
                  title="Desarrollo"
                  description="Se matchea con el desarrollo detectado desde HubSpot."
                  allLabel="Todos los desarrollos"
                  options={hubSpotImportOptions.developments.map((development) => ({
                    value: development.id,
                    label: development.name,
                  }))}
                  selectedValues={hubSpotDevelopmentIds}
                  onToggle={(value) => toggleImportValue(value, hubSpotDevelopmentIds, setHubSpotDevelopmentIds)}
                  onAll={() => setHubSpotDevelopmentIds([])}
                />
                <HubSpotFilterGroup
                  title="Estado del lead"
                  description="Usa los estados disponibles como en HubSpot."
                  allLabel="Todos los estados"
                  options={hubSpotImportOptions.leadStatuses.map((status) => ({
                    value: status.value,
                    label: status.label,
                  }))}
                  selectedValues={hubSpotLeadStatuses}
                  onToggle={(value) => toggleImportValue(value, hubSpotLeadStatuses, setHubSpotLeadStatuses)}
                  onAll={() => setHubSpotLeadStatuses([])}
                />
              </div>
            )}
          </div>
        </section>
      )}

      <div className="hidden border-b border-ink/12 bg-white px-5 lg:block">
        <div className="flex gap-5 overflow-x-auto">
          {canAssignTeam && (
            <button
              type="button"
              onClick={() => setOwnerFilter("all")}
              className={`flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-1 text-sm font-medium ${
                ownerFilter === "all"
                  ? "border-ink text-ink"
                  : "border-transparent text-ink/55 hover:text-ink"
              }`}
            >
              Todos contactos
            </button>
          )}
          {activeAgents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => setOwnerFilter(agent.id)}
              className={`flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-1 text-sm font-medium ${
                ownerFilter === agent.id
                  ? "border-ink text-ink"
                  : "border-transparent text-ink/55 hover:text-ink"
              }`}
            >
              {agent.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-[720px] max-lg:min-h-0 xl:grid-cols-1">
        <section className="min-w-0 bg-white max-lg:bg-[#efe7da]">
          <div className="border-b border-ink/10 bg-[#f4efe7] p-4 lg:hidden">
            <label className="relative block w-full">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-ink/42" />
              <input
                id="crm-mobile-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-14 w-full rounded-lg border border-ink/12 bg-white pl-12 pr-4 text-xl font-semibold text-ink shadow-sm outline-none transition-colors placeholder:text-ink/42 focus:border-[#005c5c]"
                placeholder="Buscar"
              />
            </label>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {canAssignTeam && (
                <select
                  value={ownerFilter}
                  onChange={(event) => setOwnerFilter(event.target.value)}
                  className="h-11 min-w-[238px] shrink-0 rounded-full border border-ink/18 bg-white px-4 text-sm font-semibold text-ink outline-none focus:border-[#005c5c]"
                  aria-label="Filtrar por propietario del contacto"
                >
                  <option value="all">Propietario del contacto</option>
                  {activeAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() =>
                  setSortState((current) => ({
                    column: "createdAt",
                    direction: current.column === "createdAt" && current.direction === "desc" ? "asc" : "desc",
                  }))
                }
                className="inline-flex h-11 min-w-[185px] shrink-0 items-center justify-center gap-2 rounded-full border border-ink/18 bg-white px-4 text-sm font-semibold text-ink/80 shadow-sm"
              >
                Fecha de creación
                {sortState.column === "createdAt" && sortState.direction === "asc" ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
              </button>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as CrmLeadStatus | "all")}
                className="h-11 min-w-[170px] shrink-0 rounded-full border border-ink/18 bg-white px-4 text-sm font-semibold text-ink/80 outline-none focus:border-[#005c5c]"
                aria-label="Filtrar por estado del lead"
              >
                <option value="all">Estado del lead</option>
                {effectiveLeadStatusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="hidden flex-col gap-3 border-b border-ink/12 p-3 sm:p-4 lg:flex lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block w-full lg:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-11 w-full rounded-full border border-ink/20 bg-white pl-9 pr-4 text-sm text-ink outline-none transition-colors placeholder:text-ink/45 focus:border-[#005c5c]"
                placeholder="Buscar contacto"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {canAssignTeam && selectedLeadIds.length > 0 && (
                <button
                  type="button"
                  onClick={deleteSelectedLeads}
                  disabled={isDeletingSelected}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeletingSelected ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Eliminar {selectedLeadIds.length}
                </button>
              )}
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as CrmLeadStatus | "all")}
                className="h-11 rounded-full border border-ink/20 bg-white px-4 text-sm text-ink outline-none focus:border-[#005c5c]"
              >
                <option value="all">Estado del lead</option>
                {effectiveLeadStatusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <span className="inline-flex min-h-11 items-center rounded-full border border-ink/12 bg-cream-100 px-4 text-sm text-ink/62">
                {sortedLeads.length} contacto{sortedLeads.length !== 1 ? "s" : ""}
              </span>
              <label className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/12 bg-white px-4 text-sm text-ink/65">
                <span>Por página</span>
                <select
                  value={pageSize}
                  onChange={(event) =>
                    setPageSize(Number(event.target.value) as (typeof CRM_PAGE_SIZE_OPTIONS)[number])
                  }
                  className="bg-transparent text-sm font-semibold text-ink outline-none"
                  aria-label="Contactos por página"
                >
                  {CRM_PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={saveTableView}
                className="hidden min-h-11 items-center justify-center gap-2 rounded-full border border-[#005c5c]/20 bg-[#005c5c] px-4 text-sm font-medium text-white transition-colors hover:bg-[#004949] lg:inline-flex"
              >
                <Save className="h-4 w-4" />
                Guardar vista
              </button>
              <button
                type="button"
                onClick={resetTableView}
                className="hidden min-h-11 items-center justify-center rounded-full border border-ink/15 bg-white px-4 text-sm font-medium text-ink transition-colors hover:bg-cream-100 lg:inline-flex"
              >
                Restaurar vista
              </button>
            </div>
          </div>

          {error && (
            <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {notice && (
            <div className="mx-4 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {notice}
            </div>
          )}
          {viewNotice && (
            <div className="mx-4 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {viewNotice}
            </div>
          )}

          <div className="bg-[#efe7da] px-4 pb-28 pt-4 text-ink lg:hidden">
            <div className="mb-4 text-[15px] font-semibold leading-tight text-ink/76">
              <p>{sortedLeads.length.toLocaleString("es-AR")} resultados</p>
              <p>
                Ordenado por Fecha de creación{" "}
                {sortState.column === "createdAt" && sortState.direction === "asc" ? "↑" : "↓"}
              </p>
            </div>
            <p className="mb-3 px-4 text-sm font-semibold text-ink/50">Esta semana</p>
            <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm">
              {paginatedLeads.map(renderMobileLeadCard)}
            </div>
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table
              className="border-separate border-spacing-0 table-fixed text-sm"
              style={{ width: tableWidth, minWidth: "100%" }}
            >
              <colgroup>
                {columnOrder.map((column) => (
                  <col key={column} style={{ width: columnWidths[column] }} />
                ))}
              </colgroup>
              <thead>
                <tr className="bg-[#f6f6f4] text-left text-xs font-semibold text-ink">
                  {columnOrder.map(renderColumnHeader)}
                </tr>
              </thead>
              <tbody>
                {paginatedLeads.map((lead) => {
                  const selected = selectedLeadId === lead.id;
                  const rowTone = CRM_TEMPERATURE_ROW_CLASSES[lead.temperature || ""];
                  const rowClass = selected ? rowTone.selected : rowTone.normal;

                  return (
                    <tr
                      key={lead.id}
                      className={`transition-colors ${rowClass}`}
                    >
                      {columnOrder.map((column, index) =>
                        renderLeadCell(lead, column, index === columnOrder.length - 1)
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {sortedLeads.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-ink/12 bg-white px-5 py-4 max-lg:hidden md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-ink/58">
                Mostrando {pageStart}-{pageEnd} de {sortedLeads.length} contactos
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-ink/14 bg-white px-4 text-sm font-medium text-ink transition-colors hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Anterior
                </button>

                {paginationItems(safeCurrentPage, pageCount).map((item, index) =>
                  item === "ellipsis" ? (
                    <span key={`ellipsis-${index}`} className="px-1 text-sm text-ink/40">
                      ...
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCurrentPage(item)}
                      className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-sm font-semibold transition-colors ${
                        item === safeCurrentPage
                          ? "border-[#005c5c] bg-[#005c5c] text-white"
                          : "border-ink/14 bg-white text-ink hover:bg-cream-100"
                      }`}
                      aria-current={item === safeCurrentPage ? "page" : undefined}
                    >
                      {item}
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                  disabled={safeCurrentPage >= pageCount}
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-ink/14 bg-white px-4 text-sm font-medium text-ink transition-colors hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}

          {sortedLeads.length === 0 && (
            <div className="px-5 py-16 text-center">
              <UserRound className="mx-auto h-8 w-8 text-ink/28" />
              <p className="mt-3 text-sm font-medium text-ink">Todavía no hay contactos</p>
              <p className="mt-1 text-sm text-ink/55">
                Agregá el primer lead para empezar el seguimiento comercial.
              </p>
            </div>
          )}
        </section>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-[#f4efe7]/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 text-ink shadow-[0_-16px_40px_rgba(58,29,23,0.08)] backdrop-blur lg:hidden">
          <div className="grid grid-cols-5 gap-1">
            <a
              href="/admin"
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-ink/48 transition-colors hover:bg-white hover:text-ink"
            >
              <Home className="h-6 w-6" />
              <span className="text-xs font-semibold">Inicio</span>
            </a>
            <button
              type="button"
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl bg-white text-[#005c5c] shadow-sm"
            >
              <UserRound className="h-6 w-6" />
              <span className="text-xs font-semibold">Contactos</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedLead) {
                  setActivityType("tarea");
                } else {
                  setNotice("Abrí un contacto para crear una tarea.");
                }
              }}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-ink/48 transition-colors hover:bg-white hover:text-ink"
            >
              <ListChecks className="h-6 w-6" />
              <span className="text-xs font-semibold">Tareas</span>
            </button>
            <a
              href="/admin/crm/operaciones"
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-ink/48 transition-colors hover:bg-white hover:text-ink"
            >
              <LayoutGrid className="h-6 w-6" />
              <span className="text-xs font-semibold">Paneles</span>
            </a>
            <button
              type="button"
              onClick={() => document.getElementById("crm-mobile-search")?.focus()}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-ink/48 transition-colors hover:bg-white hover:text-ink"
            >
              <Search className="h-6 w-6" />
              <span className="text-xs font-semibold">Buscar</span>
            </button>
          </div>
        </nav>

        {(isCreating || selectedLead) && (
          <div className="fixed inset-0 z-50 bg-ink/18 backdrop-blur-[1px]">
            <aside className="ml-auto flex h-full w-full max-w-[520px] flex-col overflow-y-auto border-l border-ink/12 bg-[#f1f1ef] p-4 shadow-2xl">
            {isCreating ? (
            <ContactForm
              form={form}
              activeAgents={activeAgents}
              developments={crmDevelopments}
              leadStatusOptions={effectiveLeadStatusOptions}
              canAssignTeam={canAssignTeam}
              isSaving={isSaving}
              onSubmit={saveLead}
              onCancel={resetForm}
              update={update}
            />
          ) : selectedLead ? (
            <ContactDetail
              lead={selectedLead}
              activities={selectedActivities}
              activeAgents={activeAgents}
              developments={crmDevelopments}
              leadStatusOptions={effectiveLeadStatusOptions}
              canAssignTeam={canAssignTeam}
              activityForm={activityForm}
              isSavingActivity={isSavingActivity}
              onEdit={() => editLead(selectedLead)}
              onClose={() => setSelectedLeadId("")}
              onRefreshLeads={refreshLeads}
              onActivityCreated={(activity) => setActivities((current) => [activity, ...current])}
              onActivityType={setActivityType}
              startEmailComposer={emailComposerLeadId === selectedLead.id}
              onEmailComposerStarted={() => setEmailComposerLeadId("")}
              startWhatsAppComposer={whatsAppComposerLeadId === selectedLead.id}
              onWhatsAppComposerStarted={() => setWhatsAppComposerLeadId("")}
              startCallSession={callSessionLeadId === selectedLead.id}
              onCallSessionStarted={() => setCallSessionLeadId("")}
              updateActivity={updateActivity}
              onSaveActivity={saveActivity}
            />
            ) : null}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function ContactDetail({
  lead,
  activities,
  activeAgents,
  developments,
  leadStatusOptions,
  canAssignTeam,
  activityForm,
  isSavingActivity,
  onEdit,
  onClose,
  onRefreshLeads,
  onActivityCreated,
  onActivityType,
  startEmailComposer,
  onEmailComposerStarted,
  startWhatsAppComposer,
  onWhatsAppComposerStarted,
  startCallSession,
  onCallSessionStarted,
  updateActivity,
  onSaveActivity,
}: {
  lead: CrmLead;
  activities: CrmActivity[];
  activeAgents: CrmAgent[];
  developments: CrmDevelopment[];
  leadStatusOptions: HubSpotImportStatusOption[];
  canAssignTeam: boolean;
  activityForm: ActivityFormState;
  isSavingActivity: boolean;
  onEdit: () => void;
  onClose: () => void;
  onRefreshLeads: () => Promise<void>;
  onActivityCreated: (activity: CrmActivity) => void;
  onActivityType: (type: CrmActivityType) => void;
  startEmailComposer: boolean;
  onEmailComposerStarted: () => void;
  startWhatsAppComposer: boolean;
  onWhatsAppComposerStarted: () => void;
  startCallSession: boolean;
  onCallSessionStarted: () => void;
  updateActivity: (field: keyof ActivityFormState) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => void;
  onSaveActivity: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const name = leadFullName(lead);
  const [isSavingFields, setIsSavingFields] = useState(false);
  const [fieldsError, setFieldsError] = useState("");
  const [fieldsNotice, setFieldsNotice] = useState("");
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [emailSubject, setEmailSubject] = useState("Barrera Brokers");
  const [emailBody, setEmailBody] = useState(`Hola ${lead.firstName},\n\n`);
  const [emailImageUrls, setEmailImageUrls] = useState<string[]>([]);
  const [emailContentBlocks, setEmailContentBlocks] = useState<CrmEmailTemplateContentBlock[]>([]);
  const [showWhatsAppComposer, setShowWhatsAppComposer] = useState(false);
  const [whatsAppBody, setWhatsAppBody] = useState("");
  const [whatsAppError, setWhatsAppError] = useState("");
  const [whatsAppNotice, setWhatsAppNotice] = useState("");
  const [isRegisteringWhatsApp, setIsRegisteringWhatsApp] = useState(false);
  const [whatsAppTarget, setWhatsAppTarget] = useState<"mobile" | "desktop">("desktop");
  const [callSession, setCallSession] = useState<CallSessionState | null>(null);
  const [isSavingCallSession, setIsSavingCallSession] = useState(false);
  const [callSessionError, setCallSessionError] = useState("");
  const [callSessionNotice, setCallSessionNotice] = useState("");
  const [templates, setTemplates] = useState<CrmEmailTemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailNotice, setEmailNotice] = useState("");
  const [contactFields, setContactFields] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    countryCode: string;
    phone: string;
    status: CrmLeadStatus;
    temperature: CrmLeadTemperature;
    developmentId: string;
    developmentNameText: string;
    assignedAgentId: string;
  }>({
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    countryCode: normalizeDialCode(lead.countryCode || "+54"),
    phone: lead.phone,
    status: lead.status,
    temperature: lead.temperature || "",
    developmentId: lead.developmentId || "",
    developmentNameText: lead.developmentNameText || (!lead.developmentId ? lead.developmentName || "" : ""),
    assignedAgentId: lead.assignedAgentId || "",
  });
  const hubspotFields = Object.entries(lead.hubspotProperties || {})
    .map(([key, value]) => [key, formatHubSpotValue(value)] as const)
    .filter(([, value]) => value)
    .filter(([key]) => shouldShowHubSpotContactField(key))
    .slice(0, 28);

  useEffect(() => {
    setContactFields({
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      countryCode: normalizeDialCode(lead.countryCode || "+54"),
      phone: lead.phone,
      status: lead.status,
      temperature: lead.temperature || "",
      developmentId: lead.developmentId || "",
      developmentNameText: lead.developmentNameText || (!lead.developmentId ? lead.developmentName || "" : ""),
      assignedAgentId: lead.assignedAgentId || "",
    });
    setFieldsError("");
    setFieldsNotice("");
    setShowEmailComposer(false);
    setEmailSubject("Barrera Brokers");
    setEmailBody(`Hola ${lead.firstName},\n\n`);
    setEmailImageUrls([]);
    setEmailContentBlocks([]);
    setShowWhatsAppComposer(false);
    setWhatsAppBody("");
    setWhatsAppError("");
    setWhatsAppNotice("");
    setCallSession(null);
    setIsSavingCallSession(false);
    setCallSessionError("");
    setCallSessionNotice("");
    setSelectedTemplateId("");
    setEmailError("");
    setEmailNotice("");
  }, [lead]);

  useEffect(() => {
    if (!startEmailComposer) return;
    setShowEmailComposer(true);
    onEmailComposerStarted();
  }, [onEmailComposerStarted, startEmailComposer]);

  useEffect(() => {
    if (!startWhatsAppComposer) return;
    setShowWhatsAppComposer(true);
    onWhatsAppComposerStarted();
  }, [onWhatsAppComposerStarted, startWhatsAppComposer]);

  useEffect(() => {
    setWhatsAppTarget(isMobilePhoneDevice() ? "mobile" : "desktop");
  }, []);

  useEffect(() => {
    if (!startCallSession) return;
    const startedAt = new Date().toISOString();
    setCallSession({
      startedAt,
      endedAt: "",
      notes: "",
    });
    setCallSessionError("");
    setCallSessionNotice("Llamada iniciada. Al finalizar, registrá el resumen de la conversación.");
    const url = phoneCallUrl(lead);
    if (url) window.open(url, "_self");
    onCallSessionStarted();
  }, [lead, onCallSessionStarted, startCallSession]);

  useEffect(() => {
    if ((!showEmailComposer && !showWhatsAppComposer) || templates.length > 0 || isLoadingTemplates) return;

    setIsLoadingTemplates(true);
    fetch("/api/crm/templates")
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as
          | { templates?: CrmEmailTemplateOption[]; error?: string }
          | null;
        if (!response.ok || !data?.templates) {
          throw new Error(data?.error || "No se pudieron cargar las plantillas");
        }
        setTemplates(data.templates);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "No se pudieron cargar las plantillas";
        setEmailError(message);
      })
      .finally(() => setIsLoadingTemplates(false));
  }, [isLoadingTemplates, showEmailComposer, showWhatsAppComposer, templates.length]);

  const updateContactField =
    (field: keyof typeof contactFields) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setContactFields((current) => ({
        ...current,
        [field]:
          field === "status"
            ? (value as CrmLeadStatus)
            : field === "temperature"
              ? (value as CrmLeadTemperature)
              : value,
      }));
    };

  const saveLeadField = async (payload: LeadFieldPatch) => {
    setIsSavingFields(true);
    setFieldsError("");
    setFieldsNotice("");

    try {
      const response = await fetch("/api/crm/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lead.id,
          ...payload,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo guardar el cambio");
      }

      await onRefreshLeads();
      setFieldsNotice("Guardado");
      window.setTimeout(() => setFieldsNotice(""), 1600);
    } catch (err) {
      setFieldsError(err instanceof Error ? err.message : "No se pudo guardar el cambio");
    } finally {
      setIsSavingFields(false);
    }
  };

  const saveContactFields = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveLeadField({
      firstName: contactFields.firstName,
      lastName: contactFields.lastName,
      email: contactFields.email,
      countryCode: normalizeDialCode(contactFields.countryCode),
      phone: contactFields.phone,
      status: contactFields.status,
      temperature: contactFields.temperature,
      ...(contactFields.developmentId.startsWith("text:")
        ? {
            developmentId: "",
            developmentNameText:
              developments.find((development) => development.id === contactFields.developmentId)?.name ||
              contactFields.developmentId.replace(/^text:/, ""),
          }
        : {
            developmentId: contactFields.developmentId,
            developmentNameText:
              developments.find((development) => development.id === contactFields.developmentId)?.name ||
              contactFields.developmentNameText,
          }),
      assignedAgentId: contactFields.assignedAgentId,
    });
  };

  const sendEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSendingEmail(true);
    setEmailError("");
    setEmailNotice("");

    try {
      const response = await fetch("/api/crm/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          subject: emailSubject,
          body: emailBody,
          imageUrls: emailImageUrls,
          contentBlocks: emailContentBlocks,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { activity?: CrmActivity; activityError?: string; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo enviar el correo.");
      }

      if (data?.activity) {
        onActivityCreated(data.activity);
        setEmailNotice("Correo enviado y registrado en actividades.");
        setShowEmailComposer(false);
      } else {
        setEmailNotice(
          data?.activityError ||
            "Correo enviado, pero no se pudo registrar en el historial. Probá guardar una nota manual con el seguimiento."
        );
      }
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "No se pudo enviar el correo.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const templateVariables = {
    "{{cliente_nombre}}": lead.firstName,
    "{{cliente_apellido}}": lead.lastName,
    "{{cliente_nombre_completo}}": name,
    "{{cliente_email}}": lead.email,
    "{{cliente_telefono}}": formattedLeadPhone(lead),
    "{{desarrollo}}": lead.developmentName || "el desarrollo que consultaste",
    "{{propietario_contacto}}": lead.assignedAgentName || "Barrera Brokers",
  };
  const templateVariableEntries = [
    { token: "{{cliente_nombre}}", label: "Nombre" },
    { token: "{{cliente_nombre_completo}}", label: "Nombre completo" },
    { token: "{{desarrollo}}", label: "Desarrollo" },
    { token: "{{propietario_contacto}}", label: "Propietario" },
    { token: "{{cliente_telefono}}", label: "Teléfono" },
  ];

  const applyTemplateValue = (value: string) =>
    Object.entries(templateVariables).reduce(
      (current, [token, replacement]) => current.replaceAll(token, replacement || ""),
      value
    );

  const templateBlocks = (template: CrmEmailTemplateOption): CrmEmailTemplateContentBlock[] => {
    if (template.contentBlocks?.length) {
      return template.contentBlocks.map((block) =>
        block.type === "text"
          ? {
              ...block,
              text: applyTemplateValue(block.text),
              html: block.html ? applyTemplateValue(block.html) : block.html,
            }
          : block.type === "button"
            ? {
                ...block,
                label: applyTemplateValue(block.label),
                url: applyTemplateValue(block.url),
              }
            : block
      );
    }

    return [
      { id: "legacy-text", type: "text", text: applyTemplateValue(template.body) },
      ...template.imageUrls.map((url, index) => ({
        id: `legacy-image-${index}`,
        type: "image" as const,
        url,
        width: 100,
        align: "center" as const,
      })),
    ];
  };

  const textFromTemplateBlocks = (blocks: CrmEmailTemplateContentBlock[]) =>
    blocks
      .map((block) => {
        if (block.type === "text") return block.text;
        if (block.type === "button") return `${block.label}: ${block.url}`;
        if (block.type === "attachment") return `${block.name}: ${block.url}`;
        return "";
      })
      .filter(Boolean)
      .join("\n\n")
      .trim();

  const imageUrlsFromTemplateBlocks = (blocks: CrmEmailTemplateContentBlock[]) =>
    blocks
      .filter((block): block is Extract<CrmEmailTemplateContentBlock, { type: "image" }> => block.type === "image")
      .map((block) => block.url);

  const stripTemplateHtml = (value: string) => {
    const element = document.createElement("div");
    element.innerHTML = value;
    return element.textContent || "";
  };

  const applyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (!template) {
      setEmailContentBlocks([]);
      setEmailImageUrls([]);
      return;
    }

    setEmailSubject(applyTemplateValue(template.subject));
    const blocks = templateBlocks(template);
    setEmailBody(textFromTemplateBlocks(blocks));
    setEmailImageUrls(imageUrlsFromTemplateBlocks(blocks));
    setEmailContentBlocks(blocks);
    setEmailNotice(`Plantilla aplicada: ${template.name}`);
  };

  const emailTemplates = templates.filter((template) => (template.channel || "email") === "email");
  const whatsappTemplates = templates.filter((template) => template.channel === "whatsapp");

  const applyWhatsAppTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setWhatsAppBody(applyTemplateValue(template.body || defaultWhatsAppBody()));
    setWhatsAppNotice(`Plantilla aplicada: ${template.name}`);
    setWhatsAppError("");
  };

  const defaultWhatsAppBody = () =>
    `Hola {{cliente_nombre}}, soy {{propietario_contacto}}\n\nTe escribo por una consulta que nos dejaste sobre nuestro Desarrollo {{desarrollo}}.`;

  const insertWhatsAppVariable = (token: string) => {
    setWhatsAppBody((current) => `${current || defaultWhatsAppBody()} ${token}`.trimStart());
    setWhatsAppNotice("");
    setWhatsAppError("");
  };

  const whatsAppText = applyTemplateValue(whatsAppBody || defaultWhatsAppBody()).trim();
  const currentWhatsAppMessage = whatsAppText;
  const currentWhatsAppUrl = whatsappUrl(lead, currentWhatsAppMessage, whatsAppTarget);

  const registerWhatsAppActivity = async () => {
    const message = currentWhatsAppMessage;

    if (!currentWhatsAppUrl) {
      setWhatsAppError("El contacto no tiene un número de WhatsApp válido.");
      return;
    }

    setWhatsAppError("");
    setWhatsAppNotice("WhatsApp abierto. Registrando actividad...");
    setIsRegisteringWhatsApp(true);

    try {
      const response = await fetch("/api/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          type: "whatsapp",
          title: `WhatsApp con ${lead.firstName}`,
          body: message,
          scheduledAt: new Date().toISOString(),
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { activity?: CrmActivity; error?: string }
        | null;

      if (!response.ok || !data?.activity) {
        throw new Error(data?.error || "No se pudo registrar el WhatsApp en el historial.");
      }

      onActivityCreated(data.activity);
      setWhatsAppNotice("WhatsApp registrado en actividades.");
      setShowWhatsAppComposer(false);
    } catch (err) {
      setWhatsAppError(
        err instanceof Error
          ? `${err.message} WhatsApp ya quedó abierto para que puedas continuar.`
          : "No se pudo registrar el WhatsApp. WhatsApp ya quedó abierto para que puedas continuar."
      );
    } finally {
      setIsRegisteringWhatsApp(false);
    }
  };

  const startCallFromDetail = () => {
    const startedAt = new Date().toISOString();
    setCallSession({
      startedAt,
      endedAt: "",
      notes: "",
    });
    setCallSessionError("");
    setCallSessionNotice("Llamada iniciada. Al finalizar, registrá el resumen de la conversación.");
    const url = phoneCallUrl(lead);
    if (url) window.open(url, "_self");
  };

  const finishCallSession = () => {
    setCallSession((current) =>
      current
        ? {
            ...current,
            endedAt: current.endedAt || new Date().toISOString(),
          }
        : current
    );
    setCallSessionNotice("Llamada finalizada. Agregá el resumen y guardala en el historial.");
  };

  const saveCallSession = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!callSession) return;

    const endedAt = callSession.endedAt || new Date().toISOString();
    const duration = formatInteractionDuration(callSession.startedAt, endedAt);
    const notes = callSession.notes.trim();
    const body = [
      `Inicio: ${formatInteractionDateTime(callSession.startedAt)}`,
      `Finalización: ${formatInteractionDateTime(endedAt)}`,
      `Duración aproximada: ${duration}`,
      notes ? `Resumen:\n${notes}` : "Resumen: sin notas cargadas.",
    ].join("\n\n");

    setIsSavingCallSession(true);
    setCallSessionError("");
    setCallSessionNotice("");

    try {
      const response = await fetch("/api/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          type: "llamada",
          title: `Llamada con ${lead.firstName}`,
          body,
          scheduledAt: callSession.startedAt,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { activity?: CrmActivity; error?: string }
        | null;

      if (!response.ok || !data?.activity) {
        throw new Error(data?.error || "No se pudo guardar la llamada.");
      }

      onActivityCreated(data.activity);
      setCallSession(null);
      setCallSessionNotice("Llamada registrada en el historial.");
    } catch (err) {
      setCallSessionError(err instanceof Error ? err.message : "No se pudo guardar la llamada.");
    } finally {
      setIsSavingCallSession(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-ink/12 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink/8 text-sm font-semibold text-ink/70">
              {initials(name)}
            </span>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-ink">{name}</h2>
              <button
                type="button"
                onClick={() => setShowEmailComposer(true)}
                className="mt-1 block text-left text-sm font-semibold text-[#006b6b] underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006b6b]/35"
              >
                {lead.email}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md border border-ink/15 px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-cream-100"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-ink/15 px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-cream-100"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-5 gap-2">
          <ActionButton label="Nota" icon={NotebookPen} onClick={() => onActivityType("nota")} />
          <ActionButton label="Correo" icon={Mail} onClick={() => setShowEmailComposer((value) => !value)} />
          <ActionButton label="WhatsApp" icon={MessageCircle} onClick={() => setShowWhatsAppComposer((value) => !value)} />
          <ActionButton label="Llamada" icon={Phone} onClick={startCallFromDetail} />
          <ActionButton label="Reunión" icon={CalendarDays} onClick={() => onActivityType("reunion")} />
        </div>
      </section>

      {callSession && (
        <form onSubmit={saveCallSession} className="rounded-xl border border-[#006b6b]/20 bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">Registrar llamada</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink/55">
                La llamada se inició desde el CRM. Al cortar, finalizala y dejá el resumen para el historial.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCallSession(null)}
              className="rounded-md border border-ink/15 px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-cream-100"
            >
              Cerrar
            </button>
          </div>

          <div className="mt-4 grid gap-3 rounded-lg border border-ink/10 bg-cream-50 p-3 sm:grid-cols-2">
            <InfoRow label="Inicio de llamada" value={formatInteractionDateTime(callSession.startedAt)} />
            <InfoRow
              label="Finalización"
              value={callSession.endedAt ? formatInteractionDateTime(callSession.endedAt) : "En curso"}
            />
            <InfoRow
              label="Duración aproximada"
              value={formatInteractionDuration(callSession.startedAt, callSession.endedAt || new Date().toISOString())}
            />
            <InfoRow label="Contacto" value={formattedLeadPhone(lead)} />
          </div>

          <Field label="Conversación con el cliente">
            <textarea
              value={callSession.notes}
              onChange={(event) =>
                setCallSession((current) =>
                  current
                    ? {
                        ...current,
                        notes: event.target.value,
                      }
                    : current
                )
              }
              className="form-input mt-3 min-h-32"
              placeholder="Interés, presupuesto, objeciones, próximo paso, documentación enviada..."
            />
          </Field>

          {callSessionError && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {callSessionError}
            </p>
          )}
          {callSessionNotice && (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
              {callSessionNotice}
            </p>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={finishCallSession}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-ink/15 px-4 text-sm font-medium text-ink transition-colors hover:bg-cream-100"
            >
              <Phone className="h-4 w-4" />
              Finalizar llamada
            </button>
            <button
              type="submit"
              disabled={isSavingCallSession}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#005c5c] px-4 text-sm font-medium text-white transition-colors hover:bg-[#004949] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingCallSession ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Guardar en historial
            </button>
          </div>
        </form>
      )}

      {showWhatsAppComposer && (
        <form onSubmit={(event) => event.preventDefault()} className="rounded-xl border border-ink/12 bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">Preparar WhatsApp</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink/55">
                Revisá el texto antes de abrir WhatsApp. Las variables se reemplazan automáticamente.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowWhatsAppComposer(false)}
              className="rounded-md border border-ink/15 px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-cream-100"
            >
              Cerrar
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <section className="rounded-xl border border-ink/12 bg-cream-50 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/55">
                    Plantillas de WhatsApp
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    Elegí un mensaje guardado y ajustalo antes de enviarlo.
                  </p>
                </div>
                <a
                  href="/admin/crm/plantillas"
                  className="inline-flex min-h-9 items-center justify-center rounded-lg border border-ink/15 bg-white px-3 text-xs font-medium text-ink transition-colors hover:bg-cream-100"
                >
                  Administrar plantillas
                </a>
              </div>

              {isLoadingTemplates ? (
                <div className="mt-3 h-16 animate-pulse rounded-lg border border-ink/10 bg-white" />
              ) : whatsappTemplates.length > 0 ? (
                <div className="mt-3 grid max-h-[360px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {whatsappTemplates.map((template) => {
                    const selected = selectedTemplateId === template.id;

                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyWhatsAppTemplate(template.id)}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          selected
                            ? "border-[#005c5c] bg-[#005c5c] text-white"
                            : "border-ink/12 bg-white text-ink hover:border-[#005c5c]/40"
                        }`}
                      >
                        <span className={selected ? "text-[11px] uppercase tracking-[0.14em] text-white/70" : "text-[11px] uppercase tracking-[0.14em] text-ink/45"}>
                          {template.category || "WhatsApp"}
                        </span>
                        <strong className="mt-1 block text-sm">{template.name}</strong>
                        <span className={selected ? "mt-1 block truncate text-xs text-white/70" : "mt-1 block truncate text-xs text-ink/50"}>
                          {template.body || "Mensaje de WhatsApp"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-dashed border-ink/18 bg-white px-4 py-5 text-sm text-ink/60">
                  Todavía no hay plantillas de WhatsApp guardadas.
                </div>
              )}
            </section>

            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-ink/45">
                Variables
              </p>
              <div className="flex flex-wrap gap-2">
                {templateVariableEntries.map((variable) => (
                  <button
                    key={variable.token}
                    type="button"
                    onClick={() => insertWhatsAppVariable(variable.token)}
                    className="rounded-full border border-ink/14 bg-white px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-[#006b6b]/35 hover:bg-[#006b6b]/5"
                  >
                    {variable.label}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Mensaje de WhatsApp">
              <textarea
                value={whatsAppBody || defaultWhatsAppBody()}
                onChange={(event) => {
                  setWhatsAppBody(event.target.value);
                  setWhatsAppNotice("");
                }}
                className="form-input min-h-40"
                required
              />
            </Field>

            <div className="rounded-lg border border-ink/10 bg-cream-50 p-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink/45">
                Vista previa
              </p>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">
                {currentWhatsAppMessage}
              </p>
            </div>
          </div>

          {whatsAppError && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {whatsAppError}
            </p>
          )}
          {whatsAppNotice && (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
              {whatsAppNotice}
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShowWhatsAppComposer(false)}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-ink/15 px-4 text-sm font-medium text-ink transition-colors hover:bg-cream-100"
            >
              Cancelar
            </button>
            <a
              href={currentWhatsAppUrl || undefined}
              target={whatsAppTarget === "mobile" ? "_self" : "_blank"}
              rel={whatsAppTarget === "mobile" ? undefined : "noopener noreferrer"}
              aria-disabled={!currentWhatsAppUrl || isRegisteringWhatsApp}
              onClick={(event) => {
                if (!currentWhatsAppUrl) {
                  event.preventDefault();
                  setWhatsAppError("El contacto no tiene un número de WhatsApp válido.");
                  return;
                }
                void registerWhatsAppActivity();
              }}
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#005c5c] px-4 text-sm font-medium text-white transition-colors hover:bg-[#004949] ${
                !currentWhatsAppUrl || isRegisteringWhatsApp ? "pointer-events-none opacity-60" : ""
              }`}
            >
              {isRegisteringWhatsApp ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              {isRegisteringWhatsApp
                ? "Registrando..."
                : whatsAppTarget === "mobile"
                  ? "Abrir app de WhatsApp"
                  : "Abrir WhatsApp Web"}
            </a>
          </div>
        </form>
      )}

      {showEmailComposer && (
        <form onSubmit={sendEmail} className="rounded-xl border border-ink/12 bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">Enviar correo</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink/55">
                Se enviará a {lead.email} usando tu correo personal conectado.
              </p>
            </div>
            <a
              href="/admin/crm/correo"
              className="rounded-md border border-ink/15 px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-cream-100"
            >
              Conectar correo
            </a>
          </div>

          <div className="mt-4 space-y-3">
            <section className="rounded-xl border border-ink/12 bg-cream-50 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/55">
                    Plantillas guardadas
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    Adjuntá una plantilla al correo del cliente.
                  </p>
                </div>
                <a
                  href="/admin/crm/plantillas"
                  className="inline-flex min-h-9 items-center justify-center rounded-lg border border-ink/15 bg-white px-3 text-xs font-medium text-ink transition-colors hover:bg-cream-100"
                >
                  Administrar plantillas
                </a>
              </div>

              {isLoadingTemplates ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-24 animate-pulse rounded-lg border border-ink/10 bg-white"
                    />
                  ))}
                </div>
              ) : emailTemplates.length > 0 ? (
                <div className="mt-3 grid max-h-[360px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {emailTemplates.map((template) => {
                    const selected = selectedTemplateId === template.id;

                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyTemplate(template.id)}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          selected
                            ? "border-[#005c5c] bg-[#005c5c] text-white"
                            : "border-ink/12 bg-white text-ink hover:border-[#005c5c]/40 hover:bg-white"
                        }`}
                      >
                        <span className={selected ? "text-[11px] uppercase tracking-[0.14em] text-white/70" : "text-[11px] uppercase tracking-[0.14em] text-ink/45"}>
                          {template.category || "General"}
                        </span>
                        <strong className="mt-1 block text-sm">{template.name}</strong>
                        <span className={selected ? "mt-1 block truncate text-xs text-white/70" : "mt-1 block truncate text-xs text-ink/50"}>
                          {template.subject || "Sin asunto definido"}
                        </span>
                        <span className={selected ? "mt-3 inline-flex text-xs font-semibold text-white" : "mt-3 inline-flex text-xs font-semibold text-[#005c5c]"}>
                          {selected ? "Plantilla adjuntada" : "Adjuntar plantilla"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-dashed border-ink/18 bg-white px-4 py-5 text-sm text-ink/60">
                  Todavía no hay plantillas de correo guardadas. Creá una desde “Administrar plantillas” para usarla en los correos.
                </div>
              )}
            </section>
            <Field label="Asunto">
              <input
                value={emailSubject}
                onChange={(event) => setEmailSubject(event.target.value)}
                className="form-input"
                required
              />
            </Field>
            <Field label="Mensaje">
              <textarea
                value={emailBody}
                onChange={(event) => {
                  setEmailBody(event.target.value);
                  setEmailContentBlocks([]);
                }}
                className="form-input min-h-36"
                required
              />
            </Field>
            {emailContentBlocks.length > 0 && (
              <div className="rounded-lg border border-ink/12 bg-cream-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-ink">Vista de la plantilla aplicada</p>
                    <p className="mt-1 text-[11px] text-ink/50">
                      El mail se enviará respetando el orden y tamaño de textos e imágenes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEmailContentBlocks([]);
                      setEmailImageUrls([]);
                    }}
                    className="text-xs font-medium text-red-700 hover:underline"
                  >
                    Quitar
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {emailContentBlocks.slice(0, 6).map((block, index) =>
                    block.type === "text" ? (
                      <div
                        key={block.id}
                        className="rounded-md bg-white px-3 py-2 text-[11px] leading-relaxed"
                        style={{ color: block.color || "#1c1a17" }}
                      >
                        Texto {index + 1}: {(block.html ? stripTemplateHtml(block.html) : block.text).slice(0, 90)}
                        {(block.html ? stripTemplateHtml(block.html) : block.text).length > 90 ? "..." : ""}
                      </div>
                    ) : block.type === "attachment" ? (
                      <a
                        key={block.id}
                        href={block.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-[11px] font-medium text-[#006b6b]"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Adjunto: {block.name}
                      </a>
                    ) : block.type === "button" ? (
                      <div key={block.id} className="rounded-md bg-white px-3 py-2 text-[11px]">
                        Botón: <strong>{block.label}</strong>
                      </div>
                    ) : block.type === "divider" ? (
                      <div key={block.id} className="rounded-md bg-white px-3 py-2 text-[11px] text-ink/55">
                        Separador
                      </div>
                    ) : block.type === "spacer" ? (
                      <div key={block.id} className="rounded-md bg-white px-3 py-2 text-[11px] text-ink/55">
                        Espacio {block.height}px
                      </div>
                    ) : (
                      <div key={block.id} className="rounded-md bg-white p-2">
                        <img
                          src={block.url}
                          alt=""
                          className={`max-h-28 rounded-md object-contain ${
                            block.align === "left" ? "mr-auto" : block.align === "right" ? "ml-auto" : "mx-auto"
                          }`}
                          style={{ width: `${block.width}%` }}
                        />
                        <p className="mt-1 text-center text-[10px] text-ink/45">Imagen al {block.width}%</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
            {emailContentBlocks.length === 0 && emailImageUrls.length > 0 && (
              <div className="rounded-lg border border-ink/12 bg-cream-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-ink">
                    {emailImageUrls.length} imagen{emailImageUrls.length !== 1 ? "es" : ""} de la plantilla
                  </p>
                  <button
                    type="button"
                    onClick={() => setEmailImageUrls([])}
                    className="text-xs font-medium text-red-700 hover:underline"
                  >
                    Quitar
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {emailImageUrls.slice(0, 6).map((url) => (
                    <img key={url} src={url} alt="" className="aspect-video rounded-md object-cover" />
                  ))}
                </div>
              </div>
            )}
          </div>

          {emailError && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {emailError}
            </p>
          )}
          {emailNotice && (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
              {emailNotice}
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShowEmailComposer(false)}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-ink/15 px-4 text-sm font-medium text-ink transition-colors hover:bg-cream-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSendingEmail}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#005c5c] px-4 text-sm font-medium text-white transition-colors hover:bg-[#004949] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Enviar correo
            </button>
          </div>
        </form>
      )}

      <form onSubmit={saveContactFields} className="min-w-0 rounded-xl border border-ink/12 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">Información del cliente</h3>
          </div>
          {(isSavingFields || fieldsNotice) && (
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-800">
              {isSavingFields ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {isSavingFields ? "Guardando" : fieldsNotice}
            </span>
          )}
        </div>

        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
          <div className="grid gap-3 sm:contents">
            <Field label="Nombre">
              <input
                value={contactFields.firstName}
                onChange={updateContactField("firstName")}
                className="form-input"
                required
              />
            </Field>
            <Field label="Apellido">
              <input
                value={contactFields.lastName}
                onChange={updateContactField("lastName")}
                className="form-input"
                required
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
          <Field label="Correo">
            <input
              value={contactFields.email}
              onChange={updateContactField("email")}
              className="form-input"
              type="email"
              required
            />
          </Field>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Field label="País">
              <select
                value={contactFields.countryCode}
                onChange={updateContactField("countryCode")}
                className="form-input truncate"
                required
              >
                {PHONE_COUNTRIES.map((country) => (
                  <option key={`${country.iso2}-${country.dialCode}`} value={country.dialCode}>
                    {country.name} ({country.dialCode})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Teléfono">
              <input
                value={contactFields.phone}
                onChange={updateContactField("phone")}
                className="form-input"
                required
              />
            </Field>
          </div>
          <Field label="Estado del lead">
            <select
              value={contactFields.status}
              disabled={isSavingFields}
              onChange={updateContactField("status")}
              className="form-input"
            >
              {leadStatusOptionsForValue(leadStatusOptions, contactFields.status).map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Prioridad">
            <select
              value={contactFields.temperature}
              disabled={isSavingFields}
              onChange={updateContactField("temperature")}
              className="form-input"
            >
              {CRM_TEMPERATURE_OPTIONS.map((option) => (
                <option key={option.value || "none"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Desarrollo">
            <select
              value={contactFields.developmentId}
              disabled={isSavingFields}
              onChange={updateContactField("developmentId")}
              className="form-input"
            >
              <option value="">{lead.developmentName || "Sin definir"}</option>
              {developments.map((development) => (
                <option key={development.id} value={development.id}>
                  {development.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Propietario del contacto">
            <select
              value={contactFields.assignedAgentId}
              disabled={isSavingFields || !canAssignTeam}
              onChange={updateContactField("assignedAgentId")}
              className="form-input disabled:cursor-not-allowed disabled:bg-cream-100 disabled:text-ink/50"
            >
              <option value="">Sin asignar</option>
              {activeAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name || agent.email}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {fieldsError && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {fieldsError}
          </p>
        )}

        <button
          type="submit"
          disabled={isSavingFields}
          className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-bone transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSavingFields ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Guardar información
        </button>

        {!canAssignTeam && (
          <p className="mt-3 text-xs leading-relaxed text-ink/45">
            El propietario del contacto solo puede cambiarlo administración.
          </p>
        )}
      </form>

      {hubspotFields.length > 0 && (
        <section className="rounded-xl border border-ink/12 bg-white p-5">
          <h3 className="text-sm font-semibold text-ink">Datos importados de HubSpot</h3>
          <dl className="mt-4 grid gap-3">
            {hubspotFields.map(([key, value]) => (
              <InfoRow key={key} label={key.replaceAll("_", " ")} value={value} />
            ))}
          </dl>
        </section>
      )}

      <section className="rounded-xl border border-ink/12 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">Actividades</h3>
          <span className="text-xs text-ink/50">{activities.length} registro{activities.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {ACTIVITY_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => onActivityType(type.value)}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                  activityForm.type === type.value
                    ? "border-[#005c5c] bg-[#005c5c] text-white"
                    : "border-ink/15 text-ink hover:bg-cream-100"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {type.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={onSaveActivity} className="mt-4 space-y-3">
          <input
            value={activityForm.title}
            onChange={updateActivity("title")}
            className="form-input"
            placeholder="Título de la actividad"
            required
          />
          {(activityForm.type === "reunion" || activityForm.type === "llamada" || activityForm.type === "tarea") && (
            <input
              value={activityForm.scheduledAt}
              onChange={updateActivity("scheduledAt")}
              className="form-input"
              type="datetime-local"
            />
          )}
          <textarea
            value={activityForm.body}
            onChange={updateActivity("body")}
            className="form-input min-h-24"
            placeholder="Detalle, próximos pasos, resumen de la conversación..."
          />
          <button
            type="submit"
            disabled={isSavingActivity}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-bone transition-colors hover:bg-ink/90 disabled:opacity-60"
          >
            {isSavingActivity ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Registrar actividad
          </button>
        </form>

        <div className="mt-5 space-y-3">
          {activities.map((activity) => (
            <article key={activity.id} className="rounded-lg border border-ink/10 bg-cream-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{activity.title}</p>
                  <p className="mt-1 text-xs text-ink/50">
                    {ACTIVITY_TYPES.find((type) => type.value === activity.type)?.label || activity.type}
                    {activity.createdByName ? ` · ${activity.createdByName}` : ""}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-ink/45">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatLeadDate(activity.createdAt)}
                </span>
              </div>
              {activity.scheduledAt && (
                <p className="mt-3 text-xs font-medium text-[#006b6b]">
                  Programado: {formatLeadDate(activity.scheduledAt)}
                </p>
              )}
              {activity.body && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/68">{activity.body}</p>}
            </article>
          ))}
          {activities.length === 0 && (
            <p className="rounded-lg border border-dashed border-ink/15 px-4 py-5 text-center text-sm text-ink/50">
              Sin actividades todavía. Registrá una nota, llamada o reunión.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function ContactForm({
  form,
  activeAgents,
  developments,
  leadStatusOptions,
  canAssignTeam,
  isSaving,
  onSubmit,
  onCancel,
  update,
}: {
  form: LeadFormState;
  activeAgents: CrmAgent[];
  developments: CrmDevelopment[];
  leadStatusOptions: HubSpotImportStatusOption[];
  canAssignTeam: boolean;
  isSaving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  update: (field: keyof LeadFormState) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => void;
}) {
  return (
    <section className="rounded-xl border border-ink/12 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink/45">
            {form.id ? "Editar contacto" : "Nuevo contacto"}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">
            Datos del cliente
          </h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-ink/15 px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-cream-100"
        >
          Cancelar
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre *">
            <input value={form.firstName} onChange={update("firstName")} className="form-input" required />
          </Field>
          <Field label="Apellido *">
            <input value={form.lastName} onChange={update("lastName")} className="form-input" required />
          </Field>
        </div>
        <Field label="Mail único *">
          <input value={form.email} onChange={update("email")} className="form-input" type="email" required />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[190px_1fr]">
          <Field label="País">
            <select value={form.countryCode} onChange={update("countryCode")} className="form-input">
              {PHONE_COUNTRIES.map((country) => (
                <option key={`${country.iso2}-${country.dialCode}`} value={country.dialCode}>
                  {country.name} ({country.dialCode})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Teléfono *">
            <input value={form.phone} onChange={update("phone")} className="form-input" required />
          </Field>
        </div>
        <Field label="Estado del lead">
          <select value={form.status} onChange={update("status")} className="form-input">
            {leadStatusOptionsForValue(leadStatusOptions, form.status).map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Prioridad visual">
          <select value={form.temperature} onChange={update("temperature")} className="form-input">
            {CRM_TEMPERATURE_OPTIONS.map((option) => (
              <option key={option.value || "none"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Desarrollo que consultó">
          <select value={form.developmentId} onChange={update("developmentId")} className="form-input">
            <option value="">{form.developmentNameText || "Sin definir"}</option>
            {developments.map((development) => (
              <option key={development.id} value={development.id}>
                {development.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Origen">
          <input value={form.source} onChange={update("source")} className="form-input" placeholder="Web, WhatsApp, referido..." />
        </Field>
        <Field label="Vendedor asignado">
          <select
            value={form.assignedAgentId}
            onChange={update("assignedAgentId")}
            className="form-input"
            disabled={!canAssignTeam}
          >
            {activeAgents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notas internas">
          <textarea
            value={form.notes}
            onChange={update("notes")}
            className="form-input min-h-28"
            placeholder="Presupuesto, timing, preferencias, próximo paso..."
          />
        </Field>

        <button
          type="submit"
          disabled={isSaving}
          className="btn-primary min-h-11 w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Guardando
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              {form.id ? "Guardar cambios" : "Crear contacto"}
            </>
          )}
        </button>
      </form>
    </section>
  );
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof NotebookPen;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border border-ink/15 bg-white text-xs font-medium text-ink transition-colors hover:bg-cream-100"
    >
      <Icon className="h-4 w-4 text-[#006b6b]" />
      {label}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-ink/48">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function InlinePhoneEditor({
  value,
  isSaving,
  onChange,
  onSave,
  onCancel,
}: {
  value: PhoneInlineEditorState;
  isSaving: boolean;
  onChange: (value: PhoneInlineEditorState) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSave();
      }}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      className="absolute left-2 top-[calc(100%-2px)] z-30 w-[min(440px,calc(100vw-48px))] rounded-xl border border-ink/18 bg-white p-4 text-ink shadow-2xl"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">
          Editar {value.column === "phone" ? "número de teléfono" : "WhatsApp"}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full p-1 text-ink/45 transition-colors hover:bg-ink/8 hover:text-ink"
          aria-label="Cerrar editor de teléfono"
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[190px_1fr]">
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.16em] text-ink/45">
            País
          </span>
          <select
            value={value.countryCode}
            onChange={(event) =>
              onChange({ ...value, countryCode: event.target.value })
            }
            className="h-10 w-full rounded-md border border-ink/14 bg-white px-2 text-sm font-medium text-ink outline-none focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15"
          >
            {PHONE_COUNTRIES.map((country) => (
              <option key={`${country.iso2}-${country.dialCode}`} value={country.dialCode}>
                {country.name} ({country.dialCode})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.16em] text-ink/45">
            Número
          </span>
          <input
            value={value.phone}
            onChange={(event) =>
              onChange({ ...value, phone: event.target.value })
            }
            className="h-10 w-full rounded-md border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15"
            placeholder="11 4447-5478"
            autoFocus
          />
        </label>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-ink/15 px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-cream-100"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSaving || !value.phone.trim()}
          className="inline-flex min-w-24 items-center justify-center gap-2 rounded-md bg-[#006b6b] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#005252] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Guardar
        </button>
      </div>
    </form>
  );
}

function InlineTableSelect({
  value,
  options,
  disabled,
  ariaLabel,
  onChange,
}: {
  value: string;
  options: readonly { value: string; label: string }[];
  disabled?: boolean;
  ariaLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      aria-label={ariaLabel}
      disabled={disabled}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onChange={(event) => {
        event.stopPropagation();
        onChange(event.target.value);
      }}
      className="h-9 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm font-medium text-ink outline-none transition-colors hover:border-ink/14 hover:bg-white focus:border-[#006b6b] focus:bg-white focus:ring-2 focus:ring-[#006b6b]/15 disabled:cursor-not-allowed disabled:text-ink/45"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function HubSpotFilterGroup({
  title,
  description,
  allLabel,
  options,
  selectedValues,
  onToggle,
  onAll,
}: {
  title: string;
  description: string;
  allLabel: string;
  options: { value: string; label: string; detail?: string }[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  onAll: () => void;
}) {
  const allSelected = selectedValues.length === 0;

  return (
    <section className="rounded-xl border border-ink/12 bg-[#fbfaf8] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink/55">{description}</p>
        </div>
        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-ink/45">
          {allSelected ? "Todos" : selectedValues.length}
        </span>
      </div>

      <button
        type="button"
        onClick={onAll}
        className={`mt-3 flex min-h-10 w-full items-center gap-2 rounded-lg border px-3 text-left text-sm font-medium transition-colors ${
          allSelected
            ? "border-[#005c5c] bg-[#e8f3f1] text-[#005c5c]"
            : "border-ink/12 bg-white text-ink/62 hover:bg-cream-100"
        }`}
      >
        <span
          className={`flex h-4 w-4 items-center justify-center rounded border ${
            allSelected ? "border-[#005c5c] bg-[#005c5c]" : "border-ink/28 bg-white"
          }`}
        >
          {allSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
        </span>
        {allLabel}
      </button>

      <div className="mt-2 max-h-56 space-y-1 overflow-auto pr-1">
        {options.map((option) => {
          const checked = selectedValues.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onToggle(option.value)}
              className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left transition-colors ${
                checked ? "bg-[#005c5c] text-white" : "bg-white text-ink hover:bg-cream-100"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  checked ? "border-white bg-white" : "border-ink/25 bg-white"
                }`}
              >
                {checked && <CheckCircle2 className="h-3 w-3 text-[#005c5c]" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{option.label}</span>
                {option.detail && (
                  <span className={checked ? "block truncate text-xs text-white/70" : "block truncate text-xs text-ink/45"}>
                    {option.detail}
                  </span>
                )}
              </span>
            </button>
          );
        })}

        {options.length === 0 && (
          <p className="rounded-lg border border-dashed border-ink/12 bg-white px-3 py-4 text-sm text-ink/50">
            No hay opciones disponibles.
          </p>
        )}
      </div>
    </section>
  );
}

function ResizableTh({
  column,
  label,
  children,
  sortable,
  sortDirection,
  draggable,
  isDragging,
  last,
  onDragStart,
  onDragEnd,
  onDropColumn,
  onSort,
  onResizeStart,
}: {
  column: CrmColumnKey;
  label: string;
  children?: ReactNode;
  sortable?: boolean;
  sortDirection?: CrmSortDirection | null;
  draggable?: boolean;
  isDragging?: boolean;
  last?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDropColumn?: (column: CrmColumnKey) => void;
  onSort?: () => void;
  onResizeStart: (column: CrmColumnKey, event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  const handleDragOver = (event: ReactDragEvent<HTMLTableCellElement>) => {
    if (!draggable) return;
    event.preventDefault();
  };
  const SortIcon = sortDirection === "asc" ? ArrowUp : sortDirection === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <th
      className={`relative border-b border-ink/12 py-3 align-middle transition-colors ${
        last ? "" : "border-r"
      } ${column === "name" ? "px-2" : "px-3"} ${isDragging ? "bg-cream-100 opacity-70" : ""}`}
      scope="col"
      aria-sort={
        sortDirection === "asc" ? "ascending" : sortDirection === "desc" ? "descending" : undefined
      }
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) return;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", column);
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      onDragOver={handleDragOver}
      onDrop={(event) => {
        if (!draggable) return;
        event.preventDefault();
        onDropColumn?.(column);
      }}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        {label ? (
          <span className={`flex min-w-0 items-center ${column === "name" ? "gap-1" : "gap-1.5"}`}>
            {draggable && (
              <GripVertical className={`${column === "name" ? "h-3 w-3" : "h-3.5 w-3.5"} shrink-0 text-ink/35`} />
            )}
            {sortable ? (
              <button
                type="button"
                draggable={false}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onSort?.();
                }}
                className="flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006b6b]/30"
                aria-label={`Ordenar por ${label} ${
                  sortDirection === "asc"
                    ? "de mayor a menor"
                    : sortDirection === "desc"
                      ? "de menor a mayor"
                      : "de menor a mayor"
                }`}
                title="Click para ordenar"
              >
                <span className="truncate">{label}</span>
                <SortIcon
                  className={`h-3.5 w-3.5 shrink-0 ${
                    sortDirection ? "text-[#006b6b]" : "text-ink/35"
                  }`}
                />
              </button>
            ) : (
              <span className="truncate">{label}</span>
            )}
          </span>
        ) : (
          children
        )}
      </div>
      <button
        type="button"
        aria-label={label ? `Ajustar columna ${label}` : "Ajustar columna"}
        title="Arrastrar para ajustar columna"
        onMouseDown={(event) => onResizeStart(column, event)}
        className="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none border-r border-transparent transition-colors hover:border-[#006b6b] focus:outline-none focus-visible:border-[#006b6b]"
      />
    </th>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="label-tracking mb-2 block text-ink/70">{label}</span>
      {children}
    </label>
  );
}
