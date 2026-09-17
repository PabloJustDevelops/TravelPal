import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DeleteTripDialog from "../DeleteTripDialog";
import {
  deleteTrip,
  getTripDeletionImpact,
  TripChildDeletionError,
  type TripDeletionImpact,
} from "@/lib/trips";
import { showToast } from "@/lib/toast";

jest.mock("@/lib/trips", () => ({
  ...jest.requireActual("@/lib/trips"),
  deleteTrip: jest.fn(),
  getTripDeletionImpact: jest.fn(),
}));
jest.mock("@/lib/toast", () => ({ showToast: jest.fn() }));
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));
// El modal de Headless UI se aisla: aqui solo importa lo que ofrece el dialogo.
jest.mock("@/components/ui/Modal", () => {
  const MockModal = ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
  }) => (isOpen ? <div>{children}</div> : null);
  MockModal.displayName = "Modal";
  return { __esModule: true, default: MockModal };
});

const deleteTripMock = deleteTrip as jest.Mock;
const getImpactMock = getTripDeletionImpact as jest.Mock;
const showToastMock = showToast as jest.Mock;

const trip = { id: "trip-1", title: "Escapada a Roma" };

function impact(overrides: Partial<TripDeletionImpact> = {}): TripDeletionImpact {
  return {
    cascading: [],
    expenses: { table: "expenses", one: "gasto", many: "gastos", count: 0 },
    notes: { table: "notes", one: "nota", many: "notas", count: 0 },
    ...overrides,
  };
}

function renderDialog() {
  const onClose = jest.fn();
  const onDeleted = jest.fn();

  render(
    <DeleteTripDialog
      trip={trip}
      isOpen
      onClose={onClose}
      onDeleted={onDeleted}
    />,
  );

  return { onClose, onDeleted };
}

describe("DeleteTripDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    deleteTripMock.mockReset();
    getImpactMock.mockReset();
  });

  it("con cero hijos avisa de que no hay mas datos y no ofrece la eleccion", async () => {
    getImpactMock.mockResolvedValue(impact());
    deleteTripMock.mockResolvedValue(undefined);

    const { onClose, onDeleted } = renderDialog();

    expect(
      await screen.findByText("No hay más datos asociados a este viaje."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar viaje" }));

    await waitFor(() =>
      expect(deleteTripMock).toHaveBeenCalledWith("trip-1", {
        deleteExpenses: false,
        deleteNotes: false,
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it("muestra lo que se lleva el viaje y lo que hay en gastos y notas", async () => {
    getImpactMock.mockResolvedValue(
      impact({
        cascading: [
          {
            table: "itinerary_activities",
            one: "actividad del itinerario",
            many: "actividades del itinerario",
            count: 3,
          },
          { table: "bookings", one: "reserva", many: "reservas", count: 1 },
          {
            table: "journal_entries",
            one: "entrada del diario",
            many: "entradas del diario",
            count: 2,
          },
        ],
        expenses: {
          table: "expenses",
          one: "gasto",
          many: "gastos",
          count: 1,
        },
        notes: { table: "notes", one: "nota", many: "notas", count: 2 },
      }),
    );
    deleteTripMock.mockResolvedValue(undefined);

    renderDialog();

    expect(
      await screen.findByText(
        "Se eliminarán también 3 actividades del itinerario, 1 reserva y 2 entradas del diario.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Este viaje tiene 1 gasto y 2 notas. ¿Qué quieres hacer con ellos?"),
    ).toBeInTheDocument();

    // Por defecto se conservan: no se pierde nada.
    expect(
      screen.getByRole("radio", { name: /Conservarlos sin viaje/ }),
    ).toBeChecked();

    fireEvent.click(
      screen.getByRole("radio", { name: /Eliminarlos también/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar viaje" }));

    await waitFor(() =>
      expect(deleteTripMock).toHaveBeenCalledWith("trip-1", {
        deleteExpenses: true,
        deleteNotes: true,
      }),
    );
  });

  it("cancelar cierra el dialogo y no borra nada", async () => {
    getImpactMock.mockResolvedValue(impact());
    renderDialog();

    await screen.findByText("No hay más datos asociados a este viaje.");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(deleteTripMock).not.toHaveBeenCalled();
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it("solo pide borrar la tabla opcional que tiene filas", async () => {
    getImpactMock.mockResolvedValue(
      impact({
        expenses: {
          table: "expenses",
          one: "gasto",
          many: "gastos",
          count: 2,
        },
      }),
    );
    deleteTripMock.mockResolvedValue(undefined);

    renderDialog();

    await screen.findByText(
      "Este viaje tiene 2 gastos. ¿Qué quieres hacer con ellos?",
    );
    fireEvent.click(
      screen.getByRole("radio", { name: /Eliminarlos también/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar viaje" }));

    await waitFor(() =>
      expect(deleteTripMock).toHaveBeenCalledWith("trip-1", {
        deleteExpenses: true,
        deleteNotes: false,
      }),
    );
  });

  it("si falla el borrado opcional avisa de que el viaje sigue en pie", async () => {
    getImpactMock.mockResolvedValue(
      impact({
        expenses: {
          table: "expenses",
          one: "gasto",
          many: "gastos",
          count: 1,
        },
      }),
    );
    deleteTripMock.mockRejectedValue(new TripChildDeletionError("los gastos"));

    const { onDeleted } = renderDialog();

    await screen.findByText(
      "Este viaje tiene 1 gasto. ¿Qué quieres hacer con ellos?",
    );
    fireEvent.click(
      screen.getByRole("radio", { name: /Eliminarlos también/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar viaje" }));

    await waitFor(() =>
      expect(showToastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          message: "No se pudieron eliminar los gastos; el viaje no se ha borrado.",
        }),
      ),
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
