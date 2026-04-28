import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const oauth = readFileSync("lib/oauthProxy.ts", "utf-8");
const nodes = readFileSync("routes/nodes.ts", "utf-8");

describe("node diagnostics contract", () => {
  it("preserves safe OAuth stream error metadata", () => {
    assert.match(oauth, /logEvent\(scope, "stream_error"/);
    assert.match(oauth, /eventCount/);
    assert.match(oauth, /eventType: data\.type/);
    assert.match(oauth, /err\.eventCount = eventCount/);
  });

  it("logs node attempts and retries with node context", () => {
    assert.match(nodes, /logEvent\("node", "attempt"/);
    assert.match(nodes, /operation/);
    assert.match(nodes, /clientNodeId/);
    assert.match(nodes, /parentNodeId/);
    assert.match(nodes, /errorEventType: lastErr\?\.eventType/);
    assert.match(nodes, /errorEventCount: lastErr\?\.eventCount/);
  });

  it("sends SSE error payloads after headers are committed", () => {
    assert.match(nodes, /if \(res\.headersSent\)/);
    assert.match(nodes, /writeSse\(res, "error"/);
    assert.match(nodes, /outerHttpAlreadyCommitted: res\.headersSent/);
    assert.match(nodes, /sseErrorSent: streamResponse/);
  });

  it("does not collapse stream context into only SAFETY_REFUSAL", () => {
    assert.match(nodes, /logEvent\("node", "final_error"/);
    assert.match(nodes, /upstreamCode: lastErr\?\.upstreamCode \|\| lastErr\?\.code/);
    assert.match(nodes, /errorEventType: lastErr\?\.eventType/);
    assert.match(nodes, /errorEventCount: lastErr\?\.eventCount/);
  });

  it("does not add raw prompt or base64 to diagnostic logs", () => {
    assert.match(nodes, /promptChars: prompt\.length/);
    assert.match(oauth, /imageChars: imageB64\.length/);
    assert.match(oauth, /refsCount: references\.length/);
    assert.doesNotMatch(nodes, /logEvent\("node", "attempt", \{[^}]*prompt:/);
    assert.doesNotMatch(nodes, /logEvent\("node", "attempt", \{[^}]*parentB64/);
    assert.doesNotMatch(oauth, /logEvent\("oauth-edit", "request", \{[^}]*imageB64/);
  });
});
