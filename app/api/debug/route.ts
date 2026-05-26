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
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || "NOT SET (ok in Vercel, auto-detected)",
      DATABASE_URL: process.env.DATABASE_URL ? "SET" : "MISSING",
      POSTGRES_URL: process.env.POSTGRES_URL ? "SET" : "MISSING",
      POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING ? "SET" : "MISSING",
      NODE_ENV: process.env.NODE_ENV || "unknown",
      VERCEL_URL: process.env.VERCEL_URL || "NOT SET",
    },
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT SET",
    authCheck: {} as any,
    tables: {} as any,
    counts: {} as any,
    storageBuckets: [] as any,
    adminUser: "" as any,
    sampleProperties: [] as any,
    errors: [] as any,
  };

  // Auth pre-flight check
  try {
    if (!process.env.NEXTAUTH_SECRET) {
      checks.authCheck.status = "WILL FAIL";
      checks.authCheck.reason = "NEXTAUTH_SECRET is not defined";
    } else {
      checks.authCheck.status = "OK";
      checks.authCheck.secretLength = process.env.NEXTAUTH_SECRET.length;
    }
  } catch (e: any) {
    checks.authCheck.error = e.message;
  }

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
