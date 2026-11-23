"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LockKeyhole,
  ShieldCheck,
  SlidersHorizontal,
  Mail,
} from "lucide-react";
import { useData, useToast } from "@/app/providers";
import {
  Avatar,
  Badge,
  Button,
  Empty,
  ErrorState,
  Loading,
  Modal,
  Notice,
  PageHeading,
  Pagination,
  Select,
} from "@/components/ui";
import { mutate } from "@/lib/api";
import { label } from "@/lib/format";
import type { Account, Permission, RolePolicy } from "@/types";

const descriptions = {
  canLogin: ["Sign in", "Access to the workspace"],
  canTakeSelfAttendance: ["Self attendance", "Check in and out for yourself"],
  canMarkTeamAttendance: ["Team attendance", "Mark and edit team records"],
  canToggleOT: ["Manage overtime", "Approve OT amounts and remarks"],
  canViewAllAttendance: ["All attendance", "View the company-wide register"],
  canGenerateReports: ["Generate reports", "Create scoped attendance reports"],
  canExportReports: ["Export reports", "Download Excel and PDF"],
  canViewSalaryImpact: [
    "Salary information",
    "View compensation and payroll impact",
  ],
  canManageEmployees: [
    "Manage employees",
    "Create, update, and deactivate profiles",
  ],
} satisfies Partial<Record<Permission, [string, string]>>;

type DisplayedPermission = keyof typeof descriptions;

