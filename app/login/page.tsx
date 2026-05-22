"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Mail, Lock, AlertCircle } from "lucide-react";
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

        {/* Login Card */}
        <div className="bg-white p-8 md:p-10">
          <div className="text-center mb-8">
            <h1 className="heading-serif text-2xl md:text-3xl text-charcoal-900 mb-2">
              Portal de Agentes
            </h1>
            <p className="label-tracking text-charcoal-500">
              Ingresa con tus credenciales
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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
                  placeholder="tu@email.com"
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
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none transition-colors"
                  placeholder="Tu contrasena"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Iniciando sesion..." : "Iniciar Sesion"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-charcoal-100 text-center">
            <p className="text-sm text-charcoal-500">
              No tienes cuenta?{" "}
              <Link href="/register" className="text-gold-600 hover:text-gold-700 font-medium">
                Registrate
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
