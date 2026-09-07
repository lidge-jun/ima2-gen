# WP11 A — two documentation findings resolved without expansion

Noether01a07503-63d8-7f23-b957-56091efad1b6 at34e67201 returned GO-WITH-FIXES,
two blockers; accepted Windows safety/removal and existing release-freshness proof.

1. Main accepts consistency cleanup:112 explicitly overrides110, but leaving the
withdrawn standalone checker blueprint/manifests/commands in110 invites accidental
implementation. Remove those rows, script/test commands and blueprint; replace with
the exact existing clean-checkout prepack plus installed .js proof. No product
acceptance or existing CI gate is removed. The optional local comparison utility
is explicitly not delivered, as the owner instructed against foundation expansion.
2. Main accepts registry shape ambiguity. Canonical111type already gives dist only
to registry.exact. Clarify prose accordingly: exact requires integrity/tarball;
both exact/latest still require version/gitHead equality. latest.dist is not part
of this boundary. Existing provenance finalization remains required before install.
Tests cover missing exact dist and matching/minimally shaped latest metadata;
no second helper, registry request family or new schema is needed.

Same reviewer rechecks110/111/112/113 and runs the safe baseline commands to verify
their existence/coverage. No production changes are permitted until A closes.
