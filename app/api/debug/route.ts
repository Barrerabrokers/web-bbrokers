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
    },
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT SET",
    tables: {} as any,
    storageBuckets: [] as any,
    adminUser: "" as any,
    errors: [] as any,
  };

  try {
    const supabase = getServerSupabase();

    // Test agents table
    try {
      const { error } = await supabase.from("agents").select("count").limit(1);
      checks.tables.agents = error ? `ERROR: ${error.message}` : `EXISTS`;
    } catch (e: any) {
      checks.tables.agents = `ERROR: ${e.message}`;
    }

    // Test properties table
    try {
      const { error } = await supabase.from("properties").select("count").limit(1);
      checks.tables.properties = error ? `ERROR: ${error.message}` : `EXISTS`;
    } catch (e: any) {
      checks.tables.properties = `ERROR: ${e.message}`;
    }

    // Test property_images table
    try {
      const { error } = await supabase.from("property_images").select("count").limit(1);
      checks.tables.property_images = error ? `ERROR: ${error.message}` : `EXISTS`;
    } catch (e: any) {
      checks.tables.property_images = `ERROR: ${e.message}`;
    }

    // Test contacts table
    try {
      const { error } = await supabase.from("contacts").select("count").limit(1);
      checks.tables.contacts = error ? `ERROR: ${error.message}` : `EXISTS`;
    } catch (e: any) {
      checks.tables.contacts = `ERROR: ${e.message}`;
    }

    // Test storage buckets
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

    // Test admin user
    try {
      const { data, error } = await supabase
        .from("agents")
        .select("email, role")
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
