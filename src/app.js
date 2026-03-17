import { createServer } from "node:http";
import { createPlatformContext } from "./platform/context.js";
import { notFound, sendError } from "./platform/http.js";
import { createRouter } from "./platform/router.js";
import { registerRoutes } from "./routes.js";

export async function createApp({ initialState, config, dependencies } = {}) {
  const context = await createPlatformContext({ initialState, config, dependencies });
  const router = createRouter();

  registerRoutes(router, context);

  const server = createServer(async (request, response) => {
    try {
      const handled = await router.handle(request, response);
      if (!handled) {
        notFound(response, {
          error: "not_found",
          message: `No route for ${request.method} ${request.url}`,
        });
      }
    } catch (error) {
      sendError(response, error);
    }
  });

  return {
    server,
    context,
    inject({ method = "GET", path = "/", headers = {}, body }) {
      return router.inject({ method, path, headers, body });
    },
    async close() {
      server.close();
      await context.close();
    },
  };
}
