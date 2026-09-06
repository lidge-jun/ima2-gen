import { expect, test, type Locator } from "@playwright/test";
import { checkpoint, preflightComposer, withComposer, type ComposerCase } from "./fixtures/composerComponentHarness";
import type { ComposerSurface } from "./fixtures/composerComponent";

const SURFACES: ComposerSurface[] = ["sidebar", "bottom", "home"];
const FIELDS = ["positive", "negative"] as const;
const MODIFIERS = ["Control", "Meta"] as const;
const SIGNALS = ["ref-only", "native-only", "fallback-only"] as const;
type Field = typeof FIELDS[number];
type Modifier = typeof MODIFIERS[number];
type Signal = typeof SIGNALS[number];

// Runs before Playwright's browser fixture is requested. Direct harness callers
// also undergo the same preflight; neither path permits a local override.
test.beforeAll(async ({}, info) => { await preflightComposer(info); });

function input(fixture: ComposerCase, surface: ComposerSurface, field: Field): Locator {
  const id = field === "negative" ? `negative-prompt-${surface === "home" ? "home" : "classic"}`
    : surface === "home" ? "home-prompt-input" : `positive-prompt-${surface}`;
  return fixture.page.locator(`#${id}`);
}

async function composition(field: Locator, type: "compositionstart" | "compositionend") {
  try {
    await field.evaluate((node, eventType) => {
      node.dispatchEvent(new CompositionEvent(eventType, { bubbles: true, data: "한" }));
    }, type);
    // Let Classic's compositionCommitRef microtask and React's update complete.
    await field.page().evaluate(async () => { await Promise.resolve(); });
  } catch (error) { throw new Error(`WP08 ${type} dispatch failed`, { cause: error }); }
}

async function syntheticEnter(field: Locator, modifier: Modifier | null,
  signal: { isComposing: boolean; keyCode: number }) {
  try {
    return await field.evaluate((node, { modifier, signal }) => {
      const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true,
        key: "Enter", code: "Enter", ctrlKey: modifier === "Control", metaKey: modifier === "Meta",
        isComposing: signal.isComposing });
      // keyCode is a readonly legacy field. Explicitly activate only the planned fallback.
      Object.defineProperty(event, "keyCode", { value: signal.keyCode });
      node.dispatchEvent(event);
      return { composing: event.isComposing, keyCode: event.keyCode, prevented: event.defaultPrevented };
    }, { modifier, signal });
  } catch (error) { throw new Error("WP08 synthetic Enter dispatch failed", { cause: error }); }
}

async function activateSignal(field: Locator, signal: Signal) {
  try {
    await field.focus();
    if (signal === "ref-only") await composition(field, "compositionstart");
    if (signal === "fallback-only") {
      await composition(field, "compositionstart");
      await composition(field, "compositionend");
    }
    return { isComposing: signal === "native-only", keyCode: signal === "fallback-only" ? 229 : 13 };
  } catch (error) { throw new Error(`WP08 ${signal} activation failed`, { cause: error }); }
}

for (const surface of SURFACES) for (const field of FIELDS) {
  for (const modifier of MODIFIERS) for (const signal of SIGNALS) {
    test(`${surface} ${field}: ${modifier}+Enter blocks ${signal} then submits once`, async ({ browser }, info) => {
      await withComposer(browser, info, { surface }, async (fixture) => {
        const textarea = input(fixture, surface, field);
        const flags = await activateSignal(textarea, signal);
        expect((await checkpoint(fixture, "composition-alone")).calls).toHaveLength(0);
        const dispatched = await syntheticEnter(textarea, modifier, flags);
        expect(dispatched).toEqual({ composing: flags.isComposing, keyCode: flags.keyCode, prevented: false });
        const during = await checkpoint(fixture, signal);
        expect(during.calls).toHaveLength(0);
        expect(during.keys.at(-1)).toMatchObject({ composing: flags.isComposing,
          keyCode: flags.keyCode, ctrl: modifier === "Control", meta: modifier === "Meta", calls: 0 });
        await composition(textarea, "compositionend");
        expect((await checkpoint(fixture, "compositionend-plus-microtask")).calls).toHaveLength(0);
        await textarea.press(`${modifier}+Enter`);
        const after = await checkpoint(fixture, "ordinary-chord-after-bubbling");
        expect(after.calls).toEqual([{ prompt: "A quiet Korean garden", negativePrompt: "unwanted blur", activeGenerations: 0 }]);
        expect(after.keys.at(-1)).toMatchObject({ prevented: true, calls: 1 });
        expect(after.selections).toEqual([]);
        expect(after.modes).toEqual(surface === "home" ? ["classic"] : []);
      });
    });
  }

  test(`${surface} ${field}: plain Enter preserves multiline and literal text`, async ({ browser }, info) => {
    await withComposer(browser, info, { surface }, async (fixture) => {
      const textarea = input(fixture, surface, field);
      await textarea.fill("ordinary text");
      await textarea.press("End");
      await textarea.press("Enter");
      await textarea.pressSequentially("@Cedar");
      await expect(textarea).toHaveValue("ordinary text\n@Cedar");
      if (field === "negative" || surface === "home") await expect(fixture.page.getByRole("listbox")).toHaveCount(0);
      const observation = await checkpoint(fixture, "plain-multiline");
      expect(observation.calls).toHaveLength(0);
      expect(observation.keys.find((key) => key.key === "Enter")).toMatchObject({ prevented: false, calls: 0 });
    });
  });
}

