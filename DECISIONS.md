# DECISIONS

Registro de decisiones y de límites verificados. Cada límite lleva URL y fecha de consulta.

## 2026-10-09 — Nombre: se mantiene "Puerto Franco" (provisorio)

- Búsquedas web ("Puerto Franco" game / videojuego / itch.io / marca software): no aparece ningún juego, app ni marca de software activa con ese nombre. Los resultados cercanos son *Puerto Rico* (juego de mesa) y *Uncharted Waters*, sin conflicto.
- Riesgo: "puerto franco" es un término genérico (zona franca), así que la marca sería débil y difícil de registrar. Para un proyecto gratuito alcanza.
- Pendiente humano: consultar INPI Argentina y la base mundial de marcas de la OMPI antes de invertir en un dominio pago (ver `NEXT_ACTIONS.md`).
- Subdominio gratuito previsto: `puerto-franco.pages.dev` / `puerto-franco.<cuenta>.workers.dev`. La disponibilidad se confirma al crear el proyecto en Cloudflare.

## 2026-10-09 — Límites del plan gratuito de Cloudflare (verificados)

| Recurso | Límite | Fuente |
| --- | --- | --- |
| Requests de Workers | 100.000/día, se reinicia a las 00:00 UTC | https://developers.cloudflare.com/workers/platform/limits |
| CPU por request HTTP | 10 ms (también para cron) | ídem |
| Cron Triggers | 5 por cuenta | ídem |
| Subrequests | 50 por invocación | ídem |
| Memoria | 128 MB por isolate | ídem |
| Tamaño de script | 64 MiB sin comprimir | ídem |
| D1: filas leídas | 5.000.000/día | https://developers.cloudflare.com/d1/platform/pricing/ |
| D1: filas escritas | 100.000/día | ídem |
| D1: almacenamiento | 5 GB total; 500 MB por base; 10 bases | ídem y https://developers.cloudflare.com/d1/platform/limits/ |
| D1: consultas por invocación | 50 | https://developers.cloudflare.com/d1/platform/limits/ |
| D1 al superar el tope | las consultas fallan con error hasta las 00:00 UTC | https://developers.cloudflare.com/d1/platform/pricing/ |
| Durable Objects | solo con SQLite en plan gratuito; 100.000 req/día; 13.000 GB-s/día; 5 M filas leídas y 100.000 escritas por día; 5 GB | https://developers.cloudflare.com/durable-objects/platform/pricing |

### Implicancias de diseño

- **El cuello de botella es la escritura: 100.000 filas por día en D1 y otras 100.000 en DO.** Con 1.000 DAU quedan unas 100 filas escritas por jugador y por día en D1. Por eso:
  - La producción no se escribe por tick: se guarda `last_collected_at` y se calcula de forma perezosa.
  - El inventario va en una sola fila JSON por empresa (1 escritura por acción, no 1 por producto).
  - Los bots no escriben órdenes en filas: se calculan como función determinística de (ref, hora, semilla) y solo se escribe cuando un humano opera contra ellos.
- Un solo Durable Object "Exchange" (SQLite) concentra el libro de órdenes de los 10 productos y serializa el matching. Con 10 productos alcanza; se parte por producto si la CPU lo pide.
- El contador de cuota propio vive en el DO (contadores en memoria con flush periódico) para activar el modo ahorro al 80 %.
