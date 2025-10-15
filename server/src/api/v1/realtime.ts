import { FastifyInstance } from "fastify";
import { getRealtimeStats } from "../../services/projects/statsService.js";

export async function registerRealtimeRoutes(server: FastifyInstance) {
  server.get("/visitors", async (request, reply) => {
    if (!request.project) {
      return reply.status(500).send({ error: "Project context missing" });
    }

    reply.header("Content-Type", "text/event-stream");
    reply.header("Cache-Control", "no-cache");
    reply.header("Connection", "keep-alive");

    const stream = reply.raw;

    const sendUpdate = async () => {
      const data = await getRealtimeStats(request.project!.id);
      stream.write(`event: update\n`);
      stream.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const interval = setInterval(sendUpdate, 5000);
    await sendUpdate();

    request.raw.on("close", () => {
      clearInterval(interval);
    });

    return reply;
  });
}
