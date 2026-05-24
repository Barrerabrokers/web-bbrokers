"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UserPlus, Mail, Phone, Shield, User } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  active: boolean;
  createdAt: string;
}

export default function AgentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "agent" as "agent" | "admin",
  });

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push("/admin");
      return;
    }

    if (status === "authenticated") {
      fetchAgents();
    }
  }, [status, session, router]);

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      setAgents(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al crear");
        return;
      }

      setSuccess("Agente creado exitosamente");
      setFormData({
        name: "",
        email: "",
        phone: "",
        password: "",
        role: "agent",
      });
      setShowCreateForm(false);
      fetchAgents();
    } catch (err) {
      setError("Error al crear el agente");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-ink/15 border-t-accent" />
      </div>
    );
  }

  if (session?.user?.role !== "admin") {
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink mb-1">
            Agentes
          </h1>
          <p className="text-sm text-ink/60">
            Gestiona el equipo de agentes y administradores
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn-accent text-sm"
        >
          <UserPlus className="h-4 w-4" />
          Nuevo agente
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {success}
        </div>
      )}

      {showCreateForm && (
        <div className="card p-6 mb-8">
          <h2 className="text-base font-semibold tracking-tight text-ink mb-5">
            Crear nuevo agente
          </h2>
          <form
            onSubmit={handleCreate}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div>
              <label className="block text-xs font-medium tracking-tight text-ink/75 mb-2">
                Nombre *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="form-input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium tracking-tight text-ink/75 mb-2">
                Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="form-input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium tracking-tight text-ink/75 mb-2">
                Telefono
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="form-input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium tracking-tight text-ink/75 mb-2">
                Rol *
              </label>
              <select
                required
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value as any })
                }
                className="form-input"
              >
                <option value="agent">Agente</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium tracking-tight text-ink/75 mb-2">
                Contrasena *
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="form-input"
                placeholder="Minimo 6 caracteres"
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn-outline text-sm"
              >
                Cancelar
              </button>
              <button type="submit" className="btn-accent text-sm">
                Crear agente
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="card-hover p-5 flex items-center justify-between flex-wrap gap-3"
          >
            <div className="flex items-center gap-4">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center border ${
                  agent.role === "admin"
                    ? "bg-accent/10 border-accent/30 text-accent"
                    : "bg-cream-100 border-ink/15 text-ink/60"
                }`}
              >
                {agent.role === "admin" ? (
                  <Shield className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-ink">
                  {agent.name}
                </h3>
                <div className="flex items-center gap-3 text-xs text-ink0 mt-0.5 flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {agent.email}
                  </span>
                  {agent.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {agent.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <span
              className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium tracking-tight border ${
                agent.role === "admin"
                  ? "bg-accent/10 border-accent/30 text-accent"
                  : "bg-cream-100 border-ink/15 text-ink/60"
              }`}
            >
              {agent.role === "admin" ? "Administrador" : "Agente"}
            </span>
          </div>
        ))}

        {agents.length === 0 && (
          <div className="card p-16 text-center">
            <p className="text-sm text-ink/60">No hay agentes registrados</p>
          </div>
        )}
      </div>
    </div>
  );
}
