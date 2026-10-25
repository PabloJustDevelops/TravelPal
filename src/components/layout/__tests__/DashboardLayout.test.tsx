import { render, screen } from "@testing-library/react";
import DashboardLayout from "../DashboardLayout";

jest.mock("@/components/auth/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("../Navbar", () => ({
  __esModule: true,
  default: ({ navigation }: { navigation: Array<{ name: string; href: string }> }) => (
    <nav>{navigation.map((item) => <a key={item.href} href={item.href}>{item.name}</a>)}</nav>
  ),
}));
jest.mock("../TopBar", () => ({ __esModule: true, default: () => <div data-testid="top-bar" /> }));

it("incluye inspiración de vuelos en la navegación", () => {
  render(<DashboardLayout>Contenido</DashboardLayout>);
  expect(screen.getByTestId("top-bar")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Inspiración de vuelos" })).toHaveAttribute(
    "href",
    "/travel-inspiration",
  );
});
