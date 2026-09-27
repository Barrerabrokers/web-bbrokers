# Operación de producción — Barrera Brokers

Este documento define un único camino para publicar Barrera Brokers. Su objetivo es que el código, Vercel y Supabase siempre correspondan a la misma versión.

## Fuente de verdad

| Sistema | Responsabilidad |
| --- | --- |
| Repositorio GitHub `Barrerabrokers/web-bbrokers` | Historial aprobado de código |
| Rama `main` | Única fuente de producción |
| Vercel, proyecto `web-bbrokers` | Construye y publica automáticamente cada commit de `main` |
| Supabase | Base de datos de producción; la aplicación accede mediante variables de entorno de Vercel |

El nombre `web-bbrokers` se mantiene igual porque es el nombre del proyecto de Vercel, no el nombre de cada publicación. Cada despliegue se identifica por la rama, el mensaje de commit, el SHA y la fecha. No se crean proyectos Vercel nuevos para versiones nuevas.

## Flujo obligatorio

1. Partir de una copia local limpia y actualizada de `origin/main`.
2. Crear una rama por cambio: `feat/...`, `fix/...` o `chore/...`.
3. Implementar y validar localmente:

   ```bash
   npm run build
   npx tsc --noEmit
   ```

4. Crear un commit descriptivo, por ejemplo `feat(crm): excluir emails inválidos de campañas`.
5. Subir la rama a GitHub. Vercel genera un *Preview Deployment* para revisarla.
6. Abrir un Pull Request y aprobarlo. Al fusionarlo en `main`, Vercel publica automáticamente en producción.
7. Confirmar en GitHub el estado de Vercel **success**, que el entorno sea **Production** y que el dominio responda.

No ejecutar despliegues de producción desde una carpeta local con cambios sin versionar, ni publicar ramas de backup. Eso crea versiones imposibles de rastrear y fue el origen de funcionalidades que aparecían y desaparecían.

## Estado consolidado

`main` contiene el CRM completo y las correcciones de seguridad. El commit `32b0d44` publicó en producción el manejo de emails inválidos/rebotados y los indicadores de campañas. La copia histórica `backup-production-2026-09-26` queda únicamente como respaldo: no se usa como origen de nuevos despliegues.

La copia local que quedó en una versión anterior debe conservarse solo para rescatar trabajo pendiente. Para el desarrollo habitual, crear o actualizar una copia desde `origin/main`; antes de reutilizar la anterior, convertir sus cambios pendientes en una rama y revisarlos.

## Variables de entorno y Supabase

Las claves existen únicamente en Vercel y en archivos `.env.local` excluidos de Git. Nunca se suben valores reales al repositorio, capturas o tickets. La lista de nombres se mantiene en [`.env.example`](.env.example).

Como mínimo, la aplicación necesita en Vercel las variables de autenticación y datos:

```text
NEXTAUTH_SECRET
NEXTAUTH_URL
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
```

Las integraciones habilitadas (correo, CRM, WhatsApp/Meta y automatizaciones) requieren también sus variables correspondientes del archivo de ejemplo. Cuando se agregue una integración, se agrega su nombre a `.env.example` y se carga el valor en Vercel para Preview y Production según corresponda.

En Vercel: **Project → Settings → Environment Variables**. Verificar el nombre y los entornos asignados; no hace falta revelar el valor. Una variable nueva o modificada requiere crear un nuevo despliegue para que sea utilizada.

Las migraciones de Supabase se guardan versionadas en `migrations/` y se aplican de forma explícita y verificable. No se exponen endpoints públicos que inicialicen o alteren la base de datos.

## Reglas de ramas y despliegues

- `main`: solo código aprobado y desplegable; cada push equivale a una publicación de producción.
- `feat/*` y `fix/*`: cambios aislados, con Preview Deployment automático.
- `backup/*` o tags de respaldo: solo recuperación, nunca despliegue directo.
- Un Pull Request debe mostrar el enlace de Vercel Preview y superar el build antes de fusionarse.
- No se agrega un GitHub Action de `vercel --prod`: la integración GitHub ↔ Vercel ya realiza ese trabajo y duplicarla generaría despliegues competidores.
- Los commits deben explicar el cambio. Evitar mensajes como `update`, `cambios` o `fix` sin contexto.

## Verificación y recuperación

Después de cada merge a `main`:

1. Abrir el commit en GitHub y comprobar el check de Vercel en verde.
2. En Vercel, confirmar que ese SHA figura como **Production** y revisar los logs si falló.
3. Probar la funcionalidad afectada en `https://barrerabrokers.com`.
4. Si hay una falla urgente, promover/recuperar el último despliegue de producción sano desde Vercel y luego corregirlo con un commit nuevo. No reescribir `main` ni publicar una carpeta local vieja.

## Checklist antes de fusionar

- [ ] Rama creada desde el último `origin/main`.
- [ ] `npm run build` y `npx tsc --noEmit` correctos.
- [ ] Variables nuevas documentadas sin secretos en `.env.example`.
- [ ] Migración de Supabase versionada y aplicada de forma controlada, si corresponde.
- [ ] Preview Deployment revisado.
- [ ] Pull Request aprobado y mergeado a `main`.
- [ ] Despliegue Production asociado al SHA confirmado.
