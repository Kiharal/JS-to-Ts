type ElementId = keyof ElementMap;

function byId<K extends ElementId>(id: K): ElementMap[K];
function byId(id: string): HTMLElement;
function byId(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Element #${id} not found`);
  return found;
}

function byIdOrNull<K extends ElementId>(id: K): ElementMap[K] | null;
function byIdOrNull(id: string): HTMLElement | null;
function byIdOrNull(id: string): HTMLElement | null {
  return document.getElementById(id);
}

/** Run-time checked lookup for ids built dynamically (e.g. 'guRevAttachList_' + id): throws if absent OR of the wrong kind. */
function byIdAs<T extends HTMLElement>(id: string, type: new () => T): T {
  const found = byId(id);
  if (!(found instanceof type)) throw new Error(`Element #${id} is not a ${type.name}`);
  return found;
}
