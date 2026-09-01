"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AlertCircle, ArrowLeft, CheckCircle, Lock } from "lucide-react";
import { useSiteSettings } from "@/lib/use-site-settings";

function ResetPasswordForm() {
  const settings = useSiteSettings();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("El enlace no es válido. Pedí al administrador que envíe uno nuevo.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "No se pudo actualizar la contraseña.");
        return;
      }

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("No se pudo actualizar la contraseña. Intentá nuevamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-cream-200">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-3 mb-12">
          <div className="relative h-10 w-10 flex-shrink-0">
            <Image
              src={settings.logoUrl}
              alt={settings.companyName}
              fill
              priority
              className="object-contain"
            />
          </div>
          <span className="font-display font-light text-2xl tracking-tight text-ink">
            {settings.companyName}
          </span>
        </Link>

        <div className="text-center mb-10">
          <p className="eyebrow justify-center mb-5">Portal de agentes</p>
          <h1 className="font-display font-light text-5xl md:text-6xl tracking-[-0.025em] text-ink leading-[0.95]">
            Nueva
            <br />
            <span className="italic">contraseña.</span>
          </h1>
        </div>

        {!token && (
          <div className="mb-6 border-l-2 border-accent pl-4 py-2 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
            <p className="text-sm text-ink/80">
              Este enlace no es válido. Pedí al administrador que envíe una nueva recuperación.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 border-l-2 border-accent pl-4 py-2 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
            <p className="text-sm text-ink/80">{error}</p>
          </div>
        )}

        {success ? (
          <div className="space-y-6">
            <div className="border-l-2 border-emerald-700 pl-4 py-2 flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-700 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-ink/80">
                Contraseña actualizada correctamente. Ya podés ingresar al portal.
              </p>
            </div>
            <Link href="/login" className="btn-primary w-full">
              Ir al login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-7">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-ink/55 mb-2">
                Nueva contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40 pointer-events-none" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="form-input pl-7"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-ink/55 mb-2">
                Repetir contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40 pointer-events-none" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="form-input pl-7"
                  placeholder="Repetir contraseña"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !token}
              className="btn-primary w-full mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Actualizando..." : "Actualizar contraseña"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-ink/50 hover:text-ink transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver al login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-cream-200">
          <div className="animate-spin h-8 w-8 rounded-full border-2 border-ink/15 border-t-accent" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
