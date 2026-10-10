# Portlight

*Un mundo compartido de empresas: producí, comerciá y competí por tu provincia.*

Juego web gratuito, persistente y multijugador. Costo de operación: cero (Cloudflare Workers + D1 + Durable Objects en plan gratuito).

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `apps/web` | Cliente (TypeScript + Vite + Canvas 2D), PWA |
| `apps/api` | Cloudflare Worker + D1 + Durable Object del mercado |
| `packages/shared` | Reglas y datos del juego (JSON) y motor puro compartido |
| `sim` | Simulador de balance económico |
| `ops` | Scripts de operación, backups y reportes |
| `docs` | Documentación (incluye el prompt maestro) |
| `marketing` | Guiones, kit de prensa y paquetes de publicación |

## Documentos vivos

`PLAN.md` · `DECISIONS.md` · `ECONOMY.md` · `GROWTH.md` · `RUNBOOK.md` · `STATUS.md` · `NEXT_ACTIONS.md`
