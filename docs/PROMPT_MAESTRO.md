# Prompt maestro: Puerto Franco

Oct 9, 2026 · @Justo

Pegá este documento completo en un agente de código (por ejemplo Claude Code) dentro de una carpeta vacía: construye, publica sin gastar un peso, opera solo y difunde un juego web multijugador, y no termina hasta que lo use gente real.

## 1. Rol y misión

Sos el equipo completo (ingeniería, diseño, economía de juego y crecimiento) de un proyecto llamado provisoriamente **Puerto Franco**: un juego web gratuito, persistente y multijugador donde cada jugador tiene empresas en un mapa compartido, produce aunque no esté conectado y comercia en un mercado vivo.

Tu misión es construirlo, publicarlo con costo cero, operarlo sin intervención diaria y hacerlo conocido, hasta que lo use gente real.

- Trabajá de forma autónoma y no pidas confirmación salvo que una regla de este documento lo exija.
- Antes de escribir código, leé todo este documento, creá `PLAN.md` con las tareas por fase y empezá por la fase 0.
- Idiomas: español rioplatense, inglés y portugués de Brasil desde el lanzamiento, y más idiomas después según el tráfico real (ver sección 9). La internacionalización se construye desde el día uno.
- El nombre es provisorio: verificá que no choque con marcas, dominios o juegos activos, y elegí una alternativa si hace falta.
- Pitch de una frase para toda la comunicación: *un mundo compartido de empresas: producí, comerciá y competí por tu provincia*.

## 2. Reglas innegociables

Estas reglas pesan más que cualquier otra instrucción del documento.

1. **Costo cero.** Ningún servicio, plan o dominio que pida tarjeta o pago. Si algo exige pagar, buscá una alternativa gratuita; si no existe, anotalo en `NEXT_ACTIONS.md` y seguí sin eso. Usá la URL gratuita de la plataforma hasta que el usuario decida comprar un dominio.
2. **Verificá los límites vigentes** en la documentación oficial antes de depender de ellos. Cambian seguido. Guardá fecha y URL en `DECISIONS.md`.
3. **Honestidad con los usuarios.** Los bots se muestran como "Empresa del Estado" y nunca se hacen pasar por jugadores. Todo contador público (jugadores, empresas) cuenta solo humanos reales.
4. **Prohibido:** cuentas, reseñas, votos o comentarios falsos; comprar tráfico, descargas o seguidores; mensajes masivos no pedidos; juntar datos personales; copiar nombres, arte, textos o código ajeno. Internet City, Sim Companies, Wplace y r/place son inspiración de género, no plantillas.
5. **No publiques ni comentes en Reddit, Hacker News ni foros en nombre del usuario.** Esas comunidades piden participación humana y cuentas con historial. Vos preparás el material y el usuario lo publica.
6. **Sin pay-to-win ni pay-to-fast, nunca.** El premium queda desactivado hasta cumplir las condiciones de la sección 6.
7. **Datos personales mínimos:** sin cookies de terceros ni analíticas invasivas, y el email es opcional.
8. **Si necesitás una acción humana** (cuenta con verificación por teléfono, publicar en redes, aceptar términos legales), dejá el paquete listo en `NEXT_ACTIONS.md` (qué, dónde, texto, imagen, link) y seguí con todo lo demás. No te detengas por eso.
9. **Preguntale al usuario solo si** algo exige pago, hay una duda legal seria, una cuenta pide verificar identidad o una acción es destructiva e irreversible.

## 3. Concepto y reglas del juego

**El mundo.** Un mapa estilizado de Latinoamérica más una zona "Resto del mundo", dividido en distritos por país (provincias, estados, departamentos). Cada distrito tiene lotes: el puerto del centro es caro y la periferia es gratis. Cada jugador arranca con 4 lotes gratuitos en la periferia del distrito que elija, y puede comprar más con francos hasta un máximo de 12 en la versión 1.

**Moneda.** El franco (₣). Capital inicial: ₣10.000.

**Ritmo de juego.**

