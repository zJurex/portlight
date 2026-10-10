// Íconos pixel art 12×12 en SVG (rectángulos), heredan el color del texto.
const P: Record<string, string> = {
  map: '0,2,4,8 4,1,4,9 8,2,4,8 1,3,2,1 5,4,2,1 9,5,2,1',
  company: '1,4,10,7 2,1,3,3 7,2,3,2 3,6,2,2 7,6,2,2 5,9,2,2',
  market: '1,8,2,3 4,5,2,6 7,6,2,5 10,2,2,9 0,11,12,1',
  event: '5,0,2,2 2,2,8,1 1,3,10,5 3,8,6,1 4,9,4,1 5,10,2,2',
  ranking: '0,6,3,6 4,2,4,10 9,4,3,8 5,0,2,1',
  gear: '5,0,2,2 5,10,2,2 0,5,2,2 10,5,2,2 2,2,8,8',
  plus: '5,1,2,10 1,5,10,2',
  minus: '1,5,10,2',
  home: '5,0,2,1 3,1,6,2 1,3,10,2 2,5,8,7',
  close: '1,1,2,2 3,3,2,2 5,5,2,2 7,7,2,2 9,9,2,2 9,1,2,2 7,3,2,2 3,7,2,2 1,9,2,2',
  up: '5,2,2,2 3,4,6,2 1,6,10,2',
  down: '1,4,10,2 3,6,6,2 5,8,2,2',
  coin: '3,0,6,1 1,1,10,10 3,11,6,1 5,3,2,6',
  back: '1,5,2,2 3,3,2,2 3,7,2,2 5,1,2,2 5,9,2,2 3,5,8,2',
};

export const icon = (name: keyof typeof P | string, size = 18) => {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('shape-rendering', 'crispEdges');
  for (const r of (P[name] ?? '').split(' ')) {
    const [x, y, w, h] = r.split(',');
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', x); rect.setAttribute('y', y); rect.setAttribute('width', w); rect.setAttribute('height', h);
    rect.setAttribute('fill', 'currentColor');
    svg.append(rect);
  }
  if (name === 'gear') {
    const hole = document.createElementNS(ns, 'rect');
    hole.setAttribute('x', '5'); hole.setAttribute('y', '5'); hole.setAttribute('width', '2'); hole.setAttribute('height', '2');
    hole.setAttribute('fill', 'var(--casco)');
    svg.append(hole);
  }
  return svg;
};
