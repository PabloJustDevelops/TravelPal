import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Booking } from "@/lib/insforge";
import { BookingCard } from "./BookingCard";

const booking: Booking = {
  id: "story-booking",
  user_id: "story-user",
  trip_id: "story-trip",
  type: "hotel",
  title: "Estancia en el centro",
  status: "confirmed",
  start_date: "2026-10-18",
  end_date: "2026-10-21",
  start_time: "15:00",
  cost: 180,
  currency: "EUR",
  confirmation_number: "HTL-2841",
  location: "Lisboa",
  address: "Rua da Madalena 20",
  contact_name: "Recepción",
  contact_phone: "+351 210 000 000",
  notes: "Entrada desde las 15:00.",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const meta = {
  title: "Planificación/Reserva",
  component: BookingCard,
  args: {
    booking,
    onEdit: fn(),
    onDelete: fn(),
    onStatusChange: fn(),
  },
} satisfies Meta<typeof BookingCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Confirmed: Story = {};

export const Pending: Story = {
  args: { booking: { ...booking, status: "pending" } },
};

export const PendingAt390px: Story = {
  args: { booking: { ...booking, status: "pending" } },
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
    <div data-testid="booking-card-viewport" style={{ width: "100%" }}>
      <BookingCard {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByTestId("booking-card-viewport");
    const viewportBounds = viewport.getBoundingClientRect();
    await expect(window.innerWidth).toBe(390);
    await expect(viewportBounds.width).toBeLessThanOrEqual(390);
    for (const button of canvas.getAllByRole("button")) {
      const buttonBounds = button.getBoundingClientRect();
      await expect(buttonBounds.left).toBeGreaterThanOrEqual(viewportBounds.left);
      await expect(buttonBounds.right).toBeLessThanOrEqual(viewportBounds.right);
      await expect(buttonBounds.width).toBeGreaterThanOrEqual(44);
    }
    await expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
  },
};

export const Dark: Story = {
  globals: { theme: "dark" },
};

export const ExpandedDetails: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Ver detalles" }));
    await expect(canvas.getByRole("region", { name: "Detalles de Estancia en el centro" })).toBeVisible();
  },
};
