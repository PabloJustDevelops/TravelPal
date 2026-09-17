"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient, Expense, Trip } from "@/lib/insforge";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ExpenseCard from "@/components/expenses/ExpenseCard";
import BudgetCard from "@/components/budget/BudgetCard";
import ExpenseChart from "@/components/charts/ExpenseChart";
import Button from "@/components/ui/Button";
import PageTitle from "@/components/ui/PageTitle";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { selectClassName, textareaClassName } from "@/components/ui/fieldStyles";
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
  getErrorMessage,
  getLoadErrorMessage,
} from "@/lib/utils";
import Link from "next/link";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { useApiResource } from "@/hooks/use-api-resource";
import { logger } from "@/lib/logger";

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
  { value: "travel", label: "Viaje General" },
  { value: "accommodation", label: "Alojamiento" },
  { value: "food", label: "Comida" },
  { value: "transport", label: "Transporte" },
  { value: "entertainment", label: "Entretenimiento" },
  { value: "shopping", label: "Compras" },
  { value: "other", label: "Otros" },
];

const budgetCurrencies = [
  { value: "USD", label: "USD - Dólar Estadounidense" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - Libra Esterlina" },
  { value: "JPY", label: "JPY - Yen Japonés" },
  { value: "CAD", label: "CAD - Dólar Canadiense" },
  { value: "AUD", label: "AUD - Dólar Australiano" },
  { value: "CHF", label: "CHF - Franco Suizo" },
  { value: "CNY", label: "CNY - Yuan Chino" },
];

// Un unico juego de filtros sirve a gastos y a presupuestos. Incluye "travel"
// (solo presupuestos) y "health"/"insurance" (solo gastos): el filtro que no
// aplique a una lista simplemente la deja vacia, sin bloques duplicados.
const categoryFilters = [
  { value: "travel", label: "Viaje General" },
  { value: "accommodation", label: "Alojamiento" },
  { value: "transport", label: "Transporte" },
  { value: "food", label: "Comida" },
  { value: "entertainment", label: "Entretenimiento" },
  { value: "shopping", label: "Compras" },
  { value: "health", label: "Salud" },
  { value: "insurance", label: "Seguro" },
  { value: "other", label: "Otros" },
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

export default function ExpensesPage() {
  const { user, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [tripFilter, setTripFilter] = useState<string>("all");

  // Alta/edicion/borrado de presupuesto: el mismo CRUD que vivia en /budget.
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [formData, setFormData] = useState<BudgetFormData>(emptyBudgetForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Los gastos y los viajes del filtro se leen del SDK, tabla a tabla: reproduce
  // el GET del endpoint borrado (gastos con `*, trip:trips(*)`, `eq('user_id')` y
  // `order('date', ...)`; viajes con el select de campos explicitos y
  // `order('departure_date', ...)`).
  const [expensesData, setExpensesData] = useState<{
    expenses: (Expense & { trip?: Trip })[];
    trips: Trip[];
  } | null>(null);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [expensesLoadError, setExpensesLoadError] = useState(false);
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
    setExpensesLoadError(false);

    (async () => {
      try {
        const insforge = createInsforgeClient();
        const [expensesRes, tripsRes] = await Promise.all([
          insforge
            .database.from("expenses")
            .select(`*, trip:trips(*)`)
            .eq("user_id", userId)
            .order("date", { ascending: false }),
          insforge
            .database.from("trips")
            .select(
              "id, title, user_id, origin, destination, departure_date, return_date, status, created_at, updated_at",
            )
            .eq("user_id", userId)
            .order("departure_date", { ascending: false }),
        ]);

        if (expensesRes.error) throw expensesRes.error;
        if (tripsRes.error) throw tripsRes.error;

        if (!active) return;
        setExpensesData({
          expenses: (expensesRes.data as (Expense & { trip?: Trip })[]) ?? [],
          trips: (tripsRes.data as Trip[]) ?? [],
        });
      } catch (err) {
        if (!active) return;
        logger.error("ExpensesPage: Error loading expenses", {
          error: getErrorMessage(err, "Error al cargar los gastos"),
        });
        setExpensesLoadError(true);
      } finally {
        if (active) setExpensesLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [authLoading, user?.id, expensesReloadToken]);

  // Los presupuestos siguen viniendo de su endpoint: /api/budget conserva GET
  // (lectura) y POST/PATCH/DELETE (escritura) y asi no queda ninguna ruta huerfana.
  const budgetsUrl = !authLoading && user ? "/api/budget" : null;

  const budgetsResource = useApiResource<{ budgets: Budget[] }>(budgetsUrl);

  const { expenses, trips, filteredExpenses, budgets, filteredBudgets } =
    useMemo(() => {
      const expenseRows = expensesData?.expenses ?? [];
      const tripsData = expensesData?.trips ?? [];
      const budgetsData = budgetsResource.data?.budgets ?? [];

      // "Previsto frente a real": el gastado de cada presupuesto se recalcula
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
            budget.category === "travel" || expense.category === budget.category;
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
    }, [
      expensesData,
      budgetsResource.data,
      searchTerm,
      categoryFilter,
      tripFilter,
    ]);

  // El timeout de 15 s era del hook del BFF: con el SDK solo lo conserva la
  // lectura de presupuestos, que sigue por /api/budget. El error de gastos llega
  // como fallo del SDK y reutiliza el mensaje que el handler daba para su 500.
  const budgetLoadError = getLoadErrorMessage(budgetsResource.error, {
    timeout:
      "La carga de datos ha tardado demasiado. Por favor, inténtalo de nuevo.",
    request: "Error al cargar los gastos. Por favor, inténtalo de nuevo.",
  });

  const error =
    budgetLoadError ??
    (expensesLoadError
      ? "Error al cargar los gastos. Por favor, inténtalo de nuevo."
      : null);

  const showSkeleton =
    authLoading ||
    expensesLoading ||
    budgetsResource.loading ||
    ((!authLoading && !!user) &&
      (expensesData === null || budgetsResource.data === null) &&
      !error);

  const refetchAll = () => {
    refetchExpenses();
    budgetsResource.refetch();
  };

  const getExpenseStats = () => {
    const totalAmount = expenses.reduce((sum, expense) => {
      // Convert to EUR for calculation (simplified)
      const amount =
        expense.currency === "EUR" ? expense.amount : expense.amount * 0.85;
      return sum + amount;
    }, 0);

    const categoryTotals = expenses.reduce(
      (acc, expense) => {
        const amount =
          expense.currency === "EUR" ? expense.amount : expense.amount * 0.85;
        acc[expense.category] = (acc[expense.category] || 0) + amount;
        return acc;
      },
      {} as Record<string, number>,
    );

    const topCategory = Object.entries(categoryTotals).sort(
      ([, a], [, b]) => b - a,
    )[0];

    return {
      total: totalAmount,
      count: expenses.length,
      topCategory: topCategory ? topCategory[0] : null,
      topCategoryAmount: topCategory ? topCategory[1] : 0,
      avgPerExpense: expenses.length > 0 ? totalAmount / expenses.length : 0,
    };
  };

  const getCategoryName = (category: string) => {
    const names: Record<string, string> = {
      accommodation: "Alojamiento",
      transport: "Transporte",
      food: "Comida",
      entertainment: "Entretenimiento",
      shopping: "Compras",
      health: "Salud",
      insurance: "Seguro",
      other: "Otros",
    };
    return names[category] || category;
  };

  const stats = getExpenseStats();

  // Contadores de "previsto frente a real" (sobre todos los presupuestos,
  // igual que los totales de gastos, para que no bailen con los filtros).
  const totalBudgetAmount = budgets.reduce(
    (sum, budget) => sum + budget.total_amount,
    0,
  );
  const totalSpentAmount = budgets.reduce(
    (sum, budget) => sum + budget.spent_amount,
    0,
  );
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

  const displayCurrency = budgets.length > 0 ? budgets[0].currency : "USD";
  const overallPercentage =
    totalBudgetAmount > 0 ? (totalSpentAmount / totalBudgetAmount) * 100 : 0;

  const budgetSummary = [
    {
      label: "Presupuesto total",
      value: formatCurrency(totalBudgetAmount, displayCurrency),
      tone: "text-ink",
    },
    {
      label: "Gastado",
      value: formatCurrency(totalSpentAmount, displayCurrency),
      tone: "text-ink",
    },
    {
      label: "Superados",
      value: String(overBudgetCount),
      tone: "text-danger",
    },
    {
      label: "Cerca del límite",
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
      errors.name = "El nombre es requerido";
    }

    if (!formData.total_amount || parseFloat(formData.total_amount) <= 0) {
      errors.total_amount = "El monto debe ser mayor a 0";
    }

    if (!formData.category) {
      errors.category = "La categoría es requerida";
    }

    if (!formData.start_date) {
      errors.start_date = "La fecha de inicio es requerida";
    }

    if (!formData.end_date) {
      errors.end_date = "La fecha de fin es requerida";
    }

    if (
      formData.start_date &&
      formData.end_date &&
      new Date(formData.start_date) >= new Date(formData.end_date)
    ) {
      errors.end_date =
        "La fecha de fin debe ser posterior a la fecha de inicio";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitBudget = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateBudgetForm()) return;

    try {
      setSubmitting(true);
      setSubmitError(null);

      const budgetData = {
        name: formData.name.trim(),
        total_amount: parseFloat(formData.total_amount),
        currency: formData.currency,
        category: formData.category,
        trip_id: formData.trip_id || null,
        start_date: formData.start_date,
        end_date: formData.end_date,
        description: formData.description.trim() || null,
        user_id: user?.id,
      };

      const isEditing = !!editingBudget;
      const url = isEditing ? `/api/budget/${editingBudget.id}` : "/api/budget";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(budgetData),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al guardar el presupuesto");
      }

      setShowBudgetModal(false);
      refetchAll();
    } catch (err) {
      const msg = getErrorMessage(err, "Error al guardar el presupuesto");
      logger.error("Error saving budget:", { error: msg, raw: err });
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este presupuesto?"))
      return;

    try {
      const res = await fetch(`/api/budget/${budgetId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al eliminar el presupuesto");
      }

      refetchAll();
    } catch (err) {
      const msg = getErrorMessage(err, "Error al eliminar el presupuesto");
      logger.error("Error deleting budget:", { error: msg, raw: err });
      alert(msg);
    }
  };

  if (showSkeleton) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <ErrorState message={error} onRetry={refetchAll} />
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold text-ink">
            Inicia sesión para ver tus gastos
          </h3>
          <p className="mt-1 text-sm text-muted">
            La sección de gastos requiere autenticación.
          </p>
          <Link href="/signin">
            <Button className="mt-4">Ir a Login</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageTitle
          title="Mis Gastos"
          subtitle="Controla tus gastos y compáralos con lo previsto"
          action={
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={handleCreateBudget}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Nuevo Presupuesto
              </Button>
              <Link href="/expenses/new">
                <Button>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Nuevo Gasto
                </Button>
              </Link>
            </div>
          }
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CurrencyDollarIcon className="h-8 w-8 text-success" />
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-muted">
                    Total Gastado
                  </div>
                  <div className="text-2xl font-bold text-ink">
                    {formatCurrency(stats.total, "EUR")}
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
                    Total Gastos
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
                    Promedio por Gasto
                  </div>
                  <div className="text-2xl font-bold text-ink">
                    {formatCurrency(stats.avgPerExpense, "EUR")}
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
                    Categoría Principal
                  </div>
                  <div className="text-lg font-bold text-ink">
                    {stats.topCategory
                      ? getCategoryName(stats.topCategory)
                      : "N/A"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Las graficas del dinero viven en gastos, junto a sus cifras */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-ink mb-6">
                Gastos por Categoría
              </h2>
              <ExpenseChart
                expenses={expenses}
                type="category"
                currency={displayCurrency}
                height={320}
              />
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-ink mb-6">
                Tendencia de Gastos
              </h2>
              <ExpenseChart
                expenses={expenses}
                type="timeline"
                currency={displayCurrency}
                height={320}
              />
            </CardContent>
          </Card>
        </div>

        {/* Filters: un unico bloque para gastos y presupuestos */}
        <div className="bg-surface p-4 rounded-lg shadow-sm border border-line">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
                <Input
                  type="text"
                  placeholder="Buscar gastos y presupuestos..."
                  aria-label="Buscar gastos y presupuestos"
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
                aria-label="Filtrar por categoría"
                className={selectClassName}
              >
                <option value="all">Todas las categorías</option>
                {categoryFilters.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Trip Filter */}
            <div className="lg:w-48">
              <select
                value={tripFilter}
                onChange={(e) => setTripFilter(e.target.value)}
                aria-label="Filtrar por viaje"
                className={selectClassName}
              >
                <option value="all">Todos los viajes</option>
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted">
            {filteredExpenses.length} de {expenses.length} gastos ·{" "}
            {filteredBudgets.length} de {budgets.length} presupuestos
          </p>
        </div>

        {/* Previsto frente a real */}
        <section className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <ChartBarIcon className="h-6 w-6 text-accent flex-shrink-0" />
                <div>
                  <h2 className="text-lg font-semibold text-ink">
                    Previsto frente a real
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Compara lo que presupuestaste con lo que llevas gastado.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {budgetSummary.map((item) => (
                  <div key={item.label}>
                    <p className="text-sm font-medium text-muted">
                      {item.label}
                    </p>
                    <p className={`mt-1 text-2xl font-bold ${item.tone}`}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {budgets.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>Real sobre previsto</span>
                    <span>{overallPercentage.toFixed(1)}%</span>
                  </div>
                  <div className="mt-2 w-full bg-surface-strong rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        overallPercentage > 100
                          ? "bg-danger"
                          : overallPercentage >= 80
                            ? "bg-warning"
                            : "bg-success"
                      }`}
                      style={{
                        width: `${Math.min(overallPercentage, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {filteredBudgets.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              title={
                budgets.length === 0
                  ? "No tienes presupuestos"
                  : "No se encontraron presupuestos"
              }
              description={
                budgets.length === 0
                  ? "Crea tu primer presupuesto para comparar lo previsto con lo real"
                  : "Intenta ajustar los filtros para encontrar lo que buscas"
              }
              action={
                budgets.length === 0 ? (
                  <Button onClick={handleCreateBudget}>
                    Crear Presupuesto
                  </Button>
                ) : undefined
              }
            />
          )}
        </section>

        {/* Gastos */}
        {filteredExpenses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExpenses.map((expense) => (
              <ExpenseCard key={expense.id} expense={expense} showTripTitle />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<CurrencyDollarIcon className="h-12 w-12" />}
            title={
              searchTerm || categoryFilter !== "all" || tripFilter !== "all"
                ? "No se encontraron gastos"
                : "No tienes gastos registrados"
            }
            description={
              searchTerm || categoryFilter !== "all" || tripFilter !== "all"
                ? "Intenta ajustar los filtros de búsqueda"
                : "Comienza registrando tu primer gasto"
            }
            action={
              !searchTerm &&
              categoryFilter === "all" &&
              tripFilter === "all" ? (
                <Link href="/expenses/new">
                  <Button>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Registrar Primer Gasto
                  </Button>
                </Link>
              ) : undefined
            }
          />
        )}

        {/* Create/Edit Budget Modal */}
        <Modal
          isOpen={showBudgetModal}
          onClose={() => setShowBudgetModal(false)}
          title={editingBudget ? "Editar Presupuesto" : "Nuevo Presupuesto"}
        >
          <form onSubmit={handleSubmitBudget} className="space-y-6">
            {submitError && (
              <div className="bg-danger/10 border border-danger text-danger px-4 py-3 rounded-md text-sm">
                {submitError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Nombre del Presupuesto *
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ej: Vacaciones en Europa"
                aria-label="Nombre del Presupuesto"
                error={formErrors.name}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Monto Total *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.total_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, total_amount: e.target.value })
                  }
                  placeholder="0.00"
                  aria-label="Monto Total"
                  error={formErrors.total_amount}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Moneda *
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) =>
                    setFormData({ ...formData, currency: e.target.value })
                  }
                  aria-label="Moneda"
                  className={selectClassName}
                >
                  {budgetCurrencies.map((currency) => (
                    <option key={currency.value} value={currency.value}>
                      {currency.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Categoría *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  aria-label="Categoría"
                  className={selectClassName}
                >
                  <option value="">Seleccionar categoría</option>
                  {budgetCategories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
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
                  Viaje Asociado
                </label>
                <select
                  value={formData.trip_id}
                  onChange={(e) =>
                    setFormData({ ...formData, trip_id: e.target.value })
                  }
                  aria-label="Viaje Asociado"
                  className={selectClassName}
                >
                  <option value="">Sin viaje específico</option>
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
                  Fecha de Inicio *
                </label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                  aria-label="Fecha de Inicio"
                  error={formErrors.start_date}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Fecha de Fin *
                </label>
                <Input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, end_date: e.target.value })
                  }
                  aria-label="Fecha de Fin"
                  error={formErrors.end_date}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Descripción
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                aria-label="Descripción"
                className={textareaClassName}
                placeholder="Descripción opcional del presupuesto..."
              />
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowBudgetModal(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" loading={submitting}>
                {editingBudget ? "Actualizar" : "Crear"} Presupuesto
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
