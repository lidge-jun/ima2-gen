import { resolve } from "node:path";

export type ElementKind = "character" | "product" | "style" | "scene";
export type ElementProvider = "gpt" | "gemini" | "grok";
export type ElementMode = "image" | "edit" | "video";

export interface ElementDefinition {
  id: string;
  name: string;
  kind: ElementKind;
  refs: string[];
  notes?: string;
  defaultStrength?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ExistingReferenceInput {
  source: "composer" | "node" | "continuity";
  path: string;
  strength?: number;
}

export interface ElementReferenceSlot {
  elementId: string;
  elementName: string;
  kind: ElementKind;
  path: string;
  strength?: number;
  priority: number;
}

export interface ElementCapacity {
  maxTotalRefs: number;
  maxRefsPerElement: number;
}

export interface CompileElementsInput {
  elementIds: readonly string[];
  elements: ReadonlyMap<string, ElementDefinition>;
  existingRefs: readonly ExistingReferenceInput[];
  provider: ElementProvider;
  mode: ElementMode;
  capacity: ElementCapacity;
  missingPolicy?: "error" | "collect";
}

export interface CompileElementsOutput {
  elementIds: string[];
  notesFragment: string;
  referenceSlots: ElementReferenceSlot[];
  retainedExistingRefs: ExistingReferenceInput[];
  droppedRefs: Array<{ path: string; reason: string; elementId?: string }>;
  missingElementIds: string[];
}

export const ELEMENT_CAPACITY_DEFAULTS: Record<ElementProvider, Record<ElementMode, ElementCapacity>> = {
  gpt: { image: { maxTotalRefs: 6, maxRefsPerElement: 6 }, edit: { maxTotalRefs: 6, maxRefsPerElement: 6 }, video: { maxTotalRefs: 1, maxRefsPerElement: 6 } },
  gemini: { image: { maxTotalRefs: 6, maxRefsPerElement: 6 }, edit: { maxTotalRefs: 6, maxRefsPerElement: 6 }, video: { maxTotalRefs: 3, maxRefsPerElement: 6 } },
  grok: { image: { maxTotalRefs: 4, maxRefsPerElement: 4 }, edit: { maxTotalRefs: 4, maxRefsPerElement: 4 }, video: { maxTotalRefs: 1, maxRefsPerElement: 4 } },
};

const SOURCE_PRIORITY = { continuity: 0, node: 1, composer: 2, element: 3 } as const;
const MAX_ELEMENT_NOTES = 800;
const MAX_NOTES_FRAGMENT = 2400;

class ElementCompilerError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = new.target.name;
  }
}

export class UnknownElementIdError extends ElementCompilerError {
  readonly elementId: string;
  constructor(elementId: string) {
    super(`Unknown element ID: ${elementId}`, "UNKNOWN_ELEMENT_ID");
    this.elementId = elementId;
  }
}

export class ElementRefsEmptyError extends ElementCompilerError {
  readonly elementId: string;
  constructor(elementId: string) {
    super(`Element has no usable references: ${elementId}`, "ELEMENT_REFS_EMPTY");
    this.elementId = elementId;
  }
}

export class ElementNotesTooLongError extends ElementCompilerError {
  readonly elementId: string;
  constructor(elementId: string) {
    super(`Element notes exceed ${MAX_ELEMENT_NOTES} characters: ${elementId}`, "ELEMENT_NOTES_TOO_LONG");
    this.elementId = elementId;
  }
}

export class ReferenceCapacityExceededError extends ElementCompilerError {
  constructor() {
    super("No reference capacity remains for selected elements", "REFERENCE_CAPACITY_EXCEEDED");
  }
}

export function formatElementNote(element: ElementDefinition): string | null {
  const notes = element.notes?.trim();
  return notes ? `[Element: ${element.name}] ${notes}` : null;
}

function uniqueElementIds(ids: readonly string[]) {
  return [...new Set(ids)];
}

function canonicalPath(path: string) {
  return resolve(path.trim());
}

