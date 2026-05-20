import { Mail, Phone, Calendar } from "lucide-react";

// Mock data - en producción vendría de la base de datos
const contacts = [
  {
    id: "1",
    name: "Juan Pérez",
    email: "juan@example.com",
    phone: "+54 11 1111-2222",
    message: "Me interesa el departamento en Palermo, ¿está disponible para visitar?",
    propertyId: "1",
    propertyTitle: "Departamento moderno en Palermo",
    createdAt: new Date("2024-05-15"),
    status: "nuevo",
  },
  {
    id: "2",
    name: "María González",
    email: "maria@example.com",
    phone: "+54 11 3333-4444",
    message: "Quisiera más información sobre las opciones de financiación para la casa en Nordelta.",
    propertyId: "2",
    propertyTitle: "Casa en desarrollo - Nordelta",
    createdAt: new Date("2024-05-14"),
    status: "contactado",
  },
  {
    id: "3",
    name: "Carlos Martínez",
    email: "carlos@example.com",
    phone: "+54 11 5555-6666",
    message: "Estoy interesado en inversiones inmobiliarias. Me gustaría agendar una reunión.",
    createdAt: new Date("2024-05-13"),
    status: "nuevo",
  },
];

export default function ContactsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Contactos</h1>
        <p className="text-gray-600">
          Revisa y gestiona los mensajes de clientes potenciales
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {contacts.filter(c => c.status === "nuevo").length}
          </div>
          <div className="text-sm text-gray-600">Nuevos</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {contacts.filter(c => c.status === "contactado").length}
          </div>
          <div className="text-sm text-gray-600">Contactados</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {contacts.length}
          </div>
          <div className="text-sm text-gray-600">Total</div>
        </div>
      </div>

      {/* Contacts List */}
      <div className="space-y-4">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-bold text-gray-900">
                    {contact.name}
                  </h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      contact.status === "nuevo"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {contact.status === "nuevo" ? "Nuevo" : "Contactado"}
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 mr-2" />
                    <a
                      href={`mailto:${contact.email}`}
                      className="hover:text-primary-600"
                    >
                      {contact.email}
                    </a>
                  </div>
                  {contact.phone && (
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 mr-2" />
                      <a
                        href={`tel:${contact.phone}`}
                        className="hover:text-primary-600"
                      >
                        {contact.phone}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    <span>{contact.createdAt.toLocaleDateString()}</span>
                  </div>
                </div>

                {contact.propertyId && (
                  <div className="mb-3">
                    <span className="text-sm text-gray-600">Propiedad de interés: </span>
                    <a
                      href={`/propiedades/${contact.propertyId}`}
                      target="_blank"
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      {contact.propertyTitle}
                    </a>
                  </div>
                )}

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-700">{contact.message}</p>
                </div>
              </div>
            </div>

            <div className="flex space-x-3 pt-4 border-t">
              <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium">
                Marcar como Contactado
              </button>
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                Responder
              </button>
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                Archivar
              </button>
            </div>
          </div>
        ))}
      </div>

      {contacts.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No hay contactos
          </h3>
          <p className="text-gray-600">
            Los mensajes de clientes aparecerán aquí
          </p>
        </div>
      )}
    </div>
  );
}
