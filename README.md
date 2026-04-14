# Buscador de Médicos

Directorio de médicos por mutua, especialidad y código postal. Frontend estático con datos mock. Sin backend, sin login, sin pagos.

## Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

## Build de producción

```bash
npm run build
npm run start
```

## Deploy en Vercel

1. Sube el proyecto a un repositorio de GitHub
2. Ve a [vercel.com](https://vercel.com) e inicia sesión
3. Pulsa **Add New Project** e importa el repositorio
4. Deja la configuración por defecto (Vercel detecta Next.js automáticamente)
5. Pulsa **Deploy**

El deploy tarda menos de un minuto. Vercel asigna una URL pública automáticamente.

## Estructura

```
/app
  layout.tsx          → fuente Inter, metadata SEO
  page.tsx            → landing con formulario de búsqueda
  resultados/page.tsx → lista de resultados ordenada por rating
  globals.css         → estilos base Tailwind
/components
  SearchForm.tsx      → formulario (client component)
  DoctorCard.tsx      → tarjeta de resultado
/data
  doctors.ts          → 30 médicos mock (Madrid, Barcelona, Valencia)
/lib
  search.ts           → filterDoctors(mutua, especialidad, cp)
```
