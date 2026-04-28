import { registerHealthRoutes } from "./health.js";
import { registerHistoryRoutes } from "./history.js";
import { registerSessionRoutes } from "./sessions.js";
import { registerEditRoutes } from "./edit.js";
import { registerNodeRoutes } from "./nodes.js";
import { registerGenerateRoutes } from "./generate.js";
import { registerMultimodeRoutes } from "./multimode.js";
import { registerStorageRoutes } from "./storage.js";
import { registerCardNewsRoutes } from "./cardNews.js";
import { registerMetadataRoutes } from "./metadata.js";
import { registerPromptRoutes } from "./prompts.js";
import { registerAnnotationRoutes } from "./annotations.js";
import { registerCanvasVersionRoutes } from "./canvasVersions.js";
import { registerComfyRoutes } from "./comfy.js";

export function configureRoutes(app, ctx) {
  registerHealthRoutes(app, ctx);
  registerStorageRoutes(app, ctx);
  registerMetadataRoutes(app, ctx);
  registerHistoryRoutes(app, ctx);
  registerAnnotationRoutes(app, ctx);
  registerCanvasVersionRoutes(app, ctx);
  registerComfyRoutes(app, ctx);
  registerSessionRoutes(app, ctx);
  registerEditRoutes(app, ctx);
  registerNodeRoutes(app, ctx);
  if (ctx.config.features.cardNews) registerCardNewsRoutes(app, ctx);
  registerMultimodeRoutes(app, ctx);
  registerGenerateRoutes(app, ctx);
  registerPromptRoutes(app, ctx);
}
