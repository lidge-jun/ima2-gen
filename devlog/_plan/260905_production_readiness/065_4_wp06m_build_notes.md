# WP06m B — checkpoint evidence

Main's actual shared-isolation sentinel regression failed against the old guard:
exec and execFile each reached their harmless custom async function once while
the direct denied function was not reached. No native process ran. After fresh
descriptor-based deny replacements, both direct/promisified paths reject, both
sentinel counts are0, and exact restoration checks pass.

The setup-failure test now injects a one-shot descriptor read at spawnSync and
closes any unexpected successful isolation. Existing25 harness cases pass,
including failure restoration, persistent violations and held write/cleanup.
These are focused B checks, not final-head CI or video acceptance.

Eight disjoint worker lanes are implementing the audited plan. Runtime checks
requiring new emitted modules wait for main graph-ready. Source/codec/stream/
caller completion and any integration findings will be recorded before C.
