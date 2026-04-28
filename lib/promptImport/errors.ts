export class PromptImportError extends Error {
  code: any;
  status: any;
  constructor(code, message, status = 400) {
    super(message);
    this.name = "PromptImportError";
    this.code = code;
    this.status = status;
  }
}

export function promptImportError(code, message, status = 400) {
  return new PromptImportError(code, message, status);
}

export function isPromptImportError(error) {
  return error instanceof PromptImportError || Boolean(error?.code && error?.status);
}
