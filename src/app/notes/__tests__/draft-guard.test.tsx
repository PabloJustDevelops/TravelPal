import { fireEvent, render, screen } from "@testing-library/react";
import NotesPage from "../page";

jest.mock("@/components/layout/DashboardLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "qa" }, loading: false }),
}));
jest.mock("@/lib/toast", () => ({ showToast: jest.fn() }));
jest.mock("@/lib/logger", () => ({ logger: { error: jest.fn() } }));
jest.mock("@/lib/insforge", () => ({
  createInsforgeClient: () => ({
    database: {
      from: (table: string) => {
        const chain: Record<string, unknown> = {};
        chain.select = chain.eq = chain.order = () => chain;
        chain.then = (resolve: (value: unknown) => unknown) =>
          Promise.resolve({
            data:
              table === "notes"
                ? [
                    {
                      id: "a",
                      title: "Nota A",
                      content: "Original",
                      category: "general",
                      is_favorite: false,
                      updated_at: "2026-10-16",
                    },
                  ]
                : [],
            error: null,
          }).then(resolve);
        return chain;
      },
    },
  }),
}));

it("seleccionar la misma nota o repetir nueva conserva la protección del borrador", async () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  render(<NotesPage />);
  await screen.findByRole("button", { name: "Editar nota Nota A" });
  fireEvent.change(screen.getByLabelText("Contenido *"), {
    target: { value: "Borrador A" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Editar nota Nota A" }));
  fireEvent.click(screen.getByRole("button", { name: "Nueva Nota" }));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(screen.getByDisplayValue("Borrador A")).toBeInTheDocument();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "Nueva Nota" }));
  fireEvent.change(screen.getByLabelText("Contenido *"), {
    target: { value: "Borrador nuevo" },
  });
  confirm.mockClear().mockReturnValue(false);
  fireEvent.click(screen.getByRole("button", { name: "Nueva Nota" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Cerrar editor de nota" }),
  );
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(screen.getByDisplayValue("Borrador nuevo")).toBeInTheDocument();
  confirm.mockRestore();
});
