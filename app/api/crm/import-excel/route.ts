import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import * as XLSX from "xlsx";
import { authOptions } from "@/lib/auth";
import { canManageAdminPanel, canViewAllCrmContacts } from "@/lib/roles";
import { getAllAgents, getCrmLeads, upsertCrmLeadByEmail } from "@/lib/db";
import { getDevelopments } from "@/lib/developments-db";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_ROWS = 2_000;

const TEMPLATE_HEADERS = [
  "Nombre",
  "Apellido",
  "Email",
  "Código país",
  "Teléfono",
  "Estado",
  "Temperatura",
  "Fuente",
  "Desarrollo",
  "Email agente",
  "Notas",
  "Fecha creación",
];

type ExcelRow = Record<string, unknown>;

const EMAIL_HEADERS = ["email", "correo", "correo electronico", "email address", "contact email"];

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalized(value: unknown) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cell(row: ExcelRow, ...names: string[]) {
  const entries = Object.entries(row);
  for (const name of names) {
    const target = normalized(name);
    const match = entries.find(([key]) => normalized(key) === target);
    if (match) return text(match[1]);
  }
  return "";
}

function rowsFromSheet(sheet: XLSX.WorkSheet) {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  const headerIndex = matrix.slice(0, 25).findIndex((row) =>
    row.some((value) => EMAIL_HEADERS.includes(normalized(value)))
  );
  if (headerIndex < 0) {
    throw new Error("No encontramos una columna de email/correo en el archivo");
  }

  const headers = matrix[headerIndex].map((value, index) => text(value) || `Columna ${index + 1}`);
  return matrix.slice(headerIndex + 1)
    .filter((values) => values.some((value) => text(value)))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function excelDate(value: unknown) {
  if (!value) return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S)).toISOString();
  }
  const raw = text(value);
  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString();
}

function templateWorkbook() {
  const workbook = XLSX.utils.book_new();
  const rows = [
    TEMPLATE_HEADERS,
    [
      "María",
      "González",
      "maria@ejemplo.com",
      "+54",
      "11 5555 5555",
      "Nuevo",
      "tibio",
      "Excel",
      "Nombre exacto del desarrollo",
      "agente@barrerabrokers.com",
      "Consulta por inversión",
      "2026-08-24",
    ],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 18 }, { wch: 18 }, { wch: 30 }, { wch: 14 }, { wch: 18 }, { wch: 18 },
    { wch: 14 }, { wch: 16 }, { wch: 32 }, { wch: 32 }, { wch: 42 }, { wch: 18 },
  ];
  sheet["!autofilter"] = { ref: `A1:L2` };
  XLSX.utils.book_append_sheet(workbook, sheet, "Contactos");

  const instructions = XLSX.utils.aoa_to_sheet([
    ["Instrucciones para importar contactos"],
    ["Email", "Obligatorio. Se usa para detectar contactos existentes y actualizarlos."],
    ["Nombre y apellido", "Si faltan, se completan a partir del email y con '-' respectivamente."],
    ["Estado", "Opcional. Ejemplos: Nuevo, Interesado, Contactado, En curso."],
    ["Temperatura", "Opcional: frio, tibio o caliente."],
    ["Desarrollo", "Opcional. Escribí el nombre tal como aparece en el CRM."],
    ["Email agente", "Opcional. Debe coincidir con el email de un agente activo."],
    ["Fecha creación", "Opcional. Formato recomendado: AAAA-MM-DD."],
    ["Importante", "No cambies los encabezados de la hoja Contactos. Eliminá la fila de ejemplo antes de importar."],
  ]);
  instructions["!cols"] = [{ wch: 24 }, { wch: 92 }];
  XLSX.utils.book_append_sheet(workbook, instructions, "Instrucciones");
  return workbook;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageAdminPanel(session.user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const buffer = XLSX.write(templateWorkbook(), { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-contactos-barrera-brokers.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageAdminPanel(session.user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Seleccioná un archivo Excel" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "El archivo no puede superar los 10 MB" }, { status: 400 });
    }
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      return NextResponse.json({ error: "El archivo debe ser .xlsx o .xls" }, { status: 400 });
    }

    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const sheet = workbook.Sheets.Contactos || workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return NextResponse.json({ error: "El Excel no contiene hojas" }, { status: 400 });

    const rows = rowsFromSheet(sheet);
    if (rows.length === 0) {
      return NextResponse.json({ error: "La hoja Contactos no contiene filas para importar" }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `El archivo supera el máximo de ${MAX_ROWS} contactos` }, { status: 400 });
    }

    const [agents, developments] = await Promise.all([getAllAgents(), getDevelopments()]);
    const agentsByEmail = new Map(agents.map((agent) => [agent.email.trim().toLowerCase(), agent]));
    const developmentsByName = new Map(developments.map((development) => [normalized(development.name), development]));
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 2;
      const email = cell(row, "Email", "Correo", "Correo electrónico", "Email address", "Contact email").toLowerCase();
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        skipped += 1;
        errors.push(`Fila ${rowNumber}: email faltante o inválido.`);
        continue;
      }

      const developmentName = cell(row, "Desarrollo", "Proyecto", "Development", "Project");
      const development = developmentName ? developmentsByName.get(normalized(developmentName)) : undefined;
      const agentEmail = cell(row, "Email agente", "Agente", "Propietario", "Contact owner", "HubSpot owner").toLowerCase();
      const agent = agentEmail ? agentsByEmail.get(agentEmail) : undefined;
      const temperatureValue = normalized(cell(row, "Temperatura"));
      const temperature = ["frio", "tibio", "caliente"].includes(temperatureValue)
        ? (temperatureValue as "frio" | "tibio" | "caliente")
        : "";
      const rawDate = Object.entries(row).find(([key]) => normalized(key) === normalized("Fecha creación"))?.[1];

      const result = await upsertCrmLeadByEmail({
        firstName: cell(row, "Nombre", "First name", "Firstname", "Nombre de pila"),
        lastName: cell(row, "Apellido", "Last name", "Lastname", "Apellidos"),
        email,
        countryCode: cell(row, "Código país", "Codigo pais", "Prefijo", "Country code"),
        phone: cell(row, "Teléfono", "Telefono", "Celular", "Phone", "Phone number", "Mobile phone number"),
        status: cell(row, "Estado", "Estado del lead", "Lead status", "Contact status"),
        temperature,
        source: cell(row, "Fuente", "Origen", "Original source", "Lead source"),
        developmentId: development?.id,
        developmentNameText: development?.name || developmentName,
        assignedAgentId: agent?.id,
        notes: cell(row, "Notas", "Comentarios", "Notes", "Message"),
        createdBy: session.user.id,
        createdAt: excelDate(rawDate),
      }, { preserveExistingValues: true });

      if (!result.lead) {
        skipped += 1;
        errors.push(`Fila ${rowNumber}: ${result.error || "no se pudo guardar"}.`);
      } else if (result.created) created += 1;
      else updated += 1;
    }

    const leads = await getCrmLeads({
      agentId: session.user.id,
      includeAll: canViewAllCrmContacts(session.user.role),
    });
    return NextResponse.json({ leads, created, updated, skipped, errors: errors.slice(0, 25) });
  } catch (error) {
    console.error("Error importing CRM contacts from Excel:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo importar el archivo Excel" },
      { status: 500 }
    );
  }
}
