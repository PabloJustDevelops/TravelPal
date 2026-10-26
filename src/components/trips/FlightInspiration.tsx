"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient } from "@/lib/insforge";
import { FlightIdea, ideaToTripHref, isFlightIdeaCurrent, parseInspirationQuery } from "@/lib/travel-inspiration";
import Button from "@/components/ui/Button";
import Link from "next/link";
import Input from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { localePath } from "@/lib/i18n";

type FunctionResponse = {
  status?: "unavailable" | "available" | "ready";
  ideas?: FlightIdea[];
};

const COOLDOWN_MS = 30_000;

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addMonths(month: string, offset: number): string {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function aviasalesHref(idea: FlightIdea): string {
  const departure = idea.departureDate.slice(8, 10) + idea.departureDate.slice(5, 7);
  const returning = idea.returnDate
    ? idea.returnDate.slice(8, 10) + idea.returnDate.slice(5, 7)
    : "";
  const route = `${idea.origin}${departure}${idea.destination}${returning}1`;
  return `https://www.aviasales.com/search/${encodeURIComponent(route)}`;
}

function ideaExpiresAt(idea: FlightIdea): number {
  const dataExpiry = new Date(idea.validUntil).getTime();
  const departureExpiry = new Date(`${idea.departureDate}T00:00:00.000Z`).getTime();
  return Math.min(dataExpiry, departureExpiry);
}

export default function FlightInspiration() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth);
  const [origin, setOrigin] = useState("");
  const [journey, setJourney] = useState<"round-trip" | "one-way">("round-trip");
  const [maxPrice, setMaxPrice] = useState("");
  const [ideas, setIdeas] = useState<FlightIdea[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [status, setStatus] = useState<"checking" | "unavailable" | "available" | "ready" | "error">("checking");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [, setClock] = useState(0);
  const latestQuery = useRef<{ origin: string; month: string; journey: "round-trip" | "one-way"; maxPrice?: number } | null>(null);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentIdeas = useRef<FlightIdea[]>([]);

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const client = createInsforgeClient();
    return client.functions.invoke("travel-inspiration", { body });
  }, []);

  useEffect(() => {
    if (!user) {
      setStatus("unavailable");
      return;
    }
    let active = true;
    void invoke({ checkOnly: true }).then(({ data, error: invokeError }) => {
      if (!active) return;
      if (invokeError || !data) {
        setStatus("error");
        setError(t("inspirationCheckError"));
        return;
      }
      setStatus((data as FunctionResponse).status ?? "unavailable");
    }).catch(() => {
      if (!active) return;
      setStatus("error");
      setError(t("inspirationCheckError"));
    });
    return () => { active = false; };
  }, [invoke, user, t]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const loadIdeas = useCallback(async (query: NonNullable<typeof latestQuery.current>, automatic = false) => {
    if (!automatic && Date.now() < cooldownUntil) return;
    setLoading(true);
    setError("");
    try {
      const { data, error: invokeError } = await invoke(query);
      if (invokeError || !data) throw new Error(t("inspirationRequestError"));
      const response = data as FunctionResponse;
      const nextIdeas = response.status === "ready" && Array.isArray(response.ideas) ? response.ideas : [];
      setHasSearched(true);
      currentIdeas.current = nextIdeas;
      setIdeas(nextIdeas);
      setStatus(response.status ?? "unavailable");
      if (!automatic) setCooldownUntil(Date.now() + COOLDOWN_MS);
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
      const nearestExpiry = nextIdeas.map(ideaExpiresAt).filter(Number.isFinite).sort((a, b) => a - b)[0];
      if (nearestExpiry && nearestExpiry > Date.now()) {
        expiryTimer.current = setTimeout(() => {
          const activeQuery = latestQuery.current;
          if (activeQuery) void loadIdeas(activeQuery, true);
        }, Math.max(0, nearestExpiry - Date.now()));
      }
    } catch {
      if (automatic) {
        const now = Date.now();
        const remainingIdeas = currentIdeas.current.filter((idea) => isFlightIdeaCurrent(idea, new Date(now)));
        currentIdeas.current = remainingIdeas;
        setIdeas(remainingIdeas);
        const nearestExpiry = remainingIdeas
          .map(ideaExpiresAt)
          .filter(Number.isFinite)
          .sort((a, b) => a - b)[0];
        if (expiryTimer.current) clearTimeout(expiryTimer.current);
        if (nearestExpiry && nearestExpiry > now) {
          expiryTimer.current = setTimeout(() => {
            const activeQuery = latestQuery.current;
            if (activeQuery) void loadIdeas(activeQuery, true);
          }, Math.max(0, nearestExpiry - now));
        }
      }
      setError(t("inspirationLoadError"));
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }, [cooldownUntil, invoke, t]);

  useEffect(() => () => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const query = parseInspirationQuery({
        origin,
        month,
        journey,
        ...(maxPrice ? { maxPrice } : {}),
      });
      latestQuery.current = query;
      void loadIdeas(query);
    } catch {
      setError(t("inspirationValidationError"));
      setStatus("error");
    }
  };

  const cooldownActive = Date.now() < cooldownUntil;

  if (!user) {
    return <p role="status" className="rounded-lg border border-line bg-paper p-5 text-muted">{t("inspirationSignIn")}</p>;
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">{t("inspirationHeading")}</p>
        <h1 className="text-title font-bold tracking-tight text-ink">{t("inspirationTitle")}</h1>
        <p className="max-w-3xl text-sm text-muted">{t("inspirationIntro")}</p>
      </header>

      {error && <p role="alert" className="rounded-lg border border-danger bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
      {status === "checking" && <p role="status" className="text-sm text-muted">{t("inspirationChecking")}</p>}
      {status === "unavailable" && <p role="status" className="rounded-lg border border-line bg-paper p-4 text-sm text-muted">{t("inspirationUnavailable")}</p>}

      <Card className="rounded-xl border border-line bg-paper shadow-sm">
        <CardContent className="p-5 sm:p-7">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <Input label={t("inspirationOriginLabel")} name="origin" value={origin} onChange={(event) => setOrigin(event.target.value.toUpperCase())} placeholder="MAD" required maxLength={3} />
            <label className="space-y-1 text-sm font-medium text-ink">{t("inspirationMonthLabel")}
              <select aria-label={t("inspirationMonthLabel")} className="min-h-11 w-full rounded-md border border-line bg-paper px-3" value={month} onChange={(event) => setMonth(event.target.value)}>
                {Array.from({ length: 13 }, (_, offset) => addMonths(currentMonth(), offset)).map((value) => <option key={value} value={value}>{new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T00:00:00Z`))}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-ink">{t("inspirationJourneyLabel")}
              <select aria-label={t("inspirationJourneyLabel")} className="min-h-11 w-full rounded-md border border-line bg-paper px-3" value={journey} onChange={(event) => setJourney(event.target.value as "round-trip" | "one-way")}>
                <option value="round-trip">{t("roundTrip")}</option><option value="one-way">{t("oneWay")}</option>
              </select>
            </label>
            <Input label={t("inspirationMaxPriceLabel")} name="maxPrice" type="number" min="0.01" max="100000" step="0.01" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} />
            <Button type="submit" loading={loading} disabled={cooldownActive || status === "checking"}>
              {loading ? t("inspirationLoading") : hasSearched ? t("inspirationRefresh") : t("inspirationSearch")}
            </Button>
          </form>
          {cooldownActive && <p className="mt-3 text-xs text-muted">{t("inspirationCooldown")}</p>}
        </CardContent>
      </Card>

      {status === "available" && <p role="status" className="text-sm text-muted">{t("inspirationReady")}</p>}
      {hasSearched && status === "ready" && ideas.length === 0 && <p role="status" className="rounded-lg border border-line bg-paper p-5 text-sm text-muted">{t("inspirationNoResults")}</p>}
      {ideas.length > 0 && <div className="grid gap-4 md:grid-cols-2">
        {ideas.map((idea) => <Card key={`${idea.origin}-${idea.destination}-${idea.departureDate}-${idea.returnDate ?? ""}`} className="border border-line bg-paper">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-start justify-between gap-3"><h2 className="text-lg font-semibold text-ink">{idea.origin} → {idea.destination}</h2><p className="font-semibold text-ink">{new Intl.NumberFormat(locale === "en" ? "en-US" : "es-ES", { style: "currency", currency: "EUR" }).format(idea.price)}</p></div>
            <p className="text-sm text-muted">{t("inspirationDeparture")} {new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${idea.departureDate}T00:00:00Z`))}{idea.returnDate ? ` · ${t("inspirationReturn")} ${new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${idea.returnDate}T00:00:00Z`))}` : ""} · {idea.changes === 0 ? t("inspirationDirect") : t("inspirationStops").replace("{count}", new Intl.NumberFormat(locale === "en" ? "en-US" : "es-ES").format(idea.changes))}</p>
            <p className="text-xs text-muted">{t("inspirationObserved")} {new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(idea.foundAt))} · {t("inspirationValidUntil")} {new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(idea.validUntil))}</p>
            <div className="flex flex-wrap gap-3 pt-1">
              <a className="text-sm font-medium text-accent underline" href={aviasalesHref(idea)} target="_blank" rel="noreferrer">{t("inspirationOpenProvider")}</a>
              <a className="text-sm font-medium text-accent underline" href={localePath(locale, ideaToTripHref(idea))}>{t("inspirationPlanTrip")}</a>
            </div>
          </CardContent>
        </Card>)}
      </div>}
      <p className="text-xs text-muted">{t("inspirationManualPrefix")} <Link className="font-medium text-accent underline" href={localePath(locale, "/create-trip")}>{t("inspirationManualLink")}</Link>. {t("inspirationManualSuffix")}</p>
    </section>
  );
}
