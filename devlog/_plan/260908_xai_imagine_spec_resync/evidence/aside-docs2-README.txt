Research captured 2026-09-08. Window: 2026-07-28 through 2026-09-08, X timestamps UTC.

Requested official sources saved at top level, slash paths flattened with __. fetch-manifest*.json preserve successful/404 responses; llms.txt and sitemap.xml are raw snapshots. complete-index-url-inventory.txt and .json preserve all direct thematic pages, adjacent image/collection pages, and cross-product model/pricing/release/batch catalogs (47 pages: 46 llms .md URLs and 47 sitemap URLs). Individual video model detail URLs are additional discoveries, not listed in those two indexes.

Rendered snapshots/text are included because Markdown exports omit warning/callout components. The editing and extension pages have no exclusive-model support sentence. All editing/extension samples select grok-imagine-video; extension JS generates source on 1.5 then extends with the original. Original model lists Video input, 1.5 does not. Treat as documented routing, not an authenticated runtime rejection test.

OpenAPI paths /v1/videos/generations, /edits, /extensions and polling plus /v1/video-generation-models are publicly documented, not hidden endpoints. output.upload_url and compatibility aliases are schema-visible. Custom voices guide has endpoints absent from OpenAPI, which is a cross-documentation gap, not an undocumented discovery.

Reference discrepancy: rendered R2V docs still say maximum 7 images, JS SDK enforces max(7), Python has no local count cap, OpenAPI has no reference_images.maxItems. None proves the runtime limit. User reports live 14-image measurements; this session did not repeat generation calls. Official @imagine 2026-09-02 post confirms up to 14 mixed references but does not specify public API image-object count: https://x.com/imagine/status/2095249317875622255.

September 5 @grok announcement is explicitly an agent upgrade, not a new API model id. https://x.com/grok/status/2096298105213952178.

No authenticated model-list calls or billable generation requests were made. No secret keys were read or saved. Public source models/specs and SDK type hints cannot establish undisclosed model deployment/weights/alias resolution behavior.

Detailed independent source reports: x-research/FINDINGS.txt, sdk-research/FINDINGS.md, news-research/FINDINGS.md. Raw sources remain alongside each. The final user-facing response distinguishes literal source statements from inferences.
