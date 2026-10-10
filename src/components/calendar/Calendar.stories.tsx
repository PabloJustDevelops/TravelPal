import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { addDays, format } from "date-fns";
import { Calendar } from "./Calendar";

const today = new Date();
const events = [
  {
    id: "trip-start",
    title: "Salida del viaje",
    date: format(today, "yyyy-MM-dd"),
    type: "trip" as const,
    color: "bg-accent text-on-accent",
    description: "Inicio del viaje",
  },
  {
    id: "booking-hotel",
    title: "Entrada al hotel",
    date: format(addDays(today, 1), "yyyy-MM-dd"),
    type: "booking" as const,
    color: "bg-success text-on-accent",
    time: "15:00",
  },
  {
    id: "activity-walk",
    title: "Paseo por el centro",
    date: format(addDays(today, 2), "yyyy-MM-dd"),
    type: "activity" as const,
    color: "bg-accent-soft text-accent",
    time: "10:30",
  },
];

const meta = {
  title: "Planificación/Calendario",
  component: Calendar,
  args: {
    events,
    selectedDate: today,
    onDateSelect: fn(),
    onEventClick: fn(),
    onAddEvent: fn(),
    onDeleteEvent: fn(),
    onEventDrop: fn(),
  },
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Month: Story = {};

export const Week: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Semana" }));
    await expect(canvas.getByRole("button", { name: "Semana" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  },
};

export const Dark: Story = {
  globals: { theme: "dark" },
};

export const AddEventByKeyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const addButton = canvas.getByRole("button", {
      name: "Añadir evento al día seleccionado",
    });
    addButton.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onAddEvent).toHaveBeenCalled();
  },
};
