# WP10 C — one stale CLI expectation

Candidate6c26a173 fullCI34010421031: both Node22/24 root jobs fail the same
tests/bin.test.js:84 assertion. Node22 total3232tests/3227pass/1fail/4existing skips;
Node24 failure names `should run doctor` / `doctor should report package Node
requirement`. Product-focused diagnostic and emitted CLI contracts passed.

Hypotheses and falsifiers:
- H1 stale expected literal: disproved if the test already reads engines.node.
  It instead requires `>= 20`; parent doctor hardcoded20 too.
- H2 wrong engine parsing: disproved if the actual helper with package input
  emits the declared requirement. Pure probe returns engine`>=22`, text
  `Node.js v22.23.0 (>=22)`, oldOracle:false/packageOracle:true.
- H3 wrong dispatch/no doctor output: disproved by earlier header assertion
  passing and source standardDoctor calling that helper then printing node.text.

Cause: the planned removal of the hardcoded runtime floor fixed product behavior
but missed one old CLI consumer assertion. Do not restore the incorrect20floor.
Minimum correction: this existing test reads package.json engines.node directly
and requires that exact value in stdout. No production helper is used to generate
its expectation; other header/storage/results/exit assertions remain unchanged.
Reuse the existing one-job WP10 diagnostic workflow to run only this named CLI
case on a hosted runner. No local CLI/account/port probe and no new test case,
fixture layer or guard. This is necessary verification, not auxiliary expansion.

Then aggregate repairs and rerun fullCI/CodeQL at the new exact candidate. Retain
failed evidence and the ongoing prior UI run; it is not final-head acceptance.
