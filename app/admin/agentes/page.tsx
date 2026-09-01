"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UserPlus, Mail, Phone, Shield, User, Camera, Save, Loader2, X, Trash2, CheckCircle2, PauseCircle, ArrowUp, ArrowDown, GripVertical, KeyRound } from "lucide-react";
import Image from "next/image";
import { canManageAdminPanel, getRoleLabel } from "@/lib/roles";

interface Agent {
  id: string;
  name: string;
  email: string;
  phone?: string;
  photo?: string;
  title?: string;
  role: string;
  active: boolean;
  sortOrder?: number;
  createdAt: string;
}

export default function AgentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAdmin = session?.user?.role === "admin";
  const canManagePanel = canManageAdminPanel(session?.user?.role);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "agent" as "agent" | "admin" | "marketing",
  });

  const [editData, setEditData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    title: "",
    photo: "",
    role: "agent",
    active: false,
  });

  useEffect(() => {
    if (status === "authenticated" && !canManagePanel) {
      router.push("/admin");
      return;
    }
    if (status === "authenticated") {
      fetchAgents();
    }
  }, [status, canManagePanel, router]);

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
      email: agent.email,
      password: "",
      phone: agent.phone || "",
      title: agent.title || "",
      photo: agent.photo || "",
      role: agent.role,
      active: agent.active,
    });
  };

  const handleAccessChange = async (agent: Agent, active: boolean) => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/agents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: agent.id, active }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "No se pudo actualizar el acceso");
        return;
      }

      setSuccess(active ? "Acceso del agente aprobado" : "Acceso del agente suspendido");
      await fetchAgents();
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("No se pudo actualizar el acceso");
    } finally {
      setSaving(false);
    }
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

    if (isAdmin && !editData.email.trim()) {
      setError("El email de acceso es obligatorio");
      setSaving(false);
      return;
    }

    if (isAdmin && editData.password && editData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/agents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingId,
            ...editData,
            email: isAdmin ? editData.email : undefined,
            password: isAdmin && editData.password ? editData.password : undefined,
            role: isAdmin ? editData.role : undefined,
          }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Error al guardar");
        return;
      }

      setSuccess("Agente actualizado");
      setEditingId(null);
      setEditData((current) => ({ ...current, password: "" }));
      fetchAgents();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleMoveAgent = async (agentId: string, direction: "up" | "down") => {
    const currentIndex = agents.findIndex((agent) => agent.id === agentId);
    if (currentIndex < 0) return;
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= agents.length) return;

    const reordered = [...agents];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    const normalized = reordered.map((agent, index) => ({
      ...agent,
      sortOrder: index,
    }));

    setAgents(normalized);
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/agents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: normalized.map((agent, index) => ({
            id: agent.id,
            sortOrder: index,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo guardar el orden");
        await fetchAgents();
        return;
      }

      setAgents(data || normalized);
      setSuccess("Orden de agentes actualizado");
      setTimeout(() => setSuccess(""), 2500);
    } catch {
      setError("No se pudo guardar el orden");
      await fetchAgents();
    } finally {
      setSaving(false);
    }
  };

  const handleSendPasswordReset = async (agent: Agent) => {
    setError("");
    setSuccess("");
    setResettingId(agent.id);

    try {
      const res = await fetch(`/api/agents/${agent.id}/password-reset`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudo enviar el email de recuperación");
        return;
      }

      setSuccess(data.message || `Email de recuperación enviado a ${agent.email}`);
      setTimeout(() => setSuccess(""), 4000);
    } catch {
      setError("No se pudo enviar el email de recuperación");
    } finally {
      setResettingId(null);
    }
  };

  const handleDelete = async (agent: Agent) => {
    setError("");
    setSuccess("");

    if (agent.id === session?.user?.id) {
      setError("No podes eliminar tu propia cuenta");
      return;
    }

    const confirmed = window.confirm(
      `Eliminar a "${agent.name}"? Esta accion no se puede deshacer.\n\nLas propiedades y desarrollos asociados quedaran sin agente asignado.`
    );
    if (!confirmed) return;

    setDeletingId(agent.id);
    try {
      const res = await fetch(`/api/agents?id=${agent.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Error al eliminar");
        return;
      }

      setSuccess("Agente eliminado");
      fetchAgents();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Error al eliminar el agente");
    } finally {
      setDeletingId(null);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-ink/15 border-t-accent" />
      </div>
    );
  }

  if (!canManagePanel) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink mb-1">
            Agentes
          </h1>
          <p className="text-sm text-ink/60">
            Aprobá nuevos registros y gestioná el acceso de cada agente.
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
                {isAdmin && <option value="marketing">Gerente de marketing</option>}
                {isAdmin && <option value="admin">Administrador</option>}
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
        {agents.map((agent, index) => (
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
                      <label className="block text-[10px] uppercase tracking-widest text-ink/50 mb-1">Email de acceso</label>
                      {isAdmin ? (
                        <input
                          type="email"
                          value={editData.email}
                          onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                          className="w-full px-3 py-2 border border-ink/15 rounded text-sm focus:border-accent focus:outline-none"
                        />
                      ) : (
                        <div className="w-full px-3 py-2 border border-ink/15 rounded bg-cream-100 text-sm text-ink/65">
                          {editData.email}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-ink/50 mb-1">Cargo / Título</label>
                      <input type="text" value={editData.title} onChange={(e) => setEditData({ ...editData, title: e.target.value })} className="w-full px-3 py-2 border border-ink/15 rounded text-sm focus:border-accent focus:outline-none" placeholder="Ej: Director Comercial" />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-ink/50 mb-1">Teléfono</label>
                      <input type="tel" value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} className="w-full px-3 py-2 border border-ink/15 rounded text-sm focus:border-accent focus:outline-none" />
                    </div>
                    {isAdmin && (
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-ink/50 mb-1">Nueva contraseña</label>
                        <input
                          type="password"
                          minLength={6}
                          value={editData.password}
                          onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                          className="w-full px-3 py-2 border border-ink/15 rounded text-sm focus:border-accent focus:outline-none"
                          placeholder="Dejar vacío para no cambiar"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-ink/50 mb-1">Rol</label>
                      {isAdmin ? (
                        <select value={editData.role} onChange={(e) => setEditData({ ...editData, role: e.target.value })} className="w-full px-3 py-2 border border-ink/15 rounded text-sm focus:border-accent focus:outline-none">
                          <option value="agent">Agente</option>
                          <option value="marketing">Gerente de marketing</option>
                          <option value="admin">Administrador</option>
                        </select>
                      ) : (
                        <div className="w-full px-3 py-2 border border-ink/15 rounded bg-cream-100 text-sm text-ink/65">
                          {getRoleLabel(editData.role)}
                        </div>
                      )}
                    </div>
                    <label className="sm:col-span-2 flex items-center gap-3 rounded border border-ink/15 px-3 py-2.5 text-sm text-ink cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editData.active}
                        onChange={(e) => setEditData({ ...editData, active: e.target.checked })}
                        className="h-4 w-4 accent-black"
                      />
                      Acceso aprobado al portal
                    </label>
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
                  <div className="flex items-center gap-2 text-ink/45">
                    <GripVertical className="h-4 w-4" />
                    <span className="w-7 text-center font-display italic text-lg">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  {/* Avatar */}
                  <div className="h-12 w-12 rounded-full overflow-hidden bg-cream-200 border border-ink/10 flex-shrink-0">
                    {agent.photo ? (
                      <Image src={agent.photo} alt={agent.name} width={48} height={48} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {agent.role === "admin" || agent.role === "marketing" ? (
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
                  <div className="flex items-center rounded-full border border-ink/10 bg-cream-100 p-0.5">
                    <button
                      type="button"
                      onClick={() => handleMoveAgent(agent.id, "up")}
                      disabled={saving || index === 0}
                      className="h-7 w-7 rounded-full inline-flex items-center justify-center text-ink/60 hover:bg-white hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Subir posición"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveAgent(agent.id, "down")}
                      disabled={saving || index === agents.length - 1}
                      className="h-7 w-7 rounded-full inline-flex items-center justify-center text-ink/60 hover:bg-white hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Bajar posición"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${agent.active ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
                    {agent.active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <PauseCircle className="h-3.5 w-3.5" />}
                    {agent.active ? "Aprobado" : "Pendiente"}
                  </span>
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${agent.role === "admin" || agent.role === "marketing" ? "bg-accent/10 border-accent/30 text-accent" : "bg-cream-100 border-ink/15 text-ink/60"}`}>
                    {getRoleLabel(agent.role)}
                  </span>
                  {agent.id !== session?.user?.id && (
                    <button
                      onClick={() => handleAccessChange(agent, !agent.active)}
                      disabled={saving}
                      className={`text-xs font-medium disabled:opacity-50 ${agent.active ? "text-amber-700 hover:text-amber-900" : "text-emerald-700 hover:text-emerald-900"}`}
                    >
                      {agent.active ? "Suspender" : "Aprobar acceso"}
                    </button>
                  )}
                  <button onClick={() => startEdit(agent)} className="text-xs text-accent hover:text-accent-600 font-medium">
                    Editar
                  </button>
                  <button
                    onClick={() => handleSendPasswordReset(agent)}
                    disabled={resettingId === agent.id}
                    className="inline-flex items-center gap-1 text-xs text-ink/65 hover:text-ink font-medium disabled:opacity-50"
                    title={`Enviar recuperación de contraseña a ${agent.email}`}
                  >
                    {resettingId === agent.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="h-3.5 w-3.5" />
                    )}
                    Reenviar clave
                  </button>
                  <button
                    onClick={() => handleDelete(agent)}
                    disabled={deletingId === agent.id || agent.id === session?.user?.id}
                    title={agent.id === session?.user?.id ? "No podes eliminar tu propia cuenta" : "Eliminar agente"}
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {deletingId === agent.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Eliminar
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
