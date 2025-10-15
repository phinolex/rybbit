import { FastifyInstance } from "fastify";
import { z } from "zod";
import { getOverviewStats, getPageStats, getRealtimeStats } from "../../services/projects/statsService.js";

const overviewQuerySchema = z.object({
  granularity: z.enum(["daily", "monthly", "yearly"]).default("daily"),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const pagesQuerySchema = z.object({
  path: z.string().max(2048).optional(),
  page_url: z.string().max(2048).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function registerStatsRoutes(server: FastifyInstance) {
  server.get("/overview", async (request, reply) => {
    if (!request.project) {
      return reply.status(500).send({ error: "Project context missing" });
    }

    const parsed = overviewQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid query parameters", details: parsed.error.issues });
    }

    const data = await getOverviewStats(request.project.id, {
      granularity: parsed.data.granularity,
      from: parsed.data.from,
      to: parsed.data.to,
    });

    return reply.send({ data });
  });

  server.get("/pages", async (request, reply) => {
    if (!request.project) {
      return reply.status(500).send({ error: "Project context missing" });
    }

    const parsed = pagesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid query parameters", details: parsed.error.issues });
    }

    const data = await getPageStats(request.project.id, {
      path: parsed.data.path,
      pageUrl: parsed.data.page_url,
      from: parsed.data.from,
      to: parsed.data.to,
    });

    return reply.send({ data });
  });

  server.get("/realtime", async (request, reply) => {
    if (!request.project) {
      return reply.status(500).send({ error: "Project context missing" });
    }

    const data = await getRealtimeStats(request.project.id);
    return reply.send({ data });
  });
}
