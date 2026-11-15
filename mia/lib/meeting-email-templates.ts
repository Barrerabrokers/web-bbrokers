export const clientMeetingEmail = {
  subject: 'Tu reunión con Barrera Brokers - {{dia}} a las {{hora}} con {{agente}}',
  body: `Hola {{nombre_cliente}},

Listo, queda agendada tu reunión con {{agente}}.

Día: {{dia}}
Hora: {{hora}} hs Argentina
Duración: 60 minutos
Modalidad: {{modalidad}} - {{link_meet_o_direccion}}
Tema: {{propiedad_de_interes}} - {{zona}}

Ya tenés la invitación en tu calendario.

¿Qué vamos a ver en la reunión?
- Las 2 opciones que más te cierran para {{para_que}}
- Financiación y cuotas para tu rango
- Próximos pasos si te gusta alguna

Si necesitás cambiarla, respondé este mail o escribinos por WhatsApp y la movemos.

¿Querés que te recordemos 1 hora antes por WhatsApp?

Gracias por confiar en Barrera Brokers.`,
} as const;

export const agentMeetingEmail = {
  subject: 'Nueva reunión agendada - {{nombre_cliente}} - {{dia}} {{hora}}',
  body: `Hola {{agente}},

Tenés una nueva reunión agendada por MIA.

Cliente: {{nombre_cliente}}
WhatsApp: {{whatsapp_cliente}}
Email: {{email_cliente}}
Día: {{dia}}
Hora: {{hora}} hs Argentina
Duración: 60 minutos
Modalidad: {{modalidad}} - {{link_meet_o_direccion}}

Resumen del cliente:
- Para qué: {{para_que}} - vivir / invertir
- Zona: {{zona}}
- Presupuesto: {{presupuesto}}
- Entrega: {{entrega}}
- Botón caliente: {{boton_caliente}}
- Propiedad de interés: {{propiedad_de_interes}}

Resumen de la conversación: {{resumen_conversacion}}

Link del lead en CRM: {{link_crm}}

El evento ya quedó creado en tu Google Calendar con el cliente como invitado.

Gracias,
MIA - Barrera Brokers`,
} as const;
