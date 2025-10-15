import { FastifyReply, FastifyRequest } from "fastify";
import { projectRateLimiter } from "../../lib/projectRateLimiter.js";
import { createServiceLogger } from "../../lib/logger/logger.js";
import { getProjectByApiKey } from "../../services/projects/projectService.js";

const logger = createServiceLogger("api-v1");

export async function authenticateProject(request: FastifyRequest, reply: FastifyReply) {
  const apiKey = request.headers["x-api-key"];

  if (!apiKey || typeof apiKey !== "string") {
    logger.warn({ path: request.url }, "Missing API key");
    return reply.status(401).send({ error: "Missing API key" });
  }

  const project = await getProjectByApiKey(apiKey);
  if (!project) {
    logger.warn({ path: request.url }, "Invalid API key");
    return reply.status(401).send({ error: "Invalid API key" });
  }

  if (!projectRateLimiter.isAllowed(project.id)) {
    const resetTime = projectRateLimiter.getResetTime(project.id);
    if (resetTime) {
      reply.header("Retry-After", Math.ceil((resetTime - Date.now()) / 1000));
    }
    logger.warn({ projectId: project.id, path: request.url }, "Rate limit exceeded");
    return reply.status(429).send({ error: "Rate limit exceeded" });
  }

  request.project = project;
  request.log.info({ projectId: project.id, path: request.url }, "Authenticated project request");
}
