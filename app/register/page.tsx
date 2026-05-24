"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  Mail,
  Lock,
  User,
  Phone,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Las contrasenas no coinciden");
      return;
    }

    if (formData.password.length < 6) {
      setError("La contrasena debe tener al menos 6 caracteres");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          role: "agent",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Error al registrar");
        setIsLoading(false);
        return;
      }

      setSuccess(true);

      setTimeout(async () => {
        const result = await signIn("credentials", {
          email: formData.email,
          password: formData.password,
          redirect: false,
        });

        if (result?.ok) {
          router.push("/admin");
          router.refresh();
        } else {
          router.push("/login");
        }
      }, 1500);
    } catch (err) {
      setError("Error al crear la cuenta. Intenta nuevamente.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-grid opacity-[0.4]" />
      <div className="absolute inset-0 -z-10 bg-glow-accent" />

      <div className="w-full max-w-md relative">
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

        <div className="card p-8 backdrop-blur-md bg-gray-900/80">
          <div className="text-center mb-7">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-50 mb-1.5">
              Registro de Agente
            </h1>
            <p className="text-sm text-gray-400">
              Crea tu cuenta para gestionar propiedades
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-300 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-300 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-300">
                Cuenta creada! Redirigiendo...
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium tracking-tight text-gray-300 mb-2">
                Nombre completo
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="form-input pl-10"
                  placeholder="Juan Perez"
                />
              </div>
            </div>

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
                  placeholder="agente@barrerabrokers.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium tracking-tight text-gray-300 mb-2">
                Telefono
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="form-input pl-10"
                  placeholder="+54 11 1234-5678"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium tracking-tight text-gray-300 mb-2">
                  Contrasena
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="form-input pl-10"
                    placeholder="Min 6 chars"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium tracking-tight text-gray-300 mb-2">
                  Repetir
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        confirmPassword: e.target.value,
                      })
                    }
                    className="form-input pl-10"
                    placeholder="Repetir"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || success}
              className="btn-accent w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                "Creando cuenta..."
              ) : (
                <>
                  Crear cuenta
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-800 text-center">
            <p className="text-sm text-gray-400">
              Ya tenes cuenta?{" "}
              <Link
                href="/login"
                className="text-accent-300 hover:text-accent-400 font-medium"
              >
                Inicia sesion
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