const POLICIES = [
  { name: "Home busy", surfaces: ["home"] as ComposerSurface[], busy: true, prompt: "valid", expected: 0 },
  { name: "Home blank", surfaces: ["home"] as ComposerSurface[], busy: false, prompt: "  ", expected: 0 },
  { name: "Classic missing element", surfaces: ["sidebar", "bottom"] as ComposerSurface[], missing: true, expected: 0 },
  { name: "Classic busy valid", surfaces: ["sidebar", "bottom"] as ComposerSurface[], busy: true, expected: 1 },
];
for (const policy of POLICIES) for (const surface of policy.surfaces) {
  for (const field of FIELDS) for (const modifier of MODIFIERS) {
    test(`${policy.name} ${surface} ${field}: ${modifier} submit policy`, async ({ browser }, info) => {
      await withComposer(browser, info, { surface, busy: policy.busy, prompt: policy.prompt }, async (fixture) => {
        if (policy.missing) {
          await fixture.page.evaluate(() => window.wp08!.makeMissingElement());
          const missing = await checkpoint(fixture, "public-catalog-retirement");
          expect(missing.missingElementIds).toEqual(["wp08-cedar"]);
          expect(missing.provider).toBe("nai");
        }
        await input(fixture, surface, field).press(`${modifier}+Enter`);
        const observation = await checkpoint(fixture, policy.name);
        expect(observation.calls).toHaveLength(policy.expected);
        expect(observation.modes).toEqual([]);
        if (policy.busy && policy.expected) expect(observation.calls[0].activeGenerations).toBe(1);
      });
    });
  }
}

async function openMentions(fixture: ComposerCase) {
  try {
    await fixture.page.evaluate(() => window.wp08!.enableReferenceLane());
    const textarea = input(fixture, "sidebar", "positive");
    await textarea.fill("@");
    await expect(fixture.page.getByRole("listbox")).toBeVisible();
    await expect(fixture.page.getByRole("option")).toHaveCount(2);
    await expect(textarea).toHaveAttribute("aria-expanded", "true");
    return textarea;
  } catch (error) { throw new Error("WP08 native mention activation failed", { cause: error }); }
}

test("native menu plain Enter selects exactly once without submitting", async ({ browser }, info) => {
  await withComposer(browser, info, { surface: "sidebar" }, async (fixture) => {
    const textarea = await openMentions(fixture);
    await textarea.press("Enter");
    await expect(textarea).toHaveValue("@Cedar ");
    await expect(fixture.page.getByRole("listbox")).toHaveCount(0);
    const observation = await checkpoint(fixture, "native-plain-enter");
    expect(observation.selections).toEqual(["wp08-cedar"]);
    expect(observation.calls).toHaveLength(0);
    expect(observation.tray).toHaveLength(1);
    expect(observation.keys.at(-1)).toMatchObject({ prevented: true, calls: 0 });
  });
});

for (const modifier of MODIFIERS) {
  test(`native menu ${modifier}+Enter bubbles to Classic once without selection`, async ({ browser }, info) => {
    await withComposer(browser, info, { surface: "sidebar" }, async (fixture) => {
      const textarea = await openMentions(fixture);
      await textarea.press(`${modifier}+Enter`);
      const observation = await checkpoint(fixture, "native-modified-enter");
      expect(observation.selections).toEqual([]); expect(observation.tray).toEqual([]);
      expect(observation.prompt).toBe("@");
      expect(observation.calls).toHaveLength(1); expect(observation.calls[0].prompt).toBe("@");
      expect(observation.keys.at(-1)).toMatchObject({ prevented: true, calls: 1 });
    });
  });
}

