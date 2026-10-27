"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { selectClassName } from "@/components/ui/fieldStyles";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { createInsforgeClient, type TripInvitation, type TripMember, type TripMemberRole } from "@/lib/insforge";
import { callTripInvitations, listTripCollaboration } from "@/lib/trip-invitations";
import { logger } from "@/lib/logger";

export default function TripSharingDialog({ tripId, isOpen, onClose }: { tripId: string; isOpen: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TripMemberRole>("editor");
  const [members, setMembers] = useState<TripMember[]>([]);
  const [invitations, setInvitations] = useState<TripInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listTripCollaboration(tripId);
      setMembers(result.members);
      setInvitations(result.invitations);
    } catch (error) {
      logger.error("TripSharingDialog: load failed", error);
      setMessage(t("sharingLoadError"));
    } finally { setLoading(false); }
  }, [tripId, t]);

  useEffect(() => { if (isOpen) { setMessage(""); void reload(); } }, [isOpen, reload]);

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await callTripInvitations({ action: "invite", tripId, email, role });
      setEmail("");
      setMessage(t("invitationSent"));
      await reload();
    } catch (error) {
      logger.error("TripSharingDialog: invite failed", error);
      setMessage(t("sharingActionError"));
    } finally { setBusy(false); }
  }

  async function changeRole(member: TripMember, nextRole: TripMemberRole) {
    setBusy(true); setMessage("");
    try {
      const { data, error } = await createInsforgeClient().database.from("trip_members")
        .update({ role: nextRole }).eq("trip_id", tripId).eq("user_id", member.user_id).select("user_id");
      if (error || !data?.length) throw error ?? new Error("No membership updated");
      await reload();
    } catch (error) {
      logger.error("TripSharingDialog: role update failed", error);
      setMessage(t("sharingActionError"));
    } finally { setBusy(false); }
  }

  async function removeMember(member: TripMember) {
    setBusy(true); setMessage("");
    try {
      const { data, error } = await createInsforgeClient().database.from("trip_members")
        .delete().eq("trip_id", tripId).eq("user_id", member.user_id).select("user_id");
      if (error || !data?.length) throw error ?? new Error("No membership removed");
      await reload();
    } catch (error) {
      logger.error("TripSharingDialog: member removal failed", error);
      setMessage(t("sharingActionError"));
    } finally { setBusy(false); }
  }

  async function cancelInvitation(invitation: TripInvitation) {
    setBusy(true); setMessage("");
    try {
      await callTripInvitations({ action: "cancel", tripId, invitationId: invitation.id });
      await reload();
    } catch (error) {
      logger.error("TripSharingDialog: invitation cancellation failed", error);
      setMessage(t("sharingActionError"));
    } finally { setBusy(false); }
  }

  return <Modal isOpen={isOpen} onClose={onClose} title={t("shareTrip")} size="lg">
    <div className="space-y-6">
      <form onSubmit={submitInvite} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
        <label className="block text-sm font-medium text-ink">{t("inviteByEmail")}
          <input type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-line bg-paper px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
        </label>
        <label className="block text-sm font-medium text-ink">{t("memberRole")}
          <select value={role} onChange={(event) => setRole(event.target.value as TripMemberRole)} className={`${selectClassName} mt-1 min-h-11`}>
            <option value="editor">{t("tripRoleEditor")}</option><option value="reader">{t("tripRoleReader")}</option>
          </select>
        </label>
        <Button type="submit" disabled={busy} className="min-h-11">{t("sendInvitation")}</Button>
      </form>
      {message && <p role="status" className="text-sm text-muted">{message}</p>}
      <section aria-labelledby="trip-members-heading">
        <h4 id="trip-members-heading" className="font-semibold text-ink">{t("tripMembers")}</h4>
        {loading ? <p role="status" className="py-3 text-sm text-muted">{t("loadingContent")}</p> : members.length ? <ul className="mt-2 divide-y divide-line">{members.map((member) => <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <span className="min-w-0 break-all text-sm text-ink">{member.email}</span>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor={`role-${member.user_id}`}>{t("changeMemberRole").replace("{email}", member.email)}</label>
            <select id={`role-${member.user_id}`} disabled={busy} value={member.role} onChange={(event) => void changeRole(member, event.target.value as TripMemberRole)} className={`${selectClassName} min-h-11`}>
              <option value="editor">{t("tripRoleEditor")}</option><option value="reader">{t("tripRoleReader")}</option>
            </select>
            <Button type="button" variant="outline" disabled={busy} className="min-h-11 whitespace-nowrap" onClick={() => void removeMember(member)}>{t("removeAccess")}</Button>
          </div>
        </li>)}</ul> : <p className="mt-2 text-sm text-muted">{t("noTripMembers")}</p>}
      </section>
      <section aria-labelledby="pending-invitations-heading">
        <h4 id="pending-invitations-heading" className="font-semibold text-ink">{t("pendingInvitations")}</h4>
        {invitations.length ? <ul className="mt-2 divide-y divide-line">{invitations.map((invitation) => <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <span className="text-sm text-ink">{invitation.email} · {t(invitation.role === "editor" ? "tripRoleEditor" : "tripRoleReader")}</span>
          <Button type="button" variant="outline" disabled={busy} className="min-h-11" onClick={() => void cancelInvitation(invitation)}>{t("cancelInvitation")}</Button>
        </li>)}</ul> : <p className="mt-2 text-sm text-muted">{t("noPendingInvitations")}</p>}
      </section>
    </div>
  </Modal>;
}