- Primer minuto: entrar como invitado, elegir país y distrito, reclamar un lote y construir una granja.
- Horas: la producción corre sola y se acumula hasta 24 horas sin conexión.
- Día: vender en el mercado, firmar contratos y reinvertir.
- Semana: evento mundial, ranking por distrito y país.

**Productos de la versión 1** (valores iniciales, a calibrar con el simulador de la sección 6):

| Producto | Receta | Valor base (₣) |
| --- | --- | --- |
| Trigo | materia prima | 4 |
| Madera | materia prima | 5 |
| Mineral | materia prima | 6 |
| Energía | materia prima | 3 |
| Harina | 2 Trigo + 1 Energía | 14 |
| Tablas | 2 Madera + 1 Energía | 16 |
| Acero | 2 Mineral + 2 Energía | 22 |
| Pan | 1 Harina + 1 Energía → 2 unidades | 11 c/u |
| Muebles | 2 Tablas + 1 Acero | 68 |
| Herramientas | 1 Acero + 1 Tablas | 48 |

**Edificios** (nivel 1, con 5 niveles; la producción sube ×1,0 / ×1,4 / ×1,9 / ×2,5 / ×3,2 y mejorar cuesta el costo base × 1,6 por nivel):

| Edificio | Produce | Por hora (nivel 1) | Costo base (₣) |
| --- | --- | --- | --- |
| Granja | Trigo | 12 | 800 |
| Aserradero | Madera | 10 | 900 |
| Mina | Mineral | 8 | 1.200 |
| Central | Energía | 20 | 1.000 |
| Molino | Harina | 6 | 1.500 |
| Carpintería | Tablas | 5 | 1.600 |
| Fundición | Acero | 4 | 2.200 |
| Panadería | Pan | 8 | 1.800 |
| Taller | Muebles o Herramientas | 2 | 3.000 |
| Tienda | vende al público (demanda limitada por distrito) | n/a | 2.000 |
| Almacén | +capacidad de stock | n/a | 700 |
| Puerto | contratos y menor costo de transporte | n/a | 2.500 |

**Reglas de diseño.**

- Un edificio básico debe amortizarse en 12 a 24 horas de producción.
- Vecinos complementarios (por ejemplo, Molino junto a Granja) dan hasta +10 % de producción, con tope.
- Transporte: gratis dentro del distrito, 1 % del valor dentro del país y 3 % entre países. El Puerto lo reduce.
- Los jugadores nuevos entienden el juego en menos de 5 minutos con un tutorial de 5 pasos.

## 4. Estética y paleta

**Dirección visual: "puerto de noche".** Pixel art de 16 bits, vista cenital o isométrica, dibujada por código en Canvas 2D para no depender de ningún asset externo. Los edificios encienden sus luces de noche según la hora local del jugador. Bordes rectos de 2 px, sombras duras desplazadas 3 px y nada de degradados suaves.

**Paleta** (definila como variables CSS y verificá los contrastes con un script):

| Token | Hex | Uso |
| --- | --- | --- |
| noche | #0E1B2E | fondo general |
| casco | #16283F | tarjetas y paneles |
| muelle | #1F3652 | superficies elevadas y bordes |
| crema | #F4EBD9 | texto principal |
| niebla | #A9B7C6 | texto secundario |
| franco | #F2A93B | acento principal, moneda, botones primarios |
| rio | #3FC1C9 | acento secundario, agua, enlaces |
| cosecha | #5FD38D | ganancia y estados positivos |
| teja | #E4572E | pérdida y alertas |
| ultramar | #8E6BD8 | eventos (solo gráficos y texto grande; para texto chico usar #A58AE8) |
| ladrillo | #C96F4A | cuerpo de los edificios |
| arena | #E8D3A2 | terreno y lotes libres |

**Tipografía** (alojada en el propio sitio, licencia OFL): *Press Start 2P* solo para títulos grandes (20 px o más), *Inter* para todo el resto, con números tabulares en precios y cantidades.

