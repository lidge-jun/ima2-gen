# 03 — Security Contract

## Boundary

The bridge crosses this trust boundary:

```text
browser -> ima2 server -> local ComfyUI server
```

Both browser input and ComfyUI URL input are untrusted.

In PR1, ComfyUI URL input means server-side configuration
(`IMA2_COMFY_URL` or `config.json`), not browser request body.

## Localhost URL Policy

Allowed:

- `http://127.0.0.1:<port>`
- `http://localhost:<port>`
- `http://[::1]:<port>`

Rejected:

- `https://...`
- LAN IPs
- public domains
- `0.0.0.0`
- embedded credentials
- path, query, or fragment
- non-HTTP schemes
- redirects to non-loopback targets
- missing or malformed ports
- IPv4 shorthand, decimal, octal, or hex forms
- IPv4-mapped IPv6
- `localhost.` with trailing dot
- DNS names that merely resolve to loopback

Implementation requirement:

- Normalize to origin only.
- Accept only exact hostnames `127.0.0.1`, `localhost`, and `[::1]`.
- Use manual redirect handling for the ComfyUI upload request.
- PR1 rejects every 3xx response.
- The browser-facing PR1 API does not expose `comfyUrl`; UI uses the configured
  local default. Contract tests may inject a local mock origin at module level.
- The PR1 route must reject browser-provided `comfyUrl` rather than silently
  honoring it.
- A lone trailing slash is accepted and normalized to origin.
- Any non-root path, query, fragment, credentials, missing port, malformed
  port, or non-loopback host is rejected.

## Filename Policy

Accept only saved ima2 generated filenames.

Reject:

- empty strings
- absolute paths
- `../`
- `/`
- `\`
- URL-looking strings
- encoded path separators
- filenames that resolve outside `generatedDir`
- symlinks escaping `generatedDir`

Implementation requirement:

- Validation order:
  1. Reject non-string or empty filename.
  2. Reject absolute paths, separators, URL-looking strings, and encoded
     separators.
  3. Resolve `config.storage.generatedDir` with `realpath`.
  4. Resolve candidate file with `realpath`.
  5. Require candidate real path to remain inside generated directory real path.
  6. Require regular file, not directory.
  7. Sniff image magic bytes.
- Resolve both `config.storage.generatedDir` and the candidate file with
  `realpath`.
- Reject if the candidate real path is not inside the generated directory real
  path.
- Do not reuse a path-prefix-only resolver for this route.
- Use separator-safe containment such as `path.relative`, not naive string
  prefix matching.

## File Type Policy

Allowed image types:

- PNG
- JPEG
- WebP

Detection must use magic bytes, not only extension.

## Upload Policy

The bridge uploads to ComfyUI `/upload/image`.

PR1 must not expose:

- `subfolder`
- `overwrite`
- workflow queue parameters
- raw local paths
- arbitrary URLs

Destination filename should be sanitized:

```text
ima2_<timestamp>_<safe-basename>.<ext>
```

Multipart fields:

```text
image = saved ima2 file bytes, filename=<sanitizedDestinationFilename>
type = input
```

Resource limits:

- Upload timeout is bounded by `config.comfy.uploadTimeoutMs`.
- Upload file size is bounded by `config.comfy.maxUploadBytes`.
- Timeout, connection refused, non-2xx, 3xx, invalid JSON, or missing ComfyUI
  response `name` all map to `COMFY_UPLOAD_FAILED`.
- Request schema violations, unsafe filenames, non-image bytes, directories,
  and oversize files all map to `COMFY_IMAGE_INVALID` with HTTP 400.

## Logging Policy

Never log:

- image bytes
- base64 payloads
- API keys
- OAuth/Codex token paths
- full user prompt text

Allowed logs:

- request id
- sanitized filename
- normalized local ComfyUI URL
- error code
- duration

## Failure Safety

Failures should return stable codes and safe messages.

Error envelope:

```json
{
  "ok": false,
  "error": {
    "code": "COMFY_UPLOAD_FAILED",
    "message": "Could not upload image to ComfyUI."
  }
}
```

The route must never leak:

- local absolute generated path
- ComfyUI stack trace
- raw multipart body
- Node stack trace

## Threats

| Threat | Mitigation |
|---|---|
| SSRF through `comfyUrl` | loopback-only allowlist |
| Arbitrary file upload | filename-only + generatedDir realpath check |
| Path traversal | reject separators and encoded traversal |
| Secret exfiltration | no token/API key fields or logs |
| Workflow abuse | no `/prompt` in PR1 |
| ComfyUI overwrite | do not expose overwrite |
