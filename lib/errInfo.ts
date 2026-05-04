export interface ErrInfo {
  message: string;
  code: string | undefined;
  status: number | undefined;
  name: string | undefined;
  cause: unknown;
  stack: string | undefined;
  raw: unknown;
}

/** Narrow an unknown thrown value to a stable info shape. */
export function errInfo(e: unknown): ErrInfo {
  if (e instanceof Error) {
    const anyE = e as Error & { code?: unknown; status?: unknown; cause?: unknown };
    return {
      message: e.message,
      code: typeof anyE.code === "string" ? anyE.code : undefined,
      status: typeof anyE.status === "number" ? anyE.status : undefined,
      name: e.name,
      cause: anyE.cause,
      stack: e.stack,
      raw: e,
    };
  }
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    return {
      message: typeof o.message === "string" ? o.message : String(e),
      code: typeof o.code === "string" ? o.code : undefined,
      status: typeof o.status === "number" ? o.status : undefined,
      name: typeof o.name === "string" ? o.name : undefined,
      cause: o.cause,
      stack: typeof o.stack === "string" ? o.stack : undefined,
      raw: e,
    };
  }
  return { message: String(e), code: undefined, status: undefined, name: undefined, cause: undefined, stack: undefined, raw: e };
}

/** Handy for `throw e instanceof Error ? e : asError(e)`. */
export function asError(e: unknown): Error {
  return e instanceof Error ? e : new Error(typeof e === "string" ? e : JSON.stringify(e));
}
