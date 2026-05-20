# Barrera Brokers - Plataforma Inmobiliaria

Sitio web moderno de bienes raíces construido con **Next.js 14+, TypeScript y Tailwind CSS**. Incluye gestión completa de propiedades y sistema de autenticación para agentes.

## 🚀 Características

### Frontend Público
- ✅ Landing page moderna con hero section y animaciones
- ✅ Sección de servicios (desarrollo, pozo, usados, rentals, inversiones, oportunidades)
- ✅ Catálogo de propiedades con filtros por categoría
- ✅ Página de detalle de propiedad individual
- ✅ Sección "Sobre Nosotros" con equipo
- ✅ Formulario de contacto funcional
- ✅ SEO optimizado con metadata
- ✅ Totalmente responsive (móvil, tablet, desktop)
- ✅ Performance optimizado

### Panel de Administración
- ✅ Sistema de autenticación seguro con NextAuth.js
- ✅ Dashboard con estadísticas
- ✅ CRUD completo de propiedades
- ✅ Subida y gestión de imágenes
- ✅ Categorización por tipo (desarrollo, pozo, usados, rentals, inversiones, oportunidades)
- ✅ Control de estado (disponible, reservada, vendida)
- ✅ Gestión de características y detalles
- ✅ Vista previa en tiempo real

## 🛠 Stack Tecnológico

- **Framework**: Next.js 14+ (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS
- **Autenticación**: NextAuth.js
- **Validación**: Zod
- **Formularios**: React Hook Form
- **Iconos**: Lucide React

## 📦 Instalación

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env

# Configurar NEXTAUTH_SECRET
# Genera uno con: openssl rand -base64 32
# Y agrégalo a .env

# Ejecutar en desarrollo
npm run dev

# Construir para producción
npm run build

# Ejecutar en producción
npm start
```

## 🔐 Credenciales de Demo

Para acceder al panel de administración:

- **Email**: admin@barrerabrokers.com
- **Password**: admin123

⚠️ **Importante**: Cambia estas credenciales en producción editando `/lib/db.ts`

## 📁 Estructura del Proyecto

```
web-bbrokers/
├── app/                          # App Router de Next.js
│   ├── (public)/                 # Rutas públicas
│   │   ├── page.tsx              # Home page
│   │   ├── propiedades/          # Catálogo y detalle
│   │   └── login/                # Login de agentes
│   ├── admin/                    # Panel de administración
│   │   ├── layout.tsx            # Layout con auth
│   │   ├── page.tsx              # Dashboard
│   │   └── propiedades/          # Gestión de propiedades
│   ├── api/                      # API Routes
│   │   ├── auth/                 # NextAuth
│   │   ├── properties/           # CRUD propiedades
│   │   └── contact/              # Formulario contacto
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Estilos globales
├── components/                   # Componentes reutilizables
│   ├── home/                     # Secciones del home
│   ├── layout/                   # Header, Footer
│   ├── admin/                    # Componentes del admin
│   └── property-card.tsx         # Card de propiedad
├── lib/                          # Utilidades
│   ├── db.ts                     # Base de datos mock
│   └── utils.ts                  # Funciones helper
├── types/                        # Tipos TypeScript
│   ├── index.ts                  # Tipos principales
│   └── next-auth.d.ts            # Tipos de NextAuth
├── middleware.ts                 # Middleware de auth
├── next.config.js                # Configuración Next.js
├── tailwind.config.ts            # Configuración Tailwind
└── package.json                  # Dependencias
```

## 🎨 Categorías de Propiedades

1. **En Desarrollo**: Proyectos en construcción
2. **En Pozo**: Proyectos en etapa inicial
3. **Usados**: Propiedades listas para escriturar
4. **Alquileres**: Propiedades para renta
5. **Inversiones**: Oportunidades de inversión
6. **Oportunidades**: Propiedades con precios especiales

## 💾 Base de Datos

Actualmente usa un sistema mock en memoria (`/lib/db.ts`). Para producción, se recomienda:

### Opción 1: Prisma + PostgreSQL
```bash
npm install @prisma/client prisma
npx prisma init
# Definir schema en prisma/schema.prisma
npx prisma migrate dev
```

### Opción 2: MongoDB + Mongoose
```bash
npm install mongodb mongoose
# Configurar en /lib/mongodb.ts
```

### Opción 3: Supabase
```bash
npm install @supabase/supabase-js
# Configurar en /lib/supabase.ts
```

## 🔒 Seguridad

- ✅ Autenticación con NextAuth.js
- ✅ Middleware de protección de rutas
- ✅ Validación con Zod
- ✅ Hashing de contraseñas con bcryptjs
- ✅ Variables de entorno para secretos
- ⚠️ NEXTAUTH_SECRET debe ser único en producción

## 📧 Configurar Email (Opcional)

Para que el formulario de contacto envíe emails reales:

```bash
npm install nodemailer
```

Configurar en `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASSWORD=tu-app-password
SMTP_FROM=noreply@barrerabrokers.com
```

Actualizar `/app/api/contact/route.ts` con la implementación de nodemailer.

## 🚀 Deployment

### Vercel (Recomendado)
```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel

# Configurar variables de entorno en Vercel Dashboard
```

### Otras Plataformas
- **Netlify**: Compatible con Next.js
- **Railway**: Soporta Next.js + PostgreSQL
- **AWS Amplify**: Deploy automático desde GitHub

## 📱 Responsive Design

El sitio está optimizado para:
- 📱 Móvil (< 768px)
- 📱 Tablet (768px - 1024px)
- 💻 Desktop (> 1024px)

## 🎯 Próximas Mejoras

- [ ] Integración con base de datos real
- [ ] Subida de imágenes a CDN (Cloudinary, AWS S3)
- [ ] Sistema de notificaciones por email
- [ ] Chat en vivo con agentes
- [ ] Búsqueda avanzada con filtros
- [ ] Comparador de propiedades
- [ ] Tours virtuales 360°
- [ ] Integración con Google Maps
- [ ] Panel de analytics
- [ ] Multi-idioma (i18n)

## 📝 Licencia

Este proyecto es privado y propiedad de Barrera Brokers.

## 🤝 Soporte

Para soporte técnico:
- Email: dev@barrerabrokers.com
- Teléfono: +54 11 1234-5678

---

**Desarrollado con ❤️ para Barrera Brokers**
