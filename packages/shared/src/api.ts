// Contrato HTTP entre cliente y servidor.
import type { BuildingId, ProductId } from './data';
import type { Inventory, LevelKind, Side } from './engine';

export interface CompanyView {
  id: number;
  name: string;
  color: number;
  district: number;
  cash: number;
  inv: Inventory;
  capacity: number;
  /** lotes gratuitos que quedan por reclamar */
  freeClaims: number;
  createdAt: number;
}

export interface LotView {
  lot: number;
  building: BuildingId | null;
  level: number;
  mode: number;
  lastAt: number;
  bonus: number;
  /** unidades listas para cobrar (estimación sin mirar insumos) */
  pending: number;
}

export interface OrderView {
  id: number;
  product: ProductId;
  side: Side;
  price: number;
  qty: number;
  filled: number;
  createdAt: number;
}

export interface MeResponse {
  now: number;
  company: CompanyView;
  lots: LotView[];
  orders: OrderView[];
}

export interface ProductSummary {
  id: ProductId;
  ref: number;
  bid: number | null;
  ask: number | null;
  /** cambio de ref contra el día anterior, en puntos básicos */
  changeBp: number;
}

export interface MarketSummary {
  now: number;
  products: ProductSummary[];
  /** 0 normal, 1 ahorro (80 % de cuota), 2 solo lectura (100 %) */
  saving: number;
}

export interface BookLevel { price: number; qty: number; kind: LevelKind }

export interface MarketDetail {
  now: number;
  product: ProductId;
  ref: number;
  bids: BookLevel[];
  asks: BookLevel[];
  trades: { price: number; qty: number; at: number }[];
  /** precio de referencia de cierre por día (últimos 7) */
  history: { day: number; ref: number }[];
}

export interface MapCompany { id: number; name: string; color: number; district: number }

export interface MapSnapshot {
  at: number;
  /** tuplas planas: [lote, idCompañía, índiceEdificio(-1 vacío), nivel, ...] */
  lots: number[];
  companies: MapCompany[];
  /** jugadores humanos reales */
  players: number;
}

export interface StartRequest { name: string; district: number; color: number; lang: string; ref?: string }
export interface StartResponse { token: string; me: MeResponse }

export interface OrderRequest { product: ProductId; side: Side; price: number; qty: number }
export interface OrderResponse { me: MeResponse; filled: number; avgPrice: number | null }

export interface CollectResponse {
  me: MeResponse;
  produced: Inventory;
  blocked: { lot: number; reason: 'full' | 'inputs' }[];
}

export type ErrorCode =
  | 'bad_request' | 'unauthorized' | 'not_found' | 'rate_limited' | 'read_only'
  | 'name_invalid' | 'name_taken' | 'district_invalid' | 'already_started'
  | 'lot_taken' | 'lot_state' | 'lot_not_owned' | 'lot_limit' | 'lot_district'
  | 'no_cash' | 'no_stock' | 'building_invalid' | 'lot_busy' | 'max_level'
  | 'order_limit' | 'order_invalid' | 'storage_full';

export interface ErrorResponse { error: ErrorCode }
