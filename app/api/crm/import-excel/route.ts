import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import * as XLSX from "xlsx";
import { authOptions } from "@/lib/auth";
import { canManageAdminPanel, canViewAllCrmContacts } from "@/lib/roles";
import { getCrmLeads, upsertCrmLead } from "@/lib/db";
import { getDevelopments } from "@/lib/developments-db";
import { splitInternationalPhone } from "@/lib/phone-countries";

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
  "Tipo de departamento",
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

function uniqueHeaders(values: unknown[]) {
  const seen = new Map<string, number>();
  return values.map((value, index) => {
    const base = text(value) || `Columna ${index + 1}`;
    const key = normalized(base);
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

function rowsFromSheet(sheet: XLSX.WorkSheet) {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  const headerIndex = matrix.slice(0, 25).findIndex((row) =>
    row.some((value) => EMAIL_HEADERS.includes(normalized(value)))
  );
  if (headerIndex < 0) {
    throw new Error("No encontramos una columna de email/correo en el archivo");
  }

  const headers = uniqueHeaders(matrix[headerIndex]);
  const rows = matrix.slice(headerIndex + 1)
    .filter((values) => values.some((value) => text(value)))
    .map((values, index) => ({
      rowNumber: headerIndex + index + 2,
      data: Object.fromEntries(headers.map((header, columnIndex) => [header, values[columnIndex] ?? ""])),
    }));
  return { headers, rows };
}

function importedCellValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return text(value);
}

function excelImportRecord(file: File, sheetName: string, rowNumber: number, row: ExcelRow) {
  return {
    file: file.name,
    sheet: sheetName,
    row: rowNumber,
    importedAt: new Date().toISOString(),
    fields: Object.entries(row)
      .map(([key, value]) => ({ key: normalized(key).replaceAll(" ", "_"), label: key, value: importedCellValue(value) }))
      .filter((field) => field.value !== ""),
  };
}

function phoneKey(countryCode: string, phone: string) {
  const digits = `${countryCode}${phone}`.replace(/\D/g, "");
  return digits.length >= 8 ? digits : "";
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
      "3 ambientes",
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
    ["Email", "Obligatorio. Se usa para detectar contactos existentes. Los contactos existentes se omiten sin modificarlos."],
    ["Nombre y apellido", "Si faltan, se completan a partir del email y con '-' respectivamente."],
    ["Estado", "Opcional. Ejemplos: Nuevo, Interesado, Contactado, En curso."],
    ["Temperatura", "Opcional: frio, tibio o caliente."],
    ["Desarrollo", "Opcional. Escribí el nombre tal como aparece en el CRM."],
    ["Propietario", "Los contactos nuevos se crean siempre como Sin asignar. Esta columna no cambia propietarios."],
    ["Columnas adicionales", "Podés agregar cualquier columna. Todo valor no vacío se guardará en Información del cliente."],
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

    const parsedSheet = rowsFromSheet(sheet);
    const rows = parsedSheet.rows;
    if (rows.length === 0) {
      return NextResponse.json({ error: "La hoja Contactos no contiene filas para importar" }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `El archivo supera el máximo de ${MAX_ROWS} contactos` }, { status: 400 });
    }

    const [developments, existingLeads] = await Promise.all([
      getDevelopments(),
      getCrmLeads({ includeAll: true }),
    ]);
    const developmentsByName = new Map(developments.map((development) => [normalized(development.name), development]));
    const existingEmails = new Set(
      existingLeads
        .map((lead) => String(lead.email || "").trim().toLowerCase())
        .filter(Boolean)
    );
    const existingPhones = new Set(existingLeads.map((lead) => phoneKey(lead.countryCode, lead.phone)).filter(Boolean));
    let created = 0;
    let existing = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let index = 0; index < rows.length; index += 1) {
      const { data: row, rowNumber } = rows[index];
      const email = cell(row, "Email", "Correo", "Correo electrónico", "Email address", "Contact email").toLowerCase();
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        skipped += 1;
        errors.push(`Fila ${rowNumber}: email faltante o inválido.`);
        continue;
      }

      const developmentName = cell(row, "Desarrollo", "Proyecto", "Development", "Project");
      const development = developmentName ? developmentsByName.get(normalized(developmentName)) : undefined;
      const rawPhone = cell(row, "Teléfono", "Telefono", "Celular", "Phone", "Phone number", "Mobile phone number");
      const splitPhone = splitInternationalPhone(
        rawPhone,
        cell(row, "Código país", "Codigo pais", "Prefijo", "Country code") || "+54"
      );
      const normalizedPhone = phoneKey(splitPhone.countryCode, splitPhone.phone);
      if (existingEmails.has(email) || (normalizedPhone && existingPhones.has(normalizedPhone))) {
        existing += 1;
        continue;
      }

      const fullName = cell(row, "Nombre completo", "Full name", "Fullname", "Name");
      const fullNameParts = fullName.split(/\s+/).filter(Boolean);
      const firstName = cell(row, "Nombre", "First name", "Firstname", "Nombre de pila") || fullNameParts.shift() || email.split("@")[0];
      const lastName = cell(row, "Apellido", "Last name", "Lastname", "Apellidos") || fullNameParts.join(" ") || "-";
      const temperatureValue = normalized(cell(row, "Temperatura"));
      const temperature = ["frio", "tibio", "caliente"].includes(temperatureValue)
        ? (temperatureValue as "frio" | "tibio" | "caliente")
        : "";
      const rawDate = Object.entries(row).find(([key]) => normalized(key) === normalized("Fecha creación"))?.[1];

      const result = await upsertCrmLead({
        firstName,
        lastName,
        email,
        countryCode: splitPhone.countryCode,
        phone: splitPhone.phone,
        status: cell(row, "Estado", "Estado del lead", "Lead status", "Contact status") || "Nuevo",
        temperature,
        source: cell(row, "Fuente", "Origen", "Original source", "Lead source") || "Excel",
        developmentId: development?.id,
        developmentNameText: development?.name || developmentName,
        assignedAgentId: undefined,
        notes: cell(row, "Notas", "Comentarios", "Notes", "Message"),
        metaProperties: {
          excel_imports: JSON.stringify([
            excelImportRecord(file, workbook.SheetNames.find((name) => workbook.Sheets[name] === sheet) || "Contactos", rowNumber, row),
          ]),
        },
        createdBy: session.user.id,
        createdAt: excelDate(rawDate),
      });

      if (!result.lead) {
        if ((result.error || "").toLocaleLowerCase("es-AR").includes("existe")) existing += 1;
        else {
          skipped += 1;
          errors.push(`Fila ${rowNumber}: ${result.error || "no se pudo guardar"}.`);
        }
      } else {
        created += 1;
        existingEmails.add(email);
        if (normalizedPhone) existingPhones.add(normalizedPhone);
      }
    }

    const leads = await getCrmLeads({
      agentId: session.user.id,
      includeAll: canViewAllCrmContacts(session.user.role),
    });
    return NextResponse.json({ leads, created, existing, updated: 0, skipped, errors: errors.slice(0, 25) });
  } catch (error) {
    console.error("Error importing CRM contacts from Excel:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo importar el archivo Excel" },
      { status: 500 }
    );
  }
}
