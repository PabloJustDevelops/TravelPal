import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { CalendarIcon, PlusIcon, ViewColumnsIcon } from "@heroicons/react/24/outline";
import type { Task } from "@/lib/insforge";
import Button from "@/components/ui/Button";
import PageTitle from "@/components/ui/PageTitle";
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

const longPendingTasks: Task[] = Array.from({ length: 11 }, (_, index) => ({
  id: `task-pending-${index + 1}`,
  user_id: "story-user",
  title: index === 10 ? "Última tarea pendiente" : `Tarea pendiente ${index + 1}`,
  status: "pending",
  priority: "medium",
  created_at: "2026-10-10T00:00:00.000Z",
  updated_at: "2026-10-10T00:00:00.000Z",
}));

export const MobileLongList: Story = {
  args: { tasks: longPendingTasks },
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
  render: (args) => (
    <div className="flex min-h-[calc(100vh-100px)] flex-col md:h-[calc(100vh-100px)] md:min-h-0">
      <div className="mb-6 flex flex-col items-stretch gap-4 md:flex-row md:items-center md:justify-between">
        <PageTitle
          title="Mis Tareas"
          subtitle="Gestiona tus pendientes y proyectos"
        />
        <div className="flex items-center gap-3">
          <div className="bg-surface rounded-lg border border-line p-1 flex">
            <Button
              variant="ghost"
              title="Vista Tablero"
              className="h-9 w-9 rounded-md p-2"
            >
              <ViewColumnsIcon className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              title="Vista Calendario"
              className="h-9 w-9 rounded-md p-2"
            >
              <CalendarIcon className="w-5 h-5" />
            </Button>
          </div>
          <Button aria-label="Nueva Tarea" className="gap-2">
            <PlusIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Nueva Tarea</span>
          </Button>
        </div>
      </div>
      <div className="md:flex-1 md:overflow-hidden">
        <h2 className="sr-only">Tablero de tareas</h2>
        <TaskBoard {...args} />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const lastTask = canvas.getByRole("heading", {
      name: "Última tarea pendiente",
    });

    await expect(window.innerWidth).toBe(390);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);

    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, document.documentElement.scrollHeight);
    await expect(window.scrollY).toBeGreaterThan(0);
    await expect(lastTask.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      window.innerHeight,
    );
  },
};
