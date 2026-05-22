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
      setFormData({ name: "", email: "", phone: "", password: "", role: "agent" });
      setShowCreateForm(false);
      fetchAgents();
    } catch (err) {
      setError("Error al crear el agente");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-12 w-12 border-t-2 border-b-2 border-gold-500"></div>
      </div>
    );
  }

  if (session?.user?.role !== "admin") {
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="heading-serif text-3xl text-charcoal-900 mb-2">Agentes</h1>
          <p className="text-charcoal-500">Gestiona el equipo de agentes y administradores</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center space-x-2 btn-primary"
        >
          <UserPlus className="h-5 w-5" />
          <span>Nuevo Agente</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border-l-4 border-green-500 text-green-700 px-4 py-3">
          {success}
        </div>
      )}

      {showCreateForm && (
        <div className="bg-white border border-charcoal-100 p-8 mb-8">
          <h2 className="heading-serif text-2xl text-charcoal-900 mb-6">
            Crear nuevo agente
          </h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label-tracking text-charcoal-700 block mb-2">Nombre *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="label-tracking text-charcoal-700 block mb-2">Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="label-tracking text-charcoal-700 block mb-2">Telefono</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="label-tracking text-charcoal-700 block mb-2">Rol *</label>
              <select
                required
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full px-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none"
              >
                <option value="agent">Agente</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label-tracking text-charcoal-700 block mb-2">Contrasena *</label>
              <input
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none"
                placeholder="Minimo 6 caracteres"
              />
            </div>
            <div className="md:col-span-2 flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-6 py-3 border border-charcoal-300 text-charcoal-700"
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary">
                Crear Agente
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {agents.map((agent) => (
          <div key={agent.id} className="bg-white border border-charcoal-100 p-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                agent.role === "admin" ? "bg-gold-100" : "bg-charcoal-100"
              }`}>
                {agent.role === "admin" ? (
                  <Shield className="h-6 w-6 text-gold-600" />
                ) : (
                  <User className="h-6 w-6 text-charcoal-600" />
                )}
              </div>
              <div>
                <h3 className="heading-serif text-lg text-charcoal-900">{agent.name}</h3>
                <div className="flex items-center gap-4 text-sm text-charcoal-500 mt-1">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {agent.email}
                  </span>
                  {agent.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {agent.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <span className={`label-tracking text-xs px-3 py-1 ${
              agent.role === "admin" 
                ? "bg-gold-100 text-gold-700" 
                : "bg-charcoal-100 text-charcoal-700"
            }`}>
              {agent.role === "admin" ? "Administrador" : "Agente"}
            </span>
          </div>
        ))}

        {agents.length === 0 && (
          <div className="text-center py-16 bg-white border border-charcoal-100">
            <p className="text-charcoal-500">No hay agentes registrados</p>
          </div>
        )}
      </div>
    </div>
  );
}
