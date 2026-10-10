# PLAN — Portlight

Fuente de verdad: `docs/PROMPT_MAESTRO.md`. No se pasa de fase sin cumplir la compuerta.

## Fase 0 — Preparación
- [x] Leer el prompt maestro completo
- [x] Verificar nombre (juegos, marcas, dominio gratuito) → `DECISIONS.md`
- [x] Verificar límites gratuitos de Cloudflare con URL y fecha → `DECISIONS.md`
- [x] Repositorio git con la estructura `/apps/web`, `/apps/api`, `/packages/shared`, `/sim`, `/ops`, `/docs`, `/marketing`
- [x] Documentos base: README, DECISIONS, ECONOMY, GROWTH, RUNBOOK, STATUS, NEXT_ACTIONS
- **Compuerta:** límites documentados con URL y fecha ✅

## Fase 1 — Núcleo jugable
- [x] `packages/shared`: productos, recetas, edificios, niveles, distritos (IDs neutros, JSON) + motor puro (producción perezosa, matching de órdenes, precio de referencia) en enteros
- [x] Tests del motor (producción 24 h tope, conservación de dinero y bienes)
- [x] `apps/api`: Worker + D1 (esquema, migraciones) + Durable Object SQLite por producto para el libro de órdenes
- [x] Endpoints: invitado, empresa, lotes, construir/mejorar, recolectar, mercado (libro, órdenes límite, cancelar), referencia, snapshot de mapa
- [x] Bots: creadores de mercado + Empresas del Estado, perezosos, con retirada gradual y prioridad humana
- [x] `apps/web`: Vite + TS + Canvas 2D, i18n ICU desde el día uno (es/en/pt), barra inferior de 5 pestañas, mapa con zoom/arrastre, paleta "puerto de noche"
- [ ] CI en GitHub Actions (lint, tests, build, chequeo de claves i18n)
- **Compuerta:** desplegado en URL gratuita ✅ (https://portlight.portlight-api.workers.dev); 30 min de juego seguido sin errores ⏳ (falta la sesión humana, ver NEXT_ACTIONS)

## Fase 2 — Economía validada
- [ ] `/sim`: 10.000 jugadores, 90 días, estrategias variadas + agentes tramposos, usando el mismo motor de `packages/shared`
- [ ] Ledger en centavos; control diario de masa monetaria
- [ ] Calibrar valores de `ECONOMY.md`
- **Compuerta:** criterios de la sección 6 (índice ±15 %, arbitraje <2 %/día, payback <24 h, top 1 % ≤ 20× mediana al día 30, cero creación de dinero)

## Fase 3 — Social y viral
- [ ] Rankings (empresa, distrito, país, país ajustado), evento semanal, vitrina + editor de logo 16×16
- [ ] Tarjeta para compartir, `?ref=`, botones WhatsApp/Telegram/X/copiar
- [ ] PWA + push opcional, timelapse, tutorial de 5 pasos, ayuda, reportar
- [ ] 3 idiomas completos, CI falla por claves faltantes, pseudolocalización
- **Compuerta:** 5 testers con ≥80 % del tutorial completo; 3 idiomas sin faltantes

## Fase 4 — Endurecimiento
- [ ] Modo ahorro (80 % / 100 %), contador de cuota
- [ ] Moderación (filtros es/en/pt, homoglifos, 3 reportes), panel admin
- [ ] Términos y Privacidad (es/en/pt), eliminar cuenta, Turnstile, rate limits
- [ ] Monitoreo (uptime + webhook Discord), backups diarios (hashes)
- **Compuerta:** prueba simulada con 3× tráfico objetivo sin pasar la cuota

## Fase 5 — Soft launch (20–50 personas reales) — compuerta: ≥40 % vuelve al día 2, cero errores críticos
## Fase 6 — Lanzamiento público — compuerta: 100 usuarios humanos registrados
## Fase 7 — Crecimiento (bucle semanal) — hasta "Terminado" (sección 11)