**Interfaz.**

- Pensada para celular primero, con barra inferior de 5 pestañas: Mapa, Empresa, Mercado, Evento y Ranking.
- Mapa con pellizco para zoom, arrastre y minimapa.
- Animaciones de 2 a 4 cuadros (humo, engranajes, luces) que respetan *reducir movimiento*.
- Sonido opcional y apagado por defecto, con chiptune generado con WebAudio.
- Tono de voz cercano y rioplatense, con humor liviano. Ejemplo: "Tu molino está lleno. Pasá a retirar la harina."

**Accesibilidad y rendimiento.**

- Contraste de texto AA (4,5:1 o más) y objetivos táctiles de 44 px o más.
- Nunca usar solo el color para dar información: sumar íconos y flechas ▲▼.
- JavaScript inicial de 200 KB comprimido o menos.
- LCP de 2,5 s o menos en 4G y Lighthouse móvil de 90 o más.

**Marca.** Wordmark en pixel art con un faro o ancla, y favicon de 32 px.

## 5. Funcionalidades de la versión 1

1. **Entrada sin registro.** Cuenta de invitado que se puede jugar de inmediato; para conservarla se vincula con Google o Discord (u email, si hay un servicio gratuito viable).
2. **Mapa compartido.** Zoom y arrastre, vista de distrito, búsqueda de empresas y jugadores, y un timelapse de cómo evolucionó el mapa.
3. **Empresa.** Lotes, construcción y mejora de edificios, inventario con capacidad de almacén, y recolección de lo producido (hasta 24 horas acumuladas).
4. **Mercado.** Libro de órdenes por producto, órdenes límite, precio de referencia con gráfico de 7 días, historial propio y máximo 10 órdenes abiertas por cuenta.
5. **Contratos directos** entre jugadores, sin comisión.
6. **Evento mundial semanal** con barra de progreso colectiva y recompensa cosmética visible en el mapa.
7. **Rankings** por empresa, distrito y país. El ranking de países también se muestra ajustado por cantidad de jugadores, para que los chicos compitan en serio.
8. **Vitrina de empresa.** Nombre, color, logo en cuadrícula de 16×16 con editor propio, un link opcional y @redes (disponibles a los 3 días de cuenta).
9. **Compartir.** Tarjeta de imagen "mi empresa en el mapa" generada en el navegador, link de invitación con `?ref=` y botones de WhatsApp, Telegram, X y copiar link, en ese orden.
10. **PWA instalable** con notificaciones push opcionales ("tu producción está lista").
11. **Tutorial de 5 pasos**, centro de ayuda y botón de reportar contenido.
12. **Ajustes:** idioma, sonido, reducir movimiento y modo ahorro de datos.
13. **Panel de administración** mínimo y protegido, con métricas y moderación.
14. **Hitos de difusión cosméticos** (por ejemplo, un cartel luminoso por invitar a un amigo), siempre sin ventaja de juego.

## 6. Economía, bots y premium futuro

**Precio de referencia.** Es el precio "justo" de cada producto. Mezcla el valor base con el promedio ponderado por volumen de las operaciones reales de las últimas 48 horas. Con pocas operaciones pesa el valor base; con muchas, pesa el mercado.

```latex
ref = w \cdot base + (1 - w) \cdot VWAP_{48h}, \qquad w = \frac{1}{1 + n/20}
```

`n` es la cantidad de operaciones reales en 48 horas. Con `n = 0`, `w = 1`; con `n = 20`, `w = 0,5`.

**Para qué sirve.**

- Sugiere un precio al jugador nuevo.
- Ancla a los bots.
- Pone piso y techo: el Estado compra a 0,70 × ref y vende a 1,30 × ref, con cantidades diarias limitadas por distrito. Así nadie queda sin salida y los precios no se disparan.

**Bots (mientras no hay usuarios).**

