# Conexiones de Meta

La integración de campañas/formularios utiliza **Barrera Brokers CRM** (`1113448051007765`). WhatsApp utiliza **Barrera Brokers Omnicanal** (`1735228224390278`). No deben intercambiarse sus claves secretas.

Variables de producción en Vercel:

| Conexión | Identificador | Clave secreta |
| --- | --- | --- |
| Campañas y leads | `META_CRM_APP_ID` | `META_CRM_APP_SECRET` |
| WhatsApp | `NEXT_PUBLIC_WHATSAPP_APP_ID` | `WHATSAPP_APP_SECRET` |

`META_APP_SECRET` se conserva como compatibilidad para instalaciones existentes, sin modificar su valor. Configurar las claves específicas permite completar la separación sin interrumpir WhatsApp. Nunca copiar secretos al repositorio o a logs.

El token de campañas/formularios puede configurarse con `META_CRM_ACCESS_TOKEN`. Si falta, se usa `META_ACCESS_TOKEN`. La autorización OAuth del CRM guarda el token de usuario (campañas) y el token de página (formularios) cifrados. Una conexión guardada que pertenece a otra app se ignora para estas operaciones.

La página puede fijarse con `META_CRM_PAGE_ID`. La URL OAuth es `https://barrerabrokers.com/api/crm/meta/callback`; el webhook de formularios es `https://barrerabrokers.com/api/crm/meta/webhook`, campo `leadgen`. Su firma usa la clave de la app CRM. El webhook de WhatsApp usa la clave de Omnicanal.

La autorización de formularios se guarda aunque Instagram no esté vinculado. La configuración de `leadgen` se realiza antes e independientemente de los mensajes. El cron recupera los últimos tres días; la recuperación manual revisa treinta días. Una recuperación parcial no actualiza la fecha de última sincronización exitosa.

Validación: ejecutar las pruebas `meta-app-config`, `meta-oauth-callback` y las de recuperación de leads, y compilar antes de desplegar. Después del despliegue, ejecutar el cron de Meta y comprobar el estado persistido y los contactos esperados; un despliegue exitoso no demuestra que Meta haya otorgado los permisos.
