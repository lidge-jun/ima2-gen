// Augment express Request with the request id assigned by lib/requestLogger.js.
import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    id?: string;
  }
}

export {};
