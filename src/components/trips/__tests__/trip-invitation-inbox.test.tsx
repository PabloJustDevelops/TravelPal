import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TripInvitationInbox from "../TripInvitationInbox";
import { callTripInvitations, listMyTripInvitations } from "@/lib/trip-invitations";

jest.mock("@/lib/trip-invitations", () => ({ callTripInvitations: jest.fn(), listMyTripInvitations: jest.fn() }));
jest.mock("next/link", () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/lib/logger", () => ({ logger: { error: jest.fn() } }));

const inboxMock = listMyTripInvitations as jest.Mock;
const callMock = callTripInvitations as jest.Mock;

describe("TripInvitationInbox", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    inboxMock.mockResolvedValue({ invitations: [{
      id: "invite-1", trip_id: "trip-1", trip_title: "Viaje compartido", role: "editor",
      invited_by_email: "ana@example.com", created_at: "2026-01-01",
    }] });
  });

  it("accepts a pending invitation and removes it from the inbox", async () => {
    const onAccepted = jest.fn();
    render(<TripInvitationInbox onAccepted={onAccepted} />);
    expect(await screen.findByText("Viaje compartido")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aceptar" }));
    await waitFor(() => expect(callMock).toHaveBeenCalledWith({ action: "respond", invitationId: "invite-1", response: "accept" }));
    expect(onAccepted).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("No tienes invitaciones pendientes.")).toBeInTheDocument();
  });
});
