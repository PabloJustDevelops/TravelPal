import { z } from "zod";

const IATA = /^[A-Z]{3}$/;
const MONTH = /^\d{4}-\d{2}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PROVIDER_ROWS = 1000;
const MAX_IDEAS = 12;
const MAX_AGE_MS = 48 * 60 * 60 * 1000;

export interface InspirationQuery {
  origin: string;
  month: string;
  journey: "round-trip" | "one-way";
  maxPrice?: number;
}

export interface FlightIdea {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  price: number;
  currency: "EUR";
  foundAt: string;
  validUntil: string;
  changes: number;
}

const querySchema = z.object({
  origin: z.string().regex(IATA),
  month: z.string().regex(MONTH),
  journey: z.enum(["round-trip", "one-way"]),
  maxPrice: z.number().finite().positive().max(100_000).optional(),
}).strict();

function monthStart(month: string): Date | undefined {
  if (!MONTH.test(month)) return undefined;
  const date = new Date(`${month}-01T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 7) !== month ? undefined : date;
}

function parseQueryValues(params: URLSearchParams | Record<string, unknown>): Record<string, unknown> {
  if (params instanceof URLSearchParams) {
    const values: Record<string, unknown> = {};
    for (const key of new Set(params.keys())) {
      const entries = params.getAll(key);
      if (entries.length !== 1) throw new Error("Invalid inspiration query");
      values[key] = entries[0];
    }
    return values;
  }
  if (!params || typeof params !== "object" || Array.isArray(params)) throw new Error("Invalid inspiration query");
  return params;
}

export function parseInspirationQuery(
  params: URLSearchParams | Record<string, unknown>,
  now: Date = new Date(),
): InspirationQuery {
  const values = parseQueryValues(params);
  if (typeof values.origin === "string") values.origin = values.origin.toUpperCase();
  if (typeof values.maxPrice === "string") {
    if (values.maxPrice.trim() === "") throw new Error("Invalid inspiration query");
    values.maxPrice = Number(values.maxPrice);
  }
  const query = querySchema.parse(values);
  const selectedMonth = monthStart(query.month);
  const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const latest = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 12, 1));
  if (!selectedMonth || selectedMonth < current || selectedMonth > latest) {
    throw new Error("Invalid inspiration query");
  }
  return query;
}

const providerRowSchema = z.object({
  origin: z.string().regex(IATA),
  destination: z.string().regex(IATA),
  depart_date: z.string(),
  return_date: z.string().optional().nullable(),
  value: z.number().finite().positive(),
  found_at: z.string(),
  actual: z.literal(true),
  show_to_affiliates: z.literal(true),
  number_of_changes: z.number().int().nonnegative(),
});

const providerEnvelopeSchema = z.object({ data: z.array(z.unknown()).max(MAX_PROVIDER_ROWS) });

function validInstant(value: string): Date | undefined {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

function datePart(value: string): string | undefined {
  if (!DAY.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return undefined;
  return value;
}

function toIdea(value: unknown, query: InspirationQuery, now: Date): FlightIdea | undefined {
  const parsed = providerRowSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const row = parsed.data;
  const departureDate = datePart(row.depart_date);
  const found = validInstant(row.found_at);
  const returnValue = row.return_date ?? "";
  const returnDate = returnValue ? datePart(returnValue) : undefined;
  if (!departureDate || departureDate <= now.toISOString().slice(0, 10) || !found || found > now || now.getTime() - found.getTime() >= MAX_AGE_MS) return undefined;
  if (row.origin !== query.origin || row.destination === row.origin || !departureDate.startsWith(query.month)) return undefined;
  if (query.maxPrice !== undefined && row.value > query.maxPrice) return undefined;
  if (query.journey === "round-trip" && (!returnDate || returnDate <= departureDate)) return undefined;
  if (query.journey === "one-way" && returnValue !== "") return undefined;
  if (returnDate && returnDate <= departureDate) return undefined;
  return {
    origin: row.origin,
    destination: row.destination,
    departureDate,
    ...(returnDate ? { returnDate } : {}),
    price: row.value,
    currency: "EUR",
    foundAt: found.toISOString(),
    validUntil: new Date(found.getTime() + MAX_AGE_MS).toISOString(),
    changes: row.number_of_changes,
  };
}

export function parseFlightIdeas(payload: unknown, query: InspirationQuery, now: Date = new Date()): FlightIdea[] {
  const envelope = providerEnvelopeSchema.parse(payload);
  return filterFlightIdeas(envelope.data.flatMap((row) => {
    const idea = toIdea(row, query, now);
    return idea ? [idea] : [];
  }), query, now);
}

export function isFlightIdeaCurrent(idea: FlightIdea, now: Date = new Date()): boolean {
  const expiry = validInstant(idea.validUntil);
  const departureDate = datePart(idea.departureDate);
  return Boolean(expiry && expiry > now && departureDate && departureDate > now.toISOString().slice(0, 10));
}

export function filterFlightIdeas(input: FlightIdea[], query: InspirationQuery, now: Date = new Date()): FlightIdea[] {
  const seen = new Set<string>();
  return [...input]
    .sort((a, b) => a.price - b.price)
    .filter((idea) => {
      if (!isFlightIdeaCurrent(idea, now) || idea.origin !== query.origin || !idea.departureDate.startsWith(query.month)) return false;
      if (query.maxPrice !== undefined && idea.price > query.maxPrice) return false;
      if (query.journey === "round-trip" && !idea.returnDate) return false;
      if (query.journey === "one-way" && idea.returnDate) return false;
      const key = `${idea.origin}|${idea.destination}|${idea.departureDate}|${idea.returnDate ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_IDEAS);
}

export function ideaToTripHref(idea: FlightIdea): string {
  const params = new URLSearchParams({
    source: "inspiration",
    origin: idea.origin,
    destination: idea.destination,
    departure: idea.departureDate,
  });
  if (idea.returnDate) params.set("return", idea.returnDate);
  return `/create-trip?${params.toString()}`;
}
