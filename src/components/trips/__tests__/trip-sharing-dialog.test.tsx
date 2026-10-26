import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TripSharingDialog from "../TripSharingDialog";
import { callTripInvitations, listTripCollaboration } from "@/lib/trip-invitations";

jest.mock("@/lib/trip-invitations", () => ({ callTripInvitations: jest.fn(), listTripCollaboration: jest.fn() }));
jest.mock("@/components/ui/Modal", () => ({
  __esModule: true,
  default: ({ isOpen, title, children }: { isOpen: boolean; title: string; children: React.ReactNode }) => isOpen ? <section role="dialog" aria-modal="true" aria-label={title}>{children}</section> : null,
}));
jest.mock("@/lib/logger", () => ({ logger: { error: jest.fn() } }));

const listMock = listTripCollaboration as jest.Mock;
const callMock = callTripInvitations as jest.Mock;

describe("TripSharingDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listMock.mockResolvedValue({ members: [{ user_id: "member-1", email: "maria@example.com", role: "reader", created_at: "2026-01-01" }], invitations: [] });
    callMock.mockResolvedValue({ status: "invited" });
  });

  it("shows existing roles and sends an invitation without exposing account lookup results", async () => {
    render(<TripSharingDialog tripId="trip-1" isOpen onClose={jest.fn()} />);
    expect(await screen.findByText("maria@example.com")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Rol" })).toHaveValue("editor");
    fireEvent.change(screen.getByLabelText("Invitar por correo electrónico"), { target: { value: "new@example.com" } });
    fireEvent.submit(screen.getByLabelText("Invitar por correo electrónico").closest("form")!);
    await waitFor(() => expect(callMock).toHaveBeenCalledWith({ action: "invite", tripId: "trip-1", email: "new@example.com", role: "editor" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Si existe una cuenta para ese correo, recibirá la invitación.");
  });
});
