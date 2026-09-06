# WP02 runner preflight RCA after second hosted failure

CI33945505481 at910d8b49: both Node22/24 jobs SUCCESS through package/global-update/
CLI/shutdown/dry-run. E2E beforeAll still rejects AZURE_EXTENSION_DIR; XDG refusal
is gone.9unrelatedE2Epassed,8WP02notrun. No WP02 app/runtime/render success.
Source policy is now frozen while gathering the missing boundary evidence.

Orthogonal hypotheses and falsifiers:
- H1: runner's extension path differs from the allowed literal. Falsifier: observed
  value/canonical path equals /opt/az/azcliextensions.
- H2: path matches but ownership/mode is intentionally writable/nonroot. Falsifier:
  lstat shows a root-owned755 canonical real directory.
- H3: path is absent/symlink/not-directory in this image. Falsifier: lstat and
  realpath show an existing regular directory.

Current error records only the variable name, so it cannot distinguish H1/H2/H3.
Need official image-definition source plus actual boundary metadata before any
further policy change. Synthetic tests prove current implementation, not hosted
directory facts. cxc-dev-debugging phase0/1 and cxc-search source-proof now apply.
Do not broaden conditions based on a plausible story or retry unchanged code.

Official primary source opened2026-09-05:
https://github.com/actions/runner-images/blob/main/images/ubuntu/scripts/build/install-azure-devops-cli.sh
setsAZURE_EXTENSION_DIR=/opt/az/azcliextensions and installs an extension there.
Failing run's image log:ubuntu24/20260831.293 (version20260831.293.1). This source
supports the expected literal but does not establish that run's uid/mode/linkstate.

Observability-only change: j6RunnerPathDiagnostics checks only those two fixed
expected paths AFTER confirming a hostedLinux context; different env values are
reported as expectedPath:false without printing or inspecting the arbitrary path.
It reports lstat directory/link/uid/mode and canonical-equality, no file contents.
preflight failure JSON captures this data. Existing allow/refuse policy unchanged.
Synthetic actual-source test proves diagnostics do not convert refused777 or
arbitrary-path cases into success. Next CI is a diagnostic run, not another fix.

Exact failing-image primary source fetched in full via GitHub Contents API:
https://github.com/actions/runner-images/blob/ubuntu24/20260831.293/images/ubuntu/scripts/build/configure-system.sh
explicitly runs chmod-R777 on/opt. The same image's configure-environment.sh sets
XDG_CONFIG_HOME=$HOME/.config; post-gen/environment-variables.sh substitutes the
actual user's home. H2 now has a source-backed prediction (mode777), not a guess.
Still wait for diagnostic-run33945997963's actual metadata to confirm this host.

Observed33945997963 artifact now confirms H2, twice (both spec beforeAll captures):
AZURE_EXTENSION_DIR expectedPath=true,directory=true,symlink=false,uid=0,mode777,
canonical=true. XDG expectedPath=true,directory=true,symlink=false,uid1001,mode755,
canonical=true. H1 wrongpath and H3 absent/link are falsified by these captures.
Artifacts:devlog/_artifacts/260905_production_readiness/wp02/4cd4d1d0/**/wp02-preflight.json.
The matching image source chmod-R777 predicts the exact captured discriminator;
the synthetic actual-helper mode755/mode777 toggle reproduces acceptance/refusal.

Causal fix: add only the observed canonical root-owned0777 Azure-path case as an
UNUSED PUBLIC TOOL METADATA exception. It is not a secure-permission assertion or
permission to import/execute extensions. Keep wrongpath/nonroot/symlink/canonical
errors and all otherAZURE credential vars blocked; keep child env exclusion.
Readonly Poincare candidate reviewPASS required runtime metadata (now captured),
exact bounds, unused-path proof, regressions and honest receipts. Source search
found no scoped Azure CLI/credential consumers; child starts process.execPath,
not a shell, with OAuth/Grok auto-start and MCP restoration disabled. Add actual
startApp spawn-option capture through synthetic fs/http/child boundaries to prove
metadata is absent from child env; no real resources. Record real metadata plus
exception label in successful hosted receipt; do not claim directory integrity.
