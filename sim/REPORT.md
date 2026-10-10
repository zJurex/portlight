# Informe del simulador de balance

Generado: 2026-10-10T03:50:11.842Z · 10.000 jugadores · 90 días · semilla 7

Mismo motor que el servidor (`packages/shared`): producción perezosa, recetas, almacén, bots con retirada gradual, Estado con cupos por distrito, comisión del 3 % y mantenimiento. Estrategias honestas: granjero, cadena, optimizador, casual, trader e inactivo. Tramposos: arbitrajistas y pares de cuentas que lavan precios para inflar la referencia.

## Escenario: honesto

Tiempo de cómputo: 155,0 s

| Criterio | Resultado | Detalle |
| --- | --- | --- |
| Índice de precios dentro de ±15 % en 30 días | ✅ | desvío máx. 5,5 % (90 días: 5,5 %) |
| Ningún bucle de arbitraje > 2 % diario | ✅ | sin agentes tramposos en este escenario |
| Jugador nuevo con buena estrategia recupera la 1.ª inversión en < 24 h | ✅ | mejor estrategia: farmer 12,7 h (99 % < 24 h) · chain 26,5 h · optimizer 25,2 h · casual 23,6 h · trader 84,8 h |
| Top 1 % ≤ 20 × mediana al día 30 | ✅ | 5,2 × |
| Cero creación de dinero por redondeo o duplicación | ✅ | desvío contable: 0 centavos |

**Flujo de francos (acumulado)**

| Fuente / sumidero | Total |
| --- | --- |
| Capital inicial | ₣100.000.000 |
| Compras de bots (+) | ₣3.062.875 |
| Compras del Estado (+) | ₣2.094.816.659 |
| Ventas de bots (−) | ₣660.003 |
| Ventas del Estado (−) | ₣162.596.159 |
| Comisiones (−) | ₣74.242.293 |
| Mantenimiento (−) | ₣177.182.428 |
| Lotes (−) | ₣112.862.500 |
| Construcción y mejoras (−) | ₣933.444.139 |
| **Masa monetaria final** | ₣736.892.012 |

Volumen: humano-humano ₣377.288.123 · contra bots ₣3.722.878 · contra Estado ₣2.257.412.818 · jugadores honestos activos al final: 3.677

**Precio de referencia por producto (₣)**

| Producto | Base | Día 1 | Día 7 | Día 14 | Día 30 | Día 60 | Día 90 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| wheat | 4,00 | 3,60 | 3,40 | 3,40 | 3,40 | 3,40 | 3,40 |
| wood | 5,00 | 4,50 | 4,60 | 5,16 | 4,25 | 4,25 | 4,25 |
| ore | 6,00 | 5,40 | 5,99 | 6,27 | 6,27 | 6,28 | 6,27 |
| energy | 3,00 | 2,70 | 2,57 | 2,58 | 2,55 | 2,55 | 2,55 |
| flour | 14,00 | 15,40 | 13,51 | 12,02 | 12,00 | 13,07 | 14,00 |
| planks | 16,00 | 16,00 | 16,00 | 16,00 | 16,00 | 16,00 | 16,00 |
| steel | 22,00 | 22,00 | 22,00 | 22,00 | 22,00 | 22,00 | 22,00 |
| bread | 11,00 | 11,00 | 11,00 | 11,00 | 11,00 | 11,00 | 11,00 |
| furniture | 68,00 | 68,00 | 68,00 | 68,00 | 68,00 | 68,00 | 68,00 |
| tools | 48,00 | 48,00 | 48,00 | 48,00 | 48,00 | 48,00 | 48,00 |
| **índice** | 1,00 | 0,970 | 0,959 | 0,965 | 0,945 | 0,953 | 0,960 |

**Por estrategia (final)**

