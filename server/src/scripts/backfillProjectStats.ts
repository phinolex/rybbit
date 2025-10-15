import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/postgres/postgres.js";
import { projectEvents, projects } from "../db/postgres/schema.js";
import { rebuildProjectAggregates } from "../services/projects/statsAggregationService.js";

async function main() {
  const [, , targetProjectId, fromArg, toArg] = process.argv;
  const projectIds =
    targetProjectId && targetProjectId !== "all"
      ? await resolveProjectIds([targetProjectId])
      : await resolveProjectIds();

  if (!projectIds.length) {
    console.log("No projects found for backfill");
    return;
  }

  for (const projectId of projectIds) {
    const range = await db
      .select({
        minOccurredAt: sql<string | null>`MIN(${projectEvents.occurredAt})`,
        maxOccurredAt: sql<string | null>`MAX(${projectEvents.occurredAt})`,
      })
      .from(projectEvents)
      .where(eq(projectEvents.projectId, projectId))
      .limit(1);

    const [row] = range;
    if (!row || !row.minOccurredAt) {
      console.log(`Skipping ${projectId}: no events to backfill`);
      continue;
    }

    const effectiveFrom = fromArg ?? row.minOccurredAt;
    const effectiveTo = toArg ?? row.maxOccurredAt ?? row.minOccurredAt;

    console.log(`Backfilling aggregates for ${projectId} (${effectiveFrom} → ${effectiveTo})`);
    await rebuildProjectAggregates(projectId, effectiveFrom, effectiveTo);
  }

  console.log("Backfill complete");
}

async function resolveProjectIds(filterIds?: string[]): Promise<string[]> {
  if (filterIds?.length) {
    const rows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(inArray(projects.id, filterIds));
    return rows.map(row => row.id);
  }

  const rows = await db.select({ id: projects.id }).from(projects);
  return rows.map(row => row.id);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
