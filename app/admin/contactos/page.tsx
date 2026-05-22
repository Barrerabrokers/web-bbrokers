import { Mail, Phone, Calendar } from "lucide-react";
import { getAllContacts } from "@/lib/db";

export default async function ContactsPage() {
  const contacts = await getAllContacts();

  return (
    <div>
      <div className="mb-8">
        <h1 className="heading-serif text-3xl text-charcoal-900 mb-2">Contactos</h1>
        <p className="text-charcoal-500">
          Mensajes de clientes potenciales
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 border border-charcoal-100">
          <div className="heading-serif text-3xl text-gold-600 mb-1">
            {contacts.filter((c: any) => c.status === "nuevo").length}
          </div>
          <div className="label-tracking text-charcoal-500 text-xs">Nuevos</div>
        </div>
        <div className="bg-white p-6 border border-charcoal-100">
          <div className="heading-serif text-3xl text-gold-600 mb-1">
            {contacts.filter((c: any) => c.status === "contactado").length}
          </div>
          <div className="label-tracking text-charcoal-500 text-xs">Contactados</div>
        </div>
        <div className="bg-white p-6 border border-charcoal-100">
          <div className="heading-serif text-3xl text-gold-600 mb-1">
            {contacts.length}
          </div>
          <div className="label-tracking text-charcoal-500 text-xs">Total</div>
        </div>
      </div>

      {/* Contacts List */}
      <div className="space-y-4">
        {contacts.map((contact: any) => (
          <div
            key={contact.id}
            className="bg-white border border-charcoal-100 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="heading-serif text-lg text-charcoal-900">
                    {contact.name}
                  </h3>
                  <span
                    className={`label-tracking text-xs px-3 py-1 ${
                      contact.status === "nuevo"
                        ? "bg-gold-100 text-gold-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {contact.status === "nuevo" ? "Nuevo" : "Contactado"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-charcoal-500 mb-3">
                  <a href={`mailto:${contact.email}`} className="flex items-center hover:text-gold-600">
                    <Mail className="h-4 w-4 mr-2" />
                    {contact.email}
                  </a>
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className="flex items-center hover:text-gold-600">
                      <Phone className="h-4 w-4 mr-2" />
                      {contact.phone}
                    </a>
                  )}
                  <span className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    {new Date(contact.created_at).toLocaleDateString()}
                  </span>
                </div>

                {contact.properties && (
                  <div className="mb-3 text-sm">
                    <span className="text-charcoal-500">Propiedad: </span>
                    <a
                      href={`/propiedades/${contact.properties.id}`}
                      target="_blank"
                      className="text-gold-600 hover:text-gold-700 font-medium"
                    >
                      {contact.properties.title}
                    </a>
                  </div>
                )}

                <div className="bg-charcoal-50 p-4 mt-3">
                  <p className="text-charcoal-700">{contact.message}</p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {contacts.length === 0 && (
          <div className="text-center py-16 bg-white border border-charcoal-100">
            <Mail className="h-12 w-12 text-charcoal-400 mx-auto mb-4" />
            <h3 className="heading-serif text-lg text-charcoal-900 mb-2">
              No hay contactos
            </h3>
            <p className="text-charcoal-500">
              Los mensajes de clientes apareceran aqui
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
