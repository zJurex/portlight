# NEXT_ACTIONS — acciones que necesitan a un humano

Cada ítem dice qué hacer, dónde y con qué material. El agente sigue trabajando mientras tanto.

## Bloqueantes para publicar (fase 1)

1. **Cuenta de Cloudflare (gratis, sin tarjeta).** https://dash.cloudflare.com/sign-up
   Después, en esta carpeta: `npx wrangler login` (abre el navegador para autorizar).
2. **Cuenta de GitHub y repositorio público `puerto-franco`.** https://github.com/new
   Después: `git remote add origin https://github.com/<usuario>/puerto-franco.git && git push -u origin main`.
   Secretos de Actions (Settings → Secrets → Actions): `CLOUDFLARE_API_TOKEN` (plantilla "Edit Cloudflare Workers") y `CLOUDFLARE_ACCOUNT_ID`.

## Más adelante

- [ ] Revisar las marcas "Puerto Franco" en INPI Argentina (https://portaltramites.inpi.gob.ar) y en la base mundial de la OMPI (https://branddb.wipo.int) antes de comprar un dominio.
- [ ] Servidor de Discord del juego (fase 3). El agente deja listos los canales y los webhooks.
- [ ] Perfiles oficiales con el mismo nombre en TikTok, Instagram, YouTube y X, más un email de contacto (fase 6).
- [ ] Revisión de traducciones por una persona nativa en en/pt (antes del lanzamiento).
- [ ] Revisión de Términos y Privacidad por un abogado, incluido el RGPD (antes de cualquier cobro).
- [ ] Apps OAuth de Google y Discord para vincular cuentas (fase 3).
