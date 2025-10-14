import type { FastifyPluginAsync } from "fastify";
import { authenticateProject } from "./middleware.js";
import { registerEventRoutes } from "./events.js";
import { registerFunnelRoutes } from "./funnels.js";
import { registerStatsRoutes } from "./stats.js";
import { registerRealtimeRoutes } from "./realtime.js";
import { registerUserRoutes } from "./users.js";

export const apiV1Routes: FastifyPluginAsync = async server => {
  server.addHook("onRequest", authenticateProject);

  server.register(async child => registerEventRoutes(child), { prefix: "/events" });
  server.register(async child => registerFunnelRoutes(child), { prefix: "/funnels" });
  server.register(async child => registerStatsRoutes(child), { prefix: "/stats" });
  server.register(async child => registerUserRoutes(child), { prefix: "/users" });
  server.register(async child => registerRealtimeRoutes(child), { prefix: "/realtime" });
};

export default apiV1Routes;
