# 053 — final review repair

Final review verdict at `cd74aecb`: FAIL.

## High — missing value-taking CLI flags were silently ignored

The common argv parser represented both an absent flag and a present flag with no value
as `undefined`. `parseNaiCliOptions` therefore saw no NAI option, reached server
discovery, and could generate without the requested option.

Repair:

- `ParsedArgs._present` records every recognized long/short flag occurrence.
- NAI preflight rejects any present value-taking NAI flag whose value is undefined with
  `NAI_FLAG_INVALID`, exit 2, before target/server/file work.
- Generic parser tests cover the missing-value presence marker.
- Shared helper tests cover all nine value-taking NAI flags.
- Built gen/multimode/node tests cover text and JSON modes against an unreachable
  server; every case must remain exit 2 rather than server-unreachable exit 3.

The archive HEAD, final receipt, and fresh final review are regenerated after this fix.
