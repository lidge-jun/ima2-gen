# npx Quickstart

The package engine requirement applies to npx too; source `.ts` files require the normal build before emitted `.js` files are run.

> The recommended install method is `npm install -g ima2-gen`. This page covers
> the alternative `npx` workflow for one-shot usage without a global install.

## Run without installing

```bash
npx ima2-gen serve
```

Then open `http://localhost:3333`.

To check the installed package without starting a server or reading provider
credentials, run `npx ima2-gen doctor --installation --json`. A failed local
prerequisite exits1; missing provider credentials are not installation failures.

If ChatGPT OAuth is not logged in yet:

```bash
npx @openai/codex login
npx ima2-gen serve
```

## Notes

- `npx` downloads the package to a temporary cache. Each run may re-download if
  the cache is cold, which is slower than a global install.
- Generated images are stored in `~/.ima2/generated` regardless of install
  method. They are not lost when the npx cache expires.
- `ima2 setup`, `ima2 grok login`, and other CLI commands still work after
  `npx ima2-gen serve` starts the server, as long as the npx session is active.
- For a stable, faster experience, use the global install:

```bash
npm install -g ima2-gen
ima2 setup
ima2 serve
```

## Recovering images from an old npx cache

If you used `npx` in earlier versions and your images were saved inside the npx
cache instead of `~/.ima2/generated`, see [Recover Old Images](RECOVER_OLD_IMAGES.md).
