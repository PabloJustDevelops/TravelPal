import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import FlightInspiration from "../FlightInspiration";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient } from "@/lib/insforge";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));

jest.mock("@/lib/insforge", () => ({
  createInsforgeClient: jest.fn(),
}));

describe("FlightInspiration", () => {
  const invoke = jest.fn();

  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    invoke.mockReset();
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-1" } });
    (createInsforgeClient as jest.Mock).mockReturnValue({
      functions: { invoke },
    });
    invoke.mockResolvedValue({ data: { status: "unavailable" }, error: null });
  });

  it("muestra el estado sin sesión y evita invocar la función", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });
    render(<FlightInspiration />);
    expect(screen.getByText(/inicia sesión/i)).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("comprueba disponibilidad con check-only al entrar", async () => {
    render(<FlightInspiration />);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith(
      "travel-inspiration",
      { body: { checkOnly: true } },
    ));
  });

  it("envía una consulta válida y muestra resultados con enlaces codificados", async () => {
    invoke.mockResolvedValueOnce({ data: { status: "ready" }, error: null });
    invoke.mockResolvedValueOnce({
      data: {
        status: "ready",
        ideas: [{
          origin: "MAD",
          destination: "LON",
          departureDate: "2026-11-12",
          returnDate: "2026-11-19",
          price: 125,
          currency: "EUR",
          foundAt: "2026-10-17T12:00:00.000Z",
          validUntil: "2026-10-19T12:00:00.000Z",
          changes: 0,
        }],
      },
      error: null,
    });
    render(<FlightInspiration />);
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText(/origen/i), { target: { value: "MAD" } });
    fireEvent.click(screen.getByRole("button", { name: /buscar ideas/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith(
      "travel-inspiration",
      { body: { origin: "MAD", month: expect.any(String), journey: "round-trip" } },
    ));
    expect(await screen.findByRole("heading", { name: "MAD → LON" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /planear este viaje/i })).toHaveAttribute(
      "href",
      "/create-trip?source=inspiration&origin=MAD&destination=LON&departure=2026-11-12&return=2026-11-19",
    );
    expect(screen.getByRole("link", { name: /abrir aviasales/i })).toHaveAttribute(
      "href",
      "https://www.aviasales.com/search/MAD1211LON19111",
    );
  });

  it("muestra el estado vacío cuando no hay resultados", async () => {
    invoke.mockResolvedValueOnce({ data: { status: "unavailable" }, error: null });
    render(<FlightInspiration />);
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText(/origen/i), { target: { value: "MAD" } });
    invoke.mockResolvedValueOnce({ data: { status: "ready", ideas: [] }, error: null });
    fireEvent.click(screen.getByRole("button", { name: /buscar ideas/i }));
    expect(await screen.findByText(/no encontramos ideas/i)).toBeInTheDocument();

  });

  it("muestra un error genérico si falla la comprobación", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new Error("private provider detail") });
    render(<FlightInspiration />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/no se pudo comprobar/i);
    expect(screen.getByRole("alert")).not.toHaveTextContent("private provider detail");
  });

  it("mantiene el host de Aviasales fijo y codifica valores no confiables del resultado", async () => {
    invoke.mockResolvedValueOnce({ data: { status: "unavailable" }, error: null });
    render(<FlightInspiration />);
    await screen.findByText(/no está disponible ahora/i);
    fireEvent.change(screen.getByLabelText(/origen/i), { target: { value: "MAD" } });
    invoke.mockResolvedValueOnce({
      data: { status: "ready", ideas: [{
        origin: "MAD", destination: '"><script>', departureDate: "2026-11-12", returnDate: "2026-11-19",
        price: 125, currency: "EUR", foundAt: "2026-10-17T12:00:00.000Z",
        validUntil: "2026-10-19T12:00:00.000Z", changes: 0,
      }] },
      error: null,
    });
    fireEvent.click(screen.getByRole("button", { name: /buscar ideas/i }));
    const link = await screen.findByRole("link", { name: /abrir aviasales/i });
    expect(link).toHaveAttribute("href", expect.stringMatching(/^https:\/\/www\.aviasales\.com\/search\//));
    expect(link.getAttribute("href")).not.toContain("<script>");
    expect(screen.getByRole("link", { name: /planear este viaje/i })).toHaveAttribute(
      "href",
      expect.stringContaining("destination=%22%3E%3Cscript%3E"),
    );
  });

  it("aplica cooldown visual después de consultar", async () => {
    jest.useFakeTimers();
    try {
      invoke.mockResolvedValueOnce({ data: { status: "unavailable" }, error: null });
      render(<FlightInspiration />);
      await act(async () => { await Promise.resolve(); });
      fireEvent.change(screen.getByLabelText(/origen/i), { target: { value: "MAD" } });
      invoke.mockResolvedValueOnce({ data: { status: "ready", ideas: [] }, error: null });
      fireEvent.click(screen.getByRole("button", { name: /buscar ideas/i }));
      await act(async () => { await jest.advanceTimersByTimeAsync(0); });
      expect(screen.getByRole("button", { name: /actualizar ideas/i })).toBeDisabled();
      act(() => { jest.advanceTimersByTime(30_000); });
      expect(screen.getByRole("button", { name: /actualizar ideas/i })).toBeEnabled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("renueva una idea al comenzar su fecha de salida", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-11T23:59:59.000Z"));
    try {
      invoke.mockResolvedValueOnce({ data: { status: "unavailable" }, error: null });
      render(<FlightInspiration />);
      await act(async () => { await Promise.resolve(); });
      fireEvent.change(screen.getByLabelText(/origen/i), { target: { value: "MAD" } });
      invoke.mockResolvedValueOnce({
        data: { status: "ready", ideas: [{
          origin: "MAD", destination: "LON", departureDate: "2026-11-12", returnDate: "2026-11-19",
          price: 125, currency: "EUR", foundAt: "2026-11-11T12:00:00.000Z",
          validUntil: "2026-11-13T12:00:00.000Z", changes: 0,
        }] },
        error: null,
      });
      fireEvent.click(screen.getByRole("button", { name: /buscar ideas/i }));
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByRole("heading", { name: "MAD → LON" })).toBeInTheDocument();

      invoke.mockResolvedValueOnce({ data: { status: "ready", ideas: [] }, error: null });
      await act(async () => {
        jest.advanceTimersByTime(1_001);
        await Promise.resolve();
      });

      expect(invoke).toHaveBeenCalledTimes(3);
      expect(screen.getByText(/no encontramos ideas/i)).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it("refresca automáticamente al caducar un resultado", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-01T12:00:00.000Z"));
    invoke.mockResolvedValueOnce({ data: { status: "unavailable" }, error: null });
    render(<FlightInspiration />);
    await act(async () => { await jest.advanceTimersByTimeAsync(0); });
    expect(screen.getByText(/no está disponible ahora/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/origen/i), { target: { value: "MAD" } });
    const expiresSoon = new Date(Date.now() + 500).toISOString();
    invoke.mockResolvedValueOnce({
      data: { status: "ready", ideas: [{
        origin: "MAD", destination: "LON", departureDate: "2026-11-12", returnDate: "2026-11-19",
        price: 125, currency: "EUR", foundAt: new Date().toISOString(),
        validUntil: expiresSoon, changes: 0,
      }] },
      error: null,
    });
    fireEvent.click(screen.getByRole("button", { name: /buscar ideas/i }));
    await act(async () => { await jest.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole("heading", { name: "MAD → LON" })).toBeInTheDocument();
    invoke.mockResolvedValueOnce({ data: { status: "ready", ideas: [] }, error: null });
    await act(async () => { await jest.advanceTimersByTimeAsync(500); });
    expect(invoke).toHaveBeenCalledTimes(3);
    expect(screen.getByText(/no encontramos ideas/i)).toBeInTheDocument();
  });

  it("oculta resultados caducados y muestra un error si falla la renovación automática", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-01T12:00:00.000Z"));
    invoke.mockResolvedValueOnce({ data: { status: "unavailable" }, error: null });
    render(<FlightInspiration />);
    await act(async () => { await jest.advanceTimersByTimeAsync(0); });
    expect(screen.getByText(/no está disponible ahora/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/origen/i), { target: { value: "MAD" } });
    const expiresSoon = new Date(Date.now() + 500).toISOString();
    invoke.mockResolvedValueOnce({
      data: { status: "ready", ideas: [{
        origin: "MAD", destination: "LON", departureDate: "2026-11-12", returnDate: "2026-11-19",
        price: 125, currency: "EUR", foundAt: new Date().toISOString(),
        validUntil: expiresSoon, changes: 0,
      }] },
      error: null,
    });
    fireEvent.click(screen.getByRole("button", { name: /buscar ideas/i }));
    await act(async () => { await jest.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole("heading", { name: "MAD → LON" })).toBeInTheDocument();
    invoke.mockRejectedValueOnce(new Error("private provider detail"));

    await act(async () => { await jest.advanceTimersByTimeAsync(500); });
    expect(invoke).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se pudieron cargar las ideas. Inténtalo más tarde.",
    );
    expect(screen.queryByRole("heading", { name: "MAD → LON" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /abrir aviasales/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /planear este viaje/i })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).not.toHaveTextContent("private provider detail");
  });

  it("reintenta al siguiente vencimiento tras un error y conserva las ideas aún vigentes", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-01T12:00:00.000Z"));
    invoke.mockResolvedValueOnce({ data: { status: "unavailable" }, error: null });
    render(<FlightInspiration />);
    await act(async () => { await jest.advanceTimersByTimeAsync(0); });
    expect(screen.getByText(/no está disponible ahora/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/origen/i), { target: { value: "MAD" } });
    const firstExpiry = new Date(Date.now() + 800).toISOString();
    const secondExpiry = new Date(Date.now() + 1_800).toISOString();
    invoke.mockResolvedValueOnce({
      data: { status: "ready", ideas: [
        {
          origin: "MAD", destination: "LON", departureDate: "2026-11-12", returnDate: "2026-11-19",
          price: 125, currency: "EUR", foundAt: new Date().toISOString(),
          validUntil: firstExpiry, changes: 0,
        },
        {
          origin: "MAD", destination: "PAR", departureDate: "2026-11-14", returnDate: "2026-11-21",
          price: 135, currency: "EUR", foundAt: new Date().toISOString(),
          validUntil: secondExpiry, changes: 0,
        },
      ] },
      error: null,
    });
    fireEvent.click(screen.getByRole("button", { name: /buscar ideas/i }));
    await act(async () => { await jest.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole("heading", { name: "MAD → LON" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "MAD → PAR" })).toBeInTheDocument();
    invoke.mockRejectedValueOnce(new Error("first renewal failed"));

    await act(async () => { await jest.advanceTimersByTimeAsync(800); });
    expect(invoke).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se pudieron cargar las ideas. Inténtalo más tarde.",
    );
    expect(screen.queryByRole("heading", { name: "MAD → LON" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "MAD → PAR" })).toBeInTheDocument();
    invoke.mockRejectedValueOnce(new Error("second renewal failed"));

    await act(async () => { await jest.advanceTimersByTimeAsync(1_000); });
    expect(invoke).toHaveBeenCalledTimes(4);
    expect(screen.queryByRole("heading", { name: "MAD → PAR" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /abrir aviasales/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /planear este viaje/i })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se pudieron cargar las ideas. Inténtalo más tarde.",
    );
  });

  it("no contiene fetch directo ni la URL del proveedor en el cliente", () => {
    const source = readFileSync(join(__dirname, "../FlightInspiration.tsx"), "utf8");
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toContain("api.travelpayouts.com");
  });
});
