# ima2-gen FAQ

Last reviewed: 2026-04-25

This FAQ collects the questions that tend to come up after installing or updating `ima2-gen`. The README stays short; this page is the place for practical details and recovery steps.

For Korean, see [FAQ.ko.md](FAQ.ko.md).

## Quick fixes

| Symptom | Try first |
|---|---|
| The server is unreachable | Run `ima2 serve`, then `ima2 ping`. |
| OAuth login fails | Run `npx @openai/codex login`, then restart `ima2 serve`. |
| API key generation is disabled | Use OAuth for image generation. API keys are only used by auxiliary paths. |
| Old gallery images look missing | Run `ima2 doctor`, then see [Recover Old Generated Images](RECOVER_OLD_IMAGES.md). |
| `gpt-5.5` fails | Update Codex CLI first, then try `gpt-5.4` as the stable fallback. |
| Reference upload fails | Use JPEG/PNG, lower the resolution, and keep references to 5 images or fewer. |

## Install and update

### What version of Node do I need?

Use Node.js 20 or newer. The package declares Node `>=20`, and the README badge follows that requirement.

### Should I use `npx` or a global install?

Both are supported.

```bash
npx ima2-gen serve
```

or:

```bash
npm install -g ima2-gen
ima2 serve
```

If an old global install behaves strangely, update first:

```bash
npm install -g ima2-gen@latest
```

Then run:

```bash
ima2 doctor
```

### Windows says `spawn EINVAL`. What should I do?

Update to the latest version. Older versions had trouble spawning npm/npx shims on Windows. Current builds route those commands through a Windows-safe path.

If Codex login itself is unreliable on native Windows, WSL can be the more predictable environment.

## Authentication and providers

### Do I need an OpenAI API key?

No for image generation. The normal generation path uses your local Codex/ChatGPT OAuth session.

You may still see an API key detected in settings. That only means an API key exists in env/config. Image generation routes still reject `provider: "api"` with `APIKEY_DISABLED`.

### Why does the settings page say "Configured but disabled"?

It means `ima2-gen` found an API key, but API-key image generation is intentionally disabled in this build. Use OAuth for generation.

### If Codex CLI is already logged in, does ima2-gen reuse it?

Yes. `ima2-gen` checks for an existing Codex login and uses the local OAuth path. If detection fails or the token expires, run:

```bash
npx @openai/codex login
ima2 doctor
```

Then restart `ima2 serve`.

### What if I see `Provided authentication token is expired`?

Your Codex/ChatGPT OAuth session needs to be refreshed.

```bash
npx @openai/codex login
ima2 serve
```

If this happens on a company network, a firewall, VPN, proxy, or captive portal may also be blocking the OAuth flow.

## Models and quota

### Which model should I use?

Start with `gpt-5.4` for the safest balanced workflow.

- `gpt-5.4`: recommended balanced choice.
- `gpt-5.4-mini`: current app default and faster draft model.
- `gpt-5.5`: strongest quality option when supported.

### Why does `gpt-5.5` fail when other models work?

`gpt-5.5` may require a newer Codex CLI, backend capability, or account/quota availability. Update Codex CLI first. If it still fails, use `gpt-5.4` as the stable fallback.

### How many images can Plus or Pro generate?

Do not treat any community number as a guarantee. OAuth generation can be limited by account, backend capability, traffic, and policy changes. `ima2-gen` does not publish a fixed Plus/Pro image count because that number is not stable enough to document as a promise.

## Gallery and generated files

### Where are generated images stored?

Current versions store generated images in your user data folder:

```text
macOS / Linux: ~/.ima2/generated
Windows: %USERPROFILE%\.ima2\generated
```

You can override that with `IMA2_GENERATED_DIR`.

### Why did old gallery images look missing after an update?

Older versions stored generated images inside the installed package folder. Recent versions moved the gallery to user data storage so package updates do not mix app code with runtime files.

Sorry for the scare. If the old global install folder was replaced during an update, the previous `generated/` folder may no longer be on disk. `ima2-gen` can recover old files only when that old folder still exists.

Run:

```bash
ima2 doctor
```

Then follow [Recover Old Generated Images](RECOVER_OLD_IMAGES.md).

### Does ima2-gen delete my old images during this migration?

No. The migration is copy-only. It does not delete or move legacy folders. If old files are not found, the likely issue is that the old global install folder is no longer present on disk.

### What does "Open folder" open?

The gallery's **Open folder** button opens the generated image folder on the machine running `ima2 serve`.

That is usually your own computer. If you are using a remote server, SSH session, VM, container, WSL, or another machine on your network, the folder opens or resolves on that server machine, not necessarily on the browser device.

## Reference images

### How many reference images can I attach?

Up to 5.

### What formats work best?

Use JPEG or PNG. The browser path does not support HEIC/HEIF directly, so convert those images before attaching them.

### What if a reference image is too large?

The app compresses large JPEG/PNG files before upload. If a file still fails, lower the resolution or convert it to JPEG/PNG and try again.

The API may report reference errors such as `REF_TOO_MANY`, `REF_TOO_LARGE`, `REF_NOT_BASE64`, or `REF_EMPTY`.

## Network and OAuth errors

### What does `failed to fetch` mean?

Usually one of these:

- the local OAuth proxy is not ready,
- the server was restarted,
- a VPN/proxy/firewall blocked the request,
- the network dropped while Codex/ChatGPT OAuth was being used.

Try:

```bash
ima2 doctor
ima2 ping
```

Then restart `ima2 serve` if needed.

### What should I check on a company computer?

OAuth may require access to OpenAI and ChatGPT/Codex-related hosts. A corporate firewall, TLS inspection, VPN, or proxy can break the flow. Try a different network if login and `failed to fetch` errors keep repeating.

## CLI troubleshooting checklist

Run these in order:

```bash
ima2 doctor
ima2 status
ima2 ping
ima2 ps
npx @openai/codex login
npm install -g ima2-gen@latest
```

If you run the server on a non-default port:

```bash
IMA2_SERVER=http://localhost:3333 ima2 ping
```

