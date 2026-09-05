#!/usr/bin/env node
// 066 filesystem gate: named activation evidence, never a count-only green.
import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, lstatSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnNpmSync } from './npm-subprocess.mjs';

const FILES = [
  'agy-artifact-confinement.test.ts', 'agy-artifact-read-bounds.test.ts',
  'agy-artifact-fallback.test.ts', 'agy-execution-cleanup.test.ts',
  'agy-execution-process.test.ts',
];
const HEAVY = [
  '[hosted CI] Agy artifact exact 50MiB succeeds',
  '[hosted CI] Agy artifact declared 50MiB plus one rejects',
  '[hosted CI] Agy artifact growth beyond 50MiB rejects',
  '[hosted CI] Agy artifact streamed cap rejects 50MiB plus one',
];
const ANCHORS = [
  ['Agy artifact accepts owned regular bytes and guarded cleanup',
    'Agy artifact rejects leaf symlinks without reading or deleting targets',
    'Agy artifact rejects changed identity before return',
    'Agy artifact cleanup preserves replacement and concurrent siblings'],
  ['Agy artifact reader uses bounded chunks and no readFile',
    'Agy artifact reader rejects overflow before concatenation',
    'Agy artifact reader closes on read error and cancellation',
    'Agy emitted artifact reader enforces tiny policy and cleanup'],
  ['findRecentAgyArtifact returns matching file within time window'],
  ['Agy ordinary success activates exact staging/read/removal hooks',
    'Agy abort during successful held reference removal is caught after cleanup',
    'Agy primary read EIO survives abort during held reference cleanup'],
  process.platform === 'win32' ? [
    'Windows Agy cancellation closes before one rejection',
    'Windows Agy timeout keeps first reason through abrupt close',
    'Windows Agy watchdog reaps suppressed DUT termination',
  ] : [
    'native cooperative cancellation observes close before rejection',
    'native TERM-ignoring cancellation observes close before rejection',
    'timeout wins first reason over later external abort and waits native KILL/close',
    'native watchdog reaps a missing-DUT-KILL child and close fails its violation ledger',
  ],
];
const SKIP_PATTERN = 'hosted CI';
const CHILD_DEADLINE_MS = 180_000;
const OUTPUT_LIMIT = 4 * 1024 * 1024;

function options(argv) {
  const result = { mode: undefined, testRoot: fileURLToPath(new URL('../tests/', import.meta.url)), outputDir: undefined };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (seen.has(arg)) throw new Error(`duplicate option: ${arg}`);
    seen.add(arg);
    if (arg === '--light' || arg === '--hosted-heavy') {
      assert.equal(result.mode, undefined, 'select exactly one mode');
      result.mode = arg.slice(2);
    } else if (arg === '--test-root' || arg === '--output-dir') {
      const value = argv[++i];
      assert.ok(value && !value.startsWith('--'), `missing value: ${arg}`);
      result[arg === '--test-root' ? 'testRoot' : 'outputDir'] = resolve(value);
    } else throw new Error(`unknown option: ${arg}`);
  }
  assert.ok(result.mode && result.outputDir, 'mode and fresh --output-dir are required');
  if (result.mode === 'hosted-heavy') {
    assert.equal(process.env.GITHUB_ACTIONS, 'true', 'hosted-heavy requires parent GITHUB_ACTIONS=true');
  }
  const selector = new RegExp(SKIP_PATTERN);
  assert.ok(HEAVY.every((name) => selector.test(name)), 'selector must match every heavy label');
  assert.ok(ANCHORS.flat().every((name) => !selector.test(name)), 'selector must preserve small anchors');
  return result;
}

function childEnv(file) {
  const env = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'LANG', 'TZ']) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  env.EXECUTION_TEST_FILE = pathToFileURL(file).href;
  return env;
}

function identity() {
  const env = childEnv('');
  delete env.EXECUTION_TEST_FILE;
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', env, timeout: 15_000 }).trim();
  const npm = spawnNpmSync(['--version'], { encoding: 'utf8', env, timeout: 15_000 });
  assert.equal(npm.status, 0, 'npm version probe failed');
  return {
    expectedSha: process.env.WANT_SHA ?? null, actualSha: sha,
    expectedNode: process.env.WANT_NODE ?? null, node: process.versions.node,
    expectedNpm: process.env.WANT_NPM ?? null, npm: npm.stdout.trim(),
    expectedPlatform: process.env.WANT_PLATFORM ?? null, platform: process.platform,
    workflowSha: process.env.GITHUB_WORKFLOW_SHA ?? null,
  };
}

function verifyIdentity(receipt) {
  assert.match(receipt.actualSha, /^[a-f0-9]{40}$/);
  for (const [expected, actual] of [['expectedSha', 'actualSha'], ['expectedNode', 'node'],
    ['expectedNpm', 'npm'], ['expectedPlatform', 'platform']]) {
    if (process.env.GITHUB_ACTIONS === 'true') assert.ok(receipt[expected], `missing ${expected}`);
    if (receipt[expected] !== null) assert.equal(receipt[actual], receipt[expected], expected);
  }
}

