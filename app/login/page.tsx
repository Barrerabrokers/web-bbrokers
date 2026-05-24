"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Mail, Lock, AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";
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
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 -z-10 bg-grid opacity-[0.4]" />
      <div className="absolute inset-0 -z-10 bg-glow-accent" />

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-3 mb-8 group">
          <div className="relative h-10 w-10 flex-shrink-0">
            <Image
              src="/logo.png"
              alt="Barrera Brokers"
              fill
              priority
              className="object-contain"
            />
          </div>
          <span className="text-base font-semibold tracking-tight text-gray-50">
            Barrera Brokers
          </span>
        </Link>

        {/* Login Card */}
        <div className="card p-8 backdrop-blur-md bg-gray-900/80">
          <div className="text-center mb-7">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-50 mb-1.5">
              Portal de Agentes
            </h1>
            <p className="text-sm text-gray-400">
              Ingresa con tus credenciales
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-300 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium tracking-tight text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="form-input pl-10"
                  placeholder="tu@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium tracking-tight text-gray-300 mb-2">
                Contrasena
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="form-input pl-10"
                  placeholder="Tu contrasena"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-accent w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                "Iniciando sesion..."
              ) : (
                <>
                  Iniciar sesion
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-800 text-center">
            <p className="text-sm text-gray-400">
              No tenes cuenta?{" "}
              <Link
                href="/register"
                className="text-accent-300 hover:text-accent-400 font-medium"
              >
                Registrate
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al sitio
          </Link>
        </div>
      </div>
    </div>
  );
}
