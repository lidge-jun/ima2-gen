import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const settings = readFileSync(join(root, "ui/src/components/SettingsWorkspace.tsx"), "utf8");
const css = readFileSync(join(root, "ui/src/index.css"), "utf8");

test("settings workspace keeps mobile and desktop navigation from occupying the same grid", () => {
  assert.match(settings, /settings-nav settings-nav--mobile/);
  assert.match(settings, /<nav className="settings-nav"/);
  assert.match(css, /\.settings-nav--mobile\s*\{[\s\S]*?display:\s*none;/);
  assert.match(css, /@media \(max-width:\s*800px\)[\s\S]*?\.settings-nav--mobile\s*\{[\s\S]*?display:\s*block;/);
  assert.match(
    css,
    /@media \(max-width:\s*800px\)[\s\S]*?\.settings-layout > \.settings-nav:not\(\.settings-nav--mobile\)\s*\{[\s\S]*?display:\s*none;/,
  );
});