function killTree(child) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    const result = spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'],
      { env: childEnv(''), encoding: 'utf8', timeout: 10_000 });
    if (result.status !== 0) child.kill('SIGKILL');
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); }
    catch { child.kill('SIGKILL'); }
  }
}

async function runChild(file, mode) {
  const args = ['--experimental-test-module-mocks', '--import', 'tsx', '--test',
    '--test-reporter=tap', '--test-concurrency=1'];
  if (mode === 'light') args.push(`--test-skip-pattern=${SKIP_PATTERN}`);
  args.push(file);
  try {
    return await new Promise((settle) => {
      const child = spawn(process.execPath, args, { env: childEnv(file),
        detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '', failure = null;
      const stop = (reason) => { failure ??= reason; killTree(child); };
      const timer = setTimeout(() => stop('child watchdog expired'), CHILD_DEADLINE_MS);
      const onSignal = () => stop('driver interrupted');
      process.on('SIGINT', onSignal);
      process.on('SIGTERM', onSignal);
      const collect = (chunk, isError) => {
        if (stdout.length + stderr.length + chunk.length > OUTPUT_LIMIT) {
          if (!failure) stop('child output limit exceeded');
          return;
        }
        if (isError) stderr += chunk.toString(); else stdout += chunk.toString();
      };
      child.stdout.on('data', (chunk) => collect(chunk, false));
      child.stderr.on('data', (chunk) => collect(chunk, true));
      child.once('error', (error) => { failure ??= error.message; });
      // close, not exit: descendants and both output pipes must be drained first.
      child.once('close', (code, signal) => {
        clearTimeout(timer);
        process.off('SIGINT', onSignal);
        process.off('SIGTERM', onSignal);
        settle({ args, pid: child.pid, code, signal, stdout, stderr, failure });
      });
    });
  } catch (error) { throw new Error(`filesystem child failed to launch: ${error.message}`); }
}

function verifyTap(result, index, mode) {
  assert.equal(result.failure, null, result.failure ?? 'child failure');
  assert.equal(result.signal, null, 'child terminated by signal');
  assert.equal(result.code, 0, `child exit ${result.code}`);
  assert.match(result.stdout, /^TAP version 13\r?$/m, 'missing TAP reporter');
  const rows = [...result.stdout.matchAll(/^\s*(ok|not ok) \d+ - (.+?)(?: # (SKIP|TODO)\b.*)?\r?$/gm)]
    .map((row) => ({ name: row[2], pass: row[1] === 'ok' && !row[3], directive: row[3] }));
  assert.ok(rows.length > 0, 'no test rows');
  assert.ok(!rows.some((row) => !row.pass && !row.directive), 'failed TAP row');
  if (mode === 'light') assert.ok(!rows.some((row) => row.pass && /hosted CI/.test(row.name)), 'heavy PASS in light mode');
  const required = [...ANCHORS[index], ...(index === 1 && mode === 'hosted-heavy' ? HEAVY : [])];
  for (const name of required) {
    const matches = rows.filter((row) => row.name === name);
    assert.ok(matches.length && matches.every((row) => row.pass), `missing required PASS: ${name}`);
  }
  return rows;
}

async function main() {
  const opts = options(process.argv.slice(2));
  mkdirSync(opts.outputDir); // EEXIST deliberately rejects stale/previous receipts.
  const receipt = { mode: opts.mode, files: [], exitStatus: 1 };
  try {
    Object.assign(receipt, identity());
    verifyIdentity(receipt);
    opts.testRoot = realpathSync(opts.testRoot);
    for (const name of FILES) assert.ok(lstatSync(join(opts.testRoot, name)).isFile(), `missing regular test: ${name}`);
    for (const [index, name] of FILES.entries()) {
      const result = await runChild(join(opts.testRoot, name), opts.mode);
      writeFileSync(join(opts.outputDir, `${name}.tap`), result.stdout || '# child produced no TAP\n');
      const fileReceipt = { name, ...receipt, files: undefined, ...result, rows: [], exitStatus: 1 };
      delete fileReceipt.stdout;
      try {
        fileReceipt.rows = verifyTap(result, index, opts.mode);
        fileReceipt.exitStatus = 0;
      } catch (error) { fileReceipt.failure = error.message; }
      writeFileSync(join(opts.outputDir, `${name}.json`), JSON.stringify(fileReceipt, null, 2));
      receipt.files.push({ name, exitStatus: fileReceipt.exitStatus, failure: fileReceipt.failure });
      if (fileReceipt.exitStatus) {
        receipt.exitStatus = result.code > 0 ? result.code : 1;
        throw Object.assign(new Error(`${name}: ${fileReceipt.failure}`), { exitCode: receipt.exitStatus });
      }
    }
    receipt.exitStatus = 0;
  } catch (error) {
    receipt.failure = error.message;
    throw error;
  } finally {
    writeFileSync(join(opts.outputDir, 'summary.json'), JSON.stringify(receipt, null, 2));
  }
}

try { await main(); }
catch (error) { console.error(`[agy-artifact-check] ${error.message}`); process.exitCode = error.exitCode ?? 1; }
