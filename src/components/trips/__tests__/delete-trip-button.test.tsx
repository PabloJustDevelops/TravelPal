import { fireEvent, render, screen } from "@testing-library/react";
import DeleteTripButton from "../DeleteTripButton";

interface DialogProps {
  isOpen: boolean;
  onDeleted: () => void;
  trip: { id: string; title: string };
}

// El dialogo se captura con un mock para no depender de Headless UI aqui: el
// ultimo render dice con que props quedo el disparador.
const mockDialog = jest.fn<void, [DialogProps]>();

jest.mock("../DeleteTripDialog", () => {
  const MockDialog = (props: DialogProps) => {
    mockDialog(props);
    return props.isOpen ? <div>dialogo abierto</div> : null;
  };
  MockDialog.displayName = "DeleteTripDialog";
  return { __esModule: true, default: MockDialog };
});

function lastDialogProps(): DialogProps {
  const calls = mockDialog.mock.calls;
  return calls[calls.length - 1][0];
}

describe("DeleteTripButton", () => {
  const trip = { id: "trip-1", title: "Escapada a Roma" };

  beforeEach(() => {
    mockDialog.mockClear();
  });

  it("abre el dialogo al pulsar, en vez de confirmar en un window.confirm", () => {
    const confirmSpy = jest.spyOn(window, "confirm");

    render(<DeleteTripButton trip={trip} onDeleted={jest.fn()} />);

    expect(lastDialogProps().isOpen).toBe(false);
    expect(lastDialogProps().trip).toEqual(trip);
    expect(screen.queryByText("dialogo abierto")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: `Eliminar el viaje ${trip.title}` }),
    );

    expect(screen.getByText("dialogo abierto")).toBeInTheDocument();
    expect(lastDialogProps().isOpen).toBe(true);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("traslada al dialogo el aviso de que el viaje se elimino", () => {
    const onDeleted = jest.fn();

    render(<DeleteTripButton trip={trip} onDeleted={onDeleted} />);
    fireEvent.click(
      screen.getByRole("button", { name: `Eliminar el viaje ${trip.title}` }),
    );

    expect(lastDialogProps().onDeleted).toBe(onDeleted);
  });
});
