import { fireEvent, render, screen } from "@testing-library/react";
import { BookingCard } from "../BookingCard";
import type { Booking } from "@/lib/insforge";

const booking: Booking = {
  id: "booking-1",
  user_id: "user-1",
  trip_id: "trip-1",
  type: "hotel",
  title: "Hotel en Roma",
  status: "pending",
  start_date: "2026-10-18",
  start_time: "15:00",
  cost: 180,
  currency: "EUR",
  address: "Via Roma 10",
  notes: "Entrada por la recepción principal",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("BookingCard", () => {
  it("names icon actions and exposes details as a disclosure", () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const onStatusChange = jest.fn();

    render(
      <BookingCard
        booking={booking}
        onEdit={onEdit}
        onDelete={onDelete}
        onStatusChange={onStatusChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Editar reserva Hotel en Roma" }));
    expect(onEdit).toHaveBeenCalledWith(booking);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar reserva Hotel en Roma" }));
    expect(onDelete).toHaveBeenCalledWith("booking-1");

    const detailsButton = screen.getByRole("button", { name: "Ver detalles" });
    expect(detailsButton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(detailsButton);

    expect(detailsButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Via Roma 10")).toBeInTheDocument();
    expect(screen.getByText("Entrada por la recepción principal")).toBeInTheDocument();
  });
});
