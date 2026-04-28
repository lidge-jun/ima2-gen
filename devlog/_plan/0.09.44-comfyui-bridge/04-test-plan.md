# 04 — Test Plan

## Server Contract Tests

New file:

```text
tests/comfy-bridge-contract.test.js
```

Required cases:

- config exposes `config.comfy.defaultUrl` with fallback
  `http://127.0.0.1:8188`
- `IMA2_COMFY_URL` overrides the default ComfyUI URL
- `config.json` `comfy.defaultUrl` works when env is absent
- env var wins over `config.json`
- config exposes bounded `config.comfy.uploadTimeoutMs`
- config exposes bounded `config.comfy.maxUploadBytes`
- `.env.example` documents `IMA2_COMFY_URL`, upload timeout, and max upload
  bytes
- invalid, zero, or negative upload timeout falls back to default
- invalid, zero, or negative max upload bytes falls back to default
- accepts `http://127.0.0.1:8188`
- accepts `http://127.0.0.1:8188/` and normalizes to origin
- accepts `http://localhost:8188`
- accepts `http://[::1]:8188`
- rejects `http://127.0.0.1:8188/foo`
- rejects remote domains
- rejects LAN IPs
- rejects `0.0.0.0`
- rejects missing port
- rejects path/query/fragment in ComfyUI URL
- rejects IPv4 shorthand, decimal, octal, and hex hosts
- rejects IPv4-mapped IPv6 unless explicitly allowed later
- rejects `localhost.` trailing-dot host
- rejects non-HTTP schemes
- rejects embedded credentials
- rejects local redirects and remote redirects
- proves upload code does not automatically follow a redirect before validation
- rejects missing generated file
- rejects path traversal filename
- rejects Windows path separators
- rejects encoded separators
- rejects absolute paths
- rejects URL-looking filename strings
- rejects symlink escapes from `generatedDir`
- rejects directory paths
- rejects unsupported file type
- rejects extension spoofing, e.g. `fake.png` with plain text bytes
- accepts real PNG/JPEG/WebP based on magic bytes
- uploads multipart image data to a mock ComfyUI server
- sends multipart `image` and `type=input`
- multipart contains no extra fields beyond `image` and `type=input`
- does not send `subfolder` or `overwrite`
- sends a sanitized destination filename
- makes exactly one upstream request
- makes exactly `POST /upload/image`
- does not call `/prompt`
- does not call `/history`
- maps ComfyUI non-2xx to `COMFY_UPLOAD_FAILED`
- maps ComfyUI 3xx to `COMFY_UPLOAD_FAILED`
- maps ComfyUI connection failure to `COMFY_UPLOAD_FAILED`
- maps timeout to `COMFY_UPLOAD_FAILED`
- rejects a generated image larger than `config.comfy.maxUploadBytes` before
  uploading to ComfyUI
- maps invalid JSON or missing `name` to `COMFY_UPLOAD_FAILED`
- maps ComfyUI response `{ name }` to `uploadedFilename`
- verifies route registration through the configured app route, not only direct
  helper calls
- verifies `COMFY_URL_NOT_LOCAL` returns HTTP 400
- verifies `COMFY_IMAGE_INVALID` returns HTTP 400
- verifies `COMFY_IMAGE_NOT_FOUND` returns HTTP 404
- verifies `COMFY_UPLOAD_FAILED` returns HTTP 502
- verifies success body `{ ok: true, sourceFilename, uploadedFilename }`
- verifies error body `{ ok: false, error: { code, message } }`
- verifies safe errors do not leak absolute paths, upstream stack traces, raw
  multipart body, or Node stack traces
- public `POST /api/comfy/export-image` rejects request body `comfyUrl`; PR1
  route only accepts `filename`
- public `POST /api/comfy/export-image` rejects forbidden browser fields:
  `subfolder`, `overwrite`, `prompt`, `workflow`, `client_id`, `extra_data`,
  and raw path-like fields

## UI Contract Tests

Either add to an existing UI contract test or create:

```text
tests/comfy-export-ui-contract.test.js
```

Required cases:

- `ResultActions` imports and calls `exportImageToComfy`.
- `tests/comfy-export-ui-contract.test.js` may be a source-text contract test
  if the root Node test runner cannot execute TSX directly.
- More menu includes the ComfyUI export action.
- `ResultActions` computes `actionImage` before the null return.
- `ResultActions` does not return early on missing `currentImage` when
  `imageOverride` exists.
- Action uses `actionImage.filename`, not unconditionally `currentImage`.
- Action is only available when `actionImage.filename` exists.
- More menu filename gate uses `actionImage.filename`, not
  `currentImage.filename`.
- UI request body contains exactly `filename` for PR1.
- UI sends no `comfyUrl` in PR1.
- UI does not include `subfolder`, `overwrite`, `prompt`, or workflow fields.
- Export action is disabled or guarded while an export is in flight.
- Permanent delete remains in the More menu.
- Delete/permanent-delete do not silently target a different image than export
  in `imageOverride` contexts.
- Korean and English labels exist.
- Toast keys exist:
  - `result.sendToComfyUI`
  - `result.sendToComfyUITitle`
  - `toast.comfyExported`
  - `toast.comfyExportInvalidUrl`
  - `toast.comfyExportInvalidImage`
  - `toast.comfyExportImageNotFound`
  - `toast.comfyExportFailed`
- Success toast interpolates `uploadedFilename`.
- Failure toasts preserve and map stable error codes from `jsonFetch`.

## Manual Smoke

With ComfyUI running:

1. Start `ima2 serve`.
2. Generate an image.
3. Open image More menu.
4. Click `ComfyUI로 보내기`.
5. Confirm success toast includes uploaded filename.
6. In ComfyUI, add or open a Load Image node.
7. Confirm uploaded image appears in the input list.
8. Confirm the ComfyUI upload response includes `name`, and ima2 maps it to
   `uploadedFilename`.

With ComfyUI stopped:

1. Click `ComfyUI로 보내기`.
2. Confirm failure toast is clear and non-crashing.

## Build and Test Gate

Run before B completion:

```bash
node --test tests/comfy-bridge-contract.test.js
node --test tests/comfy-export-ui-contract.test.js
npm test
npm run ui:build
```

If the repository has no `tsc --noEmit` root command, `npm run ui:build`
serves as the frontend static type/build gate.