- **Creadores de mercado:** dejan órdenes de compra y venta alrededor de la referencia, con un margen del 5 al 15 %, ruido aleatorio de ±3 % y renovación cada 10 a 20 minutos.
- **Empresas del Estado:** tienen lotes en el mapa y producen con las mismas reglas que los jugadores. Se identifican con ícono y etiqueta, no entran a los rankings ni a los contadores.
- **Prioridad humana:** un bot nunca mejora el precio de una orden real abierta.
- **Retirada gradual:** el volumen de bots de cada producto se multiplica por `max(0,15; 1 − órdenes_reales_24h / 100)`. Siempre queda un mínimo de respaldo.
- **Presupuesto:** cada bot tiene un tope diario de compra y venta para no inflar la economía.
- **Ejecución perezosa:** al recibir una consulta, el servidor "pone al día" las órdenes y la producción pendientes hasta el momento actual. Así se necesitan pocas tareas programadas (ver sección 7).

**Sumideros y fuentes de francos.**

- Sumideros: comisión de mercado del 3 % (sin comisión en contratos), mantenimiento de edificios del 0,5 % diario de su valor, compra de lotes, transporte y cosméticos.
- Fuentes: compras del Estado, recompensas de eventos y capital inicial.
- Todo movimiento queda en un libro contable (`ledger`) en enteros (centavos de franco). Cada día se controla la masa monetaria y la variación debe tener explicación.

**Simulador de balance (obligatorio antes del lanzamiento).** Corré 10.000 jugadores con estrategias variadas durante 90 días simulados, con y sin agentes que buscan trampas. Criterios para aprobar:

- Índice de precios dentro de ±15 % en 30 días.
- Ningún bucle de arbitraje que dé más de 2 % diario.
- Un jugador nuevo con buena estrategia recupera su primera inversión en menos de 24 horas.
- El 1 % más rico no supera 20 veces la mediana al día 30.
- Cero creación de dinero por errores de redondeo o duplicación.

**Premium futuro (código listo, desactivado con `premium_enabled=false`).** Se evalúa recién con 300 o más jugadores activos por semana durante 4 semanas seguidas y la economía estable.

- Sí: bajar la comisión de mercado 1 punto (con tope de ahorro diario), más órdenes abiertas (de 10 a 25), alertas e historial extendido, y cosméticos (marcos, colores, apariencias de edificios).
- Nunca: producción más rápida o mayor, temporizadores más cortos, ventajas exclusivas de poder.
- El cobro requiere que el usuario abra una cuenta de comerciante en el proveedor de pagos. Dejá la integración preparada y documentada en `NEXT_ACTIONS.md`, sin cobrar nada.

## 7. Arquitectura gratuita

**Stack propuesto** (verificá cada límite en la documentación oficial antes de fijarlo):

- **Frontend:** TypeScript + Vite + Canvas 2D, con Preact solo si hace falta. Se publica como archivos estáticos en Cloudflare, con CDN gratuita.
- **API:** Cloudflare Workers.
- **Base de datos:** D1 (SQLite). Para el libro de órdenes, un Durable Object con almacenamiento SQLite por producto evita condiciones de carrera; está disponible en el plan gratuito.
- **Automatización:** repositorio en GitHub con GitHub Actions para CI/CD, copias de seguridad diarias (exportando solo hashes, nunca datos personales en claro), el video semanal con ffmpeg y tareas programadas de respaldo.
- **Monitoreo:** un chequeo de disponibilidad gratuito con alertas a un webhook de Discord, Cloudflare Web Analytics (sin cookies) y eventos propios muestreados.

**Límites gratuitos que condicionan el diseño** (datos de octubre de 2026):

| Recurso | Límite en plan gratuito |
| --- | --- |
| Requests de Workers | 100.000 por día |
| CPU por ejecución | 10 ms |
| Tareas programadas (cron) | 5 por cuenta |
| D1 | desde el 1/9/2026 las consultas fallan si se supera el tope diario de filas leídas o escritas; se reinicia a medianoche UTC (21:00 en Argentina) |

**Qué implica.**

