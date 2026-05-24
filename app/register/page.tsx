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
    <div className="min-h-screen flex items-center justify-center p-4 py-16 bg-cream-200">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="flex items-center justify-center gap-3 mb-10"
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

        <div className="text-center mb-10">
          <p className="eyebrow justify-center mb-5">Registro de agente</p>
          <h1 className="font-display font-light text-5xl md:text-6xl tracking-[-0.025em] text-ink leading-[0.95]">
            Crea tu
            <br />
            <span className="italic">cuenta.</span>
          </h1>
        </div>

        {error && (
          <div className="mb-6 border-l-2 border-accent pl-4 py-2 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
            <p className="text-sm text-ink/80">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 border-l-2 border-emerald-700 pl-4 py-2 flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-700 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-ink/80">
              Cuenta creada! Redirigiendo...
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-7">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-ink/55 mb-2">
              Nombre completo
            </label>
            <div className="relative">
              <User className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40 pointer-events-none" />
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="form-input pl-7"
                placeholder="Juan Perez"
              />
            </div>
          </div>

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
                placeholder="agente@barrerabrokers.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-ink/55 mb-2">
              Telefono
            </label>
            <div className="relative">
              <Phone className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40 pointer-events-none" />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="form-input pl-7"
                placeholder="+54 11 1234-5678"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-ink/55 mb-2">
                Contrasena
              </label>
              <div className="relative">
                <Lock className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40 pointer-events-none" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="form-input pl-7"
                  placeholder="Min 6 chars"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-ink/55 mb-2">
                Repetir
              </label>
              <div className="relative">
                <Lock className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40 pointer-events-none" />
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
                  className="form-input pl-7"
                  placeholder="Repetir"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || success}
            className="btn-primary w-full mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-ink/15 text-center">
          <p className="text-sm text-ink/60">
            Ya tenes cuenta?{" "}
            <Link
              href="/login"
              className="text-ink font-medium link-underline"
            >
              Inicia sesion
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
