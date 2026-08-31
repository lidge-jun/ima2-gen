# 034 — wp3 audit round 3 synthesis

Reviewer verdict: FAIL. One contradiction accepted.

The plan no longer classifies by `nai-diffusion-*` prefix. The helper derives the four
exact image IDs from `getProvider("nai").models`, matching `modelResolver` exact equality.
Bare and `nai/<exact-id>` forms are accepted; an ID-shaped typo is not silently promoted
to a NAI target.
