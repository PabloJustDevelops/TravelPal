import {
  filterFlightIdeas,
  ideaToTripHref,
  isFlightIdeaCurrent,
  parseFlightIdeas,
  parseInspirationQuery,
} from "@/lib/travel-inspiration";

const now = new Date("2026-10-17T12:00:00.000Z");
const queryParams = { origin: "mad", month: "2026-11", journey: "round-trip", maxPrice: "500" };

function row(overrides: Record<string, unknown> = {}) {
  return {
    origin: "MAD",
    destination: "LIS",
    depart_date: "2026-11-10",
    return_date: "2026-11-17",
    value: 120,
    found_at: "2026-10-17T10:00:00.000Z",
    actual: true,
    show_to_affiliates: true,
    number_of_changes: 1,
    ...overrides,
  };
}

describe("parseInspirationQuery", () => {
  it("normalizes a valid query", () => {
    expect(parseInspirationQuery(queryParams, now)).toEqual({
      origin: "MAD",
      month: "2026-11",
      journey: "round-trip",
      maxPrice: 500,
    });
  });

  it("accepts the maximum supported EUR price", () => {
    expect(parseInspirationQuery({ ...queryParams, maxPrice: "100000" }, now).maxPrice).toBe(100000);
  });

  it("rejects unknown and repeated parameters", () => {
    expect(() => parseInspirationQuery({ ...queryParams, extra: "x" }, now)).toThrow();
    expect(() => parseInspirationQuery(new URLSearchParams("origin=MAD&origin=BCN&month=2026-11&journey=one-way"), now)).toThrow();
  });

  it("rejects invalid origin, month and price", () => {
    for (const params of [
      { ...queryParams, origin: "MA" },
      { ...queryParams, month: "2027-11" },
      { ...queryParams, month: "2026-09" },
      { ...queryParams, maxPrice: "0" },
      { ...queryParams, maxPrice: "Infinity" },
      { ...queryParams, maxPrice: "nope" },
      { ...queryParams, maxPrice: "100001" },
    ]) expect(() => parseInspirationQuery(params, now)).toThrow();
  });
});

describe("parseFlightIdeas", () => {
  it("keeps only fresh, valid, visible EUR provider rows", () => {
    const result = parseFlightIdeas({ data: [
      row(),
      row({ destination: "MAD" }),
      row({ value: 0 }),
      row({ actual: false }),
      row({ show_to_affiliates: false }),
      row({ found_at: "2026-10-15T11:59:59.000Z" }),
      row({ depart_date: "2026-10-16" }),
      row({ depart_date: "2026-11-01T00:30:00+14:00" }),
      row({ depart_date: "2026-02-30" }),
      row({ value: 0 }),
      null,
    ] }, parseInspirationQuery(queryParams, now), now);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      origin: "MAD", destination: "LIS", price: 120, currency: "EUR",
      departureDate: "2026-11-10", returnDate: "2026-11-17", changes: 1,
      validUntil: "2026-10-19T10:00:00.000Z",
    });
  });

  it("filters by query, deduplicates, sorts by price and caps at twelve", () => {
    const rows = Array.from({ length: 15 }, (_, i) => row({
      destination: `A${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`,
      value: 100 + i,
      depart_date: "2026-11-10",
    }));
    const ideas = parseFlightIdeas({ data: [row({ value: 300 }), row({ value: 90 }), ...rows] }, parseInspirationQuery(queryParams, now), now);
    expect(ideas).toHaveLength(12);
    expect(ideas[0].price).toBe(90);
    expect(ideas.find((idea) => idea.destination === "LIS")?.price).toBe(90);
    expect(ideas.some((idea) => idea.destination === "AAA")).toBe(true);
    expect(filterFlightIdeas(ideas, { ...parseInspirationQuery(queryParams, now), maxPrice: 105 }, now).map((idea) => idea.price)).toEqual([90, 100, 101, 102, 103, 104, 105]);
  });

  it("rejects an oversized provider envelope", () => {
    expect(() => parseFlightIdeas({ data: Array(1001).fill(row()) }, parseInspirationQuery(queryParams, now), now)).toThrow();
  });
});

describe("idea expiry and trip handoff", () => {
  it("marks an idea expired at validUntil", () => {
    const idea = parseFlightIdeas({ data: [row()] }, parseInspirationQuery(queryParams, now), now)[0];
    expect(isFlightIdeaCurrent(idea, new Date("2026-10-19T09:59:59.999Z"))).toBe(true);
    expect(isFlightIdeaCurrent(idea, new Date("2026-10-19T10:00:00.000Z"))).toBe(false);
  });

  it("expires an idea when its date-only departure is no longer in the future", () => {
    const idea = parseFlightIdeas({ data: [row({ depart_date: "2026-10-18", return_date: "2026-10-25" })] }, parseInspirationQuery({ ...queryParams, month: "2026-10" }, now), now)[0];
    expect(idea.validUntil).toBe("2026-10-19T10:00:00.000Z");
    expect(isFlightIdeaCurrent(idea, new Date("2026-10-18T01:00:00.000Z"))).toBe(false);
  });

  it("builds an encoded create-trip URL from validated dates", () => {
    const idea = parseFlightIdeas({ data: [row({ destination: "ZRH" })] }, parseInspirationQuery(queryParams, now), now)[0];
    expect(ideaToTripHref(idea)).toBe("/create-trip?source=inspiration&origin=MAD&destination=ZRH&departure=2026-11-10&return=2026-11-17");
  });
});