- Presupuesto objetivo: 1.000 jugadores activos por día con 60 requests o menos cada uno (60.000 por día, 40 % de margen).
- El cliente consulta el mercado cada 45 s solo con la pestaña visible, con retroceso progresivo y `ETag`/304.
- Ranking, mapa y precios de referencia se sirven desde un snapshot cacheado 30 a 60 s.
- Escrituras agrupadas, índices en todas las consultas y nada de lecturas de tabla completa.
- Usá 1 o 2 tareas programadas como máximo, con trabajo mínimo (10 ms de CPU). Lo demás se resuelve de forma perezosa (sección 6).
- **Modo ahorro automático** al llegar al 80 % del presupuesto: consultas más espaciadas y bots en pausa. Al 100 %: solo lectura desde caché y un aviso "volvé después de las 21:00". Nunca subas de plan ni pagues extra.

**Datos.**

- Tablas: `users`, `companies`, `lots`, `buildings`, `inventories`, `orders`, `trades`, `contracts`, `ledger`, `price_ref`, `bots`, `events`, `event_contribs`, `ranking_snapshots`, `map_snapshots`, `reports`, `referrals`, `push_subs`, `metrics_daily`.
- El servidor es la única autoridad: el cliente nunca calcula resultados económicos.
- Todo en UTC, dinero en enteros, operaciones económicas atómicas e idempotentes.

**Estructura del repositorio:** `/apps/web`, `/apps/api`, `/packages/shared` (reglas y datos del juego en JSON), `/sim` (simulador), `/ops`, `/docs`, `/marketing`. Documentos que debés mantener: `README.md`, `DECISIONS.md`, `ECONOMY.md`, `GROWTH.md`, `RUNBOOK.md`, `STATUS.md` y `NEXT_ACTIONS.md`.

## 8. Seguridad, moderación y legales

- **Cuentas.** Invitado más vinculación con Google o Discord; no guardes contraseñas propias. Usá una verificación anti-bots gratuita (por ejemplo Cloudflare Turnstile) en el alta, límites de pedidos por IP y por cuenta, y durante las primeras 48 horas un tope de ₣2.000 en transferencias y contratos para frenar multicuentas y granjas de bots.
- **Contenido de usuarios.** Solo nombre de empresa, color, logo de 16×16 en paleta fija (sin subir imágenes, lo que además elimina el costo de almacenamiento), un link opcional y @redes. El link exige `https`, cuenta con 3 días o más, `rel="nofollow ugc noopener"` y una lista de dominios bloqueados. Filtro de palabras en español, inglés y portugués, botón de reportar y ocultamiento automático tras 3 reportes distintos, con revisión en el panel de administración.
- **Seguridad técnica.** Validación siempre en el servidor, CSP estricta, ningún secreto en el repositorio, pocas dependencias y revisadas, y registro de auditoría de toda operación económica.
- **Anti-exploits.** Pruebas automáticas que buscan duplicación de recursos, condiciones de carrera y bucles de arbitraje, más agentes adversarios en el simulador.
- **Legales.** Términos y Privacidad en los idiomas de la ola 1 (sección 9), en lenguaje simple: qué datos se guardan, para qué y cómo borrarlos, con un botón "Eliminar mi cuenta". Edad mínima de 13 años. Marcá en `NEXT_ACTIONS.md` que un abogado los revise antes de activar cualquier cobro. Solo fuentes y herramientas con licencia libre; sin assets de terceros.

## 9. Idiomas y alcance internacional

El juego nace multilingüe: un solo mundo y una sola economía para todos, con la interfaz, el contenido y la difusión en varios idiomas. Hablar distinto no separa mercados: un jugador de Brasil le compra a uno de Argentina.

**Idiomas.**

| Ola | Idiomas | Cuándo |
| --- | --- | --- |
| 1 | Español rioplatense, inglés y portugués de Brasil | Completos en la fase 3 |
| 2 | Los que pida el tráfico real: se suma un idioma cuando un país supera el 5 % de los jugadores activos, o cuando llega tráfico sostenido que no puede jugar bien. Candidatos: francés, alemán, italiano, turco, indonesio y polaco | Fase 7 |

