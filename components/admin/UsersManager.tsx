"use client";
import { useState, useTransition } from "react";
import type { Role, UserStatus } from "@prisma/client";
import { inviteUserAction, changeRoleAction, setUserStatusAction, unlockUserAction } from "@/server/actions/misc";
import { Field } from "@/components/ui/Field";
import { StatusPill } from "@/components/ui/StatusPill";

interface U {
  id: string;
  name: string;
  email: string;
  role: Role;
  roleLabel: string;
  status: UserStatus;
  locked: boolean;
  twoFactor: boolean;
  lastLogin: string;
  partnerName?: string | null;
}

const ROLES: { value: Role; label: string }[] = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "ADMINISTRATOR", label: "Administrator" },
  { value: "EDITOR", label: "Editor" },
  { value: "ADVISOR", label: "Advisor" },
  { value: "VIEWER", label: "Viewer" },
];
const PARTNER_ROLE = { value: "PARTNER" as Role, label: "Partner developer (read-only portal)" };

export function UsersManager({ users, meId, meRole, partners = [] }: { users: U[]; meId: string; meRole: Role; partners?: { id: string; name: string }[] }) {
  const [v, setV] = useState({ name: "", email: "", role: "EDITOR" as Role, partnerId: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [link, setLink] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const roles = ROLES.filter((r) => meRole === "SUPER_ADMIN" || r.value !== "SUPER_ADMIN");
  const guard = (fn: () => Promise<unknown>) =>
    start(async () => {
      setFailure(null);
      try {
        await fn();
      } catch (e) {
        setFailure(e instanceof Error && /own account|invite a new user/.test(e.message) ? e.message : "That change isn't allowed for your role.");
      }
    });

  return (
    <>
      <form
        className="card"
        style={{ marginBottom: "1.2rem" }}
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await inviteUserAction(v.role === "PARTNER" ? v : { ...v, partnerId: undefined });
            if (r.ok) {
              setLink(`${location.origin}${r.link}`);
              setErrors({});
              setV({ name: "", email: "", role: "EDITOR", partnerId: "" });
            } else setErrors(r.errors);
          });
        }}
      >
        <h2>Invite someone</h2>
        <div className="two-up">
          <Field label="Name" error={errors.name}>
            {(p) => <input {...p} className="inp" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}
          </Field>
          <Field label="Email" error={errors.email}>
            {(p) => <input {...p} className="inp" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />}
          </Field>
        </div>
        <Field label="Role">
          {(p) => (
            <select {...p} className="inp" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as Role })}>
              {[...roles, PARTNER_ROLE].map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        {v.role === "PARTNER" && (
          <Field label="Partner developer" error={errors.partnerId} help="They will only see figures for estates linked to this partner. Add partners under Team & partners.">
            {(p) => (
              <select {...p} className="inp" value={v.partnerId} onChange={(e) => setV({ ...v, partnerId: e.target.value })}>
                <option value="">Choose a partner…</option>
                {partners.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        <button className="btn btn-gold btn-sm" type="submit" disabled={pending}>
          Send invitation
        </button>
        {link && (
          <p className="form-ok" style={{ marginTop: "1rem", overflowWrap: "anywhere" }}>
            Invitation created. It&apos;s been emailed; you can also share this link directly (valid 72 hours): <br />
            <code>{link}</code>
          </p>
        )}
      </form>
      {failure && (
        <p className="form-alert" role="alert">
          {failure}
        </p>
      )}
      <div className="tblwrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Status</th>
              <th className="hide-sm">2FA</th>
              <th className="hide-sm">Last sign-in</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const protectedRow = u.id === meId || (u.role === "SUPER_ADMIN" && meRole !== "SUPER_ADMIN");
              return (
                <tr key={u.id}>
                  <td>
                    <b>{u.name}</b>
                    <div style={{ fontSize: ".78rem" }}>{u.email}</div>
                  </td>
                  <td>
                    {protectedRow || u.role === "PARTNER" ? (
                      <>
                        {u.roleLabel}
                        {u.partnerName && <div style={{ fontSize: ".75rem" }}>{u.partnerName}</div>}
                      </>
                    ) : (
                      <>
                        <label className="sr-only" htmlFor={`role-${u.id}`}>
                          Role for {u.name}
                        </label>
                        <select id={`role-${u.id}`} className="inp" style={{ padding: ".4rem 2rem .4rem .6rem", fontSize: ".8rem" }} defaultValue={u.role} disabled={pending} onChange={(e) => guard(() => changeRoleAction(u.id, e.target.value as Role))}>
                          {roles.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </td>
                  <td>
                    <StatusPill status={u.status} />
                    {u.locked && <span className="pill draft">Locked</span>}
                  </td>
                  <td className="hide-sm">{u.twoFactor ? "On" : "Off"}</td>
                  <td className="hide-sm">{u.lastLogin}</td>
                  <td>
                    {!protectedRow && (
                      <div className="rowacts">
                        {u.locked && (
                          <button className="btn btn-line btn-sm" disabled={pending} onClick={() => guard(() => unlockUserAction(u.id))}>
                            Unlock
                          </button>
                        )}
                        {u.status === "ACTIVE" ? (
                          <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => guard(() => setUserStatusAction(u.id, "SUSPENDED"))}>
                            Suspend
                          </button>
                        ) : (
                          u.status === "SUSPENDED" && (
                            <button className="btn btn-line btn-sm" disabled={pending} onClick={() => guard(() => setUserStatusAction(u.id, "ACTIVE"))}>
                              Reactivate
                            </button>
                          )
                        )}
                        {u.status !== "REMOVED" && (
                          <button
                            className="btn btn-danger btn-sm"
                            disabled={pending}
                            onClick={() => {
                              if (confirm(`Remove ${u.name}? They'll be signed out immediately.`)) guard(() => setUserStatusAction(u.id, "REMOVED"));
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
