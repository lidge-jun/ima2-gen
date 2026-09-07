# WP11 C repair — stop owned Agent worker before closing its DB

Candidate15146 fullCI34019192374 passed Linux22/24 and CodeQL; Windows22/24
failed one identical agent fixture teardown: EBUSY unlink of owned test.db.
The old MCP timeout did not recur. Keep this candidate failure as evidence;
do not increase deletion retries, suppress the error or widen file protections.

Main inspected agent-mode-runtime-contract, isolation/trackers, db, route
registration and agentQueueWorker. H1 duplicate JS/TS module instance was not
reproduced by a pure owned import/mock-order fixture (same instance, both closes
affect it). H2 polling after DB closure is concrete: registerAgentRoutes calls
ensureAgentQueueWorker (routes/agent.ts:59), which leaves a1500ms interval active
(lib/agentQueueWorker.ts:42). Its empty-queue claim still opens the DB. The test
closed DB and storage without calling the existing worker stop. Async storage
teardown leaves a timer opportunity; getDb reopens a native handle to test.db.

A pure bounded fixture executed the ACTUAL worker module with config/DB/provider
dependencies mocked before import (no real account, network, process or SQLite).
Controlled timer toggle: close-only -> reopened; stop-then-close -> stayed closed;
close-only restored -> reopened. No sleeps. This falsifies a need for extra
Windows permissions or blind EBUSY retries. Native Windows original failure and
same-test fixed run still supply platform acceptance; the pure fixture alone is
not that claim. Evidence lives under evidence/wp11/15146-windows-db-diagnosis.md.

Minimal delta: tests/agent-mode-runtime-contract.test.ts dynamically captures the
existing stopAgentQueueWorker after isolation and calls it before draining writes
and closeDb. All test assertions, account/network/process traps, path containment
and storage deletion checks remain unchanged. No production code or shared new
teardown abstraction. Existing diagnostic workflow now runs only this failing
file with its build prerequisites; full CI reruns after the scoped fix is verified.

No new local full suite or real local app/server/doctor run. User scripts/recording/
is preserved. WP12 still owns the documented MCP observations and security work.
