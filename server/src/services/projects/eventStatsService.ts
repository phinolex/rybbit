import { SQL, and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../../db/postgres/postgres.js";
import { projectEvents, projectOverviewDaily } from "../../db/postgres/schema.js";

export interface EventStatsParams {
  from?: string;
  to?: string;
}

interface DateRange {
  fromDate?: string;
  toDate?: string;
}

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
  const { fromDate, toDate } = normaliseDateRange(params);

  const filters: SQL<unknown>[] = [eq(projectOverviewDaily.projectId, projectId)];
  if (fromDate) {
    filters.push(gte(projectOverviewDaily.eventDate, fromDate));
  }
  if (toDate) {
    filters.push(lte(projectOverviewDaily.eventDate, toDate));
  }

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
  const filters: SQL<unknown>[] = [eq(projectEvents.projectId, projectId)];

  if (params.from) {
    filters.push(gte(projectEvents.occurredAt, params.from));
  }

  if (params.to) {
    filters.push(lte(projectEvents.occurredAt, params.to));
  }

  return filters;
}

function normaliseDateRange(params: EventStatsParams): DateRange {
  const range: DateRange = {};

  if (params.from) {
    const fromDate = new Date(params.from);
    if (!Number.isNaN(fromDate.getTime())) {
      range.fromDate = fromDate.toISOString().slice(0, 10);
    }
  }

  if (params.to) {
    const toDate = new Date(params.to);
    if (!Number.isNaN(toDate.getTime())) {
      range.toDate = toDate.toISOString().slice(0, 10);
    }
  }

  return range;
}
