# STATUS

## 2026-10-10

- **Fase 2 aprobada:** el simulador corrió 10.000 jugadores durante 90 días (`sim/REPORT.md`).
  - Índice de precios: desvío máximo de 5,5 % (8,3 % con tramposos).
  - Arbitraje: 0,24 % diario como máximo.
  - Payback de la estrategia del tutorial: 12,7 h.
  - Top 1 %: 5,2 × la mediana.
  - Desvío contable: 0 centavos.
- Se corrigieron cuatro exploits o desequilibrios que encontró el simulador (ver DECISIONS.md). Las reglas ya están desplegadas en producción.
- **Para vigilar:** la masa monetaria crece unas 5 veces en 75 días (sin inflación de precios). Faltan sumideros cosméticos.
- **Pendiente humano:** el push a GitHub (login), los secretos de Cloudflare en GitHub y los 30 minutos de juego.

## 2026-10-09

- **En producción:** https://portlight.portlight-api.workers.dev (Workers + Durable Object SQLite, plan gratuito).
- **Fase 0:** completa. El nombre definitivo es **Portlight**.
- **Fase 1:** construida y desplegada. Falta la compuerta de 30 minutos de juego humano.
  - Motor compartido con 17 tests: producción perezosa con tope de 24 h, recetas, almacén, vecinos, precio de referencia, bots y matching.
  - API: alta como invitado, lotes, construir, mejorar, recolectar, mercado con órdenes límite y reserva de fondos, bots del Estado y ledger.
  - Web: mapa en Canvas con pixel art y luces de noche, 5 pestañas, es/en/pt, ajustes. El JS inicial pesa 19 KB comprimido.
  - Prueba de humo de la API (`ops/smoke.mjs`) y recorrido en Chrome headless OK en local. En producción solo se hicieron pruebas de lectura, para no crear empresas falsas.
- **Usuarios reales:** 0.
- **Cuota:** prácticamente sin uso.
- **Próximo:** fase 2 (simulador de 10.000 jugadores en `/sim` sobre el mismo motor, para calibrar la economía) y CI en GitHub Actions cuando exista el repo.
- **Acciones humanas pendientes:** crear el repo en GitHub y jugar 30 minutos (ver NEXT_ACTIONS.md).
