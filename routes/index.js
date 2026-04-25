import { registerHealthRoutes } from "./health.js";
import { registerHistoryRoutes } from "./history.js";
import { registerSessionRoutes } from "./sessions.js";
import { registerEditRoutes } from "./edit.js";
import { registerNodeRoutes } from "./nodes.js";
import { registerGenerateRoutes } from "./generate.js";
import { registerStorageRoutes } from "./storage.js";

export function configureRoutes(app, ctx) {
  registerHealthRoutes(app, ctx);
  registerStorageRoutes(app, ctx);
  registerHistoryRoutes(app, ctx);
  registerSessionRoutes(app, ctx);
  registerEditRoutes(app, ctx);
  registerNodeRoutes(app, ctx);
  registerGenerateRoutes(app, ctx);
}
