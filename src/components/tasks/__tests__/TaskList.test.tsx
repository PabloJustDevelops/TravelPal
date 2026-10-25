import { fireEvent, render, screen } from "@testing-library/react";
import { TaskList } from "../TaskList";
import type { Task } from "@/lib/insforge";

const task: Task = {
  id: "one",
  user_id: "qa",
  title: "Preparar maleta",
  description: "Lista personal",
  priority: "high",
  status: "pending",
  due_date: "2026-10-18",
  created_at: "",
  updated_at: "",
};
it("agrupa por estado y permite completar y editar con teclado o selector", () => {
  const onStatusChange = jest.fn(),
    onEditTask = jest.fn();
  render(
    <TaskList
      tasks={[task]}
      onStatusChange={onStatusChange}
      onEditTask={onEditTask}
      onDeleteTask={jest.fn()}
    />,
  );
  expect(screen.getByText("Por hacer · 1")).toBeInTheDocument();
  fireEvent.change(
    screen.getByRole("combobox", { name: "Mover la tarea Preparar maleta" }),
    { target: { value: "completed" } },
  );
  expect(onStatusChange).toHaveBeenCalledWith("one", "completed");
  fireEvent.click(
    screen.getByRole("button", { name: "Editar tarea Preparar maleta" }),
  );
  expect(onEditTask).toHaveBeenCalledWith(task);
});