// Plain Enter here isolates the menu guard: a modified key could pass merely
// because modified Enter bypasses selection, even if the IME guard were missing.
for (const signal of ["native-only", "fallback-only"] as const) {
  for (const modifier of [null, ...MODIFIERS]) {
    test(`native menu ${modifier ?? "plain"} Enter preserves reopened query during ${signal}`, async ({ browser }, info) => {
      await withComposer(browser, info, { surface: "sidebar" }, async (fixture) => {
        const textarea = await openMentions(fixture);
        await composition(textarea, "compositionstart");
        await expect(fixture.page.getByRole("listbox")).toHaveCount(0);
        await composition(textarea, "compositionend");
        await expect(fixture.page.getByRole("listbox")).toBeVisible();
        expect((await checkpoint(fixture, "compositionend-reopened-query")).calls).toHaveLength(0);
        const flags = { isComposing: signal === "native-only", keyCode: signal === "fallback-only" ? 229 : 13 };
        const event = await syntheticEnter(textarea, modifier, flags);
        const observation = await checkpoint(fixture, "native-ime-after-reopen");
        expect(event.prevented).toBe(false); expect(observation.calls).toHaveLength(0);
        expect(observation.selections).toEqual([]); expect(observation.prompt).toBe("@");
        await expect(fixture.page.getByRole("listbox")).toBeVisible();
        await textarea.press("Enter");
        expect((await checkpoint(fixture, "ordinary-selection-after-ime")).selections).toEqual(["wp08-cedar"]);
      });
    });
  }
}

test("composition ref closes suggestions and ordinary Escape/arrows/Tab retain menu behavior", async ({ browser }, info) => {
  await withComposer(browser, info, { surface: "sidebar" }, async (fixture) => {
    const textarea = await openMentions(fixture);
    await composition(textarea, "compositionstart");
    await expect(fixture.page.getByRole("listbox")).toHaveCount(0);
    await syntheticEnter(textarea, null, { isComposing: false, keyCode: 13 });
    expect((await checkpoint(fixture, "ref-only-closed-menu")).selections).toEqual([]);
    await composition(textarea, "compositionend");
    await expect(fixture.page.getByRole("listbox")).toBeVisible();
    await textarea.press("Escape");
    await expect(fixture.page.getByRole("listbox")).toHaveCount(0);
    await expect(textarea).toBeFocused(); await expect(textarea).toHaveValue("@");
    await textarea.click(); // React Escape must retain sticky suppression after the native listener.
    await expect(fixture.page.getByRole("listbox")).toHaveCount(0);
    await textarea.fill(""); await openMentions(fixture);
    await textarea.press("ArrowDown");
    await expect(fixture.page.getByRole("option", { selected: true })).toContainText("Willow");
    await textarea.press("ArrowUp");
    await expect(fixture.page.getByRole("option", { selected: true })).toContainText("Cedar");
    await textarea.press("Tab");
    await expect(textarea).toHaveValue("@Cedar ");
    const observation = await checkpoint(fixture, "escape-arrows-tab");
    expect(observation.selections).toEqual(["wp08-cedar"]); expect(observation.calls).toHaveLength(0);
  });
});

async function mirrorMetrics(fixture: ComposerCase, tag: string) {
  try {
    return await fixture.page.evaluate((tag) => {
      const textarea = document.querySelector<HTMLTextAreaElement>("#positive-prompt-sidebar")!;
      const mirror = document.querySelector<HTMLElement>(".composer__prompt-mirror")!;
      const style = getComputedStyle(textarea), box = textarea.getBoundingClientRect();
      // Independent text-layout probe anchored to the textarea, never to the production mirror.
      const probe = document.createElement("div");
      for (const name of ["boxSizing", "width", "height", "border", "padding", "font", "letterSpacing",
        "lineHeight", "wordSpacing", "textIndent", "textTransform", "textAlign", "tabSize", "wordBreak"] as const) {
        probe.style[name] = style[name];
      }
      Object.assign(probe.style, { position: "fixed", left: `${box.left}px`, top: `${box.top}px`,
        whiteSpace: "pre-wrap", overflowWrap: "break-word", overflowX: style.overflowX,
        overflowY: style.overflowY, visibility: "hidden" });
      probe.textContent = textarea.value; document.body.append(probe);
      probe.scrollTop = textarea.scrollTop; probe.scrollLeft = textarea.scrollLeft;
      const rect = (r: DOMRect) => ({ left: r.left, top: r.top, width: r.width, height: r.height });
      try {
        const expected = []; const text = probe.firstChild!;
        for (let index = textarea.value.indexOf(`@${tag}`); index >= 0; index = textarea.value.indexOf(`@${tag}`, index + tag.length + 1)) {
          const range = document.createRange(); range.setStart(text, index); range.setEnd(text, index + tag.length + 1);
          expected.push(...Array.from(range.getClientRects(), rect));
        }
        const marks = Array.from(mirror.querySelectorAll<HTMLElement>(".dead-tag"));
        const actual = marks.map((mark) => rect(mark.getBoundingClientRect()));
        const visible = actual.find((r) => r.top >= box.top && r.top + r.height <= box.bottom
          && r.left >= box.left && r.left + r.width <= box.right);
        return { expected, actual, textarea: rect(box), mirror: rect(mirror.getBoundingClientRect()),
          clientHeight: textarea.clientHeight, scrollHeight: textarea.scrollHeight,
          scrollTop: textarea.scrollTop, mirrorScrollTop: mirror.scrollTop,
          pointerTransparent: getComputedStyle(mirror).pointerEvents === "none"
            && marks.every((mark) => getComputedStyle(mark).pointerEvents === "none"),
          visibleMarkHitsTextarea: !!visible && document.elementFromPoint(visible.left + visible.width / 2,
            visible.top + visible.height / 2) === textarea };
      } finally { probe.remove(); }
    }, tag);
  } catch (error) { throw new Error("WP08 mirror measurement failed", { cause: error }); }
}

