"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UserPlus, Mail, Phone, Shield, User, Camera, Save, Loader2, X } from "lucide-react";
import Image from "next/image";

interface Agent {
  id: string;
  name: string;
  email: string;
  phone?: string;
  photo?: string;
  title?: string;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "agent" as "agent" | "admin",
  });

  const [editData, setEditData] = useState({
    name: "",
    phone: "",
    title: "",
    photo: "",
    role: "agent",
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

  const startEdit = (agent: Agent) => {
    setEditingId(agent.id);
    setEditData({
      name: agent.name,
      phone: agent.phone || "",
      title: agent.title || "",
      photo: agent.photo || "",
      role: agent.role,
    });
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("La foto es muy grande (máx 5MB)");
      return;
    }

    const formData = new FormData();
    formData.append("files", file);
    formData.append("folder", "agents");

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Error subiendo foto");
        return;
      }
      const data = await res.json();
      setEditData((prev) => ({ ...prev, photo: data.urls[0] }));
    } catch (err: any) {
      setError("Error subiendo foto");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/agents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...editData }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Error al guardar");
        return;
      }

      setSuccess("Agente actualizado");
      setEditingId(null);
      fetchAgents();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-ink/15 border-t-accent" />
      </div>
    );
  }

  if (session?.user?.role !== "admin") return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink mb-1">
            Agentes
          </h1>
          <p className="text-sm text-ink/60">
            Gestiona el equipo de agentes — foto, nombre y cargo se muestran en la web
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
        <div className="mb-5 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <div className="card p-6 mb-8">
          <h2 className="text-base font-semibold tracking-tight text-ink mb-5">
            Crear nuevo agente
          </h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink/75 mb-2">Nombre *</label>
              <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="form-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink/75 mb-2">Email *</label>
              <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="form-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink/75 mb-2">Teléfono</label>
              <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="form-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink/75 mb-2">Rol *</label>
              <select required value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as any })} className="form-input">
                <option value="agent">Agente</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-ink/75 mb-2">Contraseña *</label>
              <input type="password" required minLength={6} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="form-input" placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreateForm(false)} className="btn-outline text-sm">Cancelar</button>
              <button type="submit" className="btn-accent text-sm">Crear agente</button>
            </div>
          </form>
        </div>
      )}

      {/* Agents list */}
      <div className="space-y-4">
        {agents.map((agent) => (
          <div key={agent.id} className="card p-5">
            {editingId === agent.id ? (
              /* ===== EDIT MODE ===== */
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink">Editando agente</h3>
                  <button onClick={() => setEditingId(null)} className="p-1 text-ink/50 hover:text-ink">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-5">
                  {/* Photo */}
                  <div className="relative">
                    <div className="h-20 w-20 rounded-full overflow-hidden bg-cream-200 border-2 border-ink/10">
                      {editData.photo ? (
                        <Image src={editData.photo} alt={editData.name} width={80} height={80} className="object-cover w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-ink/30">
                          <User className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <label className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-accent flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                      <Camera className="h-3.5 w-3.5 text-ink" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpload(file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  {/* Fields */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-ink/50 mb-1">Nombre</label>
                      <input type="text" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="w-full px-3 py-2 border border-ink/15 rounded text-sm focus:border-accent focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-ink/50 mb-1">Cargo / Título</label>
                      <input type="text" value={editData.title} onChange={(e) => setEditData({ ...editData, title: e.target.value })} className="w-full px-3 py-2 border border-ink/15 rounded text-sm focus:border-accent focus:outline-none" placeholder="Ej: Director Comercial" />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-ink/50 mb-1">Teléfono</label>
                      <input type="tel" value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} className="w-full px-3 py-2 border border-ink/15 rounded text-sm focus:border-accent focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-ink/50 mb-1">Rol</label>
                      <select value={editData.role} onChange={(e) => setEditData({ ...editData, role: e.target.value })} className="w-full px-3 py-2 border border-ink/15 rounded text-sm focus:border-accent focus:outline-none">
                        <option value="agent">Agente</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button onClick={handleSaveEdit} disabled={saving} className="btn-primary disabled:opacity-50 inline-flex items-center gap-2 text-sm">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </div>
            ) : (
              /* ===== VIEW MODE ===== */
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="h-12 w-12 rounded-full overflow-hidden bg-cream-200 border border-ink/10 flex-shrink-0">
                    {agent.photo ? (
                      <Image src={agent.photo} alt={agent.name} width={48} height={48} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {agent.role === "admin" ? (
                          <Shield className="h-5 w-5 text-accent" />
                        ) : (
                          <User className="h-5 w-5 text-ink/40" />
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight text-ink">
                      {agent.name}
                    </h3>
                    {agent.title && (
                      <p className="text-xs text-accent font-medium">{agent.title}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-ink/50 mt-0.5 flex-wrap">
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
                <div className="flex items-center gap-3">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${agent.role === "admin" ? "bg-accent/10 border-accent/30 text-accent" : "bg-cream-100 border-ink/15 text-ink/60"}`}>
                    {agent.role === "admin" ? "Admin" : "Agente"}
                  </span>
                  <button onClick={() => startEdit(agent)} className="text-xs text-accent hover:text-accent-600 font-medium">
                    Editar
                  </button>
                </div>
              </div>
            )}
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
