# The packaged studio + CLI. Compiles the server/CLI TypeScript to JS and
# builds the Vite UI bundle, assembles everything (with its pre-built
# node_modules) into the store, and wraps the real `ima2` CLI entrypoint
# (bin/ima2.js). `nix run` therefore behaves like the `ima2` command:
#
#   nix run .# -- --help      → CLI usage
#   nix run .# -- serve       → start the studio (binds 127.0.0.1:3333)
#   nix run .# -- gen "..."    → client subcommands (need a running server)
#
# (No args prints help, matching the CLI.) We compile rather than run via tsx
# because the CLI's `serve` spawns `node server.js`, and several commands map
# to compiled JS — this makes the runtime plain node, no tsx needed.
{
  lib,
  stdenv,
  nodejs,
  makeWrapper,
  src,
  rootModules,
  uiModules,
  # Test suite derivation, attached as passthru.tests (see nix/tests.nix).
  tests,
}:
stdenv.mkDerivation (finalAttrs: {
  pname = "ima2-gen";
  version = (lib.importJSON (src + "/package.json")).version;
  inherit src;

  nativeBuildInputs = [
    nodejs
    makeWrapper
  ];

  dontConfigure = true;

  buildPhase = ''
    runHook preBuild
    export HOME="$TMPDIR"
    # Dependencies come from Nix; link them in so the builds can resolve them.
    ln -s ${rootModules}/node_modules node_modules
    ln -s ${uiModules}/node_modules ui/node_modules
    # Compile server + CLI to JS, and build the UI bundle.
    npm run build:server
    npm run build:cli
    npm run ui:build
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    # Drop the build-time symlinks before copying the source tree.
    rm node_modules ui/node_modules

    mkdir -p "$out/libexec/ima2-gen" "$out/bin"
    cp -r . "$out/libexec/ima2-gen/"

    # Real store references for the runtime.
    ln -s ${rootModules}/node_modules "$out/libexec/ima2-gen/node_modules"
    ln -s ${uiModules}/node_modules "$out/libexec/ima2-gen/ui/node_modules"

    # Wrap the CLI entrypoint. nodejs stays on PATH so `serve` can spawn the
    # server and the OAuth/Grok proxy subprocesses. Config/storage default to
    # ~/.ima2 (writable).
    makeWrapper ${lib.getExe nodejs} "$out/bin/ima2-gen" \
      --add-flags "$out/libexec/ima2-gen/bin/ima2.js" \
      --prefix PATH : ${lib.makeBinPath [ nodejs ]}

    runHook postInstall
  '';

  passthru = {
    # Dependency closures: `nix build .#ima2-gen.nodeModules` / `.uiNodeModules`.
    nodeModules = rootModules;
    uiNodeModules = uiModules;
    # Full test suite: `nix build .#ima2-gen.tests` (also wired into checks).
    inherit tests;
  };

  meta = {
    description = "Local OAuth image generation studio + CLI";
    homepage = "https://github.com/philiptaron/ima2-gen";
    license = lib.licenses.mit;
    mainProgram = "ima2-gen";
  };
})
