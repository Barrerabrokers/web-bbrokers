"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Mail, Lock, User, Phone, AlertCircle, CheckCircle } from "lucide-react";
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
      setError("Las contraseñas no coinciden");
      return;
    }

    if (formData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
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

      // Auto-login después del registro
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
    <div className="min-h-screen bg-charcoal-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex flex-col items-center mb-8">
          <div className="relative h-24 w-24 mb-4">
            <Image
              src="/logo.png"
              alt="Barrera Brokers"
              fill
              priority
              className="object-contain"
            />
          </div>
          <span className="heading-serif text-2xl text-white tracking-wider">
            Barrera Brokers
          </span>
        </Link>

        {/* Register Card */}
        <div className="bg-white p-8 md:p-10">
          <div className="text-center mb-8">
            <h1 className="heading-serif text-2xl md:text-3xl text-charcoal-900 mb-2">
              Registro de Agente
            </h1>
            <p className="label-tracking text-charcoal-500">
              Crea tu cuenta para gestionar propiedades
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 bg-green-50 border-l-4 border-green-500 text-green-700 px-4 py-3 flex items-start space-x-2">
              <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">¡Cuenta creada! Redirigiendo...</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label-tracking text-charcoal-700 block mb-2">
                Nombre Completo
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal-400" />
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none transition-colors"
                  placeholder="Juan Perez"
                />
              </div>
            </div>

            <div>
              <label className="label-tracking text-charcoal-700 block mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal-400" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none transition-colors"
                  placeholder="agente@barrerabrokers.com"
                />
              </div>
            </div>

            <div>
              <label className="label-tracking text-charcoal-700 block mb-2">
                Telefono
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal-400" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none transition-colors"
                  placeholder="+54 11 1234-5678"
                />
              </div>
            </div>

            <div>
              <label className="label-tracking text-charcoal-700 block mb-2">
                Contrasena
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none transition-colors"
                  placeholder="Minimo 6 caracteres"
                />
              </div>
            </div>

            <div>
              <label className="label-tracking text-charcoal-700 block mb-2">
                Confirmar Contrasena
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none transition-colors"
                  placeholder="Repite tu contrasena"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || success}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creando cuenta..." : "Crear Cuenta"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-charcoal-100 text-center">
            <p className="text-sm text-charcoal-500">
              Ya tienes cuenta?{" "}
              <Link href="/login" className="text-gold-600 hover:text-gold-700 font-medium">
                Inicia sesion
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-white/60 hover:text-white">
            -- Volver al sitio web
          </Link>
        </div>
      </div>
    </div>
  );
}
