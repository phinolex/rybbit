import { FastifyInstance } from "fastify";
import { z } from "zod";
import { countUsers, listUsers } from "../../services/projects/userService.js";

const usersQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
  page: z.coerce.number().min(1).max(1000).default(1),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function registerUserRoutes(server: FastifyInstance) {
  server.get("/", async (request, reply) => {
    if (!request.project) {
      return reply.status(500).send({ error: "Project context missing" });
    }

    const parsed = usersQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid query parameters", details: parsed.error.issues });
    }

    const { limit, page, from, to } = parsed.data;
    const offset = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      listUsers(request.project.id, { limit, offset, from, to }),
      countUsers(request.project.id, { from, to }),
    ]);

    return reply.send({
      data: rows.map(row => ({
        visitor_id: row.visitorId,
        visits: row.visits,
        sessions: row.sessions,
        first_seen: row.firstSeen,
        last_seen: row.lastSeen,
      })),
      pagination: {
        limit,
        page,
        total,
      },
    });
  });
}
