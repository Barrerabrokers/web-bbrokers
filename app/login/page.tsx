"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Mail, Lock, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Credenciales invalidas. Verifica tu email y contrasena.");
      } else {
        router.push("/admin");
        router.refresh();
      }
    } catch (error) {
      setError("Ocurrio un error. Por favor intenta nuevamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-cream-200">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center justify-center gap-3 mb-12"
        >
          <div className="relative h-10 w-10 flex-shrink-0">
            <Image
              src="/logo.png"
              alt="Barrera Brokers"
              fill
              priority
              className="object-contain"
            />
          </div>
          <span className="font-display font-light text-2xl tracking-tight text-ink">
            Barrera Brokers
          </span>
        </Link>

        {/* Editorial header */}
        <div className="text-center mb-10">
          <p className="eyebrow justify-center mb-5">Portal de agentes</p>
          <h1 className="font-display font-light text-5xl md:text-6xl tracking-[-0.025em] text-ink leading-[0.95]">
            Bienvenido
            <br />
            <span className="italic">de vuelta.</span>
          </h1>
        </div>

        {error && (
          <div className="mb-6 border-l-2 border-accent pl-4 py-2 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
            <p className="text-sm text-ink/80">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-7">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-ink/55 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40 pointer-events-none" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="form-input pl-7"
                placeholder="tu@email.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-ink/55 mb-2">
              Contrasena
            </label>
            <div className="relative">
              <Lock className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40 pointer-events-none" />
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="form-input pl-7"
                placeholder="Tu contrasena"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Iniciando sesion..." : "Iniciar sesion"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-ink/15 text-center">
          <p className="text-sm text-ink/60">
            No tenes cuenta?{" "}
            <Link
              href="/register"
              className="text-ink font-medium link-underline"
            >
              Registrate
            </Link>
          </p>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-ink/50 hover:text-ink transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver al sitio
          </Link>
        </div>
      </div>
    </div>
  );
}
