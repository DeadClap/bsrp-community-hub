import { Readable } from "node:stream";

function compilePath(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  const keys = [];
  const pattern = parts
    .map((part) => {
      if (part.startsWith(":")) {
        keys.push(part.slice(1));
        return "([^/]+)";
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");

  return {
    keys,
    regex: new RegExp(`^/${pattern}$`),
  };
}

export function createRouter() {
  const routes = [];

  function register(method, path, handler) {
    routes.push({ method, handler, ...compilePath(path) });
  }

  async function handle(request, response) {
    const url = new URL(request.url, "http://localhost");

    for (const route of routes) {
      if (route.method !== request.method) {
        continue;
      }

      const match = url.pathname.match(route.regex);
      if (!match) {
        continue;
      }

      const params = Object.fromEntries(route.keys.map((key, index) => [key, match[index + 1]]));
      await route.handler(request, response, params);
      return true;
    }

    return false;
  }

  async function inject({ method = "GET", path = "/", headers = {}, body }) {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const request = Readable.from(payload ? [Buffer.from(payload)] : []);
    request.method = method;
    request.url = path;
    request.headers = headers;

    let raw = "";
    const response = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
      },
      end(chunk = "") {
        raw += chunk;
      },
    };

    await handle(request, response);

    const contentType = response.headers["content-type"] ?? "";
    const parsedBody = raw
      ? contentType.includes("application/json")
        ? JSON.parse(raw)
        : raw
      : null;

    return {
      statusCode: response.statusCode,
      headers: response.headers,
      body: parsedBody,
    };
  }

  return {
    get: (path, handler) => register("GET", path, handler),
    post: (path, handler) => register("POST", path, handler),
    delete: (path, handler) => register("DELETE", path, handler),
    handle,
    inject,
  };
}
