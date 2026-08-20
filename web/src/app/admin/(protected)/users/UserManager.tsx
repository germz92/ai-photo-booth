"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { LedgerEntry, PublicUser } from "@/lib/user-types";

type InviteResult = {
  user?: PublicUser;
  inviteUrl?: string | null;
  email?: { sent?: boolean; reason?: string; error?: string };
  error?: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function UserManager({
  initialUsers,
  selfId,
}: {
  initialUsers: PublicUser[];
  selfId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [credits, setCredits] = useState("0");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [openId, setOpenId] = useState("");
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerBusy, setLedgerBusy] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const superCount = useMemo(
    () => users.filter((user) => user.role === "superadmin" && user.status !== "disabled").length,
    [users],
  );

  function replaceUser(next: PublicUser) {
    setUsers((current) => current.map((user) => (user.id === next.id ? next : user)));
  }

  async function refresh() {
    const response = await fetch("/api/admin/users");
    const json = (await response.json()) as { users?: PublicUser[] };
    if (json.users) setUsers(json.users);
  }

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setInviteUrl("");
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        name,
        credits: Number(credits) || 0,
      }),
    });
    const json = (await response.json()) as InviteResult;
    setBusy(false);
    if (!response.ok || !json.user) {
      setError(json.error || "Could not send invite");
      return;
    }
    setEmail("");
    setName("");
    setCredits("0");
    setUsers((current) => [json.user as PublicUser, ...current]);
    if (json.inviteUrl) setInviteUrl(json.inviteUrl);
    setNotice(
      json.email?.sent
        ? `Invite sent to ${json.user.email}.`
        : `Invite created for ${json.user.email}. Copy the link below to share it.`,
    );
  }

  async function patchUser(id: string, body: Record<string, string>) {
    setError("");
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await response.json()) as { user?: PublicUser; error?: string };
    if (!response.ok || !json.user) {
      setError(json.error || "Could not update user");
      return;
    }
    replaceUser(json.user);
  }

  async function changeCredits(id: string, delta: number) {
    if (!delta) return;
    setError("");
    const response = await fetch(`/api/admin/users/${id}/credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta, note: delta > 0 ? "Admin grant" : "Admin deduction" }),
    });
    const json = (await response.json()) as { user?: PublicUser; error?: string };
    if (!response.ok || !json.user) {
      setError(json.error || "Could not update credits");
      return;
    }
    replaceUser(json.user);
    if (openId === id) await loadLedger(id);
  }

  async function resend(id: string) {
    setError("");
    const response = await fetch(`/api/admin/users/${id}/resend-invite`, { method: "POST" });
    const json = (await response.json()) as InviteResult;
    if (!response.ok || !json.user) {
      setError(json.error || "Could not resend invite");
      return;
    }
    replaceUser(json.user);
    if (json.inviteUrl) setInviteUrl(json.inviteUrl);
    setNotice(json.email?.sent ? `Invite resent to ${json.user.email}.` : "Invite link refreshed. Copy it below.");
  }

  async function resetPassword(id: string) {
    setError("");
    const response = await fetch(`/api/admin/users/${id}/reset-password`, { method: "POST" });
    const json = (await response.json()) as {
      user?: PublicUser;
      resetUrl?: string | null;
      email?: { sent?: boolean };
      error?: string;
    };
    if (!response.ok) {
      setError(json.error || "Could not start password reset");
      return;
    }
    if (json.resetUrl) setInviteUrl(json.resetUrl);
    setNotice(
      json.email?.sent
        ? `Password reset emailed to ${json.user?.email}.`
        : "Password reset link created. Copy it below.",
    );
  }

  async function loadLedger(id: string) {
    setLedgerBusy(true);
    const response = await fetch(`/api/admin/users/${id}/ledger`);
    const json = (await response.json()) as { entries?: LedgerEntry[] };
    setLedger(json.entries || []);
    setLedgerBusy(false);
  }

  async function toggleLedger(id: string) {
    if (openId === id) {
      setOpenId("");
      return;
    }
    setOpenId(id);
    await loadLedger(id);
  }

  return (
    <div className="grid gap-10">
      <form className="grid gap-4" onSubmit={(event) => void onInvite(event)}>
        <label className="grid gap-1 text-sm">
          Email
          <input
            className="booth-input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="operator@example.com"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Name
          <input className="booth-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Optional" />
        </label>
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <label className="grid gap-1 text-sm">
            Credits
            <input
              className="booth-input"
              type="number"
              min={0}
              value={credits}
              onChange={(event) => setCredits(event.target.value)}
            />
          </label>
          <button type="submit" className="booth-button" disabled={busy}>
            {busy ? "Inviting…" : "Invite"}
          </button>
        </div>
      </form>
      <p className="text-sm text-muted">
        Invited people start as regular users. You can promote active users to superadmin after they accept.
      </p>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {notice ? <p className="text-sm text-accent">{notice}</p> : null}
      {inviteUrl ? (
        <div className="flex flex-wrap items-center gap-3 border border-[var(--line)] px-4 py-3">
          <code className="min-w-0 flex-1 break-all text-xs text-muted">{inviteUrl}</code>
          <button
            type="button"
            className="booth-button-secondary min-h-10 px-4 text-xs"
            onClick={() => void copyText(inviteUrl).then((ok) => setNotice(ok ? "Link copied." : "Could not copy"))}
          >
            Copy link
          </button>
        </div>
      ) : null}

      <div className="grid gap-3">
        {users.map((user) => {
          const amount = Number(amounts[user.id] || "100") || 0;
          const isSelf = user.id === selfId;
          return (
            <div key={user.id} className="border border-[var(--line)] px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {user.name || user.email}
                    {isSelf ? <span className="ml-2 text-xs text-muted">you</span> : null}
                  </p>
                  <p className="text-xs text-muted">
                    {user.email} · {user.role} · {user.status} · {user.credits} credits
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="booth-input min-h-10 w-24"
                    type="number"
                    min={1}
                    value={amounts[user.id] ?? "100"}
                    onChange={(event) => setAmounts((current) => ({ ...current, [user.id]: event.target.value }))}
                    aria-label="Credit amount"
                  />
                  <button
                    type="button"
                    className="booth-button min-h-10 px-3 text-xs"
                    onClick={() => void changeCredits(user.id, amount)}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    className="booth-button-secondary min-h-10 px-3 text-xs"
                    onClick={() => void changeCredits(user.id, -amount)}
                  >
                    Remove
                  </button>
                  {user.status === "active" && user.role !== "superadmin" ? (
                    <button
                      type="button"
                      className="booth-button-secondary min-h-10 px-3 text-xs"
                      onClick={() => void patchUser(user.id, { role: "superadmin" })}
                    >
                      Make superadmin
                    </button>
                  ) : null}
                  {user.role === "superadmin" && superCount > 1 ? (
                    <button
                      type="button"
                      className="booth-button-secondary min-h-10 px-3 text-xs"
                      onClick={() => void patchUser(user.id, { role: "user" })}
                    >
                      Make user
                    </button>
                  ) : null}
                  {user.status === "invited" ? (
                    <button
                      type="button"
                      className="booth-button-secondary min-h-10 px-3 text-xs"
                      onClick={() => void resend(user.id)}
                    >
                      Resend invite
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="booth-button-secondary min-h-10 px-3 text-xs"
                      onClick={() => void resetPassword(user.id)}
                    >
                      Reset password
                    </button>
                  )}
                  {!isSelf && user.status !== "disabled" ? (
                    <button
                      type="button"
                      className="booth-button-secondary min-h-10 px-3 text-xs"
                      onClick={() => void patchUser(user.id, { status: "disabled" })}
                    >
                      Disable
                    </button>
                  ) : null}
                  {user.status === "disabled" ? (
                    <button
                      type="button"
                      className="booth-button min-h-10 px-3 text-xs"
                      onClick={() => void patchUser(user.id, { status: "active" })}
                    >
                      Enable
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="booth-button-secondary min-h-10 px-3 text-xs"
                    onClick={() => void toggleLedger(user.id)}
                  >
                    {openId === user.id ? "Hide ledger" : "Ledger"}
                  </button>
                </div>
              </div>
              {openId === user.id ? (
                <div className="mt-4 grid gap-2 text-sm">
                  {ledgerBusy ? <p className="text-muted">Loading ledger…</p> : null}
                  {!ledgerBusy && ledger.length === 0 ? <p className="text-muted">No credit activity yet.</p> : null}
                  {ledger.map((entry) => (
                    <div key={entry.id || `${entry.createdAt}-${entry.delta}`} className="flex justify-between gap-4 text-xs text-muted">
                      <span>
                        {formatDate(entry.createdAt)} · {entry.reason}
                        {entry.note ? ` · ${entry.note}` : ""}
                      </span>
                      <span>
                        {entry.delta > 0 ? "+" : ""}
                        {entry.delta} → {entry.balanceAfter}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <button type="button" className="justify-self-start text-xs underline text-muted" onClick={() => void refresh()}>
        Refresh
      </button>
    </div>
  );
}
