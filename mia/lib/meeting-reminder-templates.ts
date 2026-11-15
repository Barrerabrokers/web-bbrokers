export const meetingReminderTemplates = {
  '1d': {
    cliente: {
      email: {
        subject: 'Mañana tenés tu reunión con Barrera Brokers - {{dia}} {{hora}}',
        body: `Hola {{nombre_cliente}},

Te recordamos que mañana tenés tu reunión con {{agente}}.

Día: {{dia}}
Hora: {{hora}} hs Argentina
Duración: 60 minutos
Modalidad: {{modalidad}} - {{link_meet_o_direccion}}
Tema: {{propiedad_de_interes}}

Si necesitás cambiarla, respondé este mail o escribinos por WhatsApp y la movemos.

Nos vemos mañana,
Equipo Barrera Brokers.`,
      },
      whatsapp: 'Hola {{nombre_cliente}}, te recordamos que mañana a las {{hora}} tenés tu reunión con {{agente}} por {{propiedad_de_interes}}. Es {{modalidad}} - {{link_meet_o_direccion}}. ¿Te sigue sirviendo ese horario?',
    },
    agente: {
      email: {
        subject: 'Mañana tenés reunión - {{nombre_cliente}} - {{dia}} {{hora}}',
        body: `Hola {{agente}},

Mañana tenés reunión con {{nombre_cliente}}.

Día: {{dia}}
Hora: {{hora}} hs Argentina
Modalidad: {{modalidad}} - {{link_meet_o_direccion}}
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

Hoy {{dia}} a las {{hora}} hs Argentina
Modalidad: {{modalidad}} - {{link_meet_o_direccion}}

¿Te recordamos bien por acá? Si llegás unos minutos tarde, avisanos por WhatsApp.

Nos vemos en un rato,
Equipo Barrera Brokers`,
      },
      whatsapp: 'Hola {{nombre_cliente}}, en 1 hora tenés tu reunión con {{agente}} - {{dia}} {{hora}}. Link: {{link_meet_o_direccion}}. ¿Llegás bien?',
    },
    agente: {
      email: {
        subject: 'En 1 hora tenés reunión - {{nombre_cliente}}',
        body: `Hola {{agente}},

En 1 hora tenés reunión con {{nombre_cliente}} - {{dia}} {{hora}}.
Modalidad: {{modalidad}} - {{link_meet_o_direccion}}
Resumen: {{resumen_conversacion}}
Link CRM: {{link_crm}}`,
      },
    },
  },
} as const;
