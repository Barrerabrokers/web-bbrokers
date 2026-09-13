# Reglas de Proyecto y Contexto: Barrera Brokers

## 1. Idioma y Comunicación
- **Idioma obligatorio:** Responder SIEMPRE en español en todas las interacciones, explicaciones, documentación interna y mensajes de commit.
- **Tono:** Profesional, técnico, ágil, arquitectónico y orientado al negocio inmobiliario e inversión.

## 2. Contexto del Negocio
- **Empresa:** Barrera Brokers ([barrerabrokers.com](https://barrerabrokers.com)).
- **Contacto principal / Fundador:** Pablo Barrera (`pablo@barrerabrokers.com`).
- **Core Business:** Curaduría de oportunidades inmobiliarias premium en Buenos Aires (Recoleta, Palermo, Belgrano, Nuñez, Puerto Madero). Especialistas en desarrollos en pozo, preventa, proyectos para inversores y renta temporal.
- **Ecosistema:**
  1. **Sitio Web Público:** Catálogo de desarrollos y propiedades, fichas técnicas, calculadoras de inversión y captación de leads.
  2. **CRM Propietario:** Plataforma interna para agentes inmobiliarios de Barrera Brokers, gestión de leads (pipeline / kanban), asignación de oportunidades y métricas.
  3. **Extensión de Google Chrome (`chrome-extension/`):** Integración activa con WhatsApp Web para sincronizar automáticamente los chats, mensajes, notas y leads con el CRM propio.

## 3. Arquitectura y Stack Tecnológico
- **Frontend & Backend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS.
- **Animaciones y UX:** GSAP, Framer Motion, Lenis (scroll cinematográfico, sin perder contraste ni accesibilidad WCAG AA).
- **Base de Datos & Auth:** Supabase (PostgreSQL), `@supabase/supabase-js`, `@supabase/ssr`, Postgres connection pooler.
- **Despliegue e Infraestructura:** Vercel (CI/CD conectado al repositorio `Barrerabrokers/web-bbrokers` en GitHub).
- **Extensión de Chrome:** Manifest V3, content scripts para WhatsApp Web (`whatsapp.js`, `whatsapp.css`), background worker y bridge al CRM (`crm-bridge.js`).
- **Integraciones:**
  - Google OAuth (Gmail y Google Calendar por agente).
  - WhatsApp Web Sync + WhatsApp Business Platform / Meta Graph API.
  - Emails transaccionales con Resend.
  - Modelos de IA: Optimización hacia Google Gemini para análisis de conversaciones, asistentes de agentes y automatización.

## 4. Principios de Diseño y Estándares
- **Mostrar la inversión antes que decorar:** Datos claros de ubicación, precio, etapa, financiación y rentabilidad.
- **Anti-referencias:** Evitar estética de plantilla SaaS o portales masivos genéricos.
- **Calidad de código:** Tipado estricto en TypeScript, esquemas en Supabase documentados y compatibilidad total con Vercel.