export default function Rights() {
  const [tab, setTab] = useState("roles"),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<Account | null>(null),
    [busy, setBusy] = useState(false);
  const policies = useData<RolePolicy[]>("/roles"),
    accounts = useData<Account[]>(`/users?page=${page}&limit=10`);
  const client = useQueryClient(),
    toast = useToast();
  async function save(path: string, body: unknown) {
    setBusy(true);
    try {
      await mutate(path, "PATCH", body);
      await client.invalidateQueries();
      toast("Permissions updated. Changes apply immediately.");
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  const query = tab === "roles" ? policies : accounts;
  return (
    <>
      <PageHeading
        title="Access, with intention"
        description="The right permissions for the right people."
      />
      <Notice>
        <ShieldCheck size={15} style={{ display: "inline" }} /> Fixed
        permissions protect your workspace. Employees can only view their own
        attendance and payroll records.
      </Notice>
      <div className="tabs">
        <button
          className={tab === "roles" ? "active" : ""}
          onClick={() => setTab("roles")}
        >
          Role permissions
        </button>
        <button
          className={tab === "users" ? "active" : ""}
          onClick={() => setTab("users")}
        >
          Individual access
        </button>
      </div>
      <section className="panel">
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} retry={() => query.refetch()} />
        ) : tab === "roles" ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Permission</th>
                  {policies.data?.data.map((policy) => (
                    <th key={policy.role} style={{ textAlign: "center" }}>
                      {label(policy.role)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  Object.entries(descriptions) as [
                    DisplayedPermission,
                    [string, string],
                  ][]
                ).map(([key, [name, description]]) => (
                  <tr key={key}>
                    <td>
                      <strong>{name}</strong>
                      <small style={{ display: "block", marginTop: 4 }}>
                        {description}
                      </small>
                    </td>
                    {policies.data?.data.map((policy) => (
                      <td key={policy.role} style={{ textAlign: "center" }}>
                        {policy.configurable.includes(key) ? (
                          <input
                            type="checkbox"
                            className="switch"
                            aria-label={`${name} for ${policy.role}`}
                            checked={policy.permissions[key]}
                            disabled={busy}
                            onChange={(e) => {
                              if (
                                key === "canLogin" &&
                                !e.target.checked &&
                                !window.confirm(
                                  `Disable inherited sign-in access for ${policy.role} accounts?`,
                                )
                              )
                                return;
                              void save(`/roles/${policy.role}/permissions`, {
                                permissions: { [key]: e.target.checked },
                              });
                            }}
                          />
                        ) : (
                          <span
                            title="Fixed by role policy"
                            style={{
                              fontSize: 11,
                              color: policy.permissions[key]
                                ? "#669374"
                                : "#b0b7b1",
                            }}
                          >
                            <LockKeyhole
                              size={12}
                              style={{ display: "inline", marginRight: 5 }}
                            />
                            {policy.permissions[key] ? "Allowed" : "Restricted"}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !accounts.data?.data.length ? (
          <Empty />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table-mobile">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Role</th>
                    <th>Access</th>
                    <th>Invitation</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {accounts.data.data.map((account, index) => (
                    <tr key={account.id}>
                      <td>
                        <div className="person">
                          <Avatar name={account.name} index={index} />
                          <div>
                            <strong>{account.name}</strong>
                            <small>{account.email}</small>
                          </div>
                        </div>
                      </td>
                      <td data-label="Role">{label(account.role)}</td>
                      <td data-label="Access">
                        <Badge
                          status={account.isActive ? "ACTIVE" : "INACTIVE"}
                        />
                      </td>
                      <td data-label="Invitation">
                        {account.activated
                          ? "Activated"
                          : account.invitation?.status || "Pending"}
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          onClick={() => setSelected(account)}
                        >
                          <SlidersHorizontal size={14} />
                          Manage
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              total={accounts.data.meta?.total || 0}
              onChange={setPage}
            />
          </>
        )}
      </section>
      {selected && (
        <Modal
          title={selected.name}
          description={`${selected.email} · ${label(selected.role)}`}
          onClose={() => setSelected(null)}
        >
          <div className="form-body">
            <Notice>
              Use Inherit to follow the role policy. Overrides take effect
              immediately.
            </Notice>
            {(Object.keys(descriptions) as DisplayedPermission[])
              .filter((key) =>
                policies.data?.data
                  .find((p) => p.role === selected.role)
                  ?.configurable.includes(key),
              )
              .map((key) => (
                <div className="toggle-row" key={key}>
                  <div>
                    <h3>{descriptions[key][0]}</h3>
                    <p>{descriptions[key][1]}</p>
                  </div>
                  <Select
                    compact
                    ariaLabel={descriptions[key][0]}
                    style={{ width: 113 }}
                    disabled={busy}
                    value={
                      selected.customPermissions?.[key] === undefined
                        ? "inherit"
                        : String(selected.customPermissions[key])
                    }
                    onChange={async (v) => {
                      const value = v === "inherit" ? null : v === "true";
                      if (
                        key === "canLogin" &&
                        value === false &&
                        !window.confirm(
                          "Revoke login and terminate this account’s sessions?",
                        )
                      )
                        return;
                      setBusy(true);
                      try {
                        await mutate(
                          `/users/${selected.id}/permissions`,
                          "PATCH",
                          { permissions: { [key]: value } },
                        );
                        const next = { ...(selected.customPermissions ?? {}) };
                        if (value === null) delete next[key];
                        else next[key] = value;
                        setSelected({ ...selected, customPermissions: next });
                        await client.invalidateQueries();
                        toast("Account permission updated.");
                      } catch (e) {
                        toast((e as Error).message, true);
                      } finally {
                        setBusy(false);
                      }
                    }}
                    options={[
                      { value: "inherit", label: "Inherit" },
                      { value: "true", label: "Allow" },
                      { value: "false", label: "Deny" },
                    ]}
                  />
                </div>
              ))}
            <div
              className="form-actions"
              style={{
                padding: "20px 0 0",
                marginTop: 12,
                justifyContent: "space-between",
                background: "white",
              }}
            >
              <Button
                variant="danger"
                busy={busy}
                onClick={async () => {
                  if (
                    !window.confirm(
                      `${selected.isActive ? "Deactivate" : "Reactivate"} ${selected.name}? Active sessions will be revoked.`,
                    )
                  )
                    return;
                  await save(`/users/${selected.id}/status`, {
                    isActive: !selected.isActive,
                  });
                  setSelected(null);
                }}
              >
                {selected.isActive
                  ? "Deactivate account"
                  : "Reactivate account"}
              </Button>
              {!selected.activated && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    mutate(
                      `/users/${selected.id}/invitations/resend`,
                      "POST",
                      {},
                    )
                      .then(() => toast("Invitation queued."))
                      .catch((e) => toast(e.message, true))
                  }
                >
                  <Mail size={14} />
                  Resend
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
