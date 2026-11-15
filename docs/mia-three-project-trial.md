> Estado actual: ver [MIA agente conversacional](mia-agent.md). El catálogo público y la memoria estructurada sustituyen el alcance fijo de esta prueba inicial. La activación general y la agenda se conservan.

# Prueba conversacional privada: seis proyectos

Alcance: Feel Recoleta, Feel Palermo, Alpha Place Libertador, Alpha Place Belgrano, Aguilar Point y 9 de Julio Estudios 3, únicamente en la conversación verificada de Pablo Barrera y en el simulador privado del CRM. Los leads siguen recibiendo solo la bienvenida.

Fuentes: fichas públicas actuales en barrerabrokers.com y listas/brochures enlazados desde la pestaña Español (`gid=2095154362`) de la planilla `1ETOspJQfcnAVvjGp7mJ2Qx5TNXDQsYG88A9GRSPClMA`. Los enlaces se descubren de nuevo en el índice; no se copian del antiguo proceso ni de notas privadas. Se preservan los hipervínculos de las celdas XLSX. Caché de documentos e índice: hasta 60 segundos; las fichas web se consultan sin caché de aplicación.

El usuario confirmó que todas las listas del Drive estaban vigentes. La fecha antigua observada en la lista de Feel Recoleta (30/05/2026) se registra como excepción explícita para esa URL y esa fecha. Una nueva fecha vencida no se autoriza automáticamente. No se asume moneda si no consta en la lista. Solo se cotizan filas disponibles, únicas, completas y con moneda verificable; la financiación se muestra únicamente si los importes cierran con la cantidad de cuotas. Se conserva la indicación de pesificación y CAC.

El modelo interpreta la conversación y redacta con citas textuales verificables. Los importes y enlaces se insertan desde el servidor con tokens validados. No se autorizan URLs ni importes escritos libremente por el modelo. No hay reservas, agendas ni envíos de documentos por fuera del mensaje de prueba. La disponibilidad de lista no es una reserva confirmada. Las discrepancias entre fuentes requieren confirmación humana.

El modelo puede utilizar historial reciente desde el inicio de la prueba y preferencias comunicadas por el interlocutor; los mensajes anteriores del asistente no constituyen una fuente comercial. No se carga el anterior flujo de venta, ni conocimiento comercial privado, ni entrenamientos compartidos. Las reglas de administración orientan estilo, no agregan hechos.

`POST /api/crm/whatsapp/mia-test` requiere la cuenta administradora autorizada y nunca envía WhatsApp ni modifica contactos. La conversación del simulador vive en el estado del navegador y puede reiniciarse. La prueba por WhatsApp utiliza el mismo generador y conserva las pausas y bloqueos de envío existentes.

Validación: `node --test tests/mia-project-trial.test.cjs tests/mia-reset-runtime.test.cjs tests/whatsapp-welcome-only.test.cjs tests/whatsapp-sales-webhook.test.cjs tests/instagram-mia.test.cjs` y TypeScript. La lectura de fuentes reales comprueba los nueve documentos y todas las cotizaciones verificables; las pruebas con modelo se realizan mediante el simulador protegido.

Ampliación del 20/10/2026: se conservan las conversaciones y los tres proyectos iniciales. La confirmación del usuario de que todas las listas del índice están vigentes cubre también el pie histórico erróneo 31/06/2026 de 9 de Julio Estudios 3, exclusivamente para esa URL y ese literal. La lectura de brochures se limita a dos proyectos simultáneos y a los proyectos relevantes para la consulta.

Las propuestas se envían con una unidad por mensaje. La separación se realiza después de validar y renderizar las cotizaciones; WhatsApp envía y registra cada mensaje en orden, y el simulador muestra las mismas burbujas. Si falla un envío se detiene la secuencia, sin repetir automáticamente las unidades ya enviadas.

Activación general: el runtime admite `audience: all` con una fecha `activatedAt` explícita. El mismo asistente y las mismas fuentes aprobadas atienden las consultas nuevas de los chats habilitados; no se envían campañas ni se responde automáticamente a mensajes anteriores a la activación. Las pausas por chat, el número de empresa y los bloqueos de envío continúan aplicándose. La solicitud explícita de un agente recibe un aviso y pausa MIA después de registrarse el envío. El simulador y la edición de instrucciones siguen restringidos a Pablo.
