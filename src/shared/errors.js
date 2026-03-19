export class AppError extends Error {
  constructor(statusCode, message, details = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function badRequest(message, details) {
  throw new AppError(400, message, details);
}

export function unauthorized(message = "Unauthorized", details) {
  throw new AppError(401, message, details);
}

export function forbidden(message = "Forbidden", details) {
  throw new AppError(403, message, details);
}

export function notFound(message = "Not found", details) {
  throw new AppError(404, message, details);
}
