import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DeleteTripButton from "../DeleteTripButton";
import { deleteTrip } from "@/lib/trips";
import { showToast } from "@/lib/toast";
import { QueryTimeoutError } from "@/lib/insforge-query";
import { CONNECTION_TIMEOUT_MESSAGE } from "@/lib/utils";

jest.mock("@/lib/trips", () => ({
  ...jest.requireActual("@/lib/trips"),
  deleteTrip: jest.fn(),
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

const deleteTripMock = deleteTrip as jest.Mock;
const showToastMock = showToast as jest.Mock;

describe("DeleteTripButton", () => {
  const trip = { id: "trip-1", title: "Escapada a Roma" };
  let confirmSpy: jest.SpyInstance;

  function renderButton(onDeleted: () => void = jest.fn()) {
    render(<DeleteTripButton trip={trip} onDeleted={onDeleted} />);
    fireEvent.click(
      screen.getByRole("button", { name: `Eliminar el viaje ${trip.title}` }),
    );
    return onDeleted;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    deleteTripMock.mockReset();
    confirmSpy = jest.spyOn(window, "confirm");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("confirma el borrado avisando de que los gastos y las notas no caen", () => {
    confirmSpy.mockReturnValue(false);

    renderButton();

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    const message = confirmSpy.mock.calls[0][0] as string;
    expect(message).toContain(trip.title);
    expect(message).toMatch(/se borrar/i);
    expect(message).toMatch(/los gastos y las notas no se borran/i);
  });

  it("borra el viaje y avisa al contenedor tras confirmar", async () => {
    confirmSpy.mockReturnValue(true);
    deleteTripMock.mockResolvedValue(undefined);

    const onDeleted = renderButton();

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(deleteTripMock).toHaveBeenCalledWith("trip-1");
    expect(showToastMock).toHaveBeenCalledWith({
      type: "success",
      message: "Viaje eliminado",
    });
  });

  it("no borra nada si se cancela la confirmacion", () => {
    confirmSpy.mockReturnValue(false);

    const onDeleted = renderButton();

    expect(deleteTripMock).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it("avisa del fallo sin cantar el borrado", async () => {
    confirmSpy.mockReturnValue(true);
    deleteTripMock.mockRejectedValue(new Error("boom"));

    const onDeleted = renderButton();

    await waitFor(() =>
      expect(showToastMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" }),
      ),
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("traduce el timeout al mensaje de conexion", async () => {
    confirmSpy.mockReturnValue(true);
    deleteTripMock.mockRejectedValue(new QueryTimeoutError("tarde"));

    renderButton();

    await waitFor(() =>
      expect(showToastMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: CONNECTION_TIMEOUT_MESSAGE }),
      ),
    );
  });
});
