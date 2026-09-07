# WP11 C — owner-authorized Tailscale diagnostic lane

Owner now requests ../fuck-powershell guidance, fast tests over Windows SSH and
asynchronous independent work. Actual reference path is ../fuck-powershell.
SSH alias desktop-c795oh4 reaches100.79.88.1; read-only probe confirms Windows
10.0.26200.9168 and Node24.19.0. Use owned temporary subdirectories only, no
business/user-data directories, credentials, global installs or service changes.
SSH default shell is /usr/bin/bash (Git Bash), not cmd.exe. cmd /c was affected
by that extra parsing layer. PowerShell encoded payloads work; do not alter SSH
settings to compensate. Native ProcessStartInfo needs explicit WorkingDirectory.

This extends diagnostic execution authority, not completion criteria. Never spoof
GITHUB_ACTIONS/RUNNER_ENVIRONMENT on this personal host. Hosted-only tests remain
hosted; pure owned filesystem/process probes may run remotely. Actual full CI
with pinned Node22/24 remains required before final acceptance. No full local suite.

Reference queries: powershell/quoting and node/env-path. Relevant cases include
prose-as-unknown-flags, node-path-host-delimiter, env-path-vs-PATH-casing,
bom-less-ps1 and irm-iex-kills-host. The last exposes an existing installer issue:
Fail currently exits the caller under the documented irm|iex path; use a
catchable failure while retaining nonzero standalone execution. Verify with a
synthetic unsupported-Node wrapper, never a real install on the workstation.

Parallel ownership under this new instruction: main owns remote fixture staging,
canonical-root/watch diagnosis, installer Fail behavior and integration. One
bounded worker may own only tests/_executionTestProcess.ts, removing the native
Windows-injected USERPROFILE at verified fixture-child entry without allowing
home/config paths or loosening assertions. No remote commands or other file writes
by the worker. Main reviews the delta and verifies it against owned Windows probes.
No speculative later-WP implementation or new test framework.

Prior diagnostic34014485364 atd22c0a19 confirmed profile synthesis with and without
tsx, and watch events on newly created src/public/fonts directories. FFmpeg
relativeEmpty=false rejects alias/canonical mismatches; do not broaden containment.
Investigate canonical fixture roots before any watcher change. Keep all prior
failed evidence and preserve scripts/recording/. Scope/resource bounds from112
remain; reassess the existing four-hour WP bound, not a new unbounded effort.

Personal-host PowerShell -File execution was refused by its execution policy.
Both initial IEx wrapper results are invalid as application evidence because the
wrapper never loaded. No execution-policy change or workaround was attempted.
The added IEx case remains for the already authorized GitHub-hosted test lane;
do not label it personal-host validation. Node-owned probes below were executed.
