import { createInsforgeClient, type TripInvitation, type TripMember, type TripMemberRole } from "@/lib/insforge";

type InvitationAction =
  | { action: "invite"; tripId: string; email: string; role: TripMemberRole }
  | { action: "cancel"; tripId: string; invitationId: string }
  | { action: "list"; tripId: string }
  | { action: "inbox" }
  | { action: "respond"; invitationId: string; response: "accept" | "reject" };

interface ListResult { members: TripMember[]; invitations: TripInvitation[]; }
interface InboxResult { invitations: TripInvitation[]; }

export async function callTripInvitations<T = unknown>(body: InvitationAction): Promise<T> {
  const { data, error } = await createInsforgeClient().functions.invoke("trip-invitations", { body });
  if (error) throw error;
  return data as T;
}

export function listTripCollaboration(tripId: string) {
  return callTripInvitations<ListResult>({ action: "list", tripId });
}

export function listMyTripInvitations() {
  return callTripInvitations<InboxResult>({ action: "inbox" });
}
