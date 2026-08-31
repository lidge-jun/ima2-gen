# v3.12.0 preview consumer incident RCA

## Symptom and boundary trace

- Release run 33072885524 failed while waiting for preview publish run 33073607259.
- `prepare`, `package`, and Windows Node 24/npm 12 succeeded.
- Windows Node 22/npm 11 job 98523042246 failed only at step 8, `Update a real global install and probe package-local OAuth`.
- The log shows clean tarball install = 410006ms, baseline install = 151655ms, then the second tarball install ran for 338536ms before GitHub killed the whole step at 15 minutes.
- The script's own per-install deadline is 420000ms, so the outer workflow timeout preempted the labeled child deadline.
- npm `latest` and `preview` remained on v3.11.0-derived artifacts; v3.12.0 has no tag or npm artifact.

## Competing hypotheses

### H1 — outer/inner timeout contract mismatch (accepted)

- Prediction: successful child operations can cumulatively consume the whole 15-minute step even though no individual operation exceeds its 420-second deadline.
- Evidence: 410006ms + 151655ms + at least 338536ms = 900197ms before the timeout, excluding sync checks and setup. The first two operations succeeded; the third was still below its own 420000ms deadline.
- Falsifier: an individual child deadline/error before 15 minutes, or a workflow budget already greater than the sum of invoked child deadlines. Neither occurred.

### H2 — second tarball install deadlocked (rejected)

- Prediction: the tree-owned child would exceed 420000ms and `runWithDeadline` would kill it with a `tarball-install` error.
- Evidence against: GitHub killed the outer step at 338536ms into that child, before the script's deadline could decide. The first tarball install completed at 410006ms on the same runner.
- Remaining risk: the retry run still must prove the second install completes; the fix does not weaken its 420000ms child deadline.

### H3 — npm 11 cannot perform the update path (rejected)

- Prediction: clean install, baseline install, or update would return a deterministic npm error.
- Evidence against: clean tarball and baseline installs returned status 0; the prior v3.11.0 Node 22 preview consumer completed the same path, and no npm error appeared in the failed log.

## Causal mechanism

The smoke deliberately executes two full tarball installs plus one registry baseline install. Each install may validly take up to seven minutes and is independently tree-killed with a labeled error. The workflow wrapped the whole sequence in 15 minutes, so a slow-but-valid first install consumed nearly half the total budget and the outer runner killed the second install before its own guard could fire. The fix must make the outer timeout a checked envelope around the internal prepacked execution budget; retrying unchanged or merely accepting a rerun is forbidden.

## Recovery choice

- Do not force main/preview back to the bootstrap SHA.
- Fast-forward dev/main with the workflow fix on top of the unpublished v3.12.0 candidate.
- Run the canonical release workflow with `bump=patch`; v3.12.1 becomes the first published 3.12 release.