| Estrategia | Jugadores | Patrimonio mediano | Payback mediano |
| --- | --- | --- | --- |
| farmer | 2949 | ₣182.795 | 13,5 h |
| chain | 2215 | ₣255.902 | 27,0 h |
| optimizer | 1491 | ₣150.518 | 24,8 h |
| casual | 2033 | ₣76.884 | 26,3 h |
| trader | 514 | ₣82.303 | 110,0 h |
| idle | 798 | ₣11.671 | 34,2 h |

## Escenario: con tramposos

Tiempo de cómputo: 188,2 s

| Criterio | Resultado | Detalle |
| --- | --- | --- |
| Índice de precios dentro de ±15 % en 30 días | ✅ | desvío máx. 8,3 % (90 días: 8,3 %) |
| Ningún bucle de arbitraje > 2 % diario | ✅ | arbitraje -20,061 % · lavado de precios 0,242 % diario |
| Jugador nuevo con buena estrategia recupera la 1.ª inversión en < 24 h | ✅ | mejor estrategia: farmer 12,6 h (100 % < 24 h) · chain 26,3 h · optimizer 20,0 h · casual 23,6 h · trader 68,3 h |
| Top 1 % ≤ 20 × mediana al día 30 | ✅ | 5,7 × |
| Cero creación de dinero por redondeo o duplicación | ✅ | desvío contable: 0 centavos |

**Flujo de francos (acumulado)**

| Fuente / sumidero | Total |
| --- | --- |
| Capital inicial | ₣101.500.000 |
| Compras de bots (+) | ₣2.950.886 |
| Compras del Estado (+) | ₣2.100.348.660 |
| Ventas de bots (−) | ₣846.188 |
| Ventas del Estado (−) | ₣174.101.283 |
| Comisiones (−) | ₣74.396.428 |
| Mantenimiento (−) | ₣178.331.922 |
| Lotes (−) | ₣113.639.000 |
| Construcción y mejoras (−) | ₣943.646.325 |
| **Masa monetaria final** | ₣719.838.400 |

Volumen: humano-humano ₣377.022.831 · contra bots ₣3.797.074 · contra Estado ₣2.274.449.943 · jugadores honestos activos al final: 3.720

**Precio de referencia por producto (₣)**

| Producto | Base | Día 1 | Día 7 | Día 14 | Día 30 | Día 60 | Día 90 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| wheat | 4,00 | 3,60 | 3,41 | 3,41 | 3,40 | 3,40 | 3,40 |
| wood | 5,00 | 4,50 | 4,69 | 4,92 | 4,71 | 4,39 | 4,25 |
| ore | 6,00 | 5,40 | 6,05 | 6,27 | 6,26 | 6,27 | 6,28 |
| energy | 3,00 | 2,70 | 2,56 | 2,58 | 2,55 | 2,55 | 2,55 |
| flour | 14,00 | 15,40 | 14,48 | 12,17 | 12,01 | 12,22 | 12,38 |
| planks | 16,00 | 16,00 | 14,62 | 14,29 | 14,40 | 14,90 | 14,52 |
| steel | 22,00 | 22,00 | 20,55 | 20,03 | 19,58 | 19,80 | 19,80 |
| bread | 11,00 | 10,78 | 9,95 | 10,14 | 10,20 | 10,12 | 10,14 |
| furniture | 68,00 | 68,00 | 68,00 | 68,00 | 68,00 | 68,00 | 68,00 |
| tools | 48,00 | 48,00 | 48,00 | 48,00 | 48,00 | 48,00 | 48,00 |
| **índice** | 1,00 | 0,968 | 0,944 | 0,934 | 0,926 | 0,925 | 0,921 |

**Por estrategia (final)**

| Estrategia | Jugadores | Patrimonio mediano | Payback mediano |
| --- | --- | --- | --- |
| farmer | 3047 | ₣157.996 | 13,4 h |
| chain | 2138 | ₣257.929 | 26,7 h |
| optimizer | 1497 | ₣173.791 | 24,5 h |
| casual | 2016 | ₣88.692 | 26,5 h |
| trader | 533 | ₣87.305 | 98,2 h |
| idle | 769 | ₣11.622 | 34,6 h |