function sortedExistingRefs(refs: readonly ExistingReferenceInput[]) {
  return refs.map((ref, index) => ({ ref, index })).sort((a, b) =>
    SOURCE_PRIORITY[a.ref.source] - SOURCE_PRIORITY[b.ref.source] || a.index - b.index,
  );
}

function compileNotes(elements: readonly ElementDefinition[]) {
  const notes = elements.map((element) => {
    const note = formatElementNote(element);
    if (note && element.notes!.trim().length > MAX_ELEMENT_NOTES) throw new ElementNotesTooLongError(element.id);
    return note;
  }).filter((note): note is string => note !== null);
  const fragment = notes.join("\n");
  if (fragment.length > MAX_NOTES_FRAGMENT) throw new ElementNotesTooLongError("all-elements");
  return fragment;
}

function retainExistingRefs(input: CompileElementsInput, droppedRefs: CompileElementsOutput["droppedRefs"]) {
  const retained: ExistingReferenceInput[] = [];
  const paths = new Set<string>();
  for (const { ref } of sortedExistingRefs(input.existingRefs)) {
    if (!ref.path.trim()) {
      droppedRefs.push({ path: ref.path, reason: "empty_path" });
    } else if (paths.has(canonicalPath(ref.path))) {
      droppedRefs.push({ path: ref.path, reason: "duplicate_higher_priority_source" });
    } else if (retained.length >= input.capacity.maxTotalRefs) {
      droppedRefs.push({ path: ref.path, reason: "reference_capacity_exceeded" });
    } else {
      paths.add(canonicalPath(ref.path));
      retained.push({ ...ref, path: canonicalPath(ref.path) });
    }
  }
  return { retained, paths };
}

function appendElementSlots(
  elements: readonly ElementDefinition[],
  input: CompileElementsInput,
  paths: Set<string>,
  retainedExistingRefs: ExistingReferenceInput[],
  droppedRefs: CompileElementsOutput["droppedRefs"],
) {
  const slots: ElementReferenceSlot[] = [];
  for (const [elementIndex, element] of elements.entries()) {
    const refs = element.refs.slice(0, 6).filter((path) => path.trim());
    if (!refs.length) throw new ElementRefsEmptyError(element.id);
    for (const path of refs.slice(0, input.capacity.maxRefsPerElement)) {
      const canonical = canonicalPath(path);
      if (paths.has(canonical)) {
        droppedRefs.push({ path, reason: "duplicate_higher_priority_source", elementId: element.id });
      } else if (retainedExistingRefs.length + slots.length >= input.capacity.maxTotalRefs) {
        droppedRefs.push({ path, reason: "reference_capacity_exceeded", elementId: element.id });
      } else {
        paths.add(canonical);
        // Keep the raw (possibly generated-dir-relative) path — the caller
        // resolves it against its own generated dir. Absolutizing here against
        // process.cwd() silently broke every relative ref (070 QA refsCount:0).
        slots.push({ elementId: element.id, elementName: element.name, kind: element.kind, path: path.trim(), strength: element.defaultStrength, priority: elementIndex });
      }
    }
  }
  return slots;
}

export function compileElements(input: CompileElementsInput): CompileElementsOutput {
  const elementIds = uniqueElementIds(input.elementIds);
  const missingElementIds = elementIds.filter((id) => !input.elements.has(id));
  const missingId = missingElementIds[0];
  if (missingId && input.missingPolicy !== "collect") throw new UnknownElementIdError(missingId);
  const elements = elementIds.flatMap((id) => {
    const element = input.elements.get(id);
    return element ? [element] : [];
  });
  const droppedRefs: CompileElementsOutput["droppedRefs"] = [];
  const { retained, paths } = retainExistingRefs(input, droppedRefs);
  const referenceSlots = appendElementSlots(elements, input, paths, retained, droppedRefs);
  if (elements.length && !referenceSlots.length && retained.length >= input.capacity.maxTotalRefs) {
    throw new ReferenceCapacityExceededError();
  }
  return { elementIds, notesFragment: compileNotes(elements), referenceSlots, retainedExistingRefs: retained, droppedRefs, missingElementIds };
}
