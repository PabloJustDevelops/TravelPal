import type { Trip } from "@/lib/insforge";
import { formatCurrency } from "@/lib/utils";
import CategoryIcon from "@/components/ui/CategoryIcon";
import { CalendarIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";

interface Props {
  data: {
    amount: string;
    currency: string;
    description: string;
    category: string;
    date: string;
    trip_id: string;
  };
  trips: Trip[];
  categoryLabel?: string;
}
export default function ExpenseSummary({ data, trips, categoryLabel }: Props) {
  const trip = trips.find((trip) => trip.id === data.trip_id);
  const amount = Number(data.amount);
  return (
    <aside
      aria-label="Resumen del gasto"
      className="self-start border-t border-line pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"
    >
      <h2 className="text-xl font-bold text-ink">Este gasto</h2>
      <p className="mt-5 break-words text-3xl font-bold tracking-tight tabular-nums text-ink">
        {Number.isFinite(amount) && amount > 0
          ? formatCurrency(amount, data.currency)
          : formatCurrency(0, data.currency)}
      </p>
      <p className="mt-2 break-words text-lg text-ink">
        {data.description || "Añade una descripción"}
      </p>
      <dl className="mt-6 space-y-5 border-y border-line py-6 text-muted">
        <div className="flex items-center gap-3">
          <CategoryIcon category={data.category} className="h-6 w-6 shrink-0" />
          <dt className="sr-only">Categoría</dt>
          <dd>{categoryLabel || data.category}</dd>
        </div>
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
          <dt className="sr-only">Fecha</dt>
          <dd>
            {data.date && !Number.isNaN(Date.parse(data.date))
              ? new Date(data.date).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "Elige una fecha"}
          </dd>
        </div>
        <div className="flex items-center gap-3">
          <PaperAirplaneIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
          <dt className="sr-only">Viaje</dt>
          <dd className="break-words">{trip?.title || "Sin viaje asociado"}</dd>
        </div>
      </dl>
      <p className="mt-6 text-sm leading-relaxed text-muted">
        El importe se guarda en {data.currency}
        {trip ? ` para ${trip.title}` : ""}.
      </p>
    </aside>
  );
}
