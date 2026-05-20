"use client";

import { useSession, signOut } from "next-auth/react";
import { Building2, LogOut, User } from "lucide-react";
import Link from "next/link";

export function AdminHeader() {
  const { data: session } = useSession();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="flex items-center justify-between px-8 py-4">
        <Link href="/admin" className="flex items-center space-x-2">
          <Building2 className="h-8 w-8 text-primary-600" />
          <div>
            <div className="text-xl font-bold text-gray-900">Barrera Brokers</div>
            <div className="text-xs text-gray-500">Panel de Administración</div>
          </div>
        </Link>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="bg-primary-100 p-2 rounded-full">
              <User className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">
                {session?.user?.name}
              </div>
              <div className="text-xs text-gray-500">
                {session?.user?.email}
              </div>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm">Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </header>
  );
}
