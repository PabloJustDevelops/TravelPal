import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ItineraryPlanner, type DayItinerary } from "./ItineraryPlanner";

const itinerary: DayItinerary[] = [
  {
    date: "2026-10-18",
    activities: [
      {
        id: "activity-museum",
        title: "Museo Nacional de Arte Antiguo",
        description: "Una parada tranquila antes de recorrer el barrio.",
        startTime: "10:00",
        endTime: "12:00",
        location: "Lisboa",
        category: "activity",
        cost: 12,
        currency: "EUR",
      },
      {
        id: "activity-lunch",
        title: "Comida en Alfama",
        startTime: "13:00",
        endTime: "14:00",
        location: "Alfama",
        category: "food",
        cost: 18,
        currency: "USD",
      },
    ],
  },
  {
    date: "2026-10-19",
    activities: [],
  },
];

const meta = {
  title: "Viajes/Itinerario",
  component: ItineraryPlanner,
  args: {
    startDate: "2026-10-18",
    endDate: "2026-10-19",
    itinerary: [],
    onCreateActivity: fn(),
    onUpdateActivity: fn(),
    onDeleteActivity: fn(),
  },
} satisfies Meta<typeof ItineraryPlanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Populated: Story = {
  args: { itinerary },
};

export const Dark: Story = {
  args: { itinerary },
  globals: { theme: "dark" },
};

export const ActivityDialog: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dayToggle = await canvas.findByRole("button", { name: /Día 1/ });
    await userEvent.click(dayToggle);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Agregar primera actividad" }),
    );

    const body = within(document.body);
    await expect(await body.findByRole("dialog")).toBeInTheDocument();
    await expect(
      body.getByRole("heading", { name: "Nueva Actividad" }),
    ).toBeInTheDocument();
    await expect(body.getByLabelText("Título *")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "Agregar primera actividad" }),
    ).toHaveFocus();
  },
};
