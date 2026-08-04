// Issue #119: a portaled Select closed as soon as the user scrolled its own
// option list, because the capture-phase `scroll` listener on `window` also
// receives scrolls raised inside the portaled list.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { shouldDismissOnScroll } from "../ui/src/lib/portalDismiss.ts";

type FakeNode = { nodeType: number };

const makeMenu = (owned: FakeNode[]) => ({
  contains: (node: Node) => owned.includes(node as unknown as FakeNode),
});

const scrollFrom = (target: unknown) => ({ target }) as Pick<Event, "target">;

test("scroll raised inside the portaled list keeps the menu open", () => {
  const inner: FakeNode = { nodeType: 1 };
  assert.equal(shouldDismissOnScroll(scrollFrom(inner), makeMenu([inner])), false);
});

test("scroll raised on a descendant of the list also keeps the menu open", () => {
  // `contains()` is true for descendants, so an option row scrolling its own
  // container must not dismiss either.
  const list: FakeNode = { nodeType: 1 };
  const option: FakeNode = { nodeType: 1 };
  const menu = makeMenu([list, option]);
  assert.equal(shouldDismissOnScroll(scrollFrom(option), menu), false);
});

test("scroll raised outside the menu still dismisses it", () => {
  const outside: FakeNode = { nodeType: 1 };
  assert.equal(shouldDismissOnScroll(scrollFrom(outside), makeMenu([{ nodeType: 1 }])), true);
});

test("document-level scroll dismisses the menu", () => {
  const documentLike: FakeNode = { nodeType: 9 };
  assert.equal(shouldDismissOnScroll(scrollFrom(documentLike), makeMenu([{ nodeType: 1 }])), true);
});

test("a window target without nodeType dismisses instead of throwing", () => {
  const windowLike = { innerWidth: 1280 };
  const menu = {
    contains: () => {
      throw new Error("contains() must not be called for non-Node targets");
    },
  };
  assert.equal(shouldDismissOnScroll(scrollFrom(windowLike), menu), true);
});

test("a missing menu ref or missing event falls back to dismissing", () => {
  assert.equal(shouldDismissOnScroll(undefined, null), true);
  assert.equal(shouldDismissOnScroll(scrollFrom({ nodeType: 1 }), null), true);
  assert.equal(shouldDismissOnScroll(scrollFrom(null), makeMenu([{ nodeType: 1 }])), true);
});

// Wiring: the guard existing is not enough — the portaled Select must actually
// register the guarded handler on the capture phase and clean it up.
const select = readFileSync("ui/src/components/controls/Select.tsx", "utf8");

test("the portaled Select registers the guarded scroll handler", () => {
  assert.match(select, /import \{ shouldDismissOnScroll \} from "\.\.\/\.\.\/lib\/portalDismiss"/);
  assert.match(select, /shouldDismissOnScroll\(event, listRef\.current\)/);
  assert.match(select, /window\.addEventListener\("scroll", closeOnScroll, true\)/);
  assert.match(select, /window\.removeEventListener\("scroll", closeOnScroll, true\)/);
  // The unguarded handler must not come back.
  assert.doesNotMatch(select, /window\.addEventListener\("scroll", close, true\)/);
  // resize keeps dismissing unconditionally: it always invalidates the position.
  assert.match(select, /window\.addEventListener\("resize", close\)/);
});