La ola 1 es una decisión de producto, no un dato medido: el español es el foco, el portugués abre Brasil (el país más grande de Latinoamérica) y el inglés da alcance global.

**Cómo se construye.**

- Cero texto fijo en el código: todo en catálogos de mensajes por idioma (formato ICU, con plurales y género) y claves estables. Lo que se dibuja en el mapa (nombres, carteles) sale del mismo catálogo; nunca hornees texto dentro de imágenes.
- Fechas, números y moneda con `Intl`. Los datos del juego guardan identificadores neutros, nunca texto; nombres de países, distritos, productos, edificios y eventos se localizan desde el catálogo.
- Interfaz lista para textos hasta 40 % más largos y para escritura de derecha a izquierda (propiedades CSS lógicas), aunque árabe o hebreo no estén en la ola 1.
- Tipografía: verificá que *Press Start 2P* cubra los caracteres de cada idioma y, si no, usá *Inter* como respaldo. Para chino, japonés, coreano o árabe usá fuentes del sistema para no cargar archivos pesados.
- Detección por `Accept-Language` más un selector de idioma siempre visible, guardado en el navegador. Nunca fuerces una redirección a los buscadores.
- URLs por idioma (`/es/`, `/en/`, `/pt/`), etiquetas `hreflang`, sitemap y tarjetas de compartir en cada idioma.
- Los cierres de evento y de semana se definen en UTC y se muestran en la hora local de cada jugador.

**Traducción a costo cero.**

1. Escribí el catálogo base en español e inglés.
2. Traducí los demás idiomas con un glosario fijo (franco, lote, distrito, Empresa del Estado, etc.) para que los términos no cambien entre pantallas.
3. Marcá las traducciones automáticas y agregá un botón "Sugerir corrección" que abra un issue o pull request en el repositorio público.
4. Pedile a una persona nativa que revise las pantallas principales de cada idioma de la ola 1 antes del lanzamiento. Dejalo como acción humana en `NEXT_ACTIONS.md`.
5. En CI, que falle el build si falta una clave, si un texto excede el largo máximo o si queda una variable sin reemplazar. Probá también con pseudolocalización.

**Moderación en varios idiomas.**

- Sin chat libre en la versión 1, para no tener que moderar texto en muchos idiomas.
- El único texto libre es el nombre de empresa (hasta 24 caracteres) y el link opcional. Filtros de palabras en español, inglés y portugués, normalización Unicode contra letras que imitan a otras, botón de reportar y ocultamiento automático tras 3 reportes distintos.

**Difusión por idioma.**

- Los videos semanales usan banderas, números, rankings e íconos con muy poco texto, así un mismo archivo sirve en todos los idiomas. Generá una versión subtitulada por idioma con ffmpeg a partir de los catálogos.
- Empezá con un perfil por red y subtítulos. Creá un perfil separado por idioma cuando ese idioma supere el 30 % de la audiencia de esa red (la creación la hace el humano).
- Para cada idioma, preparás en ese idioma el kit de prensa, la lista de comunidades y creadores pequeños, y el borrador de cada post, con las reglas de cada comunidad verificadas. Un post traducido palabra por palabra rinde mal: adaptá el ejemplo (el ranking Argentina vs Chile pasa a ser Brasil vs Argentina en portugués).
- Mostrá primero el ranking del país del lector: la rivalidad entre países es el gancho de difusión en cada idioma.
- Una landing y una página de rankings por idioma con contenido propio, nunca páginas copiadas con el texto cambiado.

**Legales.** Términos y Privacidad en cada idioma de la ola 1; si hay diferencias, prevalece la versión en español. Con jugadores de la Unión Europea aplican reglas de privacidad (RGPD): el diseño con pocos datos ayuda, pero marcá la revisión de un abogado en `NEXT_ACTIONS.md`.

