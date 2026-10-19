import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EditTripModal from "@/components/trips/EditTripModal";
import { createInsforgeClient, type Trip } from "@/lib/insforge";

jest.mock("@/components/ui/Modal", () => ({
  __esModule: true,
  default: ({
    children,
    isOpen,
    title,
  }: {
    children: React.ReactNode;
    isOpen: boolean;
    title: string;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const trip: Trip = {
  id: "trip-1",
  user_id: "user-1",
  title: "Viaje de prueba",
  origin: "Madrid",
  destination: "Lisboa",
  departure_date: "2026-10-20T09:00:00.000Z",
  return_date: "2026-10-25T18:00:00.000Z",
  status: "planned",
  notes: "Una semana tranquila.\n\nViajeros: 2",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("EditTripModal", () => {
  const update = jest.fn();
  const eq = jest.fn();
  const select = jest.fn();
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    const chain = {
      update,
      eq,
      select,
      then: (resolve: (result: unknown) => unknown) =>
        Promise.resolve({ data: [{ id: trip.id }], error: null }).then(resolve),
    };
    update.mockReturnValue(chain);
    eq.mockReturnValue(chain);
    select.mockReturnValue(chain);
    (createInsforgeClient as jest.Mock).mockReturnValue({
      database: { from: jest.fn(() => chain) },
    });
  });

  it("restaura y vuelve a guardar el número de Viajeros dentro de las notas", async () => {
    render(
      <EditTripModal
        isOpen
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        trip={trip}
      />,
    );

    expect(screen.getByLabelText("Número de personas")).toHaveValue(2);
    expect(screen.getByLabelText("Notas Adicionales")).toHaveValue("Una semana tranquila.");

    fireEvent.change(screen.getByLabelText("Número de personas"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar Cambios" }));

    await waitFor(() => expect(mockOnSuccess).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: "Una semana tranquila.\n\nViajeros: 3",
      }),
    );
    expect(eq).toHaveBeenCalledWith("id", "trip-1");
    expect(mockOnClose).toHaveBeenCalled();
  });
});