## Escenario: con tramposos, ref ingenua (control: muestra el exploit sin las defensas)

Tiempo de cómputo: 154,8 s

| Criterio | Resultado | Detalle |
| --- | --- | --- |
| Índice de precios dentro de ±15 % en 30 días | ❌ | desvío máx. 57,8 % (90 días: 68,9 %) |
| Ningún bucle de arbitraje > 2 % diario | ✅ | arbitraje -6,175 % · lavado de precios 0,026 % diario |
| Jugador nuevo con buena estrategia recupera la 1.ª inversión en < 24 h | ✅ | mejor estrategia: optimizer 9,0 h (96 % < 24 h) · farmer 12,6 h · chain 16,5 h · casual 24,2 h · trader 17,7 h |
| Top 1 % ≤ 20 × mediana al día 30 | ✅ | 5,7 × |
| Cero creación de dinero por redondeo o duplicación | ✅ | desvío contable: 0 centavos |

**Flujo de francos (acumulado)**

| Fuente / sumidero | Total |
| --- | --- |
| Capital inicial | ₣101.500.000 |
| Compras de bots (+) | ₣1.131.892 |
| Compras del Estado (+) | ₣2.795.706.066 |
| Ventas de bots (−) | ₣453.511 |
| Ventas del Estado (−) | ₣291.461 |
| Comisiones (−) | ₣93.100.884 |
| Mantenimiento (−) | ₣212.367.255 |
| Lotes (−) | ₣117.775.500 |
| Construcción y mejoras (−) | ₣1.051.913.904 |
| **Masa monetaria final** | ₣1.422.435.443 |

Volumen: humano-humano ₣307.390.993 · contra bots ₣1.585.404 · contra Estado ₣2.795.997.527 · jugadores honestos activos al final: 3.784

**Precio de referencia por producto (₣)**

| Producto | Base | Día 1 | Día 7 | Día 14 | Día 30 | Día 60 | Día 90 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| wheat | 4,00 | 2,71 | 1,42 | 1,64 | 1,31 | 2,83 | 2,95 |
| wood | 5,00 | 4,01 | 1,45 | 2,44 | 1,60 | 0,05 | 0,05 |
| ore | 6,00 | 4,74 | 2,99 | 5,58 | 0,30 | 1,02 | 4,65 |
| energy | 3,00 | 1,89 | 0,31 | 0,09 | 0,02 | 0,01 | 0,01 |
| flour | 14,00 | 21,34 | 6,38 | 1,93 | 1,37 | 0,26 | 0,31 |
| planks | 16,00 | 16,00 | 14,58 | 5,87 | 1,23 | 0,41 | 0,67 |
| steel | 22,00 | 22,00 | 20,52 | 18,79 | 16,42 | 0,68 | 1,26 |
| bread | 11,00 | 10,78 | 6,23 | 6,44 | 7,31 | 7,44 | 7,59 |
| furniture | 68,00 | 68,00 | 68,00 | 62,13 | 63,00 | 63,63 | 66,28 |
| tools | 48,00 | 48,00 | 48,00 | 48,00 | 48,00 | 48,00 | 48,00 |
| **índice** | 1,00 | 0,940 | 0,611 | 0,572 | 0,422 | 0,358 | 0,431 |

**Por estrategia (final)**

| Estrategia | Jugadores | Patrimonio mediano | Payback mediano |
| --- | --- | --- | --- |
| farmer | 2965 | ₣189.348 | 13,8 h |
| chain | 2214 | ₣339.420 | 18,8 h |
| optimizer | 1504 | ₣384.786 | 12,7 h |
| casual | 2057 | ₣75.882 | 26,6 h |
| trader | 492 | ₣62.957 | 36,1 h |
| idle | 768 | ₣11.348 | 34,8 h |

## Veredicto de la compuerta de la fase 2: ✅ APROBADA
