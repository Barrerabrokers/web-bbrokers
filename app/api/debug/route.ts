import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export async function GET() {
  const checks: any = {
    timestamp: new Date().toISOString(),
    environment: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "MISSING",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "MISSING",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "MISSING",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "SET" : "MISSING",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ? "SET" : "MISSING",
      DATABASE_URL: process.env.DATABASE_URL ? "SET" : "MISSING",
    },
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT SET",
    tables: {} as any,
    counts: {} as any,
    storageBuckets: [] as any,
    adminUser: "" as any,
    sampleProperties: [] as any,
    errors: [] as any,
  };

  try {
    const supabase = getServerSupabase();

    // agents table + count
    try {
      const { error, count } = await supabase
        .from("agents")
        .select("*", { count: "exact", head: true });
      if (error) {
        checks.tables.agents = `ERROR: ${error.message}`;
      } else {
        checks.tables.agents = `EXISTS`;
        checks.counts.agents = count;
      }
    } catch (e: any) {
      checks.tables.agents = `ERROR: ${e.message}`;
    }

    // properties + count + samples
    try {
      const { data, error, count } = await supabase
        .from("properties")
        .select("id, title, status, agent_id, created_at", { count: "exact" })
        .limit(5)
        .order("created_at", { ascending: false });
      if (error) {
        checks.tables.properties = `ERROR: ${error.message}`;
      } else {
        checks.tables.properties = `EXISTS`;
        checks.counts.properties = count;
        checks.sampleProperties = data || [];
      }
    } catch (e: any) {
      checks.tables.properties = `ERROR: ${e.message}`;
    }

    // property_images
    try {
      const { error, count } = await supabase
        .from("property_images")
        .select("*", { count: "exact", head: true });
      if (error) {
        checks.tables.property_images = `ERROR: ${error.message}`;
      } else {
        checks.tables.property_images = `EXISTS`;
        checks.counts.property_images = count;
      }
    } catch (e: any) {
      checks.tables.property_images = `ERROR: ${e.message}`;
    }

    // contacts
    try {
      const { error, count } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true });
      if (error) {
        checks.tables.contacts = `ERROR: ${error.message}`;
      } else {
        checks.tables.contacts = `EXISTS`;
        checks.counts.contacts = count;
      }
    } catch (e: any) {
      checks.tables.contacts = `ERROR: ${e.message}`;
    }

    // storage buckets
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets();
      if (error) {
        checks.storageBuckets = `ERROR: ${error.message}`;
      } else {
        checks.storageBuckets = buckets?.map((b: any) => `${b.name} (${b.public ? "public" : "private"})`) || [];
      }
    } catch (e: any) {
      checks.storageBuckets = `ERROR: ${e.message}`;
    }

    // admin user
    try {
      const { data, error } = await supabase
        .from("agents")
        .select("email, role, name")
        .eq("email", "admin@barrerabrokers.com")
        .single();
      checks.adminUser = error ? `ERROR: ${error.message}` : `EXISTS - role: ${data.role}`;
    } catch (e: any) {
      checks.adminUser = `ERROR: ${e.message}`;
    }
  } catch (error: any) {
    checks.errors.push(error.message);
  }

  return NextResponse.json(checks, { status: 200 });
}
