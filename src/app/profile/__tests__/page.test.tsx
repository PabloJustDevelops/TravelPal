import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProfilePage from "../page";

const mockUpdateProfile = jest.fn().mockResolvedValue(undefined);
const mockUploadAvatar = jest.fn();
const mockUser = { id: "u1", email: "ana@example.test", full_name: "Ana", avatar_url: "" };

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, updateProfile: mockUpdateProfile, uploadAvatar: mockUploadAvatar }),
}));
jest.mock("@/components/layout/DashboardLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("@/components/layout/AccountTabs", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showSuccess: jest.fn(), showError: jest.fn() }),
}));

beforeEach(() => jest.clearAllMocks());

it("rechaza el avatar antes de guardar y permite corregirlo", async () => {
  render(<ProfilePage />);
  fireEvent.click(screen.getByRole("button", { name: "Editar Perfil" }));
  const input = screen.getByLabelText("URL del Avatar (Opcional)");
  fireEvent.change(input, { target: { value: "https://tracker.example/pixel.png" } });
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Guardar Cambios" }));
  expect(mockUpdateProfile).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("Usa una URL HTTPS");
  expect(input).toHaveAttribute("aria-invalid", "true");

  const allowed = "https://insforge-storage.s3.us-east-2.amazonaws.com/avatar.png?signature=abc";
  fireEvent.change(input, { target: { value: allowed } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar Cambios" }));
  await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledWith({ full_name: "Ana", avatar_url: allowed }));
  await screen.findByRole("button", { name: "Editar Perfil" });
});

it("permite quitar el avatar", async () => {
  render(<ProfilePage />);
  fireEvent.click(screen.getByRole("button", { name: "Editar Perfil" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar Cambios" }));
  await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledWith({ full_name: "Ana", avatar_url: "" }));
  await screen.findByRole("button", { name: "Editar Perfil" });
});
