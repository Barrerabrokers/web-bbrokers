# MIA: agente conversacional con fuentes verificadas

## Asesoramiento y perfil comercial (21/10/2026)

El planificador distingue búsquedas, asesoramiento (`advice`) y propuestas (`proposal`). Si una consulta de asesoramiento no contiene objetivo ni filtros, MIA pregunta si el cliente busca vivienda o inversión antes de consultar todos los documentos. Puede ordenar las unidades compatibles por prioridad explícita: precio total, anticipo, cuota o superficie. La prioridad se conserva en la memoria y no relaja límites de presupuesto, moneda, zona, tipología o entrega. Las propuestas son selecciones informativas por WhatsApp con cotizaciones verificadas; no son PDFs, reservas ni condiciones negociadas.

La redacción explica el encaje y las diferencias verificadas, sin atribuir rentabilidad, demanda de alquiler o revalorización no documentadas. Mantiene la coordinación real de reuniones existente con Google Calendar y confirmación explícita del cliente.

`mia-commercial-profile.ts` guarda el resumen y el motivo del interés en notas y en `meta_properties.mia_commercial_profile_v1`. Usa señales explícitas del mensaje del cliente para frío, tibio o caliente; saludos, silencios y respuestas ambiguas no califican. No escribe `status` ni el asesor del lead. Conserva las notas y los colores manuales; puede actualizar un color que aplicó la propia MIA. Un seguimiento neutro no enfría automáticamente una oportunidad caliente. No duplica una nota si no cambió el resumen o la calificación. Las consultas de agenda también registran señales explícitas de interés.

El guardado exige que el turno siga vigente y la IA habilitada. El simulador no persiste perfiles, y el chat privado de prueba puede guardar su memoria sin modificar datos comerciales.

Validación de esta ampliación: 73 pruebas aprobadas, TypeScript y build de Next.js correctos. Verificación adicional del SQL con tablas temporales aisladas de los clientes reales. Cambios locales pendientes de publicación; no se verificaron nuevas respuestas con el proveedor real porque la clave de Groq no está disponible en el entorno local.

El runtime de WhatsApp usa `runMiaAgent`, conservando la activación pública, las pausas individuales, los bloqueos contra envíos duplicados, el traspaso al equipo y el módulo de agenda. No se restaura el proceso comercial retirado ni AI Sales.

El planificador interpreta el diálogo con el modelo configurado en `whatsapp-ai-provider`: intención, proyecto o barrio, ambientes, entrega, financiación y finalidad. El presupuesto total, el anticipo y la cuota máxima son campos separados con moneda explícita. Mantiene preferencias previas, interpreta sí/no en contexto, corrige filtros y reconoce otra opción o una nueva búsqueda. Su salida JSON es validada con Zod y los proyectos tienen que existir en el catálogo.

El catálogo se descubre desde la API pública anónima de barrerabrokers.com. Las fichas deben ser públicas y tener el título esperado. Los links a listas y brochures se resuelven por nombre exacto normalizado o alias explícito desde la planilla autorizada, sin búsquedas aproximadas ni inventario privado. Una ficha inaccesible se excluye junto con sus cotizaciones. Un proyecto sin lista verificable puede describirse con su ficha pública, pero no cotizarse. Las confirmaciones de pies de vigencia antiguos siguen siendo por URL y fecha concreta; no se autorizan automáticamente fechas nuevas.

La búsqueda aplica los filtros a todas las filas verificadas de los proyectos compatibles antes de ordenar y elegir hasta dos unidades. No convierte monedas, no considera importes desconocidos como compatibles, ni cambia entrega inmediata por obra. El modelo solo recibe tokens de las unidades compatibles; importes y links se completan en el servidor. Cada unidad se envía en su propio mensaje. Otra opción excluye las unidades ya registradas como enviadas, con identidad de proyecto y unidad independiente del precio actual.

La memoria se guarda en `crm_whatsapp_agent_settings`, clave `mia-agent-memory-v1:<conversationId>`. Contiene preferencias e identificadores de opciones, nunca precios o copias de documentos. Se aísla por conversación e inicio del runtime/prueba y se invalida al limpiar el chat. Una comprobación del último mensaje impide que un turno anterior sobrescriba uno nuevo o una intervención humana. Las referencias primera/segunda conservan el orden de los tokens enviados y se contrastan con encabezados completos registrados.

El simulador privado conserva `agentMemory` y `meetingState` solo en el navegador y requiere la cuenta administradora de Pablo. No envía WhatsApp, no guarda memoria de clientes y no crea citas reales. Las reuniones reales siguen usando disponibilidad consultada en Google Calendar, dos opciones, confirmación del cliente y registro en CRM.

Validación: `tests/mia-agent.test.cjs`, las pruebas de fuentes, runtime, agenda y canales, y `tsc --noEmit`. El control optativo `MIA_AGENT_SMOKE=1` ejecuta `scripts/verify-mia-agent.cjs` durante el build con el proveedor y las fuentes reales. Solo usa conversaciones sintéticas: dos ambientes en Núñez con límites de anticipo y cuota, otra opción sin repetir, corrección a un ambiente y entrega inmediata sin sustituciones. No crea contactos ni envía mensajes o invitaciones.