**Métricas por idioma.** Jugadores nuevos, retención al día 7 y fuente de tráfico, por idioma, en el informe semanal. Si un idioma retiene menos de la mitad que otro, revisá primero la traducción y el tutorial.

## 10. Difusión gratuita

Todo es gratuito y honesto. El juego ya trae sus ganchos de difusión: rivalidad entre países y provincias, un mapa que se llena de gente, un evento por semana y una tarjeta para compartir "mi empresa". Tu trabajo es construirlos bien, producir el contenido y dejar preparado todo lo que solo un humano puede publicar.

**A. Un producto que se comparte solo (lo construís vos).**

- Una landing con una sola frase y botón "Jugar ahora", sin registro previo.
- Etiquetas Open Graph, `sitemap.xml` y `robots.txt` correctos.
- Tarjeta de imagen de la empresa y link de invitación `?ref=`, con recompensa cosmética para ambos (con tope).
- WhatsApp y Telegram primero: en Latinoamérica es el canal principal.
- Páginas públicas de ranking por distrito, indexables solo cuando hay 10 o más jugadores reales (contenido único con datos vivos, nunca páginas vacías).
- Timelapse del mapa exportable desde el navegador.

**B. Contenido propio (lo producís vos, lo publica el humano).**

- 3 videos verticales por semana generados con ffmpeg a partir de datos reales: timelapse del mapa, "Argentina vs Chile: el ranking de la semana", "la empresa más grande de tu provincia" y "el evento de la semana en 20 segundos".
- Fórmula de cada video: texto grande desde el primer segundo explicando de qué trata el juego, subtítulos y el mismo archivo para TikTok, Reels y Shorts.
- Guiones en `/marketing`, devlog escrito cada 2 semanas y un kit de prensa (logo, capturas, una página de presentación y 3 titulares posibles).

**C. Comunidades (preparás el material, el humano publica).**

Para cada comunidad, leé sus reglas vigentes al momento de armar el paquete y descartá las que prohíban la autopromoción. Entregá: borrador del post con el tono propio de esa comunidad, imagen o GIF y horario sugerido. Orden:

1. Un Discord propio del juego (lo crea el humano; vos dejás canales y webhooks de eventos listos).
2. Soft launch con 20 a 50 personas conocidas.
3. Comunidades de juegos de gestión, idle y desarrollo indie en español. En Reddit cada subforo tiene reglas propias y existe la pauta de no más de un 10 % de publicaciones propias, así que el humano debe participar antes de publicar.
4. Una página gratuita en itch.io que lleve al juego.
5. Show HN, solo cuando el juego se pueda probar sin registro y haya algo no trivial para contar. El texto lo escribe y firma el humano, que debe estar para responder. Nunca pedir votos ni usar varias cuentas.
6. Product Hunt, también publicado por el humano.

**D. Creadores pequeños.** Armá una lista de 30 streamers, YouTubers y tiktokers chicos de juegos de gestión o idle en español. Mensajes personalizados, máximo 10 por semana, enviados por el humano. La propuesta: un evento mundial con el nombre de su comunidad y un ranking propio. Sin pagos.

**E. Prensa y newsletters.** Una lista de 10 medios y newsletters hispanos de tecnología y juegos indie, con una nota breve y un dato verdadero (por ejemplo "2.000 empresas creadas en 10 días"), solo cuando el dato exista.

**F. Bucle semanal.** Lunes: evento nuevo e informe de la semana. Miércoles: ranking y video. Viernes: resumen y timelapse. Medí qué canal trae jugadores que vuelven al día 7, duplicá lo que funciona y frená lo que no.

**Ética.** Toda cuenta oficial se declara como tal. Cero astroturfing.

## 11. Fases, métricas y cuándo se considera terminado

No pases a la fase siguiente hasta cumplir la compuerta de la actual.

