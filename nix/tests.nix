# The test suite as its own derivation, attached to the package as
# `passthru.tests` (build with `nix build .#ima2-gen.tests`) and surfaced as a
# flake check. Kept separate from the runnable package so it never slows down
# `nix build .#ima2-gen` / `nix run`.
#
# Unlike the app (which runs straight from TypeScript via tsx), the suite needs
# the compiled .js emit: a number of "contract" tests read sibling .js files as
# source text (e.g. lib/composerSnapshot.js). So this derivation runs the tsc
# builds first, then the suite. HOME is writable in the sandbox, so the
# server-lifecycle / system tests (advertise file, shutdown cleanup, …) work.
#
# The derivation succeeds iff the suite passes; $out is just a marker holding
# the captured log.
{
  lib,
  stdenv,
  nodejs,
  src,
  rootModules,
  uiModules,
}:
stdenv.mkDerivation (finalAttrs: {
  pname = "ima2-gen-tests";
  version = (lib.importJSON (src + "/package.json")).version;
  inherit src;

  nativeBuildInputs = [ nodejs ];

  dontConfigure = true;

  buildPhase = ''
    runHook preBuild
    set -o pipefail
    export HOME="$TMPDIR"

    ln -s ${rootModules}/node_modules node_modules
    ln -s ${uiModules}/node_modules ui/node_modules

    # Emit the .js artifacts that source-text contract tests read, plus the UI
    # bundle (some tests assert the app shell is served and check the Vite
    # build manifest / chunk splitting).
    echo "building server + cli (.js emit for contract tests)…"
    npm run build:server
    npm run build:cli
    echo "building UI bundle…"
    npm run ui:build

    echo "running test suite…"
    npm test 2>&1 | tee test-output.log

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    mkdir -p "$out"
    cp test-output.log "$out/test-output.log"
    runHook postInstall
  '';

  meta = {
    description = "ima2-gen test suite (node --test, against compiled artifacts)";
    license = lib.licenses.mit;
  };
})
