"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient, Trip, Expense } from "@/lib/insforge";
import {
  queryErrorKind,
  withQueryTimeout,
  type QueryErrorKind,
} from "@/lib/insforge-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TripChart from "@/components/charts/TripChart";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PageTitle from "@/components/ui/PageTitle";
import ErrorState from "@/components/ui/ErrorState";
import { fieldClassName } from "@/components/ui/fieldStyles";
import {
  ArrowDownTrayIcon,
  CalendarIcon,
  DocumentTextIcon,
  FunnelIcon,
  MapPinIcon,
  PaperAirplaneIcon,
  TableCellsIcon,
} from "@heroicons/react/24/outline";
import {
  getErrorMessage,
  getLoadErrorMessage,
  cn,
} from "@/lib/utils";
import { logger } from "@/lib/logger";
import { Menu, Transition } from "@headlessui/react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { motion } from "framer-motion";

// Skeleton Component
const DashboardSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="h-8 bg-surface-strong rounded w-1/3"></div>
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="bg-surface overflow-hidden shadow rounded-lg p-5"
        >
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-surface-strong rounded-md p-3 h-12 w-12"></div>
            <div className="ml-5 w-0 flex-1">
              <div className="h-4 bg-surface-strong rounded w-1/2 mb-2"></div>
              <div className="h-6 bg-surface-strong rounded w-3/4"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {[...Array(2)].map((_, i) => (
        <div
          key={i}
          className="bg-surface shadow rounded-lg h-64"
        ></div>
      ))}
    </div>
  </div>
);

interface Budget {
  id: string;
  name: string;
  total_amount: number;
  spent_amount: number;
  currency: string;
  category: string;
}

const dateRanges = [
  { value: "all", label: "Todo el tiempo" },
  { value: "30", label: "Últimos 30 días" },
  { value: "90", label: "Últimos 3 meses" },
  { value: "365", label: "Último año" },
];