| Fase | Qué se entrega | Compuerta para avanzar |
| --- | --- | --- |
| 0. Preparación | Nombre verificado, repositorio, `DECISIONS.md` con límites y fuentes | Límites documentados con URL y fecha |
| 1. Núcleo jugable | Invitado, mapa, 4 edificios, 10 productos, mercado con precio de referencia, bots y producción sin conexión | Desplegado en URL gratuita; 30 minutos de juego seguidos sin errores |
| 2. Economía validada | Simulador y libro contable consistente | Todos los criterios de la sección 6 |
| 3. Social y viral | Rankings, eventos, tarjetas, invitaciones, PWA con push, timelapse | 5 testers: al menos 80 % completa el tutorial; 3 idiomas completos y sin claves faltantes en CI |
| 4. Endurecimiento | Modo ahorro, moderación, legales, monitoreo, copias de seguridad | Prueba simulada con 3 veces el tráfico objetivo sin pasar la cuota |
| 5. Soft launch | 20 a 50 personas reales | Al menos 40 % vuelve al día 2; cero errores críticos |
| 6. Lanzamiento público | Semana de evento, kit de prensa, videos y paquetes de publicación | 100 usuarios humanos registrados |
| 7. Crecimiento | Bucle semanal de la sección 10 | Ver "Terminado" abajo |

**Terminado** significa las tres cosas a la vez:

1. El sistema está en producción y estable durante 7 días seguidos.
2. Hay al menos 100 usuarios reales registrados (sin contar al creador ni a testers) y al menos 30 activos por semana.
3. Los informes semanales funcionan solos.

Hasta cumplir eso, no te detengas. Después seguí con el bucle semanal; premium solo con la condición de la sección 6.

**Cómo seguir sin frenarte.**

- Si algo se traba, probá la alternativa más simple, documentala y continuá.
- Si pasan 6 semanas desde el lanzamiento público con menos del 30 % de la meta, escribí un informe de causas con 3 cambios propuestos y seguí iterando.
- Nunca falsees ni infles métricas. Si las cifras no llegan, decilo en el informe.
- Si tu entorno permite tareas programadas, creá una revisión diaria de salud y presupuesto y un informe semanal; si no, usá GitHub Actions.

**Informe semanal (`STATUS.md`).** Usuarios nuevos y activos, retención al día 1 y al día 7, canales que más traen jugadores que vuelven, salud de la economía (índice de precios, masa monetaria), uso de cuota en %, incidentes y próximas acciones humanas.

**Acciones humanas esperadas** (`NEXT_ACTIONS.md`): crear cuentas de GitHub y Cloudflare, un servidor de Discord, los perfiles oficiales con el mismo nombre en TikTok, Instagram, YouTube y X, un email de contacto, y publicar los paquetes de contenido y de comunidades que vos prepares.

## 12. Fuentes y qué volver a verificar

Datos consultados el 9 de octubre de 2026. Volvé a verificar cada uno antes de depender de él.

- [Límites de Cloudflare Workers](https://developers.cloudflare.com/workers/platform/limits): 100.000 requests por día, 10 ms de CPU, 5 tareas programadas en el plan gratuito.
- [D1: tope diario en plan gratuito desde el 1/9/2026](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/).
- [Durable Objects: precios y WebSockets](https://developers.cloudflare.com/durable-objects/platform/pricing): el almacenamiento con SQLite está disponible en el plan gratuito.
- [Pautas de Hacker News](https://news.ycombinator.com/newsguidelines.html) y [reglas de Show HN](https://news.ycombinator.com/showhn.html): sin pedir votos ni cuentas múltiples, con algo que se pueda probar.
- [Autopromoción en Reddit](https://gtstu.com/promote-indie-game-reddit-without-ban/): pauta del 10 % y reglas propias de cada subforo.
- [Wplace](https://en.wikipedia.org/wiki/Wplace): caso de difusión por rankings de países y rivalidad territorial.
- [Sim Companies](https://simcompanies.atlassian.net/wiki/x/tIA_Ug): referencia del mercado entre jugadores con comisión del 3 %.

Las cifras de este documento (precios base, tasas de producción, comisiones, umbrales) son valores iniciales para calibrar con el simulador, no resultados validados.
