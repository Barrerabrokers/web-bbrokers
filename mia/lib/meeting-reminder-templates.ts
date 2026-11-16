export const meetingReminderTemplates = {
  '1d': {
    cliente: {
      email: {
        subject: 'Mañana tenés tu reunión con Barrera Brokers - {{dia}}, {{hora}}, hora Argentina',
        body: `Hola {{nombre_cliente}},

Te recordamos que mañana tenés tu reunión con {{agente}}.

Día: {{dia}}
Hora: {{hora}}, hora Argentina
Duración: 60 minutos
Modalidad: {{modalidad}}. {{detalles}}
Tema: {{propiedad_de_interes}}

Si necesitás cambiarla, respondé este mail o escribinos por WhatsApp y la movemos.

Nos vemos mañana,
Equipo Barrera Brokers.`,
      },
      whatsapp: 'Hola {{nombre_cliente}}, te recordamos que mañana, {{dia}}, tenés tu reunión con {{agente}} a las {{hora}}, hora Argentina. Modalidad: {{modalidad}}. {{detalles}} ¿Te sigue sirviendo ese horario?',
    },
    agente: {
      email: {
        subject: 'Mañana tenés reunión - {{nombre_cliente}} - {{dia}}, {{hora}}, hora Argentina',
        body: `Hola {{agente}},

Mañana tenés reunión con {{nombre_cliente}}.

Día: {{dia}}
Hora: {{hora}}, hora Argentina
Modalidad: {{modalidad}}. {{detalles}}
Cliente: {{nombre_cliente}} - {{whatsapp_cliente}} - {{email_cliente}}
Resumen: {{para_que}}, {{zona}}, {{presupuesto}}, {{entrega}}, botón caliente: {{boton_caliente}}
Link CRM: {{link_crm}}`,
      },
    },
  },
  '1h': {
    cliente: {
      email: {
        subject: 'En 1 hora tenés tu reunión con {{agente}}',
        body: `Hola {{nombre_cliente}},

En 1 hora tenés tu reunión con {{agente}}.

Hoy {{dia}} a las {{hora}}, hora Argentina
Modalidad: {{modalidad}}. {{detalles}}

¿Te recordamos bien por acá? Si llegás unos minutos tarde, avisanos por WhatsApp.

Nos vemos en un rato,
Equipo Barrera Brokers`,
      },
      whatsapp: 'Hola {{nombre_cliente}}, en 1 hora tenés tu reunión con {{agente}} el {{dia}} a las {{hora}}, hora Argentina, por {{modalidad}}. {{detalles}} ¿Llegás bien?',
    },
    agente: {
      email: {
        subject: 'En 1 hora tenés reunión - {{nombre_cliente}}',
        body: `Hola {{agente}},

En 1 hora tenés reunión con {{nombre_cliente}} - {{dia}}, {{hora}}, hora Argentina.
Modalidad: {{modalidad}}. {{detalles}}
Resumen: {{resumen_conversacion}}
Link CRM: {{link_crm}}`,
      },
    },
  },
} as const;