const currencies = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD"];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [dateRange, setDateRange] = useState("all");
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Las tres lecturas del GET borrado llegan del SDK, tabla a tabla: ya no hay
  // ningun fetch en la pagina. El rango solo acota viajes (por salida) y gastos
  // (por fecha); los presupuestos se leen completos porque no tienen fecha de
  // referencia util para el panel.
  const [data, setData] = useState<{
    trips: Trip[];
    expenses: Expense[];
    budgets: Budget[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{
    kind: QueryErrorKind;
  } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
      setData(null);
      setLoading(false);
      return;
    }

    const userId = user.id;
    let active = true;

    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        // Mismo calculo del inicio del rango que hacia el handler.
        let startISO: string | null = null;
        if (dateRange !== "all") {
          const days = parseInt(dateRange, 10);
          if (!isNaN(days)) {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - (days - 1));
            startISO = d.toISOString();
          }
        }

        const insforge = createInsforgeClient();

        let tripsQuery = insforge
          .database.from("trips")
          .select("*")
          .eq("user_id", userId)
          .order("departure_date", { ascending: true });
        if (startISO) tripsQuery = tripsQuery.gte("departure_date", startISO);

        let expensesQuery = insforge
          .database.from("expenses")
          .select("*")
          .eq("user_id", userId)
          .order("date", { ascending: false });
        if (startISO) expensesQuery = expensesQuery.gte("date", startISO);

        const budgetsQuery = insforge
          .database.from("budgets")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        const [tripsRes, expensesRes, budgetsRes] = await withQueryTimeout(
          Promise.all([tripsQuery, expensesQuery, budgetsQuery]),
          { label: "dashboard" },
        );

        if (tripsRes.error) throw tripsRes.error;
        if (expensesRes.error) throw expensesRes.error;
        if (budgetsRes.error) throw budgetsRes.error;

        if (!active) return;
        setData({
          trips: (tripsRes.data as Trip[]) ?? [],
          expenses: (expensesRes.data as Expense[]) ?? [],
          budgets: (budgetsRes.data as Budget[]) ?? [],
        });
      } catch (err) {
        if (!active) return;
        logger.error("DashboardPage: Error loading dashboard", {
          error: getErrorMessage(err, "Error al cargar los datos"),
        });
        setLoadError({ kind: queryErrorKind(err) });
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [authLoading, user?.id, dateRange, reloadToken]);

  const {
    trips,
    currencyExpenses,
    totalTrips,
    mostVisitedDestination,
    activeTrips,
    upcomingTrips,
  } = useMemo(() => {
    const tripsData = data?.trips ?? [];
    const expensesData = data?.expenses ?? [];

    // El informe exportado respeta la moneda elegida en el filtro.
    const currencyExpenses = expensesData.filter(
      (expense) => expense.currency === selectedCurrency,
    );

    // Destino mas visitado.
    const destinationCounts = tripsData.reduce(
      (acc, trip) => {
        const destination = trip.destination || "Desconocido";
        acc[destination] = (acc[destination] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    const mostVisitedDestination =
      Object.entries(destinationCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ||
      "N/A";

    const activeTrips = tripsData.filter(
      (trip) =>
        trip.status === "confirmed" ||
        (new Date(trip.departure_date) <= new Date() &&
          new Date(trip.return_date || "") >= new Date()),
    ).length;
    const upcomingTrips = tripsData.filter(
      (trip) => new Date(trip.departure_date) > new Date(),
    ).length;

    return {
      trips: tripsData,
      currencyExpenses,
      totalTrips: tripsData.length,
      mostVisitedDestination,
      activeTrips,
      upcomingTrips,
    };
  }, [data, selectedCurrency]);

  const error = getLoadErrorMessage(loadError, {
    timeout: "La carga de datos ha tardado demasiado. Por favor, reintenta.",
    request: "Error al cargar los datos. Por favor, intenta recargar.",
  });

  const showSkeleton =
    authLoading || loading || (!!user?.id && data === null && !loadError);

  const exportToJSON = () => {
    try {
      const payload = {
        trips,
        expenses: currencyExpenses,
        budgets: data?.budgets.filter(
          (budget) => budget.currency === selectedCurrency,
        ) ?? [],
        exportDate: new Date().toISOString(),
        dateRange,
        currency: selectedCurrency,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `travel-dashboard-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (exportError) {
      const msg =
        exportError instanceof Error ? exportError.message : "Error desconocido";
      logger.error("DashboardPage: Error exporting JSON", { error: msg });
    }
  };

  const exportToPDF = async () => {
    if (!reportRef.current) return;

    setIsExporting(true);
    try {
      const element = reportRef.current;

      const dataUrl = await toPng(element, {
        backgroundColor: "#ffffff",
        pixelRatio: 1.5,
        cacheBust: true,
        fontEmbedCSS: "",
        filter: (node) => {
          if (node.tagName === "SCRIPT") return false;

          if (
            node instanceof HTMLElement &&
            node.dataset.exportExclude === "true"
          ) {
            return false;
          }
          return true;
        },
        skipAutoScale: true,
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`reporte-viajes-${new Date().toISOString().split("T")[0]}.pdf`);

      logger.info("DashboardPage: PDF exportado exitosamente");
    } catch (exportError) {
      const msg =
        exportError instanceof Error ? exportError.message : "Error desconocido";
      logger.error("DashboardPage: Error exporting PDF", {
        error: msg,
        stack: exportError instanceof Error ? exportError.stack : undefined,
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (showSkeleton) {
    return (
      <DashboardLayout>
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <ErrorState
          message={error}
          onRetry={() => refetch()}
          title="Error al cargar el dashboard"
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <motion.div
        ref={reportRef}
        className="space-y-6"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {/* Cabecera: bienvenida y menu de exportacion */}
        <PageTitle
          title={`Bienvenido, ${user?.full_name?.split(" ")[0] || "Viajero"}`}
          subtitle="Resumen de tus viajes. Filtra y exporta el informe."
          action={
            <Menu
              as="div"
              className="relative inline-block text-left z-30"
              data-export-exclude="true"
            >
              <div>
                <Menu.Button as={Fragment}>
                  <Button
                    variant="outline"
                    className="flex items-center space-x-2"
                    disabled={isExporting}
                  >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                    <span>{isExporting ? "Exportando..." : "Exportar"}</span>
                  </Button>
                </Menu.Button>
              </div>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right divide-y divide-line rounded-md bg-surface shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="px-1 py-1">
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={exportToJSON}
                          className={`${
                            active ? "bg-accent text-on-accent" : "text-ink"
                          } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                        >
                          <TableCellsIcon
                            className="mr-2 h-5 w-5"
                            aria-hidden="true"
                          />
                          Exportar JSON
                        </button>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={exportToPDF}
                          className={`${
                            active ? "bg-accent text-on-accent" : "text-ink"
                          } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                        >
                          <DocumentTextIcon
                            className="mr-2 h-5 w-5"
                            aria-hidden="true"
                          />
                          Exportar PDF
                        </button>
                      )}
                    </Menu.Item>
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>
          }
        />

        {/* Filtros: moneda y rango de fechas */}
        <div
          className="bg-surface p-4 rounded-lg shadow-sm border border-line"
          data-export-exclude="true"
        >
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center space-x-2">
              <FunnelIcon className="h-5 w-5 text-muted" />
              <span className="text-sm text-muted">
                Moneda:
              </span>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className={cn(fieldClassName, "h-auto w-auto")}
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted">
                Rango de fechas:
              </span>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className={cn(fieldClassName, "h-auto w-auto")}
              >
                {dateRanges.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Resumen: solo lo que me toca del viaje */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <motion.div variants={item}>
            <Card className="h-full">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 rounded-lg p-3 bg-accent-soft">
                    <PaperAirplaneIcon className="h-6 w-6 text-accent" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <div className="text-sm font-medium text-muted truncate">
                      Total Viajes
                    </div>
                    <div className="text-lg font-bold text-ink mt-1">
                      {totalTrips}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className="h-full">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 rounded-lg p-3 bg-accent-soft">
                    <MapPinIcon className="h-6 w-6 text-accent" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <div className="text-sm font-medium text-muted truncate">
                      Destino más visitado
                    </div>
                    <div
                      className="text-lg font-bold text-ink mt-1 truncate"
                      title={mostVisitedDestination}
                    >
                      {mostVisitedDestination}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className="h-full">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 rounded-lg p-3 bg-warning/10">
                    <CalendarIcon className="h-6 w-6 text-warning" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <div className="text-sm font-medium text-muted truncate">
                      Viajes Activos
                    </div>
                    <div className="text-lg font-bold text-ink mt-1">
                      {activeTrips}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className="h-full">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 rounded-lg p-3 bg-accent-soft">
                    <CalendarIcon className="h-6 w-6 text-accent" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <div className="text-sm font-medium text-muted truncate">
                      Próximos Viajes
                    </div>
                    <div className="text-lg font-bold text-ink mt-1">
                      {upcomingTrips}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Graficas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-6 text-ink flex items-center">
                <span className="w-1 h-6 bg-accent rounded-full mr-3"></span>
                Estado de Viajes
              </h3>
              <TripChart trips={trips} height={350} />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-6 text-ink flex items-center">
                <span className="w-1 h-6 bg-success rounded-full mr-3"></span>
                Destinos más Populares
              </h3>
              <TripChart trips={trips} type="destinations" height={300} />
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Viajes Recientes */}
          <motion.div
            variants={item}
            className="bg-surface shadow rounded-xl transition-all duration-200 border border-line"
          >
            <div className="px-6 py-5 flex justify-between items-center border-b border-line">
              <h2 className="text-lg font-semibold leading-6 text-ink flex items-center gap-2">
                <MapPinIcon className="h-5 w-5 text-accent" />
                Viajes Recientes
              </h2>
              <Link
                href="/trips"
                className="text-sm font-medium text-accent hover:text-accent-hover transition-colors hover:underline"
              >
                Ver todos
              </Link>
            </div>
            <ul
              role="list"
              className="divide-y divide-line"
            >
              {trips.slice(0, 3).map((trip) => (
                <li key={trip.id}>
                  <Link
                    href={`/trips/${trip.id}`}
                    className="block hover:bg-surface-strong transition-colors group"
                  >
                    <div className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-accent truncate group-hover:text-accent-hover">
                          {trip.title}
                        </p>
                        <div className="ml-2 flex-shrink-0 flex">
                          <span
                            className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full ${
                              trip.status === "confirmed"
                                ? "bg-success/10 text-success"
                                : trip.status === "planned"
                                  ? "bg-warning/10 text-warning"
                                  : trip.status === "cancelled"
                                    ? "bg-danger/10 text-danger"
                                    : "bg-surface-strong text-muted"
                            }`}
                          >
                            {trip.status === "confirmed"
                              ? "Confirmado"
                              : trip.status === "planned"
                                ? "Planificado"
                                : trip.status === "cancelled"
                                  ? "Cancelado"
                                  : "Completado"}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 sm:flex sm:justify-between">
                        <div className="sm:flex">
                          <p className="flex items-center text-sm text-muted">
                            <MapPinIcon className="flex-shrink-0 mr-1.5 h-4 w-4 text-muted" />
                            {trip.destination}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center text-sm text-muted sm:mt-0">
                          <CalendarIcon className="flex-shrink-0 mr-1.5 h-4 w-4 text-muted" />
                          <p>
                            {new Date(trip.departure_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
              {trips.length === 0 && (
                <li className="px-6 py-12 text-center text-muted text-sm flex flex-col items-center">
                  <PaperAirplaneIcon className="h-10 w-10 text-muted mb-2" />
                  No tienes viajes recientes
                </li>
              )}
            </ul>
          </motion.div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
