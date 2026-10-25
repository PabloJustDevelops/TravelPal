"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient, Expense, Trip } from "@/lib/insforge";
import {
  assertRowsAffected,
  queryErrorKind,
  withQueryTimeout,
  type QueryErrorKind,
} from "@/lib/insforge-query";
import slots from "@/components/ui/interiorSlots.module.css";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ExpenseCard from "@/components/expenses/ExpenseCard";
import BudgetCard from "@/components/budget/BudgetCard";
import ExpenseChart from "@/components/charts/ExpenseChart";
import Button from "@/components/ui/Button";
import PageTitle from "@/components/ui/PageTitle";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import {
  selectClassName,
  textareaClassName,
} from "@/components/ui/fieldStyles";
import ErrorState from "@/components/ui/ErrorState";
import { Card, CardContent } from "@/components/ui/Card";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  CalendarIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";
import {
  formatCurrency,
  getLoadErrorMessage,
} from "@/lib/utils";
import Link from "next/link";
import { logger } from "@/lib/logger";
import { useI18n } from '@/lib/i18n/LocaleProvider';
import { localePath } from '@/lib/i18n';

interface Budget {
  id: string;
  name: string;
  total_amount: number;
  spent_amount: number;
  currency: string;
  category: string;
  trip_id?: string;
  trip_title?: string;
  start_date: string;
  end_date: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface BudgetFormData {
  name: string;
  total_amount: string;
  currency: string;
  category: string;
  trip_id: string;
  start_date: string;
  end_date: string;
  description: string;
}

const budgetCategories = [
  { value: "travel" },
  { value: "accommodation" },
  { value: "food" },
  { value: "transport" },
  { value: "entertainment" },
  { value: "shopping" },
  { value: "other" },
];

const budgetCurrencies = [
  { value: "USD" },
  { value: "EUR" },
  { value: "GBP" },
  { value: "JPY" },
  { value: "CAD" },
  { value: "AUD" },
  { value: "CHF" },
  { value: "CNY" },
];

const categoryFilters = [
  { value: "travel" },
  { value: "accommodation" },
  { value: "transport" },
  { value: "food" },
  { value: "entertainment" },
  { value: "shopping" },
  { value: "health" },
  { value: "insurance" },
  { value: "other" },
];

const emptyBudgetForm: BudgetFormData = {
  name: "",
  total_amount: "",
  currency: "USD",
  category: "",
  trip_id: "",
  start_date: "",
  end_date: "",
  description: "",
};

export function ExpensesPageContent({t, locale}: Pick<ReturnType<typeof useI18n>, 't' | 'locale'>) {
  const formatPercent = (value: number) => new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
  const { user, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [tripFilter, setTripFilter] = useState<string>("all");
  const [chartCurrency, setChartCurrency] = useState("USD");

  // Alta/edicion/borrado de presupuesto: el mismo CRUD que vivia en /budget.
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [formData, setFormData] = useState<BudgetFormData>(emptyBudgetForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Los gastos, los viajes del filtro y los presupuestos se leen del SDK, tabla a
  // tabla: reproduce el GET de los endpoints borrados (gastos con
  // `*, trip:trips(*)`, `eq('user_id')` y `order('date', ...)`; viajes con el
  // select de campos explicitos y `order('departure_date', ...)`; presupuestos con
  // `*, eq('user_id')` y `order('created_at', ...)`).
  const [expensesData, setExpensesData] = useState<{
    expenses: (Expense & { trip?: Trip })[];
    trips: Trip[];
    budgets: Budget[];
  } | null>(null);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [expensesLoadError, setExpensesLoadError] = useState<{
    kind: QueryErrorKind;
  } | null>(null);
  const [expensesReloadToken, setExpensesReloadToken] = useState(0);

  const refetchExpenses = useCallback(
    () => setExpensesReloadToken((token) => token + 1),
    [],
  );

  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
      setExpensesData(null);
      setExpensesLoading(false);
      return;
    }

    const userId = user.id;
    let active = true;

    setExpensesLoading(true);
    setExpensesLoadError(null);

    (async () => {
      try {
        const insforge = createInsforgeClient();
        const [expensesRes, tripsRes, budgetsRes] = await withQueryTimeout(
          Promise.all([
            insforge.database
              .from("expenses")
              .select(`*, trip:trips(*)`)
              .eq("user_id", userId)
              .order("date", { ascending: false }),
            insforge.database
              .from("trips")
              .select(
                "id, title, user_id, origin, destination, departure_date, return_date, status, created_at, updated_at",
              )
              .eq("user_id", userId)
              .order("departure_date", { ascending: false }),
            insforge.database
              .from("budgets")
              .select("*")
              .eq("user_id", userId)
              .order("created_at", { ascending: false }),
          ]),
          { label: "expenses" },
        );

        if (expensesRes.error) throw expensesRes.error;
        if (tripsRes.error) throw tripsRes.error;
        if (budgetsRes.error) throw budgetsRes.error;

        if (!active) return;
        setExpensesData({
          expenses: (expensesRes.data as (Expense & { trip?: Trip })[]) ?? [],
          trips: (tripsRes.data as Trip[]) ?? [],
          budgets: (budgetsRes.data as Budget[]) ?? [],
        });
      } catch (err) {
        if (!active) return;
        logger.error("ExpensesPage: Error loading expenses", {
          error: t("expenseLoadError"),
        });
        setExpensesLoadError({ kind: queryErrorKind(err) });
      } finally {
        if (active) setExpensesLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [authLoading, user?.id, expensesReloadToken, t]);

  const { expenses, trips, filteredExpenses, budgets, filteredBudgets } =
    useMemo(() => {
      const expenseRows = expensesData?.expenses ?? [];
      const tripsData = expensesData?.trips ?? [];
      const budgetsData = expensesData?.budgets ?? [];

      // "{t("budgetCompareTitle")}": el gastado de cada presupuesto se recalcula
      // cruzandolo con los gastos (fecha dentro del periodo, categoria y viaje)
      // en vez de fiarse del spent_amount guardado.
      const tripsMap = tripsData.reduce<Record<string, string>>((acc, trip) => {
        acc[trip.id] = trip.title;
        return acc;
      }, {});

      const budgetsWithSpent: Budget[] = budgetsData.map((budget) => {
        const budgetExpenses = expenseRows.filter((expense) => {
          const expenseDate = new Date(expense.date);
          const budgetStart = new Date(budget.start_date);
          budgetStart.setHours(0, 0, 0, 0);

          const budgetEnd = new Date(budget.end_date);
          budgetEnd.setHours(23, 59, 59, 999);

          const dateInRange =
            expenseDate >= budgetStart && expenseDate <= budgetEnd;
          const categoryMatch =
            budget.category === "travel" ||
            expense.category === budget.category;
          const tripMatch =
            !budget.trip_id || expense.trip_id === budget.trip_id;

          return (
            dateInRange &&
            categoryMatch &&
            tripMatch &&
            expense.currency === budget.currency
          );
        });

        const spentAmount = budgetExpenses.reduce(
          (sum, expense) => sum + expense.amount,
          0,
        );

        return {
          ...budget,
          spent_amount: spentAmount,
          trip_title: budget.trip_id ? tripsMap[budget.trip_id] : undefined,
        };
      });

      let filtered = expenseRows;

      // Filter by search term
      if (searchTerm) {
        filtered = filtered.filter(
          (expense) =>
            expense.description
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase()) ||
            expense.trip?.title
              .toLowerCase()
              .includes(searchTerm.toLowerCase()),
        );
      }

      // Filter by category
      if (categoryFilter !== "all") {
        filtered = filtered.filter(
          (expense) => expense.category === categoryFilter,
        );
      }

      // Filter by trip
      if (tripFilter !== "all") {
        filtered = filtered.filter((expense) => expense.trip_id === tripFilter);
      }

      const filteredBudgetsList = budgetsWithSpent.filter((budget) => {
        const matchesSearch =
          budget.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          budget.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory =
          categoryFilter === "all" || budget.category === categoryFilter;
        const matchesTrip =
          tripFilter === "all" || budget.trip_id === tripFilter;

        return matchesSearch && matchesCategory && matchesTrip;
      });

      return {
        expenses: expenseRows,
        trips: tripsData,
        filteredExpenses: filtered,
        budgets: budgetsWithSpent,
        filteredBudgets: filteredBudgetsList,
      };
    }, [expensesData, searchTerm, categoryFilter, tripFilter]);

  // Las tres lecturas comparten el techo del envoltorio: si alguna no responde
  // a tiempo, el mensaje es el de timeout y no el generico del error del SDK.
  const error = getLoadErrorMessage(expensesLoadError, {
    timeout:
      t("dashboardLoadTimeout"),
    request: t("expenseLoadError"),
  });

  const showSkeleton =
    authLoading ||
    expensesLoading ||
    (!authLoading && !!user && expensesData === null && !error);

  const getExpenseStats = () => {
    const totals = expenses.reduce<
      Record<string, { total: number; count: number }>
    >((acc, expense) => {
      const current = acc[expense.currency] ?? { total: 0, count: 0 };
      current.total += expense.amount;
      current.count += 1;
      acc[expense.currency] = current;
      return acc;
    }, {});
    const categoryCounts = expenses.reduce<Record<string, number>>(
      (acc, expense) => {
        acc[expense.category] = (acc[expense.category] ?? 0) + 1;
        return acc;
      },
      {},
    );
    const topCategory = Object.entries(categoryCounts).sort(
      ([categoryA, countA], [categoryB, countB]) =>
        countB - countA || categoryA.localeCompare(categoryB),
    )[0];
    const totalsByCurrency = Object.entries(totals)
      .sort(([currencyA], [currencyB]) => currencyA.localeCompare(currencyB))
      .map(([currency, values]) => ({ currency, total: values.total }));
    const averagesByCurrency = Object.entries(totals)
      .sort(([currencyA], [currencyB]) => currencyA.localeCompare(currencyB))
      .map(([currency, values]) => ({
        currency,
        average: values.total / values.count,
      }));

    return {
      count: expenses.length,
      totalsByCurrency,
      averagesByCurrency,
      topCategory: topCategory?.[0] ?? null,
      topCategoryCount: topCategory?.[1] ?? 0,
    };
  };

  const getCategoryName = (category: string) => {
    const names: Record<string, string> = {
      travel: t("expenseCategoryTravel"),
      accommodation: t("expenseCategoryAccommodation"),
      transport: t("expenseCategoryTransport"),
      food: t("expenseCategoryFood"),
      entertainment: t("expenseCategoryEntertainment"),
      shopping: t("expenseCategoryShopping"),
      health: t("expenseCategoryHealth"),
      insurance: t("expenseCategoryInsurance"),
      other: t("expenseCategoryOther"),
    };
    return names[category] || category;
  };

  const getCurrencyName = (currency: string) => {
    const names: Record<string, string> = {
      USD: t("expenseCurrencyUsd"), EUR: t("expenseCurrencyEuro"), GBP: t("expenseCurrencyGbp"),
      JPY: t("expenseCurrencyJpy"), CAD: t("expenseCurrencyCad"), AUD: t("expenseCurrencyAud"),
      CHF: t("expenseCurrencyChf"), CNY: t("expenseCurrencyCny"),
    };
    return `${currency} - ${names[currency] ?? currency}`;
  };

  const stats = getExpenseStats();
  const hasFinancialData = expenses.length > 0 || budgets.length > 0;

  const expenseCurrencies = [
    ...new Set(expenses.map((expense) => expense.currency)),
  ].sort();
  const selectedChartCurrency = expenseCurrencies.includes(chartCurrency)
    ? chartCurrency
    : (expenseCurrencies[0] ?? "USD");
  const chartExpenses = expenses.filter(
    (expense) => expense.currency === selectedChartCurrency,
  );

  // Contadores de "previsto frente a real" (sobre todos los presupuestos,
  // igual que los totales de gastos, para que no bailen con los filtros).
  const budgetCurrencyTotals = Object.values(
    budgets.reduce<
      Record<string, { currency: string; planned: number; spent: number }>
    >((totals, budget) => {
      const current = totals[budget.currency] ?? {
        currency: budget.currency,
        planned: 0,
        spent: 0,
      };
      current.planned += budget.total_amount;
      current.spent += budget.spent_amount;
      totals[budget.currency] = current;
      return totals;
    }, {}),
  ).sort((a, b) => a.currency.localeCompare(b.currency));
  const overBudgetCount = budgets.filter(
    (budget) => budget.spent_amount > budget.total_amount,
  ).length;
  const nearLimitCount = budgets.filter((budget) => {
    const percentage =
      budget.total_amount > 0
        ? (budget.spent_amount / budget.total_amount) * 100
        : 0;
    return percentage >= 80 && budget.spent_amount <= budget.total_amount;
  }).length;

  const budgetSummary: {
    label: string;
    tone: string;
    values?: { currency: string; amount: number }[];
    value?: string;
  }[] = [
    {
      label: t("expenseBudgetTotal"),
      tone: "text-ink",
      values: budgetCurrencyTotals.map(({ currency, planned }) => ({
        currency,
        amount: planned,
      })),
    },
    {
      label: t("expenseBudgetSpent"),
      tone: "text-ink",
      values: budgetCurrencyTotals.map(({ currency, spent }) => ({
        currency,
        amount: spent,
      })),
    },
    {
      label: t("budgetExceededCount"),
      value: String(overBudgetCount),
      tone: "text-danger",
    },
    {
      label: t("budgetNearLimitCount"),
      value: String(nearLimitCount),
      tone: "text-warning",
    },
  ];

  const handleCreateBudget = () => {
    setEditingBudget(null);
    setFormData(emptyBudgetForm);
    setFormErrors({});
    setSubmitError(null);
    setShowBudgetModal(true);
  };

  const handleEditBudget = (budget: Budget) => {
    setEditingBudget(budget);
    setFormData({
      name: budget.name,
      total_amount: budget.total_amount.toString(),
      currency: budget.currency,
      category: budget.category,
      trip_id: budget.trip_id || "",
      start_date: budget.start_date,
      end_date: budget.end_date,
      description: budget.description || "",
    });
    setFormErrors({});
    setSubmitError(null);
    setShowBudgetModal(true);
  };

  const validateBudgetForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = t("budgetNameRequired");
    }

    if (!formData.total_amount || parseFloat(formData.total_amount) <= 0) {
      errors.total_amount = t("budgetAmountInvalid");
    }

    if (!formData.category) {
      errors.category = t("budgetCategoryRequired");
    }

    if (!formData.start_date) {
      errors.start_date = t("budgetStartRequired");
    }

    if (!formData.end_date) {
      errors.end_date = t("budgetEndRequired");
    }

    if (
      formData.start_date &&
      formData.end_date &&
      new Date(formData.start_date) >= new Date(formData.end_date)
    ) {
      errors.end_date =
        t("budgetEndAfterStart");
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitBudget = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateBudgetForm()) return;
    if (!user) return;

    try {
      setSubmitting(true);
      setSubmitError(null);

      // Mismo objeto que el POST/PATCH borrado: nombre recortado, importe
      // numerico, `trip_id` y `description` a null si vienen vacios y el
      // `updated_at` explicito de la edicion.
      const budgetData = {
        name: formData.name.trim(),
        total_amount: parseFloat(formData.total_amount),
        currency: formData.currency,
        category: formData.category,
        trip_id: formData.trip_id || null,
        start_date: formData.start_date,
        end_date: formData.end_date,
        description: formData.description.trim() || null,
      };

      const insforge = createInsforgeClient();

      if (editingBudget) {
        const { data: updatedRows, error } = await withQueryTimeout(
          insforge.database
            .from("budgets")
            .update({
              ...budgetData,
              updated_at: new Date().toISOString(),
            })
            .eq("id", editingBudget.id)
            .eq("user_id", user.id)
            .select(),
          { label: "budgets:update" },
        );

        if (error) throw error;
        assertRowsAffected(updatedRows, t("budgetSaveError"));
      } else {
        const { error } = await withQueryTimeout(
          insforge.database
            .from("budgets")
            .insert([{ user_id: user.id, ...budgetData }])
            .select()
            .single(),
          { label: "budgets:insert" },
        );

        if (error) throw error;
      }

      setShowBudgetModal(false);
      refetchExpenses();
    } catch (err) {
      const msg =
        queryErrorKind(err) === "timeout"
          ? t("connectionTimeout")
          : t("budgetSaveError");
      logger.error("Error saving budget:", { error: msg, raw: err });
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    if (!user) return;
    if (!confirm(t("budgetDeleteConfirm")))
      return;

    try {
      const insforge = createInsforgeClient();
      const { data: deletedRows, error } = await withQueryTimeout(
        insforge.database
          .from("budgets")
          .delete()
          .eq("id", budgetId)
          .eq("user_id", user.id)
          .select(),
        { label: "budgets:delete" },
      );

      if (error) throw error;
      assertRowsAffected(deletedRows, t("budgetDeleteError"));

      refetchExpenses();
    } catch (err) {
      const msg =
        queryErrorKind(err) === "timeout"
          ? t("connectionTimeout")
          : t("budgetDeleteError");
      logger.error("Error deleting budget:", { error: msg, raw: err });
      alert(msg);
    }
  };

  if (showSkeleton) {
    return <DashboardLayout skeleton="expenses" pending />;
  }

  if (error) {
    return (
      <DashboardLayout skeleton="expenses">
        <ErrorState title={t("errorLoadingData")} message={error} onRetry={refetchExpenses} />
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout skeleton="expenses">
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold text-ink">
            {t("notesSignInTitle")}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {t("expensesAuthDescription")}
          </p>
          <Link href={localePath(locale, '/signin')}>
            <Button className="mt-4">{t("goToSignIn")}</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout skeleton="expenses">
      <div className="space-y-6">
        {/* Header */}
        <PageTitle
          className={slots.expensesTitle}
          title={t("expensesHeading")}
          subtitle={t("expensesSubtitle")}
          action={
            hasFinancialData ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={handleCreateBudget}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  {t("addBudget")}
                </Button>
                <Link href={localePath(locale, '/expenses/new')}>
                  <Button>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    {t("addExpense")}
                  </Button>
                </Link>
              </div>
            ) : undefined
          }
        />

        <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
          <section aria-label={t("expenseMovements")} tabIndex={0} data-loading-slot="expensesMovements" className={slots.expensesMovements}>
            <h2 className="mb-2 text-2xl font-bold tracking-tight text-ink">
              {t("expenseMovements")}
            </h2>
            <p className="mb-5 text-sm text-muted">
              {t("expenseAllInOnePlace")}
            </p>{" "}
            {/* Filters: un unico bloque para gastos y presupuestos */}
            {hasFinancialData && (
              <div className="border-b border-line pb-5">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Search */}
                  <div className="flex-1">
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
                      <Input
                        type="text"
                        placeholder={t("expenseSearchPlaceholder")}
                        aria-label={t("searchExpenses")}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Category Filter */}
                  <div className="lg:w-48">
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      aria-label={t("filterCategory")}
                      className={selectClassName}
                    >
                      <option value="all">{t("allCategories")}</option>
                      {categoryFilters.map((category) => (
                        <option key={category.value} value={category.value}>
                          {getCategoryName(category.value)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Trip Filter */}
                  <div className="lg:w-48">
                    <select
                      value={tripFilter}
                      onChange={(e) => setTripFilter(e.target.value)}
                      aria-label={t("filterTrip")}
                      className={selectClassName}
                    >
                      <option value="all">{t("allTrips")}</option>
                      {trips.map((trip) => (
                        <option key={trip.id} value={trip.id}>
                          {trip.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="mt-3 text-xs text-muted">
                  {filteredExpenses.length} / {expenses.length} {t("navExpenses").toLowerCase()} · {filteredBudgets.length} / {budgets.length} {t("expenseBudgetTitle").toLowerCase()}
                </p>
              </div>
            )}
            {!hasFinancialData && (
              <EmptyState
                icon={<CurrencyDollarIcon className="h-7 w-7" />}
                title={t("expenseStartTitle")}
                description={t("expenseStartDescription")}
                action={
                  <div className="flex flex-col justify-center gap-3 sm:flex-row">
                    <Link href={localePath(locale, '/expenses/new')}>
                      <Button className="w-full sm:w-auto">
                        <PlusIcon className="mr-2 h-4 w-4" />
                        {t("registerFirstExpense")}
                      </Button>
                    </Link>
                    <Button variant="outline" onClick={handleCreateBudget}>
                      {t("createBudget")}
                    </Button>
                  </div>
                }
              />
            )}
            {/* Gastos */}
            {filteredExpenses.length > 0 ? (
              <div className="min-w-0">
                {filteredExpenses.map((expense) => (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    showTripTitle
                  />
                ))}
              </div>
            ) : (
              hasFinancialData && (
                <EmptyState
                  icon={<CurrencyDollarIcon className="h-12 w-12" />}
                  title={
                    searchTerm ||
                    categoryFilter !== "all" ||
                    tripFilter !== "all"
                      ? t("expenseNoResults")
                      : t("expenseEmptyTitle")
                  }
                  description={
                    searchTerm ||
                    categoryFilter !== "all" ||
                    tripFilter !== "all"
                      ? t("expenseFilterHint")
                      : t("expenseEmptyDescription")
                  }
                  action={
                    !searchTerm &&
                    categoryFilter === "all" &&
                    tripFilter === "all" ? (
                      <Link href={localePath(locale, '/expenses/new')}>
                        <Button>
                          <PlusIcon className="h-4 w-4 mr-2" />
                          {t("registerFirstExpense")}
                        </Button>
                      </Link>
                    ) : undefined
                  }
                />
              )
            )}
          </section>
          <aside aria-label={t("expenseBudgetTitle")} tabIndex={0} data-loading-slot="expensesBudgets" className={`${slots.expensesBudgets} xl:border-l xl:border-line xl:pl-7`}>
            <h2 className="mb-5 text-xl font-bold text-ink">{t("expenseBudgetTitle")}</h2>{" "}
            {/* {t("budgetCompareTitle")} */}
            {budgets.length > 0 && (
              <section className="space-y-4">
                {filteredBudgets.length > 1 && (
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-3">
                        <ChartBarIcon className="h-6 w-6 text-accent flex-shrink-0" />
                        <div>
                          <h2 className="text-lg font-semibold text-ink">
                            {t("budgetCompareTitle")}
                          </h2>
                          <p className="mt-1 text-sm text-muted">
                            {t("budgetCompareDescription")}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {budgetSummary.map((item) => (
                          <div key={item.label}>
                            <p className="text-sm font-medium text-muted">
                              {item.label}
                            </p>
                            {item.values ? (
                              <div
                                className={`mt-1 space-y-1 font-bold ${item.tone}`}
                              >
                                {item.values.length > 0 ? (
                                  item.values.map(({ currency, amount }) => (
                                    <p
                                      key={currency}
                                      className="text-sm sm:text-base"
                                    >
                                      <span className="mr-1 text-xs font-medium text-muted">
                                        {currency}
                                      </span>
                                      {formatCurrency(amount, currency, locale)}
                                    </p>
                                  ))
                                ) : (
                                  <p className="text-sm font-medium text-muted">
                                    {t("noBudgetsSummary")}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p
                                className={`mt-1 text-2xl font-bold ${item.tone}`}
                              >
                                {item.value}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      {budgets.length > 0 && (
                        <div className="mt-6 space-y-4">
                          {budgetCurrencyTotals.map(
                            ({ currency, planned, spent }) => {
                              const percentage =
                                planned > 0 ? (spent / planned) * 100 : 0;
                              return (
                                <div key={currency}>
                                  <div className="flex items-center justify-between text-xs text-muted">
                                    <span>
                                      {t("budgetActualVsPlanned").replace("{currency}", currency)}
                                    </span>
                                    <span>{formatPercent(percentage)}%</span>
                                  </div>
                                  <div
                                    role="progressbar"
                                    aria-label={t("budgetActualVsPlanned").replace("{currency}", currency)}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={Math.min(
                                      100,
                                      Math.max(0, Math.round(percentage)),
                                    )}
                                    aria-valuetext={t("budgetUsagePercent").replace("{percent}", formatPercent(percentage))}
                                    className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-strong"
                                  >
                                    <div
                                      className={`h-2 rounded-full transition-all duration-300 ${
                                        percentage > 100
                                          ? "bg-danger"
                                          : percentage >= 80
                                            ? "bg-warning"
                                            : "bg-success"
                                      }`}
                                      style={{
                                        width: `${Math.min(percentage, 100)}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            },
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {filteredBudgets.length > 0 ? (
                  <div className="space-y-5">
                    {filteredBudgets.map((budget) => (
                      <BudgetCard
                        key={budget.id}
                        budget={budget}
                        onEdit={handleEditBudget}
                        onDelete={handleDeleteBudget}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<ChartBarIcon className="h-12 w-12" />}
                    title={t("expenseBudgetEmpty")}
                    description={t("expenseFilterHint")}
                  />
                )}
              </section>
            )}
          </aside>
        </div>
        <details data-loading-slot="expensesReport" className={`${slots.expensesReport} border-t border-line pt-5`}>
          <summary className="min-h-11 cursor-pointer text-lg font-semibold text-ink">
            {t("expenseReport")}
          </summary>
          <div className="mt-5 space-y-6">
            {" "}
            {/* Stats Cards */}
            {expenses.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <CurrencyDollarIcon className="h-8 w-8 text-success" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-muted">
                          {t("totalSpent")}
                        </div>
                        <div className="mt-1 space-y-0.5 text-sm font-semibold text-ink">
                          {stats.totalsByCurrency.length > 0 ? (
                            stats.totalsByCurrency.map(
                              ({ currency, total }) => (
                                <p key={currency}>
                                  {formatCurrency(total, currency, locale)}
                                </p>
                              ),
                            )
                          ) : (
                            <p>{t("noExpensesOrBookings")}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <ChartBarIcon className="h-8 w-8 text-accent" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-muted">
                          {t("totalExpenses")}
                        </div>
                        <div className="text-2xl font-bold text-ink">
                          {stats.count}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <CalendarIcon className="h-8 w-8 text-accent" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-muted">
                          {t("averagePerExpense")}
                        </div>
                        <div className="mt-1 space-y-0.5 text-sm font-semibold text-ink">
                          {stats.averagesByCurrency.length > 0 ? (
                            stats.averagesByCurrency.map(
                              ({ currency, average }) => (
                                <p key={currency}>
                                  {formatCurrency(average, currency, locale)}
                                </p>
                              ),
                            )
                          ) : (
                            <p>{t("noExpensesOrBookings")}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <TrophyIcon className="h-8 w-8 text-warning" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-muted">
                          {t("mostFrequentCategory")}
                        </div>
                        <div className="text-lg font-bold text-ink">
                          {stats.topCategory
                            ? `${getCategoryName(stats.topCategory)} · ${stats.topCategoryCount} ${stats.topCategoryCount === 1 ? t("expenseOne") : t("expenseMany")}`
                            : t("notAvailable")}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            {/* Las gráficas muestran una moneda cada vez para no comparar importes incompatibles. */}
            {chartExpenses.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted">
                    {t("expensesChartFilter")}
                  </p>
                  <div className="w-full sm:w-auto sm:min-w-48">
                    <label htmlFor="expense-chart-currency" className="sr-only">
                      {t("currencyForCharts")}
                    </label>
                    <select
                      id="expense-chart-currency"
                      aria-label={t("currencyForCharts")}
                      value={selectedChartCurrency}
                      onChange={(event) => setChartCurrency(event.target.value)}
                      disabled={expenseCurrencies.length === 0}
                      className={selectClassName}
                    >
                      {(expenseCurrencies.length > 0
                        ? expenseCurrencies
                        : ["USD"]
                      ).map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <section
                    aria-label={t("expenseChartCategoryAria").replace("{currency}", selectedChartCurrency)}
                    className="min-w-0"
                  >
                    <Card className="overflow-hidden">
                      <CardContent className="p-6">
                        <h2 className="text-lg font-semibold text-ink mb-6">
                          {t("expenseChartCategory")} · {selectedChartCurrency}
                        </h2>
                        <ExpenseChart
                          expenses={chartExpenses}
                          type="category"
                          title={t("expenseChartCategoryAria").replace("{currency}", selectedChartCurrency)}
                          currency={selectedChartCurrency}
                          height={320}
                        />
                      </CardContent>
                    </Card>
                  </section>
                  <section
                    aria-label={t("expenseChartTrendAria").replace("{currency}", selectedChartCurrency)}
                    className="min-w-0"
                  >
                    <Card className="overflow-hidden">
                      <CardContent className="p-6">
                        <h2 className="text-lg font-semibold text-ink mb-6">
                          {t("expenseTrend")} · {selectedChartCurrency}
                        </h2>
                        <ExpenseChart
                          expenses={chartExpenses}
                          type="timeline"
                          title={t("expenseChartTrendAria").replace("{currency}", selectedChartCurrency)}
                          currency={selectedChartCurrency}
                          height={320}
                        />
                      </CardContent>
                    </Card>
                  </section>
                </div>
              </div>
            )}
          </div>
        </details>
        {/* Create/Edit Budget Modal */}
        <Modal
          isOpen={showBudgetModal}
          onClose={() => setShowBudgetModal(false)}
          title={editingBudget ? t("editBudget") : t("budgetModalNew")}
        >
          <form onSubmit={handleSubmitBudget} className="space-y-6">
            {submitError && (
              <div className="bg-danger/10 border border-danger text-danger px-4 py-3 rounded-md text-sm">
                {submitError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                {t("budgetNameLabel")}
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder={t("budgetNamePlaceholder")}
                aria-label={t("budgetNameLabel")}
                error={formErrors.name}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  {t("budgetAmountLabel")}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.total_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, total_amount: e.target.value })
                  }
                  placeholder={t("decimalPlaceholder")}
                  aria-label={t("budgetAmountLabel")}
                  error={formErrors.total_amount}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  {t("expenseCurrencyLabel")} *
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) =>
                    setFormData({ ...formData, currency: e.target.value })
                  }
                  aria-label={t("expenseCurrencyLabel")}
                  className={selectClassName}
                >
                  {budgetCurrencies.map((currency) => (
                    <option key={currency.value} value={currency.value}>
                      {getCurrencyName(currency.value)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  {t("expenseCategoryLabel")} *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  aria-label={t("expenseCategoryLabel")}
                  className={selectClassName}
                >
                  <option value="">{t("selectCategory")}</option>
                  {budgetCategories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {getCategoryName(category.value)}
                    </option>
                  ))}
                </select>
                {formErrors.category && (
                  <p className="mt-1 text-sm text-danger">
                    {formErrors.category}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  {t("budgetTripLabel")}
                </label>
                <select
                  value={formData.trip_id}
                  onChange={(e) =>
                    setFormData({ ...formData, trip_id: e.target.value })
                  }
                  aria-label={t("budgetTripLabel")}
                  className={selectClassName}
                >
                  <option value="">{t("noSpecificTrip")}</option>
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  {t("startDateLabel")}
                </label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                  aria-label={t("startDateLabel")}
                  error={formErrors.start_date}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  {t("endDateLabel")}
                </label>
                <Input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, end_date: e.target.value })
                  }
                  aria-label={t("endDateLabel")}
                  error={formErrors.end_date}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                {t("expenseDescription")}
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                aria-label={t("expenseDescription")}
                className={textareaClassName}
                placeholder={t("optionalBudgetDescription")}
              />
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowBudgetModal(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" loading={submitting}>
                {editingBudget ? t("budgetSubmitUpdate") : t("budgetSubmitCreate")} {t("budgetWord")}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
export default function ExpensesPage() {
  const i18n = useI18n()
  return <ExpensesPageContent {...i18n} />
}
