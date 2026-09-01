import postgres from "postgres";

export type MeetingLink = {
  id: string;
  agentId: string;
  slug: string;
  title: string;
  location: string;
  meetingModes: ("in_person" | "google_meet")[];
  durations: number[];
  weekdays: number[];
  startTime: string;
  endTime: string;
  slotInterval: number;
  active: boolean;
  agentName: string;
  agentPhoto: string;
  agentEmail: string;
};

function db() {
  const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("No hay conexión a la base de datos.");
  return postgres(url, { ssl: "require", max: 1 });
}

async function ensure(sql: ReturnType<typeof db>) {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS crm_meeting_links (
      id UUID PRIMARY KEY,
      agent_id UUID NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL DEFAULT 'Reunión',
      location TEXT NOT NULL DEFAULT 'A definir',
      meeting_mode TEXT NOT NULL DEFAULT 'in_person',
      meeting_modes TEXT[] NOT NULL DEFAULT '{in_person,google_meet}',
      durations INTEGER[] NOT NULL DEFAULT '{15,30,60}',
      weekdays INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
      start_time TIME NOT NULL DEFAULT '09:00',
      end_time TIME NOT NULL DEFAULT '18:00',
      slot_interval INTEGER NOT NULL DEFAULT 15,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS crm_meeting_bookings (
      id UUID PRIMARY KEY,
      meeting_link_id UUID NOT NULL REFERENCES crm_meeting_links(id) ON DELETE CASCADE,
      agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      guest_name TEXT NOT NULL,
      guest_email TEXT NOT NULL,
      guest_phone TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ NOT NULL,
      google_event_id TEXT DEFAULT '',
      google_event_url TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_crm_meeting_bookings_agent_start ON crm_meeting_bookings(agent_id, starts_at);
  `);
  await sql.unsafe(`ALTER TABLE crm_meeting_links ADD COLUMN IF NOT EXISTS meeting_mode TEXT NOT NULL DEFAULT 'in_person';`);
  await sql.unsafe(`ALTER TABLE crm_meeting_links ADD COLUMN IF NOT EXISTS meeting_modes TEXT[] NOT NULL DEFAULT '{in_person,google_meet}';`);
}

function map(row: any): MeetingLink {
  return {
    id: row.id, agentId: row.agent_id, slug: row.slug, title: row.title,
    location: row.location, meetingModes: row.meeting_modes?.length ? row.meeting_modes : [row.meeting_mode === "google_meet" ? "google_meet" : "in_person"], durations: row.durations || [15, 30, 60],
    weekdays: row.weekdays || [1, 2, 3, 4, 5], startTime: String(row.start_time).slice(0, 5),
    endTime: String(row.end_time).slice(0, 5), slotInterval: row.slot_interval || 15,
    active: row.active, agentName: row.agent_name || "Asesor Barrera Brokers",
    agentPhoto: row.agent_photo || "", agentEmail: row.agent_email || "",
  };
}

export async function getMeetingLinkByAgent(agentId: string) {
  const sql = db();
  try {
    await ensure(sql);
    const rows = await sql`SELECT m.*, a.name agent_name, a.photo agent_photo, a.email agent_email FROM crm_meeting_links m JOIN agents a ON a.id=m.agent_id WHERE m.agent_id=${agentId} LIMIT 1`;
    return rows[0] ? map(rows[0]) : null;
  } finally { await sql.end(); }
}

export async function getMeetingLinkBySlug(slug: string) {
  const sql = db();
  try {
    await ensure(sql);
    const rows = await sql`SELECT m.*, a.name agent_name, a.photo agent_photo, a.email agent_email FROM crm_meeting_links m JOIN agents a ON a.id=m.agent_id WHERE m.slug=${slug} AND m.active=TRUE LIMIT 1`;
    return rows[0] ? map(rows[0]) : null;
  } finally { await sql.end(); }
}

export async function saveMeetingLink(agentId: string, data: Omit<MeetingLink, "id"|"agentId"|"agentName"|"agentPhoto"|"agentEmail">) {
  const sql = db();
  try {
    await ensure(sql);
    const id = crypto.randomUUID();
    await sql`INSERT INTO crm_meeting_links (id,agent_id,slug,title,location,meeting_mode,meeting_modes,durations,weekdays,start_time,end_time,slot_interval,active)
      VALUES (${id},${agentId},${data.slug},${data.title},${data.location},${data.meetingModes[0]},${data.meetingModes},${data.durations},${data.weekdays},${data.startTime},${data.endTime},${data.slotInterval},${data.active})
      ON CONFLICT (agent_id) DO UPDATE SET slug=EXCLUDED.slug,title=EXCLUDED.title,location=EXCLUDED.location,meeting_mode=EXCLUDED.meeting_mode,meeting_modes=EXCLUDED.meeting_modes,durations=EXCLUDED.durations,weekdays=EXCLUDED.weekdays,start_time=EXCLUDED.start_time,end_time=EXCLUDED.end_time,slot_interval=EXCLUDED.slot_interval,active=EXCLUDED.active,updated_at=NOW()`;
    return getMeetingLinkByAgent(agentId);
  } finally { await sql.end(); }
}

export async function createMeetingBooking(data: { link: MeetingLink; name: string; email: string; phone: string; notes: string; startsAt: Date; endsAt: Date; googleEventId: string; googleEventUrl: string }) {
  const sql = db();
  try {
    await ensure(sql);
    const overlap = await sql`SELECT id FROM crm_meeting_bookings WHERE agent_id=${data.link.agentId} AND starts_at < ${data.endsAt.toISOString()} AND ends_at > ${data.startsAt.toISOString()} LIMIT 1`;
    if (overlap.length) throw new Error("Ese horario acaba de ser reservado. Elegí otro.");
    await sql`INSERT INTO crm_meeting_bookings (id,meeting_link_id,agent_id,guest_name,guest_email,guest_phone,notes,starts_at,ends_at,google_event_id,google_event_url)
      VALUES (${crypto.randomUUID()},${data.link.id},${data.link.agentId},${data.name},${data.email},${data.phone},${data.notes},${data.startsAt.toISOString()},${data.endsAt.toISOString()},${data.googleEventId},${data.googleEventUrl})`;
  } finally { await sql.end(); }
}

export async function getBookedRanges(agentId: string, from: Date, to: Date) {
  const sql = db();
  try {
    await ensure(sql);
    return await sql`SELECT starts_at, ends_at FROM crm_meeting_bookings WHERE agent_id=${agentId} AND starts_at < ${to.toISOString()} AND ends_at > ${from.toISOString()}`;
  } finally { await sql.end(); }
}
