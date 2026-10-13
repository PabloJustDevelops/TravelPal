import { fireEvent, render, screen } from "@testing-library/react";
import type { Task } from "@/lib/insforge";
import { TaskBoard } from "../TaskBoard";

const tasks: Task[] = [
  {
    id: "task-pending",
    user_id: "user-1",
    title: "Reservar tren",
    status: "pending",
    priority: "high",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "task-in-progress",
    user_id: "user-1",
    title: "Preparar equipaje",
    status: "in_progress",
    priority: "medium",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "task-completed",
    user_id: "user-1",
    title: "Confirmar alojamiento",
    status: "completed",
    priority: "low",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

describe("TaskBoard", () => {
  it("no muestra la zona de borrado cuando no hay tareas que arrastrar", () => {
    render(
      <TaskBoard
        tasks={[]}
        onEditTask={jest.fn()}
        onDeleteTask={jest.fn()}
        onStatusChange={jest.fn()}
      />,
    );

    expect(screen.queryByText("Soltar para eliminar")).not.toBeInTheDocument();
  });

  it("ofrece una selección accesible de estado para recorrer el tablero en móvil", () => {
    render(
      <TaskBoard
        tasks={tasks}
        onEditTask={jest.fn()}
        onDeleteTask={jest.fn()}
        onStatusChange={jest.fn()}
      />,
    );

    const stateSelector = screen.getByRole("combobox", {
      name: "Mostrar tareas por estado",
    });
    expect(stateSelector).toHaveValue("pending");
    const pendingColumn = screen.getByRole("region", { name: "Pendiente" });
    const progressColumn = screen.getByRole("region", { name: "En Progreso" });
    expect(pendingColumn).toHaveClass("flex");
    expect(progressColumn).toHaveClass("hidden");

    fireEvent.change(stateSelector, { target: { value: "in_progress" } });

    expect(stateSelector).toHaveValue("in_progress");
    expect(pendingColumn).toHaveClass("hidden");
    expect(progressColumn).toHaveClass("flex");
  });
});
