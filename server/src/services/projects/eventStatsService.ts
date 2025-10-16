import { SQL, and, eq, sql } from "drizzle-orm";
import { db } from "../../db/postgres/postgres.js";
import { projectEvents, projectOverviewDaily } from "../../db/postgres/schema.js";
import { buildDateRangeFilters, normalizeDateToYYYYMMDD } from "../../api/v1/utils/index.js";

export interface EventStatsParams {
  from?: string;
  to?: string;
}

// Moved to utils/dates.ts

export interface EventSummary {
  totalEvents: number;
  uniqueVisitors: number;
  uniqueSessions: number;
  firstSeen: string | null;
  lastSeen: string | null;
}

export async function getEventSummary(projectId: string, params: EventStatsParams): Promise<EventSummary> {
  const filters = buildEventFilters(projectId, params);

  const [row] = await db
    .select({
      totalEvents: sql<number>`COUNT(*)`,
      uniqueVisitors: sql<number>`COUNT(DISTINCT COALESCE(${projectEvents.userHash}, ${projectEvents.sessionHash}, ${projectEvents.id}))`,
      uniqueSessions: sql<number>`COUNT(DISTINCT ${projectEvents.sessionHash})`,
      firstSeen: sql<string | null>`MIN(${projectEvents.occurredAt})`,
      lastSeen: sql<string | null>`MAX(${projectEvents.occurredAt})`,
    })
    .from(projectEvents)
    .where(and(...filters));

  return {
    totalEvents: Number(row?.totalEvents ?? 0),
    uniqueVisitors: Number(row?.uniqueVisitors ?? 0),
    uniqueSessions: Number(row?.uniqueSessions ?? 0),
    firstSeen: row?.firstSeen ? new Date(row.firstSeen).toISOString() : null,
    lastSeen: row?.lastSeen ? new Date(row.lastSeen).toISOString() : null,
  };
}

export interface EventDailyPoint {
  date: string;
  events: number;
  uniqueVisitors: number;
}

export async function getEventDailySeries(projectId: string, params: EventStatsParams): Promise<EventDailyPoint[]> {
  const fromDate = normalizeDateToYYYYMMDD(params.from);
  const toDate = normalizeDateToYYYYMMDD(params.to);

  const filters: SQL<unknown>[] = [
    eq(projectOverviewDaily.projectId, projectId),
    ...buildDateRangeFilters(projectOverviewDaily.eventDate, fromDate, toDate),
  ];

  const rows = await db
    .select({
      eventDate: projectOverviewDaily.eventDate,
      events: projectOverviewDaily.visits,
      uniqueVisitors: projectOverviewDaily.uniqueVisitors,
    })
    .from(projectOverviewDaily)
    .where(and(...filters))
    .orderBy(projectOverviewDaily.eventDate);

  return rows.map(row => ({
    date: new Date(`${row.eventDate}T00:00:00.000Z`).toISOString(),
    events: Number(row.events ?? 0),
    uniqueVisitors: Number(row.uniqueVisitors ?? 0),
  }));
}

function buildEventFilters(projectId: string, params: EventStatsParams): SQL<unknown>[] {
  return [
    eq(projectEvents.projectId, projectId),
    ...buildDateRangeFilters(projectEvents.occurredAt, params.from, params.to),
  ];
}

// normaliseDateRange moved to utils/dates.ts
