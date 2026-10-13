import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Task } from "@/lib/insforge";
import { TaskBoard } from "./TaskBoard";

const tasks: Task[] = [
  {
    id: "task-pending",
    user_id: "story-user",
    title: "Reservar tren",
    description: "Comprar billetes para el trayecto a Lisboa.",
    status: "pending",
    priority: "high",
    due_date: "2026-10-15",
    created_at: "2026-10-10T00:00:00.000Z",
    updated_at: "2026-10-10T00:00:00.000Z",
  },
  {
    id: "task-in-progress",
    user_id: "story-user",
    title: "Preparar equipaje",
    status: "in_progress",
    priority: "medium",
    created_at: "2026-10-10T00:00:00.000Z",
    updated_at: "2026-10-10T00:00:00.000Z",
  },
  {
    id: "task-completed",
    user_id: "story-user",
    title: "Confirmar alojamiento",
    status: "completed",
    priority: "low",
    created_at: "2026-10-10T00:00:00.000Z",
    updated_at: "2026-10-10T00:00:00.000Z",
  },
];

const meta = {
  title: "Tareas/Tablero",
  component: TaskBoard,
  args: {
    tasks,
    onEditTask: fn(),
    onDeleteTask: fn(),
    onStatusChange: fn(),
  },
} satisfies Meta<typeof TaskBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Board: Story = {};

export const Dark: Story = { globals: { theme: "dark" } };

export const Mobile390: Story = {
  parameters: {
    viewport: {
      options: {
        travelPal390: {
          name: "TravelPal 390 × 844",
          styles: { width: "390px", height: "844px" },
          type: "mobile",
        },
      },
    },
  },
  globals: { viewport: { value: "travelPal390", isRotated: false } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const selector = canvas.getByRole("combobox", {
      name: "Mostrar tareas por estado",
    });
    await expect(window.innerWidth).toBe(390);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);

    await userEvent.selectOptions(selector, "in_progress");
    const pendingColumn = canvasElement.querySelector<HTMLElement>("#task-column-pending");
    const progressColumn = canvasElement.querySelector<HTMLElement>("#task-column-in_progress");
    await expect(pendingColumn).not.toBeNull();
    await expect(progressColumn).not.toBeNull();
    await expect(getComputedStyle(pendingColumn!).display).toBe("none");
    await expect(getComputedStyle(progressColumn!).display).toBe("flex");

    const editButton = canvas.getByRole("button", { name: "Editar tarea" });
    const deleteButton = canvas.getByRole("button", { name: "Eliminar tarea" });
    for (const button of [editButton, deleteButton]) {
      const bounds = button.getBoundingClientRect();
      await expect(bounds.width).toBeGreaterThanOrEqual(44);
      await expect(bounds.height).toBeGreaterThanOrEqual(44);
      await expect(getComputedStyle(button).opacity).toBe("1");
    }

    await userEvent.tab();
    await expect(editButton).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onEditTask).toHaveBeenCalledWith(tasks[1]);
    await userEvent.click(deleteButton);
    await expect(args.onDeleteTask).toHaveBeenCalledWith(tasks[1]);
  },
};
