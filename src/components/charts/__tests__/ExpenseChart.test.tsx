import React from "react";
import { render, screen } from "@testing-library/react";
import type { Expense } from "@/lib/insforge";
import ExpenseChart from "../ExpenseChart";

jest.mock("recharts", () => {
  const ReactRuntime = jest.requireActual("react") as typeof React;
  const renderChildren = ({ children }: { children: React.ReactNode }) =>
    ReactRuntime.createElement("div", null, children);

  return {
    PieChart: renderChildren,
    Pie: ({ data }: { data: Array<{ name: string; value: number }> }) =>
      ReactRuntime.createElement(
        "ul",
        null,
        data.map((point) =>
          ReactRuntime.createElement(
            "li",
            { key: point.name },
            `${point.name}: ${point.value}`,
          ),
        ),
      ),
    Cell: () => null,
    ResponsiveContainer: renderChildren,
    Tooltip: () => null,
    Legend: () => null,
    BarChart: renderChildren,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
  };
});

const expense = (id: string, amount: number, currency: string): Expense => ({
  id,
  user_id: "user-1",
  title: id,
  amount,
  currency,
  category: "food",
  date: "2026-05-02",
  created_at: "2026-05-02T00:00:00.000Z",
  updated_at: "2026-05-02T00:00:00.000Z",
});

describe("ExpenseChart", () => {
  it("calcula categorías solo con los gastos de la moneda mostrada", async () => {
    render(
      <ExpenseChart
        expenses={[expense("usd", 120, "USD"), expense("eur", 500, "EUR")]}
        currency="USD"
        type="category"
      />,
    );

    expect(await screen.findByText("Comida: 120")).toBeInTheDocument();
    expect(screen.queryByText("Comida: 620")).not.toBeInTheDocument();
  });
});
