# Guía de Deployment

Esta guía te ayudará a desplegar el sitio web de Barrera Brokers en producción.

## 📋 Requisitos Previos

- Cuenta en [Vercel](https://vercel.com) (recomendado) o plataforma alternativa
- Repositorio en GitHub conectado
- Variables de entorno configuradas

## 🚀 Deployment en Vercel (Recomendado)

### Paso 1: Conectar Repositorio

1. Ve a [vercel.com](https://vercel.com) e inicia sesión
2. Click en "Add New Project"
3. Importa el repositorio `Barrerabrokers/web-bbrokers`
4. Vercel detectará automáticamente que es un proyecto Next.js

### Paso 2: Configurar Variables de Entorno

En la configuración del proyecto en Vercel, agrega estas variables:

```
NEXTAUTH_SECRET=tu-secret-key-aqui-usa-openssl-rand-base64-32
NEXTAUTH_URL=https://barrerabrokers.com
DATABASE_URL=tu-url-de-base-de-datos
```

**Generar NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### Paso 3: Deploy

1. Click en "Deploy"
2. Vercel construirá y desplegará tu aplicación automáticamente
3. Recibirás una URL de producción (ej: `web-bbrokers.vercel.app`)

### Paso 4: Configurar Dominio Personalizado

1. En el dashboard de Vercel, ve a "Settings" > "Domains"
2. Agrega tu dominio: `barrerabrokers.com`
3. Sigue las instrucciones para configurar DNS:
   - Tipo: `A` o `CNAME`
   - Apunta a los servidores de Vercel

## 🗄️ Base de Datos en Producción

Actualmente el proyecto usa datos en memoria (mock). Para producción, elige una opción:

### Opción 1: Vercel Postgres

```bash
# Instalar
npm install @vercel/postgres

# En Vercel Dashboard:
# Storage > Create Database > Postgres
# Las variables se agregarán automáticamente
```

### Opción 2: Supabase (Recomendado)

```bash
# Instalar
npm install @supabase/supabase-js

# Variables de entorno:
NEXT_PUBLIC_SUPABASE_URL=tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

1. Crea cuenta en [supabase.com](https://supabase.com)
2. Crea un nuevo proyecto
3. Crea las tablas en SQL Editor:

```sql
-- Tabla de agentes
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  photo VARCHAR(500),
  role VARCHAR(20) DEFAULT 'agent',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de propiedades
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  location VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  bedrooms INTEGER,
  bathrooms INTEGER,
  area DECIMAL(10,2) NOT NULL,
  images TEXT[] NOT NULL,
  features TEXT[] NOT NULL,
  agent_id UUID REFERENCES agents(id),
  status VARCHAR(20) DEFAULT 'disponible',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de contactos
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  message TEXT NOT NULL,
  property_id UUID REFERENCES properties(id),
  status VARCHAR(20) DEFAULT 'nuevo',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_properties_category ON properties(category);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_contacts_status ON contacts(status);
```

4. Reemplaza `/lib/db.ts` con implementación de Supabase

### Opción 3: Railway + PostgreSQL

```bash
# Variables de entorno:
DATABASE_URL=postgresql://usuario:password@host:5432/db
```

## 📧 Configurar Email

### Usando Gmail:

1. Habilita "App Passwords" en tu cuenta de Google
2. Genera una contraseña de aplicación
3. Agrega a variables de entorno:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASSWORD=tu-app-password
SMTP_FROM=noreply@barrerabrokers.com
```

### Usando SendGrid:

```bash
npm install @sendgrid/mail
```

```
SENDGRID_API_KEY=tu-api-key
```

## 🔒 Seguridad en Producción

### 1. Cambiar Credenciales de Demo

En `/lib/db.ts`, actualiza o elimina el agente demo:

```typescript
// Hashear nueva contraseña
import bcrypt from 'bcryptjs';
const hashedPassword = await bcrypt.hash('nueva-contraseña-segura', 10);
```

### 2. Configurar CORS

En `next.config.js`:

```javascript
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: 'https://barrerabrokers.com' },
      ],
    },
  ];
},
```

### 3. Rate Limiting

Considera agregar rate limiting para las APIs:

```bash
npm install @upstash/ratelimit @upstash/redis
```

## 🖼️ Almacenamiento de Imágenes

Para almacenar imágenes de propiedades, usa:

### Cloudinary (Recomendado)

```bash
npm install cloudinary next-cloudinary
```

Variables:
```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu-cloud-name
CLOUDINARY_API_KEY=tu-api-key
CLOUDINARY_API_SECRET=tu-api-secret
```

### Vercel Blob

```bash
npm install @vercel/blob
```

## 📊 Analytics

Vercel Analytics está incluido por defecto. Para analytics adicionales:

```bash
npm install @vercel/analytics
```

En `app/layout.tsx`:
```typescript
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

## 🔄 CI/CD

Con Vercel, cada push a `main` despliega automáticamente.

### Configurar Branches de Preview:

1. Crea rama `develop` para staging
2. Cada PR generará una preview URL automática
3. Solo los merges a `main` van a producción

## ✅ Checklist Pre-Deployment

- [ ] Variables de entorno configuradas
- [ ] Base de datos en producción lista
- [ ] NEXTAUTH_SECRET generado (único y seguro)
- [ ] Credenciales demo removidas/cambiadas
- [ ] Dominio personalizado configurado
- [ ] SSL/HTTPS habilitado (automático en Vercel)
- [ ] Almacenamiento de imágenes configurado
- [ ] Email/SMTP configurado
- [ ] Analytics configurado
- [ ] Probado en producción

## 🐛 Troubleshooting

### Error: "NEXTAUTH_SECRET missing"
- Asegúrate de agregar `NEXTAUTH_SECRET` en variables de entorno de Vercel

### Error: "Cannot connect to database"
- Verifica `DATABASE_URL` en variables de entorno
- Asegúrate que la base de datos permite conexiones externas

### Imágenes no cargan
- Verifica configuración de `next.config.js` > `images.domains`
- Agrega dominio de CDN/almacenamiento de imágenes

### 500 Error en API
- Revisa logs en Vercel Dashboard > Deployments > Logs
- Verifica que todas las variables de entorno estén configuradas

## 📞 Soporte

Para problemas de deployment:
- Vercel Support: https://vercel.com/support
- Documentación Next.js: https://nextjs.org/docs
- Supabase Docs: https://supabase.com/docs

---

¡Tu sitio está listo para producción! 🎉