function alignmentError(metrics: Awaited<ReturnType<typeof mirrorMetrics>>) {
  if (!metrics.expected.length || metrics.actual.length !== metrics.expected.length) return Number.MAX_SAFE_INTEGER;
  return Math.max(...metrics.actual.flatMap((rect, index) =>
    (["left", "top", "width", "height"] as const).map((key) => Math.abs(rect[key] - metrics.expected[index][key]))));
}

async function assertMirror(fixture: ComposerCase, tag: string, name: string) {
  try {
    await expect.poll(async () => alignmentError(await mirrorMetrics(fixture, tag))).toBeLessThanOrEqual(1);
    const metrics = await mirrorMetrics(fixture, tag); fixture.metrics.push({ name, value: metrics });
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
    expect(metrics.mirrorScrollTop).toBe(metrics.scrollTop);
    expect(metrics.pointerTransparent).toBe(true); expect(metrics.visibleMarkHitsTextarea).toBe(true);
    expect(metrics.mirror.width).toBeCloseTo(metrics.textarea.width, 0);
    expect(metrics.mirror.height).toBeCloseTo(metrics.textarea.height, 0);
    return metrics;
  } catch (error) { throw new Error(`WP08 mirror ${name} failed`, { cause: error }); }
}

test("public attachment retirement leaves literal tags; actual mirror tracks native scroll and resize", async ({ browser }, info) => {
  await withComposer(browser, info, { surface: "sidebar" }, async (fixture) => {
    const retired = await fixture.page.evaluate(() => window.wp08!.retireAttachment());
    const textarea = input(fixture, "sidebar", "positive");
    await expect(textarea).toHaveValue(retired.text);
    const observation = await checkpoint(fixture, "public-addReferenceDataUrl-removeTrayItem");
    expect(retired.admissionProvider).toBe("oauth"); expect(observation.provider).toBe("nai");
    expect(observation.tray).toEqual([]); expect(observation.retiredTags[retired.tag]).toBeGreaterThan(0);
    await expect(fixture.page.locator(".composer__prompt-mirror .dead-tag").first()).toBeAttached();
    const before = await assertMirror(fixture, retired.tag, "initial");
    await textarea.evaluate((node) => { node.scrollTop = 120; }); // Native scroll event, no manual dispatch.
    await expect.poll(() => textarea.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    const scrolled = await assertMirror(fixture, retired.tag, "scrolled");
    expect(scrolled.scrollTop).toBeGreaterThan(before.scrollTop);
    expect(scrolled.actual[0].top - before.actual[0].top).toBeCloseTo(-scrolled.scrollTop, 0);
    await fixture.page.setViewportSize({ width: 900, height: 900 });
    await expect.poll(() => textarea.evaluate((node) => node.getBoundingClientRect().width)).not.toBe(before.textarea.width);
    const resized = await assertMirror(fixture, retired.tag, "resized");
    expect(resized.textarea.width).not.toBe(before.textarea.width);
    await fixture.page.screenshot({ path: info.outputPath("wp08-input-mirror-resized.png") });
    await input(fixture, "sidebar", "negative").fill("@Cedar stays literal");
    await expect(fixture.page.getByRole("listbox")).toHaveCount(0);
    expect((await checkpoint(fixture, "retirement-no-submit")).calls).toHaveLength(0);
  });
});
