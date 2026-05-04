export class PromptImportError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "PromptImportError";
    this.code = code;
    this.status = status;
  }
}

export function promptImportError(code: string, message: string, status = 400) {
  return new PromptImportError(code, message, status);
}

export function isPromptImportError(error: unknown) {
  return error instanceof PromptImportError || Boolean((error as { code?: unknown; status?: unknown })?.code && (error as { status?: unknown })?.status);
}
