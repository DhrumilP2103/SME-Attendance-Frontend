"use client";
import { useEffect, useState, type FormEvent } from "react";
import { DateTime } from "luxon";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Download,
  Pencil,
  Clock3,
  History,
  LogIn,
  LogOut,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { useData, useToast } from "@/app/providers";
import {
  Avatar,
  Badge,
  Button,
  Empty,
  ErrorState,
  Field,
  Loading,
  Modal,
  Notice,
  PageHeading,
  Pagination,
  SearchInput,
} from "@/components/ui";
import {
  dateNow,
  dateLabel,
  label,
  time,
  money,
  minor,
  major,
} from "@/lib/format";
import { download, mutate, queryString } from "@/lib/api";
import type { AttendanceRow, AuthUser } from "@/types";

export default function Attendance({
  user,
  self = false,
}: {
  user: AuthUser;
  self?: boolean;
}) {
  const [date, setDate] = useState(dateNow(user.company.timezone)),
    [status, setStatus] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState<AttendanceRow | null>(null);
  const toast = useToast();
  const filters = queryString({
    from: self ? `${date.slice(0, 7)}-01` : date,
    to: date,
    status,
    search,
    page,
    limit: 10,
    employeeId: self
      ? user.employeeId || "000000000000000000000000"
      : undefined,
  });
  const query = useData<AttendanceRow[]>(`/attendance?${filters}`);
  const p = user.effectivePermissions;
  const summary = query.data?.meta?.summary;
  return (
    <>
      <PageHeading
        title={self ? "My attendance" : "Attendance register"}
        description={
          self
            ? "Your time, accounted for. One day at a time."
            : "Every workday, every team member. All in one place."
        }
      >
        {p.canExportReports && p.canGenerateReports && (
          <Button
            variant="secondary"
            onClick={() =>
              download(
                `/reports/attendance/export?${filters}&format=csv`,
                `Attendance_${date}.csv`,
              ).catch((e) => toast(e.message, true))
            }
          >
            <Download size={15} />
            Export CSV
          </Button>
        )}
        <Button variant="secondary" onClick={() => query.refetch()}>
          <RefreshCw size={14} />
          Refresh
        </Button>
      </PageHeading>
      {self && (
        <div style={{ marginBottom: 22 }}>
          <PunchCard user={user} />
        </div>
      )}
      {!self && summary && (
        <div className="stats-grid">
          {[
            ["Present", summary.present, "green"],
            ["Absent", summary.absent, ""],
            ["On leave", summary.leave, ""],
            ["Unmarked", summary.unmarked, ""],
          ].map(([name, value, color]) => (
            <div className="stat-card" key={name}>
              <div className="stat-top">
                {name}
                <CalendarDays size={15} />
              </div>
              <h3 className={String(color)}>
                {String(value).padStart(2, "0")}
              </h3>
              <div className="stat-bottom">{dateLabel(date)}</div>
            </div>
          ))}
        </div>
      )}
      <section className="panel">
        <div className="toolbar">
          {!self && (
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
            />
          )}
          <input
            type="date"
            aria-label="Attendance date"
            value={date}
            max={dateNow(user.company.timezone)}
            onChange={(e) => {
              setDate(e.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label="Filter attendance status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {[
              "PRESENT",
              "ABSENT",
              "HALF_DAY",
              "LEAVE",
              "HOLIDAY",
              "INCOMPLETE",
              "UNMARKED",
            ].map((s) => (
              <option value={s} key={s}>
                {label(s)}
              </option>
            ))}
          </select>
          <span className="toolbar-spacer" />
          <small>{user.company.timezone}</small>
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} retry={() => query.refetch()} />
        ) : !query.data.data.length ? (
          <Empty />
        ) : (
          <AttendanceTable
            rows={query.data.data}
            user={user}
            onEdit={!self && p.canMarkTeamAttendance ? setEdit : undefined}
            showDate={self}
          />
        )}
        {query.data?.meta && (
          <Pagination
            page={page}
            total={query.data.meta.total}
            onChange={setPage}
          />
        )}
      </section>
      {edit && (
        <AttendanceEditor
          row={edit}
          user={user}
          onClose={() => setEdit(null)}
        />
      )}
    </>
  );
}
export function AttendanceTable({
  rows,
  user,
  onEdit,
  showDate = false,
}: {
  rows: AttendanceRow[];
  user: AuthUser;
  onEdit?: (row: AttendanceRow) => void;
  showDate?: boolean;
}) {
  const pay =
    user.effectivePermissions.canViewSalaryImpact ||
    rows.some((r) => r.employeeId === user.employeeId);
  return (
    <div className="table-wrap">
      <table className="table-mobile">
        <thead>
          <tr>
            <th>Employee</th>
            {showDate && <th>Date</th>}
            <th>Check-in</th>
            <th>Check-out</th>
            <th>Hours</th>
            <th>Status</th>
            {pay && <th>Overtime</th>}
            {onEdit && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.employeeId}-${row.workDate}`}>
              <td>
                <div className="person">
                  <Avatar name={row.employeeName} index={index} />
                  <div>
                    <strong>{row.employeeName}</strong>
                    <small>
                      {row.employeeCode} · {row.department}
                    </small>
                  </div>
                </div>
              </td>
              {showDate && <td data-label="Date">{dateLabel(row.workDate)}</td>}
              <td data-label="Check-in" className="mono">
                {time(row.inTime, user.company.timezone)}
              </td>
              <td data-label="Check-out" className="mono">
                {time(row.outTime, user.company.timezone)}
              </td>
              <td data-label="Hours">
                {row.totalHours ? `${row.totalHours.toFixed(1)} hrs` : "—"}
              </td>
              <td data-label="Status">
                <Badge status={row.isIncomplete ? "INCOMPLETE" : row.status} />
              </td>
              {pay && (
                <td data-label="Overtime">
                  {row.isOvertime && row.otAmount !== undefined ? (
                    <span className="badge badge-overtime">
                      {money(row.otAmount, user.company.currency)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              )}
              {onEdit && (
                <td>
                  <button
                    className="icon-button"
                    aria-label={`Edit attendance for ${row.employeeName}`}
                    onClick={() => onEdit(row)}
                  >
                    <Pencil size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function AttendanceEditor({
  row,
  user,
  onClose,
}: {
  row: AttendanceRow;
  user: AuthUser;
  onClose: () => void;
}) {
  const [status, setStatus] = useState(
      row.status === "UNMARKED" ? "PRESENT" : row.status,
    ),
    [ot, setOt] = useState(row.isOvertime),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [auditOpen, setAuditOpen] = useState(false);
  const toast = useToast(),
    client = useQueryClient(),
    zone = user.company.timezone;
  const working = ["PRESENT", "HALF_DAY"].includes(status);
  const audit = useData<
    {
      _id: string;
      action: string;
      actorId?: { name: string };
      createdAt: string;
      reason?: string;
      before?: unknown;
      after?: unknown;
    }[]
  >(`/attendance/${row.employeeId}/${row.workDate}/audit`, auditOpen);
  const localTime = (value: string | null) =>
    value
      ? DateTime.fromISO(value).setZone(zone).toFormat("yyyy-MM-dd'T'HH:mm")
      : "";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const stamp = (key: string) =>
        form.get(key)
          ? DateTime.fromISO(String(form.get(key)), { zone })
              .toUTC()
              .toISO()
          : null;
      const body: Record<string, unknown> = {
        status,
        inTime: working ? stamp("inTime") : null,
        outTime: working ? stamp("outTime") : null,
        modificationReason: form.get("reason"),
        version: row.version,
      };
      if (["ADMIN", "HR"].includes(user.role))
        body.regularMinutes = working
          ? Math.round(Number(form.get("regularHours")) * 60)
          : 0;
      if (user.effectivePermissions.canToggleOT)
        Object.assign(body, {
          isOvertime: working && ot,
          otAmount:
            working && ot
              ? minor(String(form.get("amount")), user.company.currency)
              : 0,
          otRemark: working && ot ? form.get("remark") : "",
        });
      await mutate(
        `/attendance/${row.employeeId}/${row.workDate}`,
        "PUT",
        body,
      );
      await client.invalidateQueries();
      toast("Attendance saved. The change is recorded in the audit trail.");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Make every hour count."
      description={`${row.employeeName} · ${dateLabel(row.workDate)}`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-body">
          <Field label="Attendance status">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {["PRESENT", "ABSENT", "HALF_DAY", "LEAVE", "HOLIDAY"].map(
                (s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ),
              )}
            </select>
          </Field>
          {working && (
            <div className="form-grid" style={{ marginTop: 18 }}>
              <Field label={`Check-in (${zone})`}>
                <input
                  name="inTime"
                  type="datetime-local"
                  defaultValue={localTime(row.inTime)}
                />
              </Field>
              <Field label="Check-out">
                <input
                  name="outTime"
                  type="datetime-local"
                  defaultValue={localTime(row.outTime)}
                />
              </Field>
              {["ADMIN", "HR"].includes(user.role) && (
                <div className="full">
                  <Field
                    label="Approved regular hours"
                    hint="Exclude overtime. Must fit the completed shift."
                  >
                    <input
                      name="regularHours"
                      type="number"
                      min="0"
                      max="16"
                      step="0.25"
                      defaultValue={row.regularMinutes / 60}
                      required
                    />
                  </Field>
                </div>
              )}
            </div>
          )}
          {working && user.effectivePermissions.canToggleOT && (
            <>
              <label className="toggle-row">
                <div>
                  <h3>Overtime</h3>
                  <p>A little extra effort deserves recognition.</p>
                </div>
                <input
                  className="switch"
                  type="checkbox"
                  checked={ot}
                  onChange={(e) => setOt(e.target.checked)}
                  aria-label="Enable overtime"
                />
              </label>
              {ot && (
                <div className="ot-fields">
                  <Field label={`OT amount (${user.company.currency})`}>
                    <input
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      defaultValue={
                        major(row.otAmount || 0, user.company.currency) || ""
                      }
                      required
                    />
                  </Field>
                  <Field label="OT remark">
                    <textarea
                      name="remark"
                      placeholder="What was the extra time for?"
                      defaultValue={row.otRemark}
                      required
                      maxLength={1000}
                    />
                  </Field>
                </div>
              )}
            </>
          )}
          <div style={{ marginTop: 18 }}>
            <Field
              label={row.version ? "Reason for change" : "Note (optional)"}
            >
              <textarea
                name="reason"
                required={row.version > 0}
                maxLength={1000}
                placeholder="Add a little context for the audit trail…"
              />
            </Field>
          </div>
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          {row.id && user.effectivePermissions.canViewSalaryImpact && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAuditOpen(!auditOpen)}
            >
              <History size={14} />
              {auditOpen ? "Hide" : "View"} change history
            </Button>
          )}
          {auditOpen && (
            <div>
              {audit.isPending ? (
                <Loading />
              ) : audit.error ? (
                <p className="form-error">{audit.error.message}</p>
              ) : !audit.data.data.length ? (
                <p className="muted">No changes yet.</p>
              ) : (
                audit.data.data.map((entry) => (
                  <div className="audit-item" key={entry._id}>
                    <strong>
                      {label(entry.action)} · {entry.actorId?.name || "System"}
                    </strong>
                    <p>
                      {new Date(entry.createdAt).toLocaleString()} ·{" "}
                      {entry.reason || "Recorded action"}
                    </p>
                    <details>
                      <summary style={{ fontSize: 11 }}>Changed values</summary>
                      <pre>
                        {JSON.stringify(
                          { before: entry.before, after: entry.after },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button busy={busy}>
            <CheckCircle2 size={15} />
            Save attendance
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function PunchCard({ user }: { user: AuthUser }) {
  const date = dateNow(user.company.timezone),
    client = useQueryClient(),
    toast = useToast();
  const query = useData<AttendanceRow[]>(
    `/attendance?from=${date}&to=${date}&employeeId=${user.employeeId || "000000000000000000000000"}`,
  );
  const [clock, setClock] = useState("—"),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const update = () =>
      setClock(
        new Intl.DateTimeFormat("en-US", {
          timeZone: user.company.timezone,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date()),
      );
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [user.company.timezone]);
  const row = query.data?.data[0];
  async function punch() {
    setBusy(true);
    try {
      await mutate(
        `/attendance/${row?.inTime ? "check-out" : "check-in"}`,
        "POST",
        {},
        crypto.randomUUID(),
      );
      await client.invalidateQueries();
      toast(
        row?.inTime
          ? "All done. Have a lovely rest of your day!"
          : "You’re checked in. Make it a great day!",
      );
    } catch (e) {
      await query.refetch();
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel punch-card">
      <div className="flex" style={{ justifyContent: "center" }}>
        <Clock3 size={17} className="green" />
        <h2>Your workday</h2>
      </div>
      <div className="punch-clock" suppressHydrationWarning>
        {clock}
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        {dateLabel(date, { weekday: "long" })} · {user.company.timezone}
      </p>
      {query.error ? (
        <Notice>{query.error.message}</Notice>
      ) : (
        <Button
          busy={busy}
          disabled={
            query.isPending ||
            !user.employeeId ||
            !user.effectivePermissions.canTakeSelfAttendance ||
            Boolean(row?.outTime) ||
            Boolean(
              row?.status && !["PRESENT", "UNMARKED"].includes(row.status),
            )
          }
          onClick={punch}
        >
          {row?.outTime ? (
            <CheckCircle2 size={18} />
          ) : row?.inTime ? (
            <LogOut size={18} />
          ) : (
            <LogIn size={18} />
          )}
          {row?.outTime
            ? "Workday complete"
            : row?.inTime
              ? "Check out"
              : "Check in"}
        </Button>
      )}
      <div className="punch-times">
        <div>
          <span>CHECK-IN</span>
          <strong>{time(row?.inTime || null, user.company.timezone)}</strong>
        </div>
        <div>
          <span>CHECK-OUT</span>
          <strong>{time(row?.outTime || null, user.company.timezone)}</strong>
        </div>
        <div>
          <span>WORKED</span>
          <strong>
            {row?.totalHours ? `${row.totalHours.toFixed(1)}h` : "—"}
          </strong>
        </div>
      </div>
    </section>
  );
}
