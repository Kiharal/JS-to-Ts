/* ===== TYPED DOM ACCESS =====
   Every element lookup goes through these helpers instead of document.getElementById().
   - byId('entryDate')   -> HTMLInputElement   (id known at compile time; type comes from the generated ElementMap)
   - byId(someString)    -> HTMLElement        (id only known at run time)
   Both throw a descriptive error when the element is missing - the same failure the old code hit as a
   "cannot read properties of null" TypeError - so a typo or a removed element is never silently ignored.
   Use byIdOrNull() only where the code genuinely tolerates a missing element. */
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
