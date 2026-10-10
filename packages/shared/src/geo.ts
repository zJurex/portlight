// Mapa estilizado: cada país es un bloque de distritos en una cuadrícula (cartograma).
// Cada distrito es un cuadrado de LOTS_SIDE × LOTS_SIDE lotes: periferia gratis, centro = puerto caro.
// Los nombres de países se localizan con Intl.DisplayNames; los distritos son nombres propios
// (las regiones de "Resto del mundo" se localizan desde el catálogo con la clave region.<id>).

export const LOTS_SIDE = 8;
export const LOTS_PER_DISTRICT = LOTS_SIDE * LOTS_SIDE;
/** separación entre distritos, en lotes */
export const DISTRICT_GAP = 1;
export const CELL = LOTS_SIDE + DISTRICT_GAP;

interface CountryDef {
  /** ISO 3166-1 alfa-2, o 'XW' para Resto del mundo */
  code: string;
  /** posición y ancho del bloque en unidades de distrito */
  x: number;
  y: number;
  w: number;
  districts: string[];
}

const COUNTRY_DEFS: CountryDef[] = [
  { code: 'MX', x: 0, y: 0, w: 8, districts: ['Baja California', 'Sonora', 'Chihuahua', 'Coahuila', 'Nuevo León', 'Tamaulipas', 'Durango', 'Sinaloa', 'Baja California Sur', 'Nayarit', 'Zacatecas', 'San Luis Potosí', 'Aguascalientes', 'Jalisco', 'Guanajuato', 'Querétaro', 'Colima', 'Michoacán', 'México', 'Hidalgo', 'Ciudad de México', 'Tlaxcala', 'Puebla', 'Veracruz', 'Guerrero', 'Morelos', 'Oaxaca', 'Tabasco', 'Chiapas', 'Campeche', 'Yucatán', 'Quintana Roo'] },
  { code: 'XW', x: 22, y: 0, w: 4, districts: ['region.north_america', 'region.europe', 'region.middle_east', 'region.asia', 'region.central_america', 'region.caribbean', 'region.africa', 'region.oceania'] },
  { code: 'VE', x: 15, y: 4, w: 5, districts: ['Zulia', 'Falcón', 'Lara', 'Yaracuy', 'Carabobo', 'Táchira', 'Trujillo', 'Portuguesa', 'Cojedes', 'Aragua', 'Mérida', 'Barinas', 'Distrito Capital', 'La Guaira', 'Miranda', 'Apure', 'Guárico', 'Anzoátegui', 'Nueva Esparta', 'Sucre', 'Dependencias Federales', 'Amazonas', 'Bolívar', 'Monagas', 'Delta Amacuro'] },
  { code: 'CO', x: 9, y: 5, w: 6, districts: ['San Andrés', 'La Guajira', 'Magdalena', 'Atlántico', 'Bolívar', 'Cesar', 'Córdoba', 'Sucre', 'Antioquia', 'Santander', 'Norte de Santander', 'Arauca', 'Chocó', 'Caldas', 'Risaralda', 'Boyacá', 'Casanare', 'Vichada', 'Valle del Cauca', 'Quindío', 'Tolima', 'Cundinamarca', 'Bogotá', 'Meta', 'Cauca', 'Huila', 'Guaviare', 'Guainía', 'Nariño', 'Putumayo', 'Caquetá', 'Vaupés', 'Amazonas'] },
  { code: 'EC', x: 5, y: 10, w: 4, districts: ['Galápagos', 'Esmeraldas', 'Carchi', 'Imbabura', 'Manabí', 'Santo Domingo de los Tsáchilas', 'Pichincha', 'Sucumbíos', 'Santa Elena', 'Los Ríos', 'Cotopaxi', 'Napo', 'Guayas', 'Bolívar', 'Tungurahua', 'Orellana', 'El Oro', 'Chimborazo', 'Pastaza', 'Cañar', 'Loja', 'Azuay', 'Morona Santiago', 'Zamora Chinchipe'] },
  { code: 'BR', x: 16, y: 11, w: 6, districts: ['Roraima', 'Amapá', 'Amazonas', 'Pará', 'Maranhão', 'Ceará', 'Acre', 'Rondônia', 'Tocantins', 'Piauí', 'Rio Grande do Norte', 'Paraíba', 'Mato Grosso', 'Goiás', 'Distrito Federal', 'Bahia', 'Pernambuco', 'Alagoas', 'Mato Grosso do Sul', 'Minas Gerais', 'Espírito Santo', 'Rio de Janeiro', 'Sergipe', 'São Paulo', 'Paraná', 'Santa Catarina', 'Rio Grande do Sul'] },
  { code: 'PE', x: 6, y: 16, w: 6, districts: ['Tumbes', 'Piura', 'Lambayeque', 'Cajamarca', 'Amazonas', 'Loreto', 'La Libertad', 'San Martín', 'Áncash', 'Huánuco', 'Ucayali', 'Pasco', 'Lima', 'Lima Metropolitana', 'Callao', 'Junín', 'Huancavelica', 'Madre de Dios', 'Ica', 'Ayacucho', 'Apurímac', 'Cusco', 'Arequipa', 'Puno', 'Moquegua', 'Tacna'] },
  { code: 'BO', x: 12, y: 17, w: 3, districts: ['Pando', 'Beni', 'La Paz', 'Cochabamba', 'Santa Cruz', 'Oruro', 'Potosí', 'Chuquisaca', 'Tarija'] },
  { code: 'PY', x: 15, y: 17, w: 3, districts: ['Alto Paraguay', 'Boquerón', 'Concepción', 'Presidente Hayes', 'Amambay', 'San Pedro', 'Canindeyú', 'Asunción', 'Central', 'Cordillera', 'Caaguazú', 'Alto Paraná', 'Paraguarí', 'Guairá', 'Caazapá', 'Ñeembucú', 'Misiones', 'Itapúa'] },
  { code: 'AR', x: 12, y: 20, w: 3, districts: ['Jujuy', 'Salta', 'Formosa', 'Tucumán', 'Santiago del Estero', 'Chaco', 'Catamarca', 'La Rioja', 'Misiones', 'San Juan', 'Córdoba', 'Corrientes', 'Mendoza', 'San Luis', 'Santa Fe', 'Neuquén', 'La Pampa', 'Entre Ríos', 'Río Negro', 'CABA', 'Buenos Aires', 'Chubut', 'Santa Cruz', 'Tierra del Fuego'] },
  { code: 'CL', x: 10, y: 21, w: 2, districts: ['Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo', 'Valparaíso', 'Metropolitana', "O'Higgins", 'Maule', 'Ñuble', 'Biobío', 'Araucanía', 'Los Ríos', 'Los Lagos', 'Aysén', 'Magallanes'] },
  { code: 'UY', x: 15, y: 23, w: 4, districts: ['Artigas', 'Rivera', 'Salto', 'Tacuarembó', 'Paysandú', 'Cerro Largo', 'Río Negro', 'Durazno', 'Treinta y Tres', 'Soriano', 'Flores', 'Florida', 'Lavalleja', 'Rocha', 'Colonia', 'San José', 'Canelones', 'Maldonado', 'Montevideo'] },
];

