export const CLIENT_NEWSLETTER = {
  subject: "Novedades de Real Estate | Barrera Brokers",
  body: `Hola {{nombre}},

Gracias por haber confiado en Barrera Brokers. Queremos seguir acompañándote después de tu compra y acercarte información útil para tus próximos proyectos.

Nuevos proyectos
[Nombre del proyecto, ubicación, características y enlace para conocerlo.]

Actualidad del mercado
[Noticia relevante, fecha, fuente y enlace. Explicá brevemente por qué puede interesarle al cliente.]

¿Estás evaluando una nueva inversión o querés conversar sobre tu propiedad? Respondé este correo y coordinamos una charla.

Un saludo,
Barrera Brokers

Si preferís no recibir estas novedades, respondé BAJA y dejaremos de enviártelas.`,
};
export function personalizeClientNewsletter(value: string, name: string) {
  return value.replaceAll("{{nombre}}", () => name);
}
export function newsletterHasPlaceholders(subject: string, body: string) {
  return /\[[^\]]+\]|\{\{[^}]+\}\}/.test(subject + "\n" + body);
}
