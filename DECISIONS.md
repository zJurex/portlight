# DECISIONS

Registro de decisiones y de límites verificados. Cada límite lleva URL y fecha de consulta.

## 2026-10-09 — Nombre definitivo: **Portlight** (reemplaza a "Puerto Franco")

- Motivo: el usuario pidió un nombre en inglés. "Portlight" es la luz de un puerto (un faro) y también la claraboya de un barco. Encaja con la estética "puerto de noche" y con el logo del faro, y se pronuncia fácil en es/en/pt.
- Verificación: búsqueda web de "Portlight" game. No hay juegos ni apps con ese nombre; solo existe una ONG de EE. UU. (Portlight Strategies), de otro rubro y sin conflicto en la clase de videojuegos.
- `portlight.pages.dev` no resuelve, así que el nombre está libre en el subdominio gratuito. El Worker se publica como `portlight`.
- Descartados: "Harborlight" (ya existe un juego web con ese nombre en Cinevva), "Freeport" (empresa y ciudad muy conocidas) y "Lanternport" (cuesta pronunciarlo en es/pt).
- Repositorio sugerido en GitHub: `portlight` (lo crea el usuario).
- Pendiente humano antes de comprar un dominio: revisar las bases de marcas de la OMPI y del INPI.

## 2026-10-09 — (Histórico) Nombre provisorio "Puerto Franco"

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

## 2026-10-09 — Arquitectura de la fase 1: un Durable Object como única autoridad

- **Todo el estado económico** (usuarios, empresas, lotes, órdenes, operaciones, ledger y cupos) vive en **un solo Durable Object `World` con SQLite**. Serializa todas las operaciones, así que no hay condiciones de carrera ni hace falta coordinar D1 con el DO. Las operaciones son atómicas con `transactionSync`.
- **D1 queda para más adelante:** snapshots de ranking, métricas diarias y copias. En la fase 1 no se usa porque agregaría escrituras sin necesidad.
- **Los estáticos los sirve Workers Static Assets.** No cuentan como requests del Worker, porque solo `/api/*` ejecuta código (`run_worker_first`).
- **El mapa se guarda como un único blob en `meta`:** 1 fila escrita por cambio y 1 fila leída al despertar, en vez de recorrer la tabla de lotes.
- **Bots perezosos:** las cotizaciones del creador de mercado son una función determinística de (producto, ref, ventana de 15 min). Solo se escribe el uso del cupo cuando alguien opera contra el bot.
- **Precio de referencia:** solo cuentan las operaciones humano-humano (`n` = operaciones reales). Las operaciones contra bots no mueven la ref, para que no se refuerce sola.
- **Prioridad humana:** el bot iguala (nunca mejora) una orden humana que esté dentro de su banda de ±15 % de la ref. Fuera de esa banda la ignora, para que una orden extrema no arrastre a los bots.
- **Ledger:** cada movimiento de caja es una fila con su motivo (start, lot, build, upgrade, maintenance, buy, sell, escrow, release). Invariante: caja = SUM(ledger) por empresa, y masa monetaria = Σ caja + Σ reservas de órdenes de compra.
- **Comisión del 3 %:** la paga el vendedor y queda neta en la fila `sell`. El valor bruto está en `trades`.
- **Mantenimiento perezoso:** 0,5 % diario del valor invertido, cobrado al actuar y nunca por debajo de cero.
- **Cuota:** el DO cuenta sus requests diarios. Activa el modo ahorro al 80 % y el modo solo lectura al 100 % (sección 7).
- **Mapa v1:** cartograma de 11 países de Latinoamérica más "Resto del mundo" (8 regiones), 281 distritos de 8×8 lotes. En la v1 solo se crece dentro del distrito propio, y no hay transporte entre distritos hasta la fase 2.
- **Edificios habilitados en la v1:** los 9 productivos más el Almacén. La Tienda y el Puerto quedan definidos pero apagados hasta la fase 2.

## 2026-10-10 — Fase 2: calibración de la economía con el simulador

El simulador (`sim/`, el mismo motor que el servidor) encontró cuatro problemas en las reglas originales. Las correcciones están en `ECONOMY.md` y la evidencia en `sim/REPORT.md`.

1. **Espiral deflacionario:** un piso del Estado relativo a la ref (0,70 × ref) arrastra la ref hacia abajo sin fin; la madera cayó un 95 % en 30 días. → **El Estado se ancla al valor base**, con una banda de 0,85 a 1,15 × base. Se cambia el valor del prompt (0,70/1,30 × ref) porque con él no se cumple el criterio del índice ±15 %.
2. **Bucle bot → Estado (10,8 % diario):** con el bot atado a la ref y el Estado al valor base, comprarle al bot y venderle al Estado daba ganancia. → **El bot cotiza siempre dentro de la banda del Estado.**
3. **Reventa al Estado (5,7 % diario):** comprar barato en un distrito con el cupo agotado y revenderlo al Estado en otro. → **El Estado solo compra lo producido por la propia empresa.**
4. **Manipulación de la ref por lavado entre cuentas propias:** → **un trade por par cada 48 h**, precio recortado a la banda, tope de ±10 % diario y banda de órdenes de 0,5 a 2 × ref.

Además, los cupos del Estado crecen con los jugadores activos de cada distrito (demanda pública), para que la economía escale con la población.

El criterio de payback se mide como la mejor estrategia honesta disponible para un recién llegado (la del tutorial: granja y vender). Las estrategias que compran insumos para edificios futuros mezclan esa inversión con la primera. El informe muestra todas las estrategias.

Los costos de los edificios quedan como en el prompt maestro: bajarlos no cambiaba el resultado.
