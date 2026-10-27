"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient } from "@/lib/insforge";
import { FlightIdea, TravelIdea, travelIdeaToTripHref, isFlightIdeaCurrent, parseInspirationQuery } from "@/lib/travel-inspiration";
import Button from "@/components/ui/Button";
import Link from "next/link";
import Input from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { localePath } from "@/lib/i18n";

type FunctionResponse = {
  status?: "unavailable" | "available" | "ready" | "provider_error";
  ideas?: TravelIdea[];
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

// MOTIS devuelve modos técnicos (REGIONAL_RAIL, HIGHSPEED_RAIL...): se traducen y se ocultan los
// tramos a pie, que no aportan nada a la tarjeta.
const MODE_LABELS: Record<string, string> = {
  WALK: "inspirationModeWalk",
  REGIONAL_RAIL: "inspirationModeRegionalRail",
  HIGHSPEED_RAIL: "inspirationModeHighSpeedRail",
  LONG_DISTANCE: "inspirationModeRail",
  RAIL: "inspirationModeRail",
  BUS: "inspirationModeBus",
  COACH: "inspirationModeBus",
  FERRY: "inspirationModeFerry",
  TRAM: "inspirationModeTram",
  SUBWAY: "inspirationModeMetro",
  METRO: "inspirationModeMetro",
};

function modeLabel(t: (key: never) => string, mode: string): string | null {
  if (mode === "WALK") return null;
  const key = MODE_LABELS[mode];
  return key ? t(key as never) : t("inspirationModeTransit" as never);
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

function departureLabel(idea: TravelIdea, locale: "es" | "en"): string {
  const dateLocale = locale === "en" ? "en-US" : "es-ES";
  if (idea.mode === "ground") {
    return new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(idea.departureAt));
  }
  return new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium", timeZone: "UTC" })
    .format(new Date(`${idea.departureDate}T00:00:00Z`));
}

function ideaKey(idea: TravelIdea): string {
  const departure = idea.departureAt ?? (idea as FlightIdea).departureDate;
  const details = idea.mode === "ground"
    ? `${idea.arrivalAt}-${idea.durationMinutes}-${idea.transfers}-${idea.lines.join("|")}-${idea.modes.join("|")}`
    : (idea as FlightIdea).returnDate ?? "";
  return `${idea.mode}-${idea.origin}-${idea.destination}-${departure}-${details}`;
}

export default function FlightInspiration() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth);
  const [mode, setMode] = useState<"flight" | "ground">("flight");
  const currentMode = useRef<"flight" | "ground">("flight");
  const requestVersion = useRef(0);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [groundDate, setGroundDate] = useState("");
  const [journey, setJourney] = useState<"round-trip" | "one-way">("round-trip");
  const [maxPrice, setMaxPrice] = useState("");
  const [ideas, setIdeas] = useState<TravelIdea[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [status, setStatus] = useState<"checking" | "unavailable" | "available" | "ready" | "error" | "provider_error">("checking");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [, setClock] = useState(0);
  const latestQuery = useRef<Record<string, unknown> | null>(null);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentIdeas = useRef<TravelIdea[]>([]);

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
    void invoke(mode === "flight" ? { checkOnly: true } : { checkOnly: true, mode }).then(({ data, error: invokeError }) => {
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
  }, [invoke, user, t, mode]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const loadIdeas = useCallback(async (query: NonNullable<typeof latestQuery.current>, automatic = false) => {
    if (!automatic && Date.now() < cooldownUntil) return;
    const version = ++requestVersion.current;
    const requestedMode = query.mode;
    setLoading(true);
    setError("");
    try {
      const { data, error: invokeError } = await invoke(query);
      if (version !== requestVersion.current || requestedMode !== currentMode.current) return;
      if (invokeError || !data) throw new Error(t("inspirationRequestError"));
      const response = data as FunctionResponse;
      const nextIdeas = response.status === "ready" && Array.isArray(response.ideas) ? response.ideas : [];
      setHasSearched(true);
      currentIdeas.current = nextIdeas;
      setIdeas(nextIdeas);
      setStatus(response.status ?? "unavailable");
      if (!automatic) setCooldownUntil(Date.now() + COOLDOWN_MS);
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
      const nearestExpiry = nextIdeas.filter((idea) => idea.mode !== "ground").map((idea) => ideaExpiresAt(idea as FlightIdea)).filter(Number.isFinite).sort((a, b) => a - b)[0];
      if (nearestExpiry && nearestExpiry > Date.now()) {
        expiryTimer.current = setTimeout(() => {
          const activeQuery = latestQuery.current;
          if (activeQuery) void loadIdeas(activeQuery, true);
        }, Math.max(0, nearestExpiry - Date.now()));
      }
    } catch {
      if (version !== requestVersion.current || requestedMode !== currentMode.current) return;
      if (automatic) {
        const now = Date.now();
        const remainingIdeas = currentIdeas.current.filter((idea) => idea.mode === "ground" || isFlightIdeaCurrent(idea as FlightIdea, new Date(now)));
        currentIdeas.current = remainingIdeas;
        setIdeas(remainingIdeas);
        const nearestExpiry = remainingIdeas
          .filter((idea) => idea.mode !== "ground")
          .map((idea) => ideaExpiresAt(idea as FlightIdea))
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
      if (version === requestVersion.current) setLoading(false);
    }
  }, [cooldownUntil, invoke, t]);

  useEffect(() => () => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const query = mode === "ground"
        ? { mode, origin: origin.trim(), destination: destination.trim(), date: groundDate }
        : { mode, ...parseInspirationQuery({ origin, month, journey, ...(maxPrice ? { maxPrice } : {}) }) };
      if (mode === "ground" && (!origin.trim() || !destination.trim() || !groundDate)) throw new Error();
      latestQuery.current = query;
      void loadIdeas(query);
    } catch {
      setError(t("inspirationValidationError"));
      setStatus("error");
    }
  };

  const cooldownActive = Date.now() < cooldownUntil;
  const displayedError = status === "provider_error" ? t("inspirationProviderDown") : error;

  if (!user) {
    return <p role="status" className="rounded-lg border border-line bg-paper p-5 text-muted">{t("inspirationSignIn")}</p>;
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">{t("inspirationHeading")}</p>
        <h1 className="text-title font-bold tracking-tight text-ink">{t("inspirationTitle")}</h1>
        <p className="max-w-3xl text-sm text-muted">{t(mode === "ground" ? "inspirationGroundIntro" : "inspirationIntro")}</p>
      </header>

      {displayedError && <p role="alert" className="rounded-lg border border-danger bg-danger/10 px-4 py-3 text-sm text-danger">{displayedError}</p>}
      {status === "checking" && <p role="status" className="text-sm text-muted">{t("inspirationChecking")}</p>}
      {status === "unavailable" && <p role="status" className="rounded-lg border border-line bg-paper p-4 text-sm text-muted">{t("inspirationUnavailable")}</p>}

      <Card className="rounded-xl border border-line bg-paper shadow-sm">
        <CardContent className="p-5 sm:p-7">
          <div role="group" aria-label={t("inspirationModeLabel")} className="mb-5 flex flex-wrap gap-2">
            <button type="button" aria-pressed={mode === "flight"} onClick={() => { if (currentMode.current === "flight") return; currentMode.current = "flight"; requestVersion.current++; latestQuery.current = null; currentIdeas.current = []; if (expiryTimer.current) clearTimeout(expiryTimer.current); setMode("flight"); setIdeas([]); setHasSearched(false); setLoading(false); setError(""); setStatus("checking"); setCooldownUntil(0); }} className="min-h-11 rounded-md border border-line px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" >{t("inspirationFlights")}</button>
            <button type="button" aria-pressed={mode === "ground"} onClick={() => { if (currentMode.current === "ground") return; currentMode.current = "ground"; requestVersion.current++; latestQuery.current = null; currentIdeas.current = []; if (expiryTimer.current) clearTimeout(expiryTimer.current); setMode("ground"); setIdeas([]); setHasSearched(false); setLoading(false); setError(""); setStatus("checking"); setCooldownUntil(0); }} className="min-h-11 rounded-md border border-line px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{t("inspirationGround")}</button>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <Input label={mode === "flight" ? t("inspirationOriginLabel") : t("inspirationGroundOrigin")} name="origin" value={origin} onChange={(event) => setOrigin(mode === "flight" ? event.target.value.toUpperCase() : event.target.value)} placeholder={mode === "flight" ? "MAD" : undefined} required maxLength={mode === "flight" ? 3 : 100} />
            {mode === "ground" && <Input label={t("inspirationGroundDestination")} name="destination" value={destination} onChange={(event) => setDestination(event.target.value)} required maxLength={100} />}
            {mode === "ground" ? <label className="space-y-1 text-sm font-medium text-ink">{t("inspirationGroundDate")}<input aria-label={t("inspirationGroundDate")} type="date" min={new Date().toISOString().slice(0, 10)} value={groundDate} onChange={(event) => setGroundDate(event.target.value)} required className="min-h-11 w-full rounded-md border border-line bg-paper px-3" /></label> : <label className="space-y-1 text-sm font-medium text-ink">{t("inspirationMonthLabel")}
              <select aria-label={t("inspirationMonthLabel")} className="min-h-11 w-full rounded-md border border-line bg-paper px-3" value={month} onChange={(event) => setMonth(event.target.value)}>
                {Array.from({ length: 13 }, (_, offset) => addMonths(currentMonth(), offset)).map((value) => <option key={value} value={value}>{new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T00:00:00Z`))}</option>)}
              </select></label>}
            {mode === "flight" && <><label className="space-y-1 text-sm font-medium text-ink">{t("inspirationJourneyLabel")}
              <select aria-label={t("inspirationJourneyLabel")} className="min-h-11 w-full rounded-md border border-line bg-paper px-3" value={journey} onChange={(event) => setJourney(event.target.value as "round-trip" | "one-way")}>
                <option value="round-trip">{t("roundTrip")}</option><option value="one-way">{t("oneWay")}</option>
              </select>
            </label><Input label={t("inspirationMaxPriceLabel")} name="maxPrice" type="number" min="0.01" max="100000" step="0.01" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} /></>}
            <Button type="submit" loading={loading} disabled={cooldownActive || status === "checking"} className="min-h-11">
              {loading ? t("inspirationLoading") : hasSearched ? t("inspirationRefresh") : t("inspirationSearch")}
            </Button>
          </form>
          {cooldownActive && <p className="mt-3 text-xs text-muted">{t("inspirationCooldown")}</p>}
        </CardContent>
      </Card>

      {status === "available" && <p role="status" className="text-sm text-muted">{t("inspirationReady")}</p>}
      {hasSearched && status === "ready" && ideas.length === 0 && <p role="status" aria-live="polite" className="rounded-lg border border-line bg-paper p-5 text-sm text-muted">{t("inspirationNoResults")}</p>}
      {ideas.length > 0 && <div role="status" aria-live="polite" className="grid gap-4 md:grid-cols-2">
        {ideas.map((idea) => <Card key={ideaKey(idea)} className="border border-line bg-paper">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-start justify-between gap-3"><h2 className="text-lg font-semibold text-ink">{idea.origin} → {idea.destination}</h2><p className="font-semibold text-ink">{idea.price !== null ? new Intl.NumberFormat(locale === "en" ? "en-US" : "es-ES", { style: "currency", currency: "EUR" }).format(idea.price) : t("inspirationNoPrice")}</p></div>
            <p className="text-sm text-muted">{t("inspirationDeparture")} {departureLabel(idea, locale)}{idea.mode !== "ground" && (idea as FlightIdea).returnDate ? ` · ${t("inspirationReturn")} ${new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${(idea as FlightIdea).returnDate}T00:00:00Z`))}` : ""} · {idea.transfers === 0 || (idea as FlightIdea).changes === 0 ? t("inspirationDirect") : ((idea.mode === "ground" ? idea.transfers : (idea as FlightIdea).changes) === 1 ? t("inspirationOneStop") : t("inspirationStops").replace("{count}", new Intl.NumberFormat(locale === "en" ? "en-US" : "es-ES").format(idea.transfers ?? (idea as FlightIdea).changes)))}</p>
            {idea.mode === "ground" && <><p className="text-sm text-muted">{t("inspirationArrival")} {new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(idea.arrivalAt))} · {t("inspirationDuration").replace("{minutes}", String(idea.durationMinutes))}</p><p className="text-sm text-muted">{[...new Set([...idea.lines, ...idea.modes.map((m) => modeLabel(t, m)).filter((label): label is string => Boolean(label))])].join(" · ")}</p><p className="text-xs text-muted">{idea.attribution}</p></>}
            {idea.mode !== "ground" && <p className="text-xs text-muted">{t("inspirationObserved")} {new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date((idea as FlightIdea).foundAt))} · {t("inspirationValidUntil")} {new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date((idea as FlightIdea).validUntil))}</p>}
            <div className="flex flex-wrap gap-3 pt-1">
              {idea.mode !== "ground" && <a className="text-sm font-medium text-accent underline" href={aviasalesHref(idea as FlightIdea)} target="_blank" rel="noreferrer">{t("inspirationOpenProvider")}</a>}
              {idea.mode === "ground" && <a className="text-sm font-medium text-accent underline" href={idea.deepLink} target="_blank" rel="noreferrer">{t("inspirationOpenTransitous")}</a>}
              <a className="text-sm font-medium text-accent underline" href={localePath(locale, travelIdeaToTripHref(idea.mode === "ground" ? idea : { ...(idea as FlightIdea), mode: "flight", departureAt: idea.departureAt ?? (idea as FlightIdea).departureDate }))}>{t("inspirationPlanTrip")}</a>
            </div>
          </CardContent>
        </Card>)}
      </div>}
      <p className="text-xs text-muted">{t("inspirationManualPrefix")} <Link className="font-medium text-accent underline" href={localePath(locale, "/create-trip")}>{t("inspirationManualLink")}</Link>. {t("inspirationManualSuffix")}</p>
    </section>
  );
}
