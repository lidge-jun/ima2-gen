import test from "node:test";
import assert from "node:assert/strict";
import { classifyUpstreamError, classifyUpstreamErrorCode } from "../lib/errorClassify.js";

test("moderation refused", () => {
  assert.equal(classifyUpstreamError("moderation_blocked"), "MODERATION_REFUSED");
  assert.equal(classifyUpstreamError("moderation refused"), "MODERATION_REFUSED");
});

test("generic retry wrapper is not treated as moderation", () => {
  assert.equal(classifyUpstreamError("Content generation refused after retries"), "UNKNOWN");
});

test("upstream validation errors map to invalid request", () => {
  assert.equal(classifyUpstreamErrorCode("invalid_value"), "INVALID_REQUEST");
  assert.equal(classifyUpstreamErrorCode("invalid_request_error"), "INVALID_REQUEST");
  assert.equal(classifyUpstreamError("Invalid size '512x512'"), "INVALID_REQUEST");
  assert.equal(
    classifyUpstreamError("Requested resolution is below the current minimum pixel budget."),
    "INVALID_REQUEST",
  );
});

test("ChatGPT sign-in expired before api-key checks", () => {
  assert.equal(classifyUpstreamError("Provided authentication token is expired"), "AUTH_CHATGPT_EXPIRED");
  assert.equal(classifyUpstreamError("Please sign in again to continue"), "AUTH_CHATGPT_EXPIRED");
  assert.equal(classifyUpstreamError("Access token expired. Please reauth."), "AUTH_CHATGPT_EXPIRED");
});

test("API key errors", () => {
  assert.equal(classifyUpstreamError("Incorrect API key provided: sk-xxx"), "AUTH_API_KEY_INVALID");
  assert.equal(classifyUpstreamError("Invalid Authentication"), "AUTH_API_KEY_INVALID");
  assert.equal(classifyUpstreamError("You exceeded your current quota"), "AUTH_API_KEY_INVALID");
  assert.equal(classifyUpstreamError("Incorrect organization ID"), "AUTH_API_KEY_INVALID");
});

test("network failures", () => {
  assert.equal(classifyUpstreamError("failed to fetch"), "NETWORK_FAILED");
  assert.equal(classifyUpstreamError("connect ECONNREFUSED 127.0.0.1:1455"), "NETWORK_FAILED");
  assert.equal(classifyUpstreamError("getaddrinfo ENOTFOUND api.openai.com"), "NETWORK_FAILED");
});

test("upstream 5xx", () => {
  assert.equal(
    classifyUpstreamError("An error occurred while processing your request. You can retry"),
    "UPSTREAM_5XX",
  );
  assert.equal(classifyUpstreamError("Request failed with 503"), "UPSTREAM_5XX");
});

test("oauth proxy unavailable", () => {
  assert.equal(classifyUpstreamError("OAuth proxy is not running"), "OAUTH_UNAVAILABLE");
  assert.equal(classifyUpstreamError("OAuth proxy is not ready yet"), "OAUTH_UNAVAILABLE");
});

test("falls back to UNKNOWN", () => {
  assert.equal(classifyUpstreamError(""), "UNKNOWN");
  assert.equal(classifyUpstreamError(undefined), "UNKNOWN");
  assert.equal(classifyUpstreamError("totally random failure message"), "UNKNOWN");
});

test("classifyUpstreamErrorCode does not over-match moderation", () => {
  assert.equal(classifyUpstreamErrorCode("moderation_blocked"), "MODERATION_REFUSED");
  assert.equal(classifyUpstreamErrorCode("moderation refused"), "MODERATION_REFUSED");
  assert.equal(classifyUpstreamErrorCode("invalid_moderation"), "UNKNOWN");
  assert.equal(classifyUpstreamErrorCode("moderation_timeout"), "UNKNOWN");
  assert.equal(classifyUpstreamErrorCode("unknown"), "UNKNOWN");
});

test("chatgpt expiry wins over generic token", () => {
  assert.equal(classifyUpstreamError("your session token has expired"), "AUTH_CHATGPT_EXPIRED");
});
