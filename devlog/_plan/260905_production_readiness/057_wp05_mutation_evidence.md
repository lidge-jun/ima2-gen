# WP05 C — actual negative activation and restoration

Baseline code/test checkpoint71b72dd7. All B workers closed before mutations.
No publicnetwork/provider calls; ownedloopback only forpinning, fakeupstream for
sparse fixture. Exacthunks restored immediately and rebuilt where applicable.

## Sparse index identity

Changed only final sweep `index` to compactposition instead oforiginalIndexes.
Rebuiltserver; selected actualroute `G05-7 grok-api sparse-one async` failed
exit1 with2actual vs1expected outputs. Restoredoriginalindexexpression, rebuilt,
samecasepassed exit0. This is actualroute persistence, not a result-only mock.

## Pinned connection lookup

Temporarily replaced the request's customlookup withundefined; a no-op reference
kept the unused-function compiler warning from masking runtime verification.
Selected native named-loopback testfailed exit1. Temporary diagnostic at the
existing defaultDNS sentinel printed `WP05_MUTATION_DEFAULT_DNS_GUARD 1`, proving
the missinglookup was caught before any publicDNS/connect. Publicwrapper safely
reportedGROK_IMAGE_DOWNLOAD_FAILED502. Restoredlookup/no-op/diagnostic exacthunks,
rebuilt; same nativecasepassed exit0 and its realserver/socketclose assertions.
No guardcoerced a badaddressinto success and no broadertransport was allowed.

## Retry-response boundary

Temporarily returned rawPinnedImageResponse in placeoftypedretryadapter, keeping
only a no-op reference to avoid an unrelated unused-function diagnostic.
Servertypecheckfailed exit2:TS2345 rawresponse lacksrequiredok, plusTS2339 source
missing onRetryResponse. Restoredadapterline; samecompilerpassed exit0.
No runtime execution was needed for this type-negative case.

## Evidence and scope

RawRED outputs are in sessionevidence wp05/sparse-red.txt,lookup-red.txt and
retry-type-red.txt. `git diff` ofallmutatedsource/testpaths is empty afterrestore.
No mutationcommitted/pushed. Final current-head fullCI/securityscan/independent
reviews/heavybounds/manualQA remain required; mutation evidence alone is not DONE.
