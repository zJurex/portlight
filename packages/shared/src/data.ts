// Reglas y datos del juego. Identificadores neutros: los textos salen de los catálogos i18n.
// Dinero siempre en centavos de franco (enteros).

export const PRODUCTS = [
  'wheat', 'wood', 'ore', 'energy',
  'flour', 'planks', 'steel', 'bread',
  'furniture', 'tools',
] as const;
export type ProductId = (typeof PRODUCTS)[number];

export const BASE_VALUE: Record<ProductId, number> = {
  wheat: 400, wood: 500, ore: 600, energy: 300,
  flour: 1400, planks: 1600, steel: 2200, bread: 1100,
  furniture: 6800, tools: 4800,
};

export type Tier = 'raw' | 'mid' | 'final';
export const PRODUCT_TIER: Record<ProductId, Tier> = {
  wheat: 'raw', wood: 'raw', ore: 'raw', energy: 'raw',
  flour: 'mid', planks: 'mid', steel: 'mid', bread: 'final',
  furniture: 'final', tools: 'final',
};

export interface Recipe {
  out: ProductId;
  /** unidades producidas por corrida de la receta */
  outQty: number;
  inputs: Partial<Record<ProductId, number>>;
}

export const BUILDING_IDS = [
  'farm', 'sawmill', 'mine', 'power',
  'mill', 'carpentry', 'foundry', 'bakery', 'workshop',
  'warehouse', 'shop', 'port',
] as const;
export type BuildingId = (typeof BUILDING_IDS)[number];

export interface BuildingDef {
  cost: number; // centavos
  /** unidades de producto por hora a nivel 1 */
  rate: number;
  recipes: Recipe[];
  /** disponible para construir en esta versión */
  enabled: boolean;
}

const raw = (out: ProductId): Recipe => ({ out, outQty: 1, inputs: {} });

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  farm: { cost: 80_000, rate: 12, recipes: [raw('wheat')], enabled: true },
  sawmill: { cost: 90_000, rate: 10, recipes: [raw('wood')], enabled: true },
  mine: { cost: 120_000, rate: 8, recipes: [raw('ore')], enabled: true },
  power: { cost: 100_000, rate: 20, recipes: [raw('energy')], enabled: true },
  mill: { cost: 150_000, rate: 6, recipes: [{ out: 'flour', outQty: 1, inputs: { wheat: 2, energy: 1 } }], enabled: true },
  carpentry: { cost: 160_000, rate: 5, recipes: [{ out: 'planks', outQty: 1, inputs: { wood: 2, energy: 1 } }], enabled: true },
  foundry: { cost: 220_000, rate: 4, recipes: [{ out: 'steel', outQty: 1, inputs: { ore: 2, energy: 2 } }], enabled: true },
  bakery: { cost: 180_000, rate: 8, recipes: [{ out: 'bread', outQty: 2, inputs: { flour: 1, energy: 1 } }], enabled: true },
  workshop: {
    cost: 300_000, rate: 2,
    recipes: [
      { out: 'furniture', outQty: 1, inputs: { planks: 2, steel: 1 } },
      { out: 'tools', outQty: 1, inputs: { steel: 1, planks: 1 } },
    ],
    enabled: true,
  },
  warehouse: { cost: 70_000, rate: 0, recipes: [], enabled: true },
  shop: { cost: 200_000, rate: 0, recipes: [], enabled: false },
  port: { cost: 250_000, rate: 0, recipes: [], enabled: false },
};

/** multiplicador de producción por nivel, en milésimas */
export const LEVEL_MULT_MILLI = [1000, 1400, 1900, 2500, 3200];
export const MAX_LEVEL = 5;

/** Vecinos complementarios: edificio -> edificios que lo potencian si están en un lote adyacente */
export const COMPLEMENTS: Partial<Record<BuildingId, BuildingId[]>> = {
  mill: ['farm', 'power'],
  carpentry: ['sawmill', 'power'],
  foundry: ['mine', 'power'],
  bakery: ['mill', 'power'],
  workshop: ['carpentry', 'foundry'],
};
export const NEIGHBOR_BONUS_PCT = 5;
export const NEIGHBOR_BONUS_CAP_PCT = 10;

export const ECON = {
  startCash: 1_000_000, // ₣10.000
  freeLots: 4,
  maxLots: 12,
  maxOfflineMs: 24 * 3600_000,
  baseStorage: 1_000,
  warehouseStorage: 1_500, // por nivel 1, escala con el multiplicador
  marketFeeBp: 300, // 3 %
  maintenanceBpPerDay: 50, // 0,5 % diario del valor invertido
  maxOpenOrders: 10,
  newAccountTransferCap: 200_000, // ₣2.000 en las primeras 48 h (fase 3: contratos)
  /** precio de lote por anillo: 0 periferia … 3 centro (puerto) */
  lotPrice: [50_000, 150_000, 400_000, 1_000_000],
  refWindowMs: 48 * 3600_000,
  refHalfWeightTrades: 20,
  stateBuyBp: 8500,
  /** 'base': piso/techo del Estado fijos sobre el valor base · 'ref': relativos a ref (espiral) */
  stateAnchor: 'base' as 'base' | 'ref',
  stateSellBp: 11500,
  /** cupo diario del Estado por distrito y producto, según el nivel del producto */
  stateDailyQty: { raw: 200, mid: 80, final: 20 } as Record<Tier, number>,
  /** el cupo crece con cada jugador activo del distrito (demanda pública) */
  stateDailyQtyPerActive: { raw: 250, mid: 80, final: 30 } as Record<Tier, number>,
  /** la ref no se mueve más de ±10 % por día respecto del cierre anterior */
  refDailyMoveBp: 1000,
  /** banda de precios de una orden: 0,5 a 2 × ref */
  orderMinBp: 5000,
  orderMaxBp: 20000,
  /** un par comprador-vendedor cuenta como una sola operación real en la ventana de ref */
  refOnePerPair: true,
  /** creadores de mercado: cantidad por ventana de renovación */
  botBucketMs: 15 * 60_000,
  botQty: { raw: 300, mid: 100, final: 30 } as Record<Tier, number>,
  botMinFactorBp: 1500,
  botRealOrdersForZero: 100,
  /** tope diario de compra de los bots, en ventanas de cantidad */
  botDailyBuckets: 24,
};

export const upgradeCost = (b: BuildingId, level: number) =>
  Math.round(BUILDINGS[b].cost * Math.pow(1.6, level));

/** valor invertido en un edificio de nivel `level` (para el mantenimiento) */
export const buildingValue = (b: BuildingId, level: number) => {
  let v = BUILDINGS[b].cost;
  for (let l = 1; l < level; l++) v += upgradeCost(b, l);
  return v;
};

export const storageCapacity = (warehouseLevels: number[]) =>
  ECON.baseStorage +
  warehouseLevels.reduce((s, l) => s + Math.floor((ECON.warehouseStorage * LEVEL_MULT_MILLI[l - 1]) / 1000), 0);
