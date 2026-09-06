# WP05 B integration — observed failures and scoped corrections

## Default DNS trap also intercepted server bind

Pure network fixture safety passed, but the first actual RouteHarness run failed:
Node net.lookupAndListen invokes dns.lookup even for literal127.0.0.1.
The main-owned test child hit its60s safety deadline after dependent writer latches
could not start. Process exited1; ps confirmed no matching harness processes left.
No external DNS/provider traffic escaped; this was over-blocking, not a green run.

Final selected correction: exported test-only listenOwnedLoopback(callback) in
_grokImageTransportFixture.ts. During the synchronous server.listen call only,
it supplies literal127.0.0.1 by nextTick with family/all support. Every other host
throws; it never delegates nativeDNS. Original property descriptor is restored
immediately, named ESM outbound trap remains unchanged. No global numeric allowlist.
RouteHarness and standalonelegacy fixtures reuse the same helper.

Main reread the helpers and independently ran final fullharness24/24PASS,
including actualpinnedGET/call/DNS counters, postabortexceptionledger, descriptor
rollback, heldpump/directwork/detachedwrite teardown, and retained timeout state.
Main authorizes only controlledfake-network small runtime tests at this point.

## Test compiler deltas

Headers iteration in the test DOM type environment was replaced with forEach,
without changing tsconfig. Test-only union values require actual Array.isArray,
PromiseSettledResult status and precise fake-interface narrowing; no production
type policy was weakened. Main latesttest compiler after these fixesexit0.

## Reported worker execution deviation

Download-test worker reported that its first malformed name filter ran four
CI-only50MiB boundary cases locally. This violated the phase's resource split.
No realprovider/DNS/network calls occurred: these were interceptedfixture cases.
The worker stopped furtherheavyexecution and used an explicit small-case whitelist
plus skip pattern afterward. Main disclosed the deviation to the user and does
not count it as authorization to run morestress locally. Remainingheavy cases
stay in hostedexact-headCI. Record theactualcommands with the worker finalproof.

## Native pinning safety gate

Main read the nativepinningtest beforeallowing it. Input-validation spy restricts
HTTPtoexactownednamedorigin/port/path, bansconnection overrides and allHTTPS; TCP
remainsreal. DNSmockreturns127 only; missinglookuphits throwing defaultDNSsentinel.
Main additionally requires the spy to validatecustomlookup's returned address(es)
are127/family4 beforeNodeconnect, so even a futureDUTwrongaddressbug cannot make a
publicconnection. No coercion/fake success; badresultsfail. The ownedserver is
boundbeforeDNSguards. Actualnativecase remains pending this finalguard andmainrun.

Finalguard now validates each customlookup result is literal127.0.0.1/numeric4
beforeforwarding unchanged values toNode. Mainreadandran theentirepinningfile:
pure inputguard+returnedaddressguard+actualownedloopback3/3PASS. Realserver/socket
closed assertions passed; no defaultDNS query or publicconnection occurred.
