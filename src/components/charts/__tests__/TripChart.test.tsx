import React from "react";
import { render, screen } from "@testing-library/react";
import type { Trip } from "@/lib/insforge";
import TripChart from "../TripChart";

jest.mock("recharts", () => {
  const ReactRuntime = jest.requireActual("react") as typeof React;
  const renderChildren = ({ children }: { children: React.ReactNode }) =>
    ReactRuntime.createElement("div", null, children);

  return {
    PieChart: renderChildren,
    Pie: renderChildren,
    Cell: () => null,
    ResponsiveContainer: ({
      children,
      height,
    }: {
      children: React.ReactNode;
      height: number | string;
    }) =>
      ReactRuntime.createElement(
        "div",
        { "data-testid": "responsive-container", "data-height": height },
        children,
      ),
    Tooltip: () => null,
    Legend: () => null,
    BarChart: renderChildren,
    Bar: renderChildren,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
  };
});

const trip = (id: string, status: Trip["status"]): Trip => ({
  id,
  user_id: "user-1",
  title: `Viaje ${id}`,
  origin: "Madrid",
  destination: `Destino ${id}`,
  departure_date: "2026-10-18T09:00:00",
  status,
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
});

describe("TripChart", () => {
  it("reduce la altura móvil para un único estado y conserva la altura de escritorio", async () => {
    render(<TripChart trips={[trip("1", "planned")]} height={350} />);

    const chart = await screen.findByTestId("trip-chart");
    expect(chart).toHaveClass(
      "h-[var(--chart-mobile-height)]",
      "lg:h-[var(--chart-height)]",
    );
    expect(chart).toHaveStyle({
      "--chart-mobile-height": "220px",
      "--chart-height": "350px",
    });
    expect(screen.getByTestId("responsive-container")).toHaveAttribute(
      "data-height",
      "100%",
    );
  });

  it("ajusta la altura móvil para mostrar una leyenda con varios estados", async () => {
    render(
      <TripChart
        trips={[
          trip("1", "planned"),
          trip("2", "confirmed"),
          trip("3", "completed"),
          trip("4", "cancelled"),
        ]}
        height={350}
      />,
    );

    expect(await screen.findByTestId("trip-chart")).toHaveStyle({
      "--chart-mobile-height": "224px",
    });
  });

  it("mantiene un área compacta cuando no hay viajes", () => {
    render(<TripChart trips={[]} height={350} />);

    expect(screen.getByTestId("trip-chart")).toHaveClass(
      "h-[var(--chart-mobile-height)]",
    );
    expect(screen.getByText("No hay datos suficientes")).toBeInTheDocument();
  });
});
