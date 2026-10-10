// Paleta "puerto de noche" (espejo de las variables CSS en style.css).
export const C = {
  noche: '#0E1B2E',
  casco: '#16283F',
  muelle: '#1F3652',
  crema: '#F4EBD9',
  niebla: '#A9B7C6',
  franco: '#F2A93B',
  rio: '#3FC1C9',
  cosecha: '#5FD38D',
  teja: '#E4572E',
  ultramar: '#8E6BD8',
  ladrillo: '#C96F4A',
  arena: '#E8D3A2',
  // derivados para el dibujo (sombras y matices sin degradados)
  sombra: '#08111E',
  arenaOscura: '#CDB582',
  aguaOscura: '#14304A',
  madera: '#8A5A3B',
  piedra: '#6B7A8F',
} as const;

/** colores elegibles para las empresas (todos con buen contraste sobre noche y arena) */
export const COMPANY_COLORS = [0xf2a93b, 0x3fc1c9, 0x5fd38d, 0xe4572e, 0xa58ae8, 0xf4ebd9, 0xff7eb6, 0x4f8cff];

export const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
