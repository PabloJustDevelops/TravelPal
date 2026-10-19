"use client";

import type { Expense } from "@/lib/insforge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import CategoryIcon from "@/components/ui/CategoryIcon";

interface ExpenseCardProps {
  expense: Expense & { trip?: { title: string }; notes?: string };
  showTripTitle?: boolean;
}
const categoryNames: Record<string, string> = {
  accommodation: "Alojamiento",
  transport: "Transporte",
  food: "Comida",
  entertainment: "Entretenimiento",
  shopping: "Compras",
  health: "Salud",
  insurance: "Seguro",
  other: "Otros",
};
export default function ExpenseCard({
  expense,
  showTripTitle = false,
}: ExpenseCardProps) {
  return (
    <article className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line py-5 sm:grid-cols-[100px_minmax(0,1fr)_auto_44px]">
      <time dateTime={expense.date} className="text-xs text-muted sm:text-sm">
        {formatDate(expense.date)}
      </time>
      <div className="col-start-1 row-start-1 min-w-0 sm:col-start-2">
        <h3 className="flex items-center gap-3 font-medium text-ink">
          <CategoryIcon
            category={expense.category}
            className="h-5 w-5 shrink-0 text-muted"
          />
          <span className="break-words">
            {expense.title || expense.description}
          </span>
        </h3>
        <p className="mt-1 text-xs text-muted">
          {categoryNames[expense.category] || expense.category}
          {showTripTitle && expense.trip ? ` · ${expense.trip.title}` : ""}
        </p>
        {(expense.notes ||
          (expense.description !== expense.title && expense.description)) && (
          <p className="mt-1 line-clamp-2 break-words text-sm text-muted">
            {expense.notes || expense.description}
          </p>
        )}
        {expense.receipt_url && (
          <p className="mt-1 text-xs text-success">Recibo adjunto</p>
        )}
      </div>
      <p className="col-start-2 row-start-1 whitespace-nowrap text-right font-semibold tabular-nums text-ink sm:col-start-3">
        {formatCurrency(expense.amount, expense.currency)}
      </p>
      <Link
        href={`/expense-edit?id=${encodeURIComponent(expense.id)}`}
        aria-label={`Editar gasto ${expense.title || expense.description}`}
        className="col-start-2 inline-flex h-11 w-11 items-center justify-center justify-self-end rounded-md text-muted hover:bg-surface hover:text-accent sm:col-start-4 sm:row-start-1"
      >
        <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
      </Link>
    </article>
  );
}
