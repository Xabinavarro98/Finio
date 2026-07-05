# Finio

Dashboard personal de seguimiento de cartera de inversión.

Registra activos (nombre, tipo, plataforma, importe invertido y rentabilidad) y calcula automáticamente el patrimonio total, el beneficio, la rentabilidad media ponderada y la distribución por tipo. Incluye objetivo de independencia financiera editable y copias de seguridad por exportación/importación.

## Tecnología

- React + Vite (frontend)
- Funciones serverless de Vercel (`/api`) para datos de mercado
- Los datos de la cartera se guardan por ahora en el navegador (localStorage)

## Desarrollo local

Requiere Node.js instalado.

```bash
npm install
npm run dev
```

Se abre en `http://localhost:5173`.

## Publicación

El proyecto está pensado para desplegarse en Vercel conectando este repositorio. Vercel detecta Vite automáticamente y publica en cada cambio.

## Aviso

Herramienta de seguimiento personal. No constituye asesoramiento financiero.
