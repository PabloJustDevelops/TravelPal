import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TripItinerary from "../TripItinerary";
import { createInsforgeClient } from "@/lib/insforge";
import { formatCurrency } from "@/lib/utils";

jest.mock("@/lib/logger", () => ({
  logger: { debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.mock("@/lib/insforge", () => ({
  createInsforgeClient: jest.fn(),
}));

jest.mock("next/link", () => {
  const MockLink = ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = "Link";
  return MockLink;
});

type QueryResult = { data?: unknown; error?: unknown };

function createDatabase(initialActivities: Record<string, unknown>[]) {
  const activities = [...initialActivities];
  const failures = new Map<string, unknown[]>();
  const from = jest.fn((table: string) => {
    let operation: "select" | "insert" | "update" | "delete" = "select";
    let insertedRow: Record<string, unknown> | undefined;
    let selectedId: unknown;
    let updatedValues: Record<string, unknown> | undefined;
    const chain: Record<string, unknown> = {};

    chain.select = jest.fn(() => chain);
    chain.eq = jest.fn((column: string, value: unknown) => {
      if (column === "id") selectedId = value;
      return chain;
    });
    chain.order = jest.fn(() => chain);
    chain.insert = jest.fn((rows: Record<string, unknown>[]) => {
      operation = "insert";
      insertedRow = { id: "activity-new", ...rows[0] };
      return chain;
    });
    chain.update = jest.fn((values: Record<string, unknown>) => {
      operation = "update";
      updatedValues = values;
      return chain;
    });
    chain.delete = jest.fn(() => {
      operation = "delete";
      return chain;
    });
    chain.then = (resolve: (result: QueryResult) => unknown) => {
      let result: QueryResult = { data: [] };
      const queuedFailures = failures.get(operation);
      if (queuedFailures?.length) {
        result = { data: null, error: queuedFailures.shift() };
      } else if (table === "itinerary_activities" && operation === "select") {
        result = { data: activities };
      } else if (operation === "insert" && insertedRow) {
        activities.push(insertedRow);
        result = { data: [insertedRow] };
      } else if (operation === "update") {
        const row = activities.find((activity) => activity.id === selectedId);
        if (row && updatedValues) Object.assign(row, updatedValues);
        result = { data: row ? [row] : [] };
      } else if (operation === "delete") {
        const index = activities.findIndex((activity) => activity.id === selectedId);
        const [deleted] = index >= 0 ? activities.splice(index, 1) : [];
        result = { data: deleted ? [deleted] : [] };
      }
      return Promise.resolve(result).then(resolve);
    };

    return chain;
  });

  return {
    from,
    activities,
    failNext(operation: string, error: unknown) {
      failures.set(operation, [...(failures.get(operation) ?? []), error]);
    },
  };
}

describe("TripItinerary", () => {
  beforeEach(() => jest.clearAllMocks());

  it("filtra las actividades por viaje y conserva los importes por moneda", async () => {
    const database = createDatabase([
      {
        id: "activity-1",
        trip_id: "trip-1",
        date: "2026-10-18",
        title: "Museo",
        category: "activity",
        cost: 10,
        currency: "USD",
        order_index: 0,
        completed: false,
      },
      {
        id: "activity-2",
        trip_id: "trip-1",
        date: "2026-10-18",
        title: "Comida",
        category: "food",
        cost: 25,
        currency: "EUR",
        order_index: 1,
        completed: false,
      },
    ]);
    (createInsforgeClient as jest.Mock).mockReturnValue({ database });

    render(
      <TripItinerary
        tripId="trip-1"
        startDate="2026-10-18"
        endDate="2026-10-18"
        userId="user-1"
      />,
    );

    await userEvent.setup().click(await screen.findByRole("button", { name: /Día 1/ }));
    expect(await screen.findByRole("heading", { name: "Museo" })).toBeInTheDocument();
    const activityQuery = database.from.mock.results[0].value;
    expect(activityQuery.eq).toHaveBeenCalledWith("trip_id", "trip-1");
    const normalizeSpaces = (value: string) => value.replace(/\s/g, " ");
    expect(
      screen.getAllByText((value) => normalizeSpaces(value) === normalizeSpaces(formatCurrency(10, "USD"))),
    ).toHaveLength(2);
    expect(
      screen.getAllByText((value) => normalizeSpaces(value) === normalizeSpaces(formatCurrency(25, "EUR"))),
    ).toHaveLength(2);
    expect(screen.queryByText(formatCurrency(35, "EUR"))).not.toBeInTheDocument();
  });

  it("abre un diálogo etiquetado, cierra con Escape y devuelve el foco al disparador", async () => {
    const user = userEvent.setup();
    const database = createDatabase([]);
    (createInsforgeClient as jest.Mock).mockReturnValue({ database });

    render(
      <TripItinerary
        tripId="trip-1"
        startDate="2026-10-18"
        endDate="2026-10-18"
        userId="user-1"
      />,
    );

    const dayToggle = await screen.findByRole("button", { name: /Día 1/ });
    await user.click(dayToggle);
    const addButton = screen.getByRole("button", { name: "Agregar primera actividad" });
    await user.click(addButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nueva Actividad" })).toBeInTheDocument();
    expect(screen.getByLabelText("Título *")).toHaveAttribute("id");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(addButton).toHaveFocus();
  });

  it("guarda una actividad con el viaje, usuario y día actuales", async () => {
    const user = userEvent.setup();
    const database = createDatabase([]);
    (createInsforgeClient as jest.Mock).mockReturnValue({ database });

    render(
      <TripItinerary
        tripId="trip-1"
        startDate="2026-10-18"
        endDate="2026-10-18"
        userId="user-1"
      />,
    );

    await user.click(await screen.findByRole("button", { name: /Día 1/ }));
    await user.click(screen.getByRole("button", { name: "Agregar primera actividad" }));
    await user.type(screen.getByPlaceholderText("Nombre de la actividad"), "Paseo");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Agregar$/ }));

    await waitFor(() => expect(database.activities).toHaveLength(1));
    expect(database.activities[0]).toEqual(
      expect.objectContaining({
        user_id: "user-1",
        trip_id: "trip-1",
        date: "2026-10-18",
        title: "Paseo",
        order_index: 0,
      }),
    );
    expect(await screen.findByRole("heading", { name: "Paseo" })).toBeInTheDocument();
  });

  it("actualiza la actividad seleccionada y vuelve a cargarla", async () => {
    const user = userEvent.setup();
    const database = createDatabase([
      {
        id: "activity-1",
        trip_id: "trip-1",
        date: "2026-10-18",
        title: "Museo",
        category: "activity",
        cost: 10,
        currency: "EUR",
        order_index: 0,
        completed: false,
      },
    ]);
    (createInsforgeClient as jest.Mock).mockReturnValue({ database });

    render(
      <TripItinerary
        tripId="trip-1"
        startDate="2026-10-18"
        endDate="2026-10-18"
        userId="user-1"
      />,
    );

    await user.click(await screen.findByRole("button", { name: /Día 1/ }));
    await user.click(await screen.findByRole("button", { name: "Editar Museo" }));
    const titleInput = screen.getByLabelText("Título *");
    await user.clear(titleInput);
    await user.type(titleInput, "Museo actualizado");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Actualizar" }));

    expect(await screen.findByRole("heading", { name: "Museo actualizado" })).toBeInTheDocument();
    expect(database.activities[0]).toEqual(expect.objectContaining({ id: "activity-1", title: "Museo actualizado" }));
  });

  it("elimina la actividad seleccionada y la quita del itinerario", async () => {
    const user = userEvent.setup();
    const database = createDatabase([
      {
        id: "activity-1",
        trip_id: "trip-1",
        date: "2026-10-18",
        title: "Museo",
        category: "activity",
        order_index: 0,
        completed: false,
      },
    ]);
    (createInsforgeClient as jest.Mock).mockReturnValue({ database });

    render(
      <TripItinerary
        tripId="trip-1"
        startDate="2026-10-18"
        endDate="2026-10-18"
        userId="user-1"
      />,
    );

    await user.click(await screen.findByRole("button", { name: /Día 1/ }));
    await screen.findByRole("heading", { name: "Museo" });
    await user.click(screen.getByRole("button", { name: "Eliminar Museo" }));

    await waitFor(() => expect(database.activities).toHaveLength(0));
    expect(screen.queryByRole("heading", { name: "Museo" })).not.toBeInTheDocument();
  });

  it("permite reintentar la carga del itinerario", async () => {
    const user = userEvent.setup();
    const database = createDatabase([
      {
        id: "activity-1",
        trip_id: "trip-1",
        date: "2026-10-18",
        title: "Museo",
        category: "activity",
        order_index: 0,
        completed: false,
      },
    ]);
    database.failNext("select", { message: "temporary error" });
    (createInsforgeClient as jest.Mock).mockReturnValue({ database });

    render(
      <TripItinerary
        tripId="trip-1"
        startDate="2026-10-18"
        endDate="2026-10-18"
        userId="user-1"
      />,
    );

    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("button", { name: /Día 1/ })).toBeInTheDocument();
  });
});
