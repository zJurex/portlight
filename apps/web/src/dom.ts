// Helpers mínimos de DOM (sin framework). Todo texto entra como textContent, nunca como HTML.
type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; on?: Record<string, (e: Event) => void> };

export const h = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'on') for (const [ev, fn] of Object.entries(v as Record<string, (e: Event) => void>)) el.addEventListener(ev, fn);
    else if (k === 'class') el.className = v as string;
    else if (k === 'style') el.setAttribute('style', v as string);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v !== undefined && v !== null) {
      if (k in el && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, String(v));
    }
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
};

export const clear = (el: Element) => { while (el.firstChild) el.firstChild.remove(); return el; };
export const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T;
