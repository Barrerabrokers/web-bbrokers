"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, ExternalLink } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export function AdminHeader() {
  const { data: session } = useSession();

  return (
    <header className="bg-gray-950/80 backdrop-blur-xl border-b border-gray-800 sticky top-0 z-30">
      <div className="flex items-center justify-between px-6 md:px-8 h-14">
        <Link href="/admin" className="flex items-center gap-2.5">
          <div className="relative h-7 w-7">
            <Image
              src="/logo.png"
              alt="Barrera Brokers"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-gray-50">
              Barrera Brokers
            </div>
            <div className="text-[10px] tracking-widest uppercase text-gray-500">
              Admin
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            target="_blank"
            className="btn-ghost text-xs hidden sm:inline-flex"
          >
            Ver sitio
            <ExternalLink className="h-3 w-3" />
          </Link>

          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-gray-800">
            <div className="h-7 w-7 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-[11px] font-semibold text-accent-300">
              {session?.user?.name?.charAt(0)?.toUpperCase() ?? "A"}
            </div>
            <div className="leading-tight">
              <div className="text-xs font-medium text-gray-200">
                {session?.user?.name}
              </div>
              <div className="text-[10px] text-gray-500">
                {session?.user?.email}
              </div>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="btn-ghost text-xs"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
}
