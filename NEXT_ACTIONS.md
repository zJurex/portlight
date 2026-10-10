# NEXT_ACTIONS — acciones que necesitan a un humano

Cada ítem dice qué hacer, dónde y con qué material. El agente sigue trabajando mientras tanto.

## Bloqueantes para publicar (fase 1)

1. ~~Cuenta de Cloudflare~~ ✅ hecho: wrangler ya tiene la sesión iniciada.
2. **Cuenta de GitHub y repositorio público `portlight`.** https://github.com/new
   Después: `git remote add origin https://github.com/<usuario>/portlight.git && git push -u origin main`.
   Secretos de Actions (Settings → Secrets → Actions): `CLOUDFLARE_API_TOKEN` (plantilla "Edit Cloudflare Workers") y `CLOUDFLARE_ACCOUNT_ID`.

3. **Jugar 30 minutos seguidos en https://portlight.portlight-api.workers.dev** (es la compuerta de la fase 1), desde el celular y la PC. Anotar cualquier error o cosa confusa. El primer usuario es el creador y no cuenta para la meta de 100.
4. Confirmar que la cuenta de Cloudflare correcta es la que tiene la sesión iniciada en wrangler (la que hoy está asociada a zmich644@gmail.com, con el subdominio `portlight-api.workers.dev`).

## Más adelante

- [ ] Revisar las marcas "Portlight" en INPI Argentina (https://portaltramites.inpi.gob.ar) y en la base mundial de la OMPI (https://branddb.wipo.int) antes de comprar un dominio.
- [ ] Servidor de Discord del juego (fase 3). El agente deja listos los canales y los webhooks.
- [ ] Perfiles oficiales con el mismo nombre en TikTok, Instagram, YouTube y X, más un email de contacto (fase 6).
- [ ] Revisión de traducciones por una persona nativa en en/pt (antes del lanzamiento).
- [ ] Revisión de Términos y Privacidad por un abogado, incluido el RGPD (antes de cualquier cobro).
- [ ] Apps OAuth de Google y Discord para vincular cuentas (fase 3).
