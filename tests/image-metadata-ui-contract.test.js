import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("image metadata UI contract", () => {
  it("exposes a metadata read API client that treats missing metadata as non-throwing", () => {
    const api = readSource("ui/src/lib/api.ts");

    assert.match(api, /export type ImageMetadataReadResponse/);
    assert.match(api, /metadata:\s*EmbeddedGenerationMetadata \| null/);
    assert.match(api, /source:\s*"xmp" \| "png-comment" \| null/);
    assert.match(api, /export function readImageMetadata/);
    assert.match(api, /\/api\/metadata\/read/);
  });

  it("stores pending metadata restore instead of applying settings on drop", () => {
    const store = readSource("ui/src/store/useAppStore.ts");

    assert.match(store, /type MetadataRestoreState/);
    assert.match(store, /metadataRestore:\s*MetadataRestoreState/);
    assert.match(store, /readDroppedImageMetadata:\s*\(file: File,\s*targetNodeId\?: ClientNodeId \| null\) => Promise<boolean>/);
    assert.match(store, /const result = await readImageMetadata\(\{ filename: file\.name,\s*dataUrl \}\)/);
    assert.match(store, /if \(!result\.metadata\) return false/);
    assert.match(store, /metadataRestore:\s*\{/);
    assert.match(store, /applyMetadataRestore:\s*\(\) =>/);
    assert.match(store, /cancelMetadataRestore:\s*\(\) => set\(\{ metadataRestore: null \}\)/);
    assert.match(store, /addMetadataRestoreAsReference:\s*\(\) =>/);
  });

  it("connects metadata restore to classic and node drop targets", () => {
    const promptComposer = readSource("ui/src/components/PromptComposer.tsx");
    const imageNode = readSource("ui/src/components/ImageNode.tsx");

    assert.match(promptComposer, /readDroppedImageMetadata/);
    assert.match(promptComposer, /const handled = await readDroppedImageMetadata\(files\[0\]\)/);
    assert.match(promptComposer, /if \(handled\) return/);
    assert.match(promptComposer, /await addReferences\(files\)/);

    assert.match(imageNode, /readDroppedImageMetadata/);
    assert.match(imageNode, /const handled = await readDroppedImageMetadata\(files\[0\], id\)/);
    assert.match(imageNode, /if \(handled\) return/);
    assert.match(imageNode, /await addNodeReferences\(id, files\)/);
  });

  it("renders a confirmation dialog before restore actions", () => {
    const app = readSource("ui/src/App.tsx");
    const dialog = readSource("ui/src/components/MetadataRestoreDialog.tsx");
    const css = readSource("ui/src/index.css");

    assert.match(app, /import \{ MetadataRestoreDialog \} from "\.\/components\/MetadataRestoreDialog"/);
    assert.match(app, /<MetadataRestoreDialog \/>/);
    assert.match(dialog, /metadataRestore/);
    assert.match(dialog, /applyMetadataRestore/);
    assert.match(dialog, /addMetadataRestoreAsReference/);
    assert.match(dialog, /cancelMetadataRestore/);
    assert.match(dialog, /metadata\.restoreTitle/);
    assert.match(css, /\.metadata-restore/);
  });

  it("defines metadata restore copy in both locales", () => {
    const en = JSON.parse(readSource("ui/src/i18n/en.json"));
    const ko = JSON.parse(readSource("ui/src/i18n/ko.json"));
    const keys = [
      "restoreTitle",
      "restoreBody",
      "applySettings",
      "useAsReferenceOnly",
      "noMetadata",
      "invalidMetadata",
      "unsupportedFormat",
      "readFailed",
      "applied",
      "sourceXmp",
      "sourcePngComment",
    ];

    for (const key of keys) {
      assert.equal(typeof en.metadata?.[key], "string", `en metadata.${key}`);
      assert.equal(typeof ko.metadata?.[key], "string", `ko metadata.${key}`);
    }
  });
});
