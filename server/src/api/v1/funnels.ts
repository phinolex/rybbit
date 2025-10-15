import { FastifyInstance } from "fastify";
import { z } from "zod";
import type { FunnelRecord } from "../../services/projects/funnelService.js";
import {
  createFunnel,
  deleteFunnel,
  FunnelInput,
  getFunnel,
  getFunnelStats,
  listFunnels,
  updateFunnel,
} from "../../services/projects/funnelService.js";

const stepSchema = z.object({
  key: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  order: z.number().int().nonnegative().optional(),
  page_pattern: z.string().max(2048).optional(),
});

const funnelSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(512).optional(),
  is_active: z.boolean().optional(),
  steps: z.array(stepSchema).min(1),
});

const updateSchema = funnelSchema.partial().extend({
  steps: z.array(stepSchema).min(1).optional(),
});

const statsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

type IdParams = {
  id: string;
};

function mapFunnel(funnel: FunnelRecord) {
  return {
    id: funnel.id,
    name: funnel.name,
    description: funnel.description,
    is_active: funnel.isActive,
    created_at: funnel.createdAt,
    updated_at: funnel.updatedAt,
    steps: funnel.steps.map(step => ({
      id: step.id,
      key: step.key,
      name: step.name,
      order: step.order,
      page_pattern: step.pagePattern,
    })),
  };
}

function mapFunnelResponse(funnel: FunnelRecord | null) {
  return funnel ? mapFunnel(funnel) : null;
}

export async function registerFunnelRoutes(server: FastifyInstance) {
  server.post("/", async (request, reply) => {
    if (!request.project) {
      return reply.status(500).send({ error: "Project context missing" });
    }

    const parsed = funnelSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid payload", details: parsed.error.issues });
    }

    const input: FunnelInput = {
      name: parsed.data.name,
      description: parsed.data.description,
      isActive: parsed.data.is_active,
      steps: parsed.data.steps.map(step => ({
        key: step.key,
        name: step.name,
        order: step.order,
        pagePattern: step.page_pattern,
      })),
    };

    try {
      const funnel = await createFunnel(request.project.id, input);
      return reply.status(201).send({ data: mapFunnelResponse(funnel) });
    } catch (error) {
      request.log.error(error, "Failed to create funnel");
      return reply.status(500).send({ error: "Failed to create funnel" });
    }
  });

  server.get("/", async (request, reply) => {
    if (!request.project) {
      return reply.status(500).send({ error: "Project context missing" });
    }
    const funnels = await listFunnels(request.project.id);
    return reply.send({
      data: funnels.map(mapFunnel),
    });
  });

  server.get<{ Params: IdParams }>("/:id", async (request, reply) => {
    if (!request.project) {
      return reply.status(500).send({ error: "Project context missing" });
    }

    const funnel = await getFunnel(request.project.id, request.params.id);
    if (!funnel) {
      return reply.status(404).send({ error: "Funnel not found" });
    }
    return reply.send({ data: mapFunnelResponse(funnel) });
  });

  server.patch<{ Params: IdParams }>("/:id", async (request, reply) => {
    if (!request.project) {
      return reply.status(500).send({ error: "Project context missing" });
    }

    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid payload", details: parsed.error.issues });
    }

    const input: Partial<FunnelInput> = {};
    if (parsed.data.name !== undefined) input.name = parsed.data.name;
    if (parsed.data.description !== undefined) input.description = parsed.data.description;
    if (parsed.data.is_active !== undefined) input.isActive = parsed.data.is_active;
    if (parsed.data.steps) {
      input.steps = parsed.data.steps.map(step => ({
        key: step.key,
        name: step.name,
        order: step.order,
        pagePattern: step.page_pattern,
      }));
    }

    const funnel = await updateFunnel(request.project.id, request.params.id, input);
    if (!funnel) {
      return reply.status(404).send({ error: "Funnel not found" });
    }
    return reply.send({ data: mapFunnelResponse(funnel) });
  });

  server.delete<{ Params: IdParams }>("/:id", async (request, reply) => {
    if (!request.project) {
      return reply.status(500).send({ error: "Project context missing" });
    }

    const success = await deleteFunnel(request.project.id, request.params.id);
    if (!success) {
      return reply.status(404).send({ error: "Funnel not found" });
    }
    return reply.status(204).send();
  });

  server.get<{ Params: IdParams }>("/:id/stats", async (request, reply) => {
    if (!request.project) {
      return reply.status(500).send({ error: "Project context missing" });
    }

    const parsedQuery = statsQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return reply.status(400).send({ error: "Invalid query parameters", details: parsedQuery.error.issues });
    }

    const stats = await getFunnelStats(request.project.id, request.params.id, parsedQuery.data);
    if (!stats) {
      return reply.status(404).send({ error: "Funnel not found" });
    }

    return reply.send({ data: stats });
  });
}
