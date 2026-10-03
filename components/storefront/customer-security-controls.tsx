"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

type Session = {
  id: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  current: boolean;
};

function formatDate(value: string | null) {
  if (!value) return "No activity recorded";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function CustomerSecurityControls() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  async function loadSessions() {
    setLoadingSessions(true);
    setSessionError(null);
    try {
      const response = await fetch("/api/customer/security/sessions", { credentials: "same-origin", cache: "no-store" });
      const body = await response.json().catch(() => null) as { sessions?: Session[]; error?: { message?: string } } | null;
      if (!response.ok || !body?.sessions) throw new Error(body?.error?.message ?? "Sessions could not be loaded.");
      setSessions(body.sessions);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Sessions could not be loaded.");
    } finally {
      setLoadingSessions(false);
    }
  }

  useEffect(() => { void loadSessions(); }, []);

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (changingPassword) return;
    setChangingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(null);
    try {
      const response = await fetch("/api/customer/security/password", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await response.json().catch(() => null) as { password?: { sessionsRevoked?: number }; error?: { message?: string } } | null;
      if (!response.ok) throw new Error(body?.error?.message ?? "Password could not be changed.");
      setCurrentPassword("");
      setNewPassword("");
      setPasswordSuccess(`Password changed. ${body?.password?.sessionsRevoked ?? 0} other session(s) were signed out.`);
      await loadSessions();
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Password could not be changed.");
    } finally {
      setChangingPassword(false);
    }
  }

  async function revokeSession(sessionId: string) {
    setBusySessionId(sessionId);
    setSessionError(null);
    try {
      const response = await fetch(`/api/customer/security/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const body = await response.json().catch(() => null) as { session?: { current?: boolean }; error?: { message?: string } } | null;
      if (!response.ok) throw new Error(body?.error?.message ?? "The session could not be revoked.");
      if (body?.session?.current) {
        window.location.assign("/login");
        return;
      }
      await loadSessions();
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "The session could not be revoked.");
    } finally {
      setBusySessionId(null);
    }
  }

  async function logoutAll() {
    if (!window.confirm("Sign out this account from every active device?")) return;
    setLoggingOutAll(true);
    setSessionError(null);
    try {
      const response = await fetch("/api/customer/security/sessions", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      if (!response.ok) throw new Error(body?.error?.message ?? "Sessions could not be revoked.");
      window.location.assign("/login?logout-all=1");
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Sessions could not be revoked.");
      setLoggingOutAll(false);
    }
  }

  return (
    <section className="mt-12 grid gap-6 border-t border-black/10 pt-8" aria-labelledby="security-heading">
      <div>
        <p className="text-xs font-900 uppercase tracking-[0.25em] text-primary-blue">Security</p>
        <h2 id="security-heading" className="mt-2 text-xl uppercase">Account security</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6">Password changes require your current password. Other active sessions are signed out after a successful password change.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
        <CardContent>
          {passwordError ? <Alert variant="error" title="Password change failed" className="mb-5">{passwordError}</Alert> : null}
          {passwordSuccess ? <Alert variant="success" title="Password changed" className="mb-5">{passwordSuccess}</Alert> : null}
          <form onSubmit={changePassword} className="grid gap-5" aria-busy={changingPassword}>
            <FormField label="Current password" htmlFor="current-password" required>
              <Input id="current-password" name="currentPassword" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
            </FormField>
            <FormField label="New password" htmlFor="new-password" description="Use at least 12 characters." required>
              <Input id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={1024} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
            </FormField>
            <Button type="submit" loading={changingPassword}>Change password</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Active sessions</CardTitle>
            <Button type="button" variant="outline" loading={loggingOutAll} onClick={logoutAll}>Log out all devices</Button>
          </div>
        </CardHeader>
        <CardContent>
          {sessionError ? <Alert variant="error" title="Session management failed" className="mb-5">{sessionError}</Alert> : null}
          {loadingSessions ? <p className="text-sm text-muted-foreground">Loading active sessions…</p> : null}
          {!loadingSessions && sessions.length === 0 ? <p className="text-sm text-muted-foreground">No active sessions were found.</p> : null}
          {!loadingSessions && sessions.length > 0 ? (
            <ul className="grid gap-3" aria-label="Active sessions">
              {sessions.map((session) => (
                <li key={session.id} className="border-2 border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="grid gap-1 text-sm">
                      <strong>{session.current ? "Current session" : "Active session"}</strong>
                      <span>Started {formatDate(session.createdAt)}</span>
                      <span>Last activity {formatDate(session.lastUsedAt)}</span>
                      <span>Expires {formatDate(session.expiresAt)}</span>
                    </div>
                    <Button type="button" variant="outline" loading={busySessionId === session.id} onClick={() => revokeSession(session.id)}>
                      {session.current ? "Sign out" : "Revoke"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
