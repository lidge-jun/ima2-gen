import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");

test("ResultActions extends a video by filename through the singleton SSE channel", () => {
  const source = read("ui/src/components/ResultActions.tsx");
  const stream = read("ui/src/lib/videoExtendStream.ts");
  assert.match(source, /import \{ postVideoExtendStream[^}]* \} from "\.\.\/lib\/videoExtendStream"/);
  assert.match(stream, /import \{[^}]*subscribe[^}]*\} from "\.\/eventChannel"/s);
  assert.match(stream, /whenConnected\(\)\.then\(\(\) => submitVideoExtend/);
  assert.match(source, /const requestId = `vext_\$\{crypto\.randomUUID\(\)\}`/);
  assert.match(source, /sourceVideoId: actionImage\.filename/);
  assert.match(source, /await postVideoExtendStream\(/);
  assert.doesNotMatch(source, /videoUrl:\s*(?:actionImage\.)?(?:url|image)/);
  assert.doesNotMatch(source, /fetch\("\/api\/video\/extend"[\s\S]*?\.catch\(\(\) => \{\}\)/);
});

test("ResultActions exposes pending, retry, cancellation, and immediate history insertion", () => {
  const source = read("ui/src/components/ResultActions.tsx");
  const stream = read("ui/src/lib/videoExtendStream.ts");
  assert.match(source, /disabled=\{extendState === "pending" \|\| extendState === "tracking-expired"\}/);
  assert.match(source, /extendState === "error"\s*\?\s*t\("gallery\.retry"\)/);
  assert.match(stream, /cancelInflight\(payload\.requestId\)/);
  assert.match(source, /addHistoryItem\(toVideoHistoryItem\(done, actionImage\)\)/);
  assert.match(source, /onClick=\{extend\}/);
});

test("video lineage is typed and preserved by refreshed history mapping", () => {
  const types = read("ui/src/types.ts");
  const historyApi = read("ui/src/lib/api-history.ts");
  const storeHelpers = read("ui/src/store/storeHelpers.ts");
  assert.match(types, /export type VideoLineage = \{/);
  assert.match(types, /videoLineage\?: VideoLineage \| null/);
  assert.match(historyApi, /videoLineage\?: import\("\.\.\/types"\)\.VideoLineage \| null/);
  assert.match(storeHelpers, /videoLineage: it\.videoLineage \?\? null/);
});
