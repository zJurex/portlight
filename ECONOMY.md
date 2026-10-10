# ECONOMY — Portlight

Reglas vigentes de la economía, por qué están así y cómo se validaron. La fuente de verdad del código es `packages/shared/src/data.ts` (`ECON`, `BUILDINGS`, `BASE_VALUE`) y `engine.ts`. El simulador (`sim/`) usa exactamente ese mismo motor.

## Moneda y contabilidad

- Franco (₣), guardado en **centavos enteros**. Capital inicial: ₣10.000.
- Cada movimiento de caja es una fila del `ledger` con su motivo. Invariantes:
  - caja de una empresa = SUM(ledger) de esa empresa;
  - masa monetaria = Σ cajas + Σ reservas de órdenes de compra;
  - masa monetaria = capital inicial + fuentes − sumideros, con **0 centavos de diferencia** (lo verifica el simulador cada día).
- **Fuentes:** capital inicial, compras de los bots y compras del Estado.
- **Sumideros:** comisión del 3 % (la paga quien vende), mantenimiento del 0,5 % diario del valor invertido, lotes, construcción y mejoras, y ventas de bots y del Estado.

## Precio de referencia

`ref = w·base + (1−w)·VWAP_48h`, con `w = 1/(1 + n/20)`, como dice el prompt maestro. Se le agregaron tres defensas que salen del simulador:

1. **Un solo trade por par de empresas cada 48 h.** Sin esto, dos cuentas propias que se compran entre sí suben `n` a voluntad.
2. **El precio de cada operación se recorta a la banda del Estado** antes de entrar al VWAP. Una venta de 1 unidad a 5 veces su precio ya no arrastra la ref.
3. **La ref no se mueve más de ±10 % por día** respecto del cierre anterior, y además queda dentro de la banda del Estado.

Solo cuentan las operaciones entre humanos. Las que se hacen contra bots o contra el Estado no mueven la ref.

## Estado: piso y techo

- El Estado compra a **0,85 × base** y vende a **1,15 × base**, con cupos diarios por distrito.
- **Cambio respecto del prompt maestro (0,70/1,30 × ref):** anclar el piso a la ref genera un **espiral deflacionario**. El piso hace que las operaciones se hagan al piso, eso baja la ref, y con ella baja el piso. En el simulador la madera cayó un 95 % en 30 días. Anclado al valor base, el piso es fijo y el índice queda estable. El escenario de control del informe sigue mostrando el espiral.
- **Cupo diario por distrito y producto:** una base (200 materia prima, 80 intermedios, 20 finales) más un extra por cada jugador activo del distrito en los últimos 3 días (250, 80 y 30). Representa la demanda pública: más gente, más consumo.
- **El Estado solo le compra a una empresa lo que esa empresa produjo** (crédito que se suma al recolectar). Sin esta regla aparecía un 5,7 % diario de reventa al Estado: comprar barato en un distrito con el cupo agotado y revender en otro.

## Bots (creadores de mercado)

- Cotizan alrededor de la ref con un spread del 5–15 % y ruido de ±3 %, renovado cada 15 minutos. Son una función determinística, sin escrituras.
- Volumen × `max(0,15; 1 − órdenes_reales_24h/100)`, con un tope diario de compra y venta.
- **Prioridad humana:** igualan, nunca mejoran, una orden humana dentro de ±15 % de la ref.
- **Nunca abren un bucle contra el Estado:** el bot no vende por debajo de lo que paga el Estado ni compra por encima de lo que cobra el Estado. Sin esto, cuando la ref caía debajo del piso aparecía un bucle de 10,8 % diario (comprarle al bot y venderle al Estado).

## Órdenes

- Órdenes límite con precio entre **0,5 y 2 × ref**, y como máximo 10 abiertas por cuenta.
- La compra reserva los francos y la venta reserva los bienes. Al cancelar se devuelve la reserva.

## Producción

- Producción perezosa, acumulada hasta 24 h. Lo que no entra en el almacén o no tiene insumos sigue acumulado.
- Niveles ×1,0 / 1,4 / 1,9 / 2,5 / 3,2. Mejorar cuesta `costo base × 1,6^nivel`.
- Mejorar conserva exactamente lo acumulado (se reescala el tiempo al nuevo ritmo), así no hay ganancia retroactiva.
- Vecinos complementarios: +5 % por tipo, hasta +10 %.

## Validación

Ver `sim/REPORT.md` (se regenera con `npm run sim -w sim`). Criterios de la sección 6 del prompt maestro: índice ±15 % en 30 días, ningún bucle de arbitraje de más de 2 % diario, payback del primer edificio en menos de 24 h para un jugador nuevo con buena estrategia, top 1 % ≤ 20 × mediana al día 30, y cero creación de dinero.

## Limitaciones conocidas

- **Escala de lotes:** un distrito tiene 62 lotes libres. Con 10.000 jugadores son unos 36 por distrito, lo que da menos de 2 lotes por jugador. El simulador modela los lotes de forma abstracta. **Antes de superar ~1.500 jugadores activos hay que agrandar los distritos** (por ejemplo, de 8×8 a 12×12, o con anillos que se abren según la demanda). Queda como tarea en PLAN.md.
- El simulador no modela el transporte entre distritos, el bonus de vecinos ni los contratos directos. Los dos primeros son menores; los contratos llegan en la fase 3.
- **Masa monetaria en crecimiento:** en la corrida de 10.000 jugadores, la masa monetaria pasa de ₣100 M a ~₣500 M al día 75, porque el Estado compra la producción. Los precios no se mueven (la banda los ancla), pero se acumula riqueza. Antes de abrir la fase 6 conviene sumar sumideros que no den ventaja de juego: cosméticos, eventos con aportes y mantenimiento progresivo en niveles altos. Hay que seguir este número en el informe semanal.