export interface District {
  idx: number;
  country: string;
  /** nombre propio, o clave de catálogo si empieza con "region." */
  name: string;
  /** posición en unidades de distrito */
  dx: number;
  dy: number;
}

export interface Country {
  code: string;
  districts: number[];
}

export const DISTRICTS: District[] = [];
export const COUNTRIES: Country[] = [];

for (const c of COUNTRY_DEFS) {
  const country: Country = { code: c.code, districts: [] };
  c.districts.forEach((name, i) => {
    const d: District = { idx: DISTRICTS.length, country: c.code, name, dx: c.x + (i % c.w), dy: c.y + Math.floor(i / c.w) };
    DISTRICTS.push(d);
    country.districts.push(d.idx);
  });
  COUNTRIES.push(country);
}

export const WORLD_W = Math.max(...DISTRICTS.map((d) => d.dx + 1)) * CELL;
export const WORLD_H = Math.max(...DISTRICTS.map((d) => d.dy + 1)) * CELL;
export const TOTAL_LOTS = DISTRICTS.length * LOTS_PER_DISTRICT;

export const lotDistrict = (lot: number) => Math.floor(lot / LOTS_PER_DISTRICT);
export const lotLocal = (lot: number) => {
  const i = lot % LOTS_PER_DISTRICT;
  return { lx: i % LOTS_SIDE, ly: Math.floor(i / LOTS_SIDE) };
};
/** anillo del lote: 0 periferia … 3 centro (puerto) */
export const lotRing = (lot: number) => {
  const { lx, ly } = lotLocal(lot);
  return Math.min(lx, ly, LOTS_SIDE - 1 - lx, LOTS_SIDE - 1 - ly);
};
/** posición del lote en el mundo, en unidades de lote */
export const lotWorld = (lot: number) => {
  const d = DISTRICTS[lotDistrict(lot)];
  const { lx, ly } = lotLocal(lot);
  return { x: d.dx * CELL + lx, y: d.dy * CELL + ly };
};
export const lotAt = (district: number, lx: number, ly: number) => district * LOTS_PER_DISTRICT + ly * LOTS_SIDE + lx;

/** lotes vecinos (4 direcciones) dentro del mismo distrito */
export const lotNeighbors = (lot: number) => {
  const d = lotDistrict(lot);
  const { lx, ly } = lotLocal(lot);
  const out: number[] = [];
  for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = lx + ax, ny = ly + ay;
    if (nx >= 0 && ny >= 0 && nx < LOTS_SIDE && ny < LOTS_SIDE) out.push(lotAt(d, nx, ny));
  }
  return out;
};

/** distrito en una posición del mundo (en lotes), o -1 */
const DISTRICT_GRID = new Map<string, number>(DISTRICTS.map((d) => [`${d.dx},${d.dy}`, d.idx]));
export const lotAtWorld = (x: number, y: number) => {
  if (x < 0 || y < 0) return -1;
  const dx = Math.floor(x / CELL), dy = Math.floor(y / CELL);
  const lx = x % CELL, ly = y % CELL;
  if (lx >= LOTS_SIDE || ly >= LOTS_SIDE) return -1;
  const d = DISTRICT_GRID.get(`${dx},${dy}`);
  return d === undefined ? -1 : lotAt(d, lx, ly);
};

// Empresas del Estado: lotes fijos y determinísticos en el anillo 1 de cada distrito.
const STATE_BUILDINGS = ['farm', 'sawmill', 'mine', 'power'] as const;
const STATE_SLOTS: [number, number][] = [[1, 1], [6, 1], [1, 6], [6, 6]];
export const stateLots = (district: number) => {
  // 2 lotes por distrito, elegidos con un hash simple del índice
  const a = (district * 7) % 4, b = (a + 1 + (district % 3)) % 4;
  return [a, b].map((s, k) => ({
    lot: lotAt(district, STATE_SLOTS[s][0], STATE_SLOTS[s][1]),
    building: STATE_BUILDINGS[(district + k * 2) % 4],
    level: 1 + ((district + k) % 3),
  }));
};
const STATE_LOT_SET = new Set(DISTRICTS.flatMap((d) => stateLots(d.idx).map((s) => s.lot)));
export const isStateLot = (lot: number) => STATE_LOT_SET.has(lot);
