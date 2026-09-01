# Configuración de WhatsApp — Barrera Brokers

Esta carpeta reúne la configuración necesaria para activar el número de Barrera Brokers con la API oficial de WhatsApp y el agente de IA.

## Número de la empresa

- Número visible: `+54 11 6406-9668`
- Número para la API: `541164069668`
- Modalidad requerida: WhatsApp Business Platform con coexistencia

La coexistencia permite conservar el uso del número en WhatsApp Business mientras el CRM recibe y envía mensajes mediante la API oficial.

## Webhook de producción

```text
https://barrerabrokers.com/api/whatsapp/webhook
```

En Meta se debe suscribir, como mínimo, el campo `messages` de la cuenta de WhatsApp Business.

## Variables requeridas

Copiar los nombres de `variables.env.example` a las variables de entorno del proyecto en Vercel. Nunca guardar tokens o claves reales en Git.

| Variable | Origen |
| --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | Token permanente de usuario del sistema en Meta |
| `WHATSAPP_PHONE_NUMBER_ID` | Identificador del número en WhatsApp Business Platform |
| `WHATSAPP_VERIFY_TOKEN` | Texto secreto definido por Barrera Brokers para verificar el webhook |
| `META_APP_SECRET` | Secreto de la aplicación de Meta |
| `WHATSAPP_GRAPH_VERSION` | Versión de Graph API utilizada |
| `OPENAI_API_KEY` | Clave del proyecto de OpenAI |
| `OPENAI_WHATSAPP_MODEL` | Modelo utilizado por el agente |
| `WHATSAPP_AI_INSTRUCTIONS` | Reglas e información comercial del agente |

## Activación

1. Incorporar el número mediante un flujo oficial que admita coexistencia.
2. Configurar las variables en Vercel para Production, Preview y Development según corresponda.
3. En Meta, registrar el webhook y usar el mismo valor definido en `WHATSAPP_VERIFY_TOKEN`.
4. Suscribir la cuenta de WhatsApp Business al webhook de mensajes.
5. Volver a desplegar el proyecto.
6. Abrir `https://barrerabrokers.com/admin/crm/marketing/whatsapp` y confirmar que figure “API conectada”.
7. Enviar un mensaje de prueba desde un número externo.

## Reglas operativas implementadas

- Los contactos nuevos se crean como `Sin propietario`.
- La IA responde solamente mientras el chat no tenga un agente asignado.
- Cuando una persona toma el chat, la IA se pausa.
- El responsable del chat se sincroniza con el propietario del contacto.
- Administración ve todas las conversaciones; cada agente ve las asignadas.
- El historial queda guardado en el CRM.
- Meta debe firmar cada webhook; las solicitudes con firma inválida se rechazan.

## Seguridad

- No copiar claves reales dentro de esta carpeta.
- No enviar tokens, contraseñas o secretos por WhatsApp, email o capturas.
- Rotar inmediatamente cualquier clave que haya sido compartida accidentalmente.
- Utilizar únicamente la API oficial; no conectar el número mediante automatizaciones no autorizadas de WhatsApp Web.
