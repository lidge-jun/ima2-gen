/**
 * Client-side ceilings for a whole video request, shared by the CLI, the MCP lane, and the
 * budget contract test so none of them can drift apart.
 *
 * The server worst case for one Grok video is
 *   1500 s planning + 300 s start + 1800 s poll + 300 s poll overshoot + 300 s download
 *   = 4200 s
 * (the poll loop checks its deadline BEFORE each request, so the final poll can exceed the
 * poll budget by one request timeout). Every client must sit ABOVE that with real slack —
 * an equal ceiling is a race the client can win, abandoning a request the server would
 * have completed.
 *
 * MUST stay a leaf module: no imports, so bin/, ui/, and tests can all read it.
 * devlog/_plan/260817_grok_video_planner_timeout/010_timeout_budgets.md
 */
export const VIDEO_CLIENT_TIMEOUT_SEC = 5400;
export const VIDEO_CLIENT_TIMEOUT_MS = VIDEO_CLIENT_TIMEOUT_SEC * 1000;
