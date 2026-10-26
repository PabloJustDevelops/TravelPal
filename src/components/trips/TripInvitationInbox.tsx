"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { listMyTripInvitations, callTripInvitations } from "@/lib/trip-invitations";
import type { TripInvitation } from "@/lib/insforge";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { localePath } from "@/lib/i18n";
import { logger } from "@/lib/logger";

export default function TripInvitationInbox({ onAccepted }: { onAccepted?: () => void }) {
  const { locale, t } = useI18n();
  const [invitations, setInvitations] = useState<TripInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true); setError(false);
    try { setInvitations((await listMyTripInvitations()).invitations); }
    catch (reason) { logger.error("TripInvitationInbox: load failed", reason); setError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function respond(invitation: TripInvitation, response: "accept" | "reject") {
    setBusyId(invitation.id); setError(false);
    try {
      await callTripInvitations({ action: "respond", invitationId: invitation.id, response });
      setInvitations((current) => current.filter((item) => item.id !== invitation.id));
      if (response === "accept") onAccepted?.();
    } catch (reason) { logger.error("TripInvitationInbox: response failed", reason); setError(true); }
    finally { setBusyId(null); }
  }

  if (loading) return <p role="status" className="text-sm text-muted">{t("loadingContent")}</p>;
  return <section aria-labelledby="trip-invitations-heading" className="rounded-xl border border-line bg-paper p-5">
    <h2 id="trip-invitations-heading" className="text-lg font-semibold text-ink">{t("tripInvitationInbox")}</h2>
    {error && <p role="alert" className="mt-3 text-sm text-danger">{t("invitationResponseError")}</p>}
    {invitations.length ? <ul className="mt-3 divide-y divide-line">{invitations.map((invitation) => <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
      <div>
        <Link href={`${localePath(locale, "/trip")}?id=${encodeURIComponent(invitation.trip_id ?? "")}`} className="inline-flex min-h-11 items-center font-medium text-ink hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{invitation.trip_title}</Link>
        <p className="mt-1 text-sm text-muted">{t("invitationFrom").replace("{email}", invitation.invited_by_email ?? "")} · {t(invitation.role === "editor" ? "tripRoleEditor" : "tripRoleReader")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busyId === invitation.id} className="min-h-11" onClick={() => void respond(invitation, "accept")}>{t("acceptInvitation")}</Button>
        <Button type="button" variant="outline" disabled={busyId === invitation.id} className="min-h-11" onClick={() => void respond(invitation, "reject")}>{t("rejectInvitation")}</Button>
      </div>
    </li>)}</ul> : <p className="mt-3 text-sm text-muted">{t("noTripInvitations")}</p>}
  </section>;
}
