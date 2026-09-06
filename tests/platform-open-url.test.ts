import assert from "node:assert/strict";
import { test, mock } from "node:test";

const urls = [
  "https://example.test/path?a=1&b=2#fragment",
  "http://example.test/space here?q=한글🙂",
  'https://example.test/?q=$(echo PWNED);`echo PWNED`&x="quoted"',
  "https://example.test/?q='; Write-Output PWNED; #&x=%TEMP%^|<>!",
];

test("openUrl uses argument/data boundaries on every supported platform", async (t) => {
  const calls: Array<{ file: string; args: string[]; options: { shell?: unknown; windowsHide?: boolean } }> = [];
  let failure: Error | undefined;
  let procVersion = "Linux fixture";
  const processMock = mock.module("node:child_process", { namedExports: {
    execFileSync(file: string, args: string[], options: { shell?: unknown; windowsHide?: boolean }) {
      calls.push({ file, args, options });
      if (failure) throw failure;
      return Buffer.alloc(0);
    },
    execSync() { throw new Error("shell execution forbidden"); },
    spawn() { throw new Error("unexpected process launch"); },
  } });
  const fsMock = mock.module("node:fs", { namedExports: {
    readFileSync(path: string) {
      assert.equal(path, "/proc/version");
      return procVersion;
    },
  } });
  const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform")!;
  const display = process.env.DISPLAY;
  const wayland = process.env.WAYLAND_DISPLAY;
  try {
    for (const mode of ["darwin", "linux", "win32", "wsl"] as const) {
      await t.test(mode, async () => {
        Object.defineProperty(process, "platform", { ...platformDescriptor, value: mode === "wsl" ? "linux" : mode });
        procVersion = mode === "wsl" ? "Linux Microsoft WSL2 fixture" : "Linux fixture";
        const { openUrl } = await import(new URL(`../bin/lib/platform.ts?mode=${mode}`, import.meta.url).href);
        Object.defineProperty(process, "platform", platformDescriptor);
        process.env.DISPLAY = ":fixture";
        for (const url of urls) {
          calls.length = 0;
          assert.deepEqual(openUrl(url), { ok: true });
          assert.equal(calls.length, 1);
          const call = calls[0];
          assert.ok(!call.options.shell);
          if (mode === "win32" || mode === "wsl") {
            assert.equal(call.file, "powershell.exe");
            assert.deepEqual(call.args.slice(0, -1), ["-NoProfile", "-NonInteractive", "-EncodedCommand"]);
            assert.equal(call.options.windowsHide, true);
            const command = Buffer.from(call.args.at(-1)!, "base64").toString("utf16le");
            const data = /FromBase64String\('([A-Za-z0-9+/=]+)'\)/.exec(command)?.[1];
            assert.ok(data, "only base64 URL data may enter the fixed command");
            assert.equal(Buffer.from(data, "base64").toString("utf8"), url);
            assert.equal(command.replace(data, "DATA"), "$u=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('DATA')); Start-Process -FilePath $u -ErrorAction Stop");
          } else {
            assert.equal(call.file, mode === "darwin" ? "open" : "xdg-open");
            assert.deepEqual(call.args, [url]);
          }
        }
        calls.length = 0;
        for (const url of ["file:///tmp/file", "javascript:alert(1)", "data:text/html,test", "mailto:a@example.test", "not a URL", "--help"]) {
          assert.equal(openUrl(url).ok, false, url);
        }
        assert.deepEqual(calls, []);
        failure = new Error("launcher failed");
        assert.deepEqual(openUrl(urls[0]), { ok: false, error: "launcher failed" });
        failure = undefined;
        delete process.env.DISPLAY;
        delete process.env.WAYLAND_DISPLAY;
        calls.length = 0;
        if (mode === "linux") {
          assert.deepEqual(openUrl(urls[0]), { ok: false, error: "no desktop session (DISPLAY/WAYLAND_DISPLAY unset)" });
          assert.deepEqual(calls, []);
          process.env.WAYLAND_DISPLAY = "fixture-wayland";
          assert.deepEqual(openUrl(urls[0]), { ok: true });
        } else {
          assert.deepEqual(openUrl(urls[0]), { ok: true });
        }
      });
    }
  } finally {
    Object.defineProperty(process, "platform", platformDescriptor);
    if (display === undefined) delete process.env.DISPLAY; else process.env.DISPLAY = display;
    if (wayland === undefined) delete process.env.WAYLAND_DISPLAY; else process.env.WAYLAND_DISPLAY = wayland;
    fsMock.restore();
    processMock.restore();
  }
});
