# 🗄️ Configuración de Supabase

Esta guía te muestra cómo configurar Supabase como base de datos para Barrera Brokers.

## 📋 Paso 1: Ejecutar el Schema SQL

1. Ve a tu dashboard de Supabase: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Click en **SQL Editor** (icono de terminal en el menú lateral)
4. Click en **New query**
5. Copia y pega el contenido completo del archivo `supabase-schema.sql`
6. Click en **Run** (o Ctrl+Enter)

Esto creará:
- ✅ Tabla `agents` (agentes y administradores)
- ✅ Tabla `properties` (propiedades)
- ✅ Tabla `property_images` (imágenes de propiedades)
- ✅ Tabla `contacts` (mensajes de contacto)
- ✅ Bucket de Storage `properties` para imágenes
- ✅ Usuario admin inicial: `admin@barrerabrokers.com` / `admin123`

## 📦 Paso 2: Configurar Storage para imágenes

1. Ve a **Storage** en el menú lateral de Supabase
2. Verifica que exista el bucket **`properties`**
3. Si no existe:
   - Click en **New bucket**
   - Name: `properties`
   - **Public bucket**: ✅ (activado)
   - Click en **Create bucket**

### Políticas de acceso al bucket:

1. Click en el bucket `properties` → **Policies**
2. Crea estas políticas:

**Política 1: Lectura pública**
```sql
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'properties');
```

**Política 2: Upload con autenticación**
```sql
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'properties');
```

## 🔑 Paso 3: Obtener las credenciales

1. En Supabase, ve a **Project Settings** (engranaje) → **API**
2. Copia estos valores:

| Variable | Valor en Supabase |
|----------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (⚠️ secreto) |

## ⚙️ Paso 4: Configurar variables en Vercel

1. Ve a tu proyecto en Vercel: https://vercel.com/dashboard
2. **Settings** → **Environment Variables**
3. Agrega las 3 variables de Supabase + las de NextAuth:

```
NEXTAUTH_SECRET=tu-secret-generado-con-openssl-rand-base64-32
NEXTAUTH_URL=https://web-bbrokers.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

4. **Redeploy** el sitio para que tome las nuevas variables

## ✅ Paso 5: Probar el sistema

### Login con admin:
- URL: https://web-bbrokers.vercel.app/login
- Email: `admin@barrerabrokers.com`
- Password: `admin123`

### Registrar un nuevo agente:
- URL: https://web-bbrokers.vercel.app/register
- Completa el formulario
- El sistema creará la cuenta automáticamente

### Crear una propiedad:
1. Login como admin o agente
2. Ve a **Admin → Nueva Propiedad**
3. **Sube imágenes directamente** (drag & drop o click)
4. Las imágenes se guardan automáticamente en Supabase Storage
5. La propiedad se guarda en la base de datos

## 🛡️ Roles y permisos

- **Agente**: Puede crear/editar sus propias propiedades, ver contactos
- **Admin**: Todo lo anterior + gestionar agentes, ver todas las propiedades

Solo un admin puede crear nuevos administradores.

## 🔒 Seguridad: Cambiar password del admin

El password inicial `admin123` debe cambiarse. Para hacerlo:

1. Login como admin
2. (Próximamente: feature de cambio de password)
3. O ejecuta en Supabase SQL Editor:

```sql
-- Generar nuevo hash en https://bcrypt-generator.com/
-- (con 10 rounds)
UPDATE agents 
SET password = '$2a$10$NUEVO_HASH_AQUI'
WHERE email = 'admin@barrerabrokers.com';
```

## 📊 Verificar que funcione

En Supabase, ve a **Table Editor** y verifica:

- ✅ Tabla `agents` tiene al menos 1 admin
- ✅ Tabla `properties` se llena al crear propiedades
- ✅ Tabla `property_images` guarda las URLs
- ✅ Storage bucket `properties` recibe los archivos

## 🐛 Troubleshooting

### "No se puede conectar a la base de datos"
- Verifica que las 3 variables de Supabase estén en Vercel
- Verifica que `NEXT_PUBLIC_SUPABASE_URL` sea correcta

### "Error al subir imagen"
- Verifica que el bucket `properties` exista y sea público
- Verifica las políticas de Storage

### "Credenciales inválidas" al hacer login
- Verifica que el usuario exista en la tabla `agents`
- El password debe estar hasheado con bcrypt
- Si es la primera vez, usa: `admin@barrerabrokers.com` / `admin123`

## 🎯 Próximos pasos

- Configurar emails reales con Supabase Auth
- Habilitar Row Level Security (RLS)
- Agregar autenticación con Google/Magic Link
- Backup automático de la base de datos
