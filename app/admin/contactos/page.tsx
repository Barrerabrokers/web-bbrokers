import { Mail, Phone, Calendar } from "lucide-react";
import { getAllContacts } from "@/lib/db";

export default async function ContactsPage() {
  const contacts = await getAllContacts();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink mb-1">
          Contactos
        </h1>
        <p className="text-sm text-ink/60">
          Mensajes de clientes potenciales
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="card p-5">
          <div className="text-3xl font-semibold tracking-tightest text-accent mb-1">
            {contacts.filter((c: any) => c.status === "nuevo").length}
          </div>
          <div className="text-xs text-ink0 tracking-tight">Nuevos</div>
        </div>
        <div className="card p-5">
          <div className="text-3xl font-semibold tracking-tightest text-emerald-300 mb-1">
            {contacts.filter((c: any) => c.status === "contactado").length}
          </div>
          <div className="text-xs text-ink0 tracking-tight">Contactados</div>
        </div>
        <div className="card p-5">
          <div className="text-3xl font-semibold tracking-tightest text-ink mb-1">
            {contacts.length}
          </div>
          <div className="text-xs text-ink0 tracking-tight">Total</div>
        </div>
      </div>

      {/* Contacts List */}
      <div className="space-y-3">
        {contacts.map((contact: any) => (
          <div
            key={contact.id}
            className="card-hover p-5"
          >
            <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h3 className="text-base font-semibold tracking-tight text-ink">
                    {contact.name}
                  </h3>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
                      contact.status === "nuevo"
                        ? "bg-accent/10 border-accent/30 text-accent"
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    }`}
                  >
                    {contact.status === "nuevo" ? "Nuevo" : "Contactado"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink/60 mb-3">
                  <a
                    href={`mailto:${contact.email}`}
                    className="inline-flex items-center gap-1.5 hover:text-accent transition-colors"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {contact.email}
                  </a>
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="inline-flex items-center gap-1.5 hover:text-accent transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {contact.phone}
                    </a>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(contact.created_at).toLocaleDateString()}
                  </span>
                </div>

                {contact.properties && (
                  <div className="mb-3 text-xs">
                    <span className="text-ink0">Propiedad: </span>
                    <a
                      href={`/propiedades/${contact.properties.id}`}
                      target="_blank"
                      className="text-accent hover:text-accent-600"
                    >
                      {contact.properties.title}
                    </a>
                  </div>
                )}

                <div className="rounded-md border border-ink/15 bg-cream-200/50 p-3 mt-2">
                  <p className="text-sm text-ink/75 leading-relaxed tracking-tight">
                    {contact.message}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {contacts.length === 0 && (
          <div className="card p-16 text-center">
            <Mail className="h-10 w-10 text-ink/40 mx-auto mb-4" />
            <h3 className="text-base font-semibold tracking-tight text-ink mb-1">
              No hay contactos
            </h3>
            <p className="text-sm text-ink/60">
              Los mensajes de clientes apareceran aqui.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
