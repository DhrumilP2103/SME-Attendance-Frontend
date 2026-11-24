"use client";
import { showSalaryInformation } from "@/lib/features";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Save, Send, Mail, Clock3, ShieldCheck, LogOut } from "lucide-react";
import { useData, useToast } from "@/app/providers";
import {
  Avatar,
  Badge,
  Button,
  Empty,
  ErrorState,
  Field,
  Loading,
  Notice,
  PageHeading,
  Select,
} from "@/components/ui";
import { api, mutate, clearSessionToken } from "@/lib/api";
import { label } from "@/lib/format";
import type { AuthUser, EodConfig, EodRun } from "@/types";

export default function Settings({
  user,
  section,
}: {
  user: AuthUser;
  section: string;
}) {
  if (section === "profile") return <Profile user={user} />;
  if (section === "company") return <CompanySettings user={user} />;
  return <EodSettings />;
}
function CompanySettings({ user }: { user: AuthUser }) {
  const [busy, setBusy] = useState(false),
    toast = useToast(),
    client = useQueryClient();
  return (
    <>
      <PageHeading
        title="Your workspace"
        description="The details that make this place yours."
      />
      <div className="settings-grid">
        <section className="panel settings-card">
          <h2>Company details</h2>
          <p>Your company name appears across reports and emails.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const form = new FormData(e.currentTarget);
              try {
                await mutate("/settings/company", "PATCH", {
                  name: form.get("name"),
                  currency: form.get("currency"),
                });
                await client.invalidateQueries();
                toast("Workspace settings saved.");
              } catch (error) {
                toast((error as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Company name">
              <input
                name="name"
                defaultValue={user.company.name}
                required
                maxLength={120}
              />
            </Field>
            <Field
              label="Currency"
              hint={showSalaryInformation
                ? "Currency is locked after employee compensation records exist."
                : "Currency is used for overtime amounts."}
            >
              <Select
                name="currency"
                ariaLabel="Currency"
                defaultValue={user.company.currency}
                options={[
                  { value: "INR", label: "INR", hint: "Indian Rupee" },
                  { value: "USD", label: "USD", hint: "US Dollar" },
                  { value: "EUR", label: "EUR", hint: "Euro" },
                  { value: "GBP", label: "GBP", hint: "British Pound" },
                  { value: "AED", label: "AED", hint: "UAE Dirham" },
                  { value: "JPY", label: "JPY", hint: "Japanese Yen" },
                ]}
              />
            </Field>
            <Button busy={busy}>
              <Save size={15} />
              Save changes
            </Button>
          </form>
        </section>
        <section className="panel settings-card">
          <span className="stat-icon">
            <ShieldCheck size={20} />
          </span>
          <h2 style={{ marginTop: 15 }}>A secure foundation</h2>
          <p>
            Access is controlled by role permissions and account-level
            overrides. Attendance{showSalaryInformation ? " and compensation" : ""} changes are recorded for
            accountability.
          </p>
          <Notice>
            Your business timezone is managed under EOD Automation. Historical
            attendance dates are never silently shifted.
          </Notice>
        </section>
      </div>
    </>
  );
}
function EodSettings() {
  const query = useData<EodConfig>("/settings/eod");
  if (query.isPending) return <Loading />;
  if (query.error)
    return <ErrorState error={query.error} retry={() => query.refetch()} />;
  return <EodForm config={query.data.data} />;
}
const fallbackTimezones = [
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];
function timezoneGroups(current: string) {
  const supported =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : fallbackTimezones;
  const zones = [...new Set([...supported, current])].sort();
  const groups = new Map<string, { value: string; label: string }[]>();
  for (const zone of zones) {
    let offset = "";
    try {
      offset =
        new Intl.DateTimeFormat("en", {
          timeZone: zone,
          timeZoneName: "shortOffset",
        })
          .formatToParts()
          .find((part) => part.type === "timeZoneName")?.value ?? "";
    } catch {
      offset = "";
    }
    const region = zone.includes("/") ? zone.split("/")[0] : "Universal";
    const list = groups.get(region) ?? [];
    list.push({
      value: zone,
      label: offset ? `${zone.replace(/_/g, " ")} (${offset})` : zone,
    });
    groups.set(region, list);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}
function EodForm({ config }: { config: EodConfig }) {
  const [enabled, setEnabled] = useState(config.isEnabled),
    [activityLogEnabled, setActivityLogEnabled] = useState(
      config.activityLogEmail.enabled,
    ),
    [busy, setBusy] = useState(false),
    [sending, setSending] = useState(false),
    toast = useToast(),
    client = useQueryClient();
  const runs = useQuery({
    queryKey: ["eod-runs"],
    queryFn: () => api<EodRun[]>("/eod/runs?limit=10"),
    refetchInterval: 5000,
    retry: false,
  });
  const zones = useMemo(() => timezoneGroups(config.timezone), [config.timezone]);
  return (
    <>
      <PageHeading
        title="A thoughtful end to the day"
        description="Let your daily attendance summary take care of itself."
      >
        <Button
          variant="secondary"
          busy={sending}
          onClick={async () => {
            setSending(true);
            try {
              await mutate("/eod/send", "POST", {}, crypto.randomUUID());
              await runs.refetch();
              toast("EOD report queued. Delivery status will appear below.");
            } catch (e) {
              toast((e as Error).message, true);
            } finally {
              setSending(false);
            }
          }}
        >
          <Send size={14} />
          Send report now
        </Button>
      </PageHeading>
      {config.emailDelivery === "LOCAL_OUTBOX" && (
        <Notice>
          Local email mode: messages are saved as .eml files in
          backend/.local/mail. No external email is sent until SMTP is
          configured. The separate worker must be running.
        </Notice>
      )}
      <div className="settings-grid">
        <section className="panel settings-card">
          <h2>Daily report schedule</h2>
          <p>A consistent update for the people who need it.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const form = new FormData(e.currentTarget);
              try {
                await mutate("/settings/eod", "PATCH", {
                  isEnabled: enabled,
                  scheduledTime: form.get("time"),
                  timezone: form.get("timezone"),
                  adminRecipients: String(form.get("recipients"))
                    .split(/[\n,;]/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                  sections: {
                    attendance: form.has("attendance"),
                    salary: showSalaryInformation ? form.has("salary") : config.sections.salary,
                  },
                  activityLogEmail: {
                    enabled: activityLogEnabled,
                    intervalMonths: Number(
                      form.get("activityLogIntervalMonths"),
                    ),
                  },
                });
                await client.invalidateQueries();
                toast("EOD schedule saved.");
              } catch (error) {
                toast((error as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="toggle-row" style={{ paddingTop: 0 }}>
              <div>
                <h3>Automated reports</h3>
                <p>Send a summary at your chosen time.</p>
              </div>
              <input
                type="checkbox"
                className="switch"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                aria-label="Enable automated EOD reports"
              />
            </label>
            <div className="form-grid">
              <Field label="Send at">
                <input
                  name="time"
                  type="time"
                  defaultValue={config.scheduledTime}
                  required
                />
              </Field>
              <Field
                label="Business timezone"
                hint="Attendance days and report schedules follow this timezone."
              >
                <Select
                  name="timezone"
                  ariaLabel="Business timezone"
                  defaultValue={config.timezone}
                  searchPlaceholder="Search timezones…"
                  options={zones.map(([region, list]) => ({
                    group: region,
                    options: list.map((zone) => ({
                      value: zone.value,
                      label: zone.label,
                    })),
                  }))}
                />
              </Field>
            </div>
            <Field
              label="Recipients"
              hint="Separate email addresses with commas or new lines."
            >
              <textarea
                name="recipients"
                defaultValue={config.adminRecipients.join("\n")}
                placeholder="admin@company.com"
                required
              />
            </Field>
            <label className="toggle-row" style={{ marginTop: 16 }}>
              <div>
                <h3>Email activity log</h3>
                <p>
                  Send all logged creations to the recipients above, then clear
                  the log after successful delivery.
                </p>
              </div>
              <input
                type="checkbox"
                className="switch"
                checked={activityLogEnabled}
                onChange={(e) => setActivityLogEnabled(e.target.checked)}
                aria-label="Enable activity log emails"
              />
            </label>
            <Field
              label="Send every (months)"
              hint="Default: every 2 months. Choose any interval from 1 to 12 months."
            >
              <input
                name="activityLogIntervalMonths"
                type="number"
                min={1}
                max={12}
                defaultValue={config.activityLogEmail.intervalMonths}
                required
              />
            </Field>
            <h3 style={{ fontSize: 12, marginBottom: 12 }}>
              Include in each report
            </h3>
            <div className="stack" style={{ gap: 10 }}>
              {[
                [
                  "attendance",
                  "Attendance Report",
                  "Daily status, hours and overtime for every employee.",
                ],
                [
                  "salary",
                  "Salary Report",
                  "Month-to-date salary estimate for active employees.",
                ],
              ].filter(([key]) => showSalaryInformation || key !== "salary").map(([key, name, hint]) => (
                <label className="check-label" key={key}>
                  <input
                    name={key}
                    type="checkbox"
                    defaultChecked={
                      config.sections[key as keyof EodConfig["sections"]]
                    }
                  />
                  <span>
                    {name}
                    <small className="block text-[10px] text-[#8c958e]">
                      {hint}
                    </small>
                  </span>
                </label>
              ))}
            </div>
            <Button busy={busy}>
              <Save size={15} />
              Save automation
            </Button>
          </form>
        </section>
        <div className="stack">
          <section className="panel settings-card">
            <span className="stat-icon">
              <Mail size={19} />
            </span>
            <h2 style={{ marginTop: 16 }}>A little peace of mind</h2>
            <p>
              Each selected report arrives with its own CSV attachment.
              Recipients see the same data and totals as your workspace.
            </p>
            <div className="row" style={{ fontSize: 11, color: "#809086" }}>
              <Clock3 size={15} />
              Your timezone. Your schedule.
            </div>
          </section>
          <section className="panel">
            <div className="panel-header">
              <h2>Recent deliveries</h2>
              <Badge status={enabled ? "ACTIVE" : "INACTIVE"} />
            </div>
            {runs.isPending ? (
              <Loading />
            ) : runs.error ? (
              <ErrorState error={runs.error} retry={() => runs.refetch()} />
            ) : !runs.data?.data.length ? (
              <Empty
                title="A clean slate"
                description="Your report delivery history will appear here."
              />
            ) : (
              <div className="panel-body">
                {runs.data.data.map((run) => (
                  <div className="audit-item" key={run._id}>
                    <div className="row space-between">
                      <strong>{run.workDate}</strong>
                      <Badge status={run.status} />
                    </div>
                    <p>
                      {label(run.trigger)} ·{" "}
                      {new Date(run.createdAt).toLocaleTimeString()}
                    </p>
                    {run.result && <p>{run.result}</p>}
                    {run.error && (
                      <p style={{ color: "#b37962" }}>{run.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
function Profile({ user }: { user: AuthUser }) {
  const [busy, setBusy] = useState(false),
    toast = useToast(),
    client = useQueryClient(),
    router = useRouter();
  async function logout() {
    try {
      await mutate("/auth/logout", "POST", {});
      clearSessionToken();
      client.clear();
      router.replace("/login");
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  return (
    <>
      <PageHeading
        title="A space for you"
        description="Your account details and security, all in one place."
      >
        <Button variant="secondary" onClick={logout}>
          <LogOut size={15} />
          Sign out
        </Button>
      </PageHeading>
      <div className="settings-grid">
        <section className="panel">
          <div className="profile-header">
            <Avatar name={user.name} size="lg" />
            <div>
              <h2>{user.name}</h2>
              <p>
                {label(user.role)} · {user.company.name}
              </p>
            </div>
          </div>
          <div className="panel-body stack">
            <Field label="Email address">
              <input value={user.email} readOnly />
            </Field>
            <Field label="Role">
              <input value={label(user.role)} readOnly />
            </Field>
            <small>Contact your administrator to change account details.</small>
          </div>
        </section>
        <section className="panel settings-card">
          <h2>Keep your account secure</h2>
          <p>Changing your password signs you out on all devices.</p>
          {user.demo ? (
            <Notice>
              Demo accounts use local, passwordless access. Create an invited
              account to test password setup and changes.
            </Notice>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                const form = new FormData(e.currentTarget);
                try {
                  if (form.get("password") !== form.get("confirm"))
                    throw new Error("Passwords do not match.");
                  await mutate("/auth/password", "PATCH", {
                    currentPassword: form.get("current"),
                    password: form.get("password"),
                  });
                  clearSessionToken();
                  client.clear();
                  toast("Password changed. Please sign in again.");
                  router.replace("/login");
                } catch (error) {
                  toast((error as Error).message, true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Current password">
                <input
                  name="current"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <Field label="New password" hint="Use at least 12 characters.">
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </Field>
              <Field label="Confirm password">
                <input
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                />
              </Field>
              <Button busy={busy}>
                <ShieldCheck size={15} />
                Update password
              </Button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
