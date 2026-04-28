# Oracle Audit — ComfyUI Bridge

Reviewed with Oracle browser model on 2026-04-28.

## Verdict

Oracle agreed the direction is sound only if staged narrowly.

Adopted decision:

```text
PR1: ima2 UI -> ComfyUI image upload only
PR2: ComfyUI node -> ima2 local server
Later: Comfy image input and workflow automation only after demand
```

## Adopted Recommendations

- Keep ima2 as the only OAuth/OpenAI authority.
- Add `Send to ComfyUI` to the current image More menu.
- Browser should call ima2 server, not ComfyUI directly.
- Server should upload saved generated image to ComfyUI `/upload/image`.
- Do not queue ComfyUI workflows in PR1.
- Do not call `/prompt` in PR1.
- Do not accept arbitrary paths, URLs, or raw files from the browser.
- Enforce localhost-only ComfyUI URLs.
- Treat generated filenames as untrusted.
- Prefer direct HTTP over CLI subprocess for future ComfyUI custom nodes.
- Store ComfyUI default URL in `config.js`, not as a route-local magic string.
- Use realpath-based generatedDir containment checks.
- Reject redirects or handle them manually.
- Use ComfyUI response `name` as `uploadedFilename`.
- Send multipart `image` and `type=input` only.
- Keep `comfyUrl` out of the browser-facing PR1 request.
- Add timeout and max upload size bounds under `config.comfy`.
- Add symlink escape, redirect, route registration, safe error, and UI
  `actionImage.filename` contract tests.
- Local audit cannot verify the upstream ComfyUI `/upload/image` response shape
  from this repository. Before B completion, manual smoke or upstream
  confirmation must verify multipart `image`, `type=input`, and JSON response
  field `name`.

## Key Risks

| Risk | Decision |
|---|---|
| CLI subprocess from ComfyUI | Not default; HTTP preferred |
| React direct upload to ComfyUI | Avoid; use server proxy |
| Remote ComfyUI URL | Reject in MVP |
| Workflow automation scope creep | Exclude from PR1 |
| Arbitrary local file upload | filename-only + realpath check |
| Credential leakage | no API key/token fields |

## Files Oracle Expected for PR1

- `routes/index.js`
- `routes/comfy.js`
- `config.js`
- `.env.example`
- `lib/comfyBridge.js`
- `ui/src/lib/api.ts`
- `ui/src/components/ResultActions.tsx`
- `ui/src/i18n/en.json`
- `ui/src/i18n/ko.json`
- tests and docs
