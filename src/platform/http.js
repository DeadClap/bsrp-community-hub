import { AppError } from "../shared/errors.js";

export function json(response, payload, statusCode = 200) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload, null, 2));
  return payload;
}

export function text(response, payload, statusCode = 200, contentType = "text/plain; charset=utf-8") {
  response.statusCode = statusCode;
  response.setHeader("content-type", contentType);
  response.end(payload);
  return payload;
}

export function html(response, payload, statusCode = 200) {
  return text(response, payload, statusCode, "text/html; charset=utf-8");
}

export function noContent(response) {
  response.statusCode = 204;
  response.end();
}

export async function parseJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function notFound(response, payload) {
  return json(response, payload, 404);
}

export function sendError(response, error) {
  if (error instanceof AppError) {
    return json(
      response,
      {
        error: error.message,
        details: error.details,
      },
      error.statusCode,
    );
  }

  return json(
    response,
    {
      error: "internal_error",
      message: error.message,
    },
    500,
  );
}
