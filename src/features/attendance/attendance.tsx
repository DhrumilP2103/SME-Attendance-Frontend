"use client";
import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  LogIn,
  LogOut,
  RefreshCw,
  TriangleAlert,
  X,
} from "lucide-react";
import { useData, useToast } from "@/app/providers";
import {
  Avatar,
  Badge,
  Button,
  Empty,
  ErrorState,
  Loading,
  Notice,
  PageHeading,
  Pagination,
  SearchInput,
  Select,
} from "@/components/ui";
import { dateNow, dateLabel, label, time, money } from "@/lib/format";
import { download, mutate, queryString } from "@/lib/api";
import type { AttendanceRow, AuthUser, MissingHours } from "@/types";

export default function Attendance({
  user,
  self = false,
}: {
  user: AuthUser;
  self?: boolean;
}) {
  const [date, setDate] = useState(dateNow(user.company.timezone)),
    // The team register opens on the people who still need a mark.
    [status, setStatus] = useState(self ? "" : "PENDING"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const toast = useToast(),
    client = useQueryClient(),
    p = user.effectivePermissions,
    today = dateNow(user.company.timezone),
    // A rolling window keeps the previous month in view on the first days of a month.
    missingFrom =
      DateTime.fromISO(today).minus({ days: 30 }).toISODate() || today,
    yesterday = DateTime.fromISO(today).minus({ days: 1 }).toISODate() || "";
  const filters = queryString({
    from: self ? `${date.slice(0, 7)}-01` : date,
    to: date,
    status: status === "PENDING" ? "UNMARKED" : status,
    search,
    page,
    limit: 10,
    employeeId: self
      ? user.employeeId || "000000000000000000000000"
      : undefined,
  });
  const query = useData<AttendanceRow[]>(`/attendance?${filters}`);
  const canMark = !self && p.canMarkTeamAttendance;
  const missing = useData<MissingHours>(
    `/attendance/missing-hours?${queryString({ from: missingFrom, to: yesterday })}`,
    canMark && Boolean(yesterday),
  );
  const summary = query.data?.meta?.summary;
  const missingDays = [
    ...new Set(missing.data?.data.rows.map((row) => row.workDate) || []),
  ];
  async function quickMark(
    row: AttendanceRow,
    next: "PRESENT" | "ABSENT",
    hours?: number,
  ) {
    try {
      const payRole = ["ADMIN", "HR"].includes(user.role),
        body: Record<string, unknown> = {
          status: next,
          version: row.version,
          modificationReason: `Quick mark from the attendance register: ${label(next).toLowerCase()}.`,
        };
      if (next === "ABSENT") {
        Object.assign(body, { inTime: null, outTime: null });
        if (payRole) body.regularMinutes = 0;
        if (p.canToggleOT)
          Object.assign(body, { isOvertime: false, otAmount: 0, otRemark: "" });
      }
      if (hours !== undefined && payRole)
        body.regularMinutes = Math.round(hours * 60);
      await mutate(
        `/attendance/${row.employeeId}/${row.workDate}`,
        "PUT",
        body,
      );
      await client.invalidateQueries();
      toast(
        `${row.employeeName} marked ${label(next).toLowerCase()}${hours !== undefined ? ` · ${hours} hrs` : ""}.`,
      );
      return true;
    } catch (e) {
      toast((e as Error).message, true);
      return false;
    }
  }
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
      {canMark && missing.data?.data.count ? (
        <Notice>
          <strong>
            {missing.data.data.count} hourly{" "}
            {missing.data.data.count === 1 ? "record is" : "records are"}{" "}
            missing hours.
          </strong>{" "}
          Add the hours for previous days so payroll stays accurate.
          <div className="row" style={{ flexWrap: "wrap", marginTop: 8 }}>
            {missingDays.slice(0, 5).map((day) => (
              <button
                key={day}
                type="button"
                className="btn btn-secondary"
                style={{ minHeight: 27, padding: "4px 9px", fontSize: 10 }}
                onClick={() => {
                  setDate(day);
                  setPage(1);
                }}
              >
                {dateLabel(day)}
              </button>
            ))}
            {missingDays.length > 5 && (
              <small>+{missingDays.length - 5} more days</small>
            )}
          </div>
        </Notice>
      ) : null}
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
          <Select
            compact
            ariaLabel="Filter attendance status"
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[
              { value: "PENDING", label: "Pending" },
              { value: "PRESENT", label: "Present" },
              { value: "ABSENT", label: "Absent" },
              { value: "", label: "All statuses" },
            ]}
          />
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
            onQuickMark={canMark ? quickMark : undefined}
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
    </>
  );
}
export function AttendanceTable({
  rows,
  user,
  onQuickMark,
  showDate = false,
}: {
  rows: AttendanceRow[];
  user: AuthUser;
  onQuickMark?: (
    row: AttendanceRow,
    status: "PRESENT" | "ABSENT",
    hours?: number,
  ) => Promise<boolean>;
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
            {onQuickMark && <th>Mark</th>}
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
                    <small>{row.employeeCode}</small>
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
                <span className="inline-flex items-center gap-[6px]">
                  {row.totalHours
                    ? `${row.totalHours.toFixed(1)} hrs`
                    : row.regularMinutes
                      ? `${(row.regularMinutes / 60).toFixed(1)} hrs`
                      : "—"}
                  {row.payType === "HOURLY" &&
                    row.status === "PRESENT" &&
                    !row.regularMinutes && (
                      <span
                        className="inline-flex items-center gap-[3px] text-[10px] font-semibold text-warn"
                        title="No approved hours recorded for this hourly employee."
                      >
                        <TriangleAlert size={12} /> Missing
                      </span>
                    )}
                </span>
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
              {onQuickMark && (
                <td data-label="Mark">
                  <QuickMark row={row} onMark={onQuickMark} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function QuickMark({
  row,
  onMark,
}: {
  row: AttendanceRow;
  onMark: (
    row: AttendanceRow,
    status: "PRESENT" | "ABSENT",
    hours?: number,
  ) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false),
    [hours, setHours] = useState(""),
    [busy, setBusy] = useState(false);
  const hourly = row.payType === "HOURLY",
    day = dateLabel(row.workDate);
  async function mark(status: "PRESENT" | "ABSENT", worked?: number) {
    setBusy(true);
    const saved = await onMark(row, status, worked);
    setBusy(false);
    if (saved) setOpen(false);
  }
  if (open)
    return (
      <form
        className="flex items-center gap-[6px]"
        onSubmit={async (event) => {
          event.preventDefault();
          const raw = hours.trim();
          // Hours are optional: an empty field still records the present mark.
          if (!raw) {
            await mark("PRESENT");
            return;
          }
          const value = Number(raw);
          if (Number.isFinite(value) && value > 0) await mark("PRESENT", value);
        }}
      >
        <input
          aria-label={`Hours worked by ${row.employeeName} on ${day}`}
          type="number"
          min="0.25"
          max={row.standardDailyHours || 8}
          step="0.25"
          autoFocus
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="Optional"
          className="min-h-[32px] w-[84px] px-2 py-[4px] text-[12px]"
        />
        <button
          type="submit"
          title={`Save hours for ${row.employeeName}`}
          className="grid size-[32px] place-items-center rounded-[8px] border border-ok bg-ok text-white shadow-sm hover:border-ok"
          disabled={busy}
          aria-label={`Save hours for ${row.employeeName}`}
        >
          <Check size={15} />
        </button>
        <button
          type="button"
          className="grid size-[32px] place-items-center rounded-[8px] border border-field bg-white text-muted hover:border-stone"
          aria-label="Cancel hours entry"
          onClick={() => setOpen(false)}
        >
          <X size={14} />
        </button>
      </form>
    );
  return (
    <div className="flex items-center gap-[6px]">
      <button
        type="button"
        title={`Mark ${row.employeeName} absent`}
        aria-label={`Mark ${row.employeeName} absent on ${day}`}
        aria-pressed={row.status === "ABSENT"}
        disabled={busy || row.status === "ABSENT"}
        className={`grid size-[32px] place-items-center rounded-[8px] border text-[12px] font-extrabold transition ${
          row.status === "ABSENT"
            ? "border-bad bg-bad text-white shadow-sm ring-2 ring-bad/25"
            : "border-bad-soft bg-bad-soft text-bad hover:border-bad hover:bg-bad hover:text-white"
        }`}
        onClick={() => void mark("ABSENT")}
      >
        A
      </button>
      <button
        type="button"
        title={`Mark ${row.employeeName} present`}
        aria-label={`Mark ${row.employeeName} present on ${day}`}
        aria-pressed={row.status === "PRESENT"}
        disabled={busy || row.status === "PRESENT"}
        className={`grid size-[32px] place-items-center rounded-[8px] border text-[12px] font-extrabold transition ${
          row.status === "PRESENT"
            ? "border-ok bg-ok text-white shadow-sm ring-2 ring-ok/25"
            : "border-ok-soft bg-ok-soft text-ok hover:border-ok hover:bg-ok hover:text-white"
        }`}
        onClick={() => void mark("PRESENT")}
      >
        P
      </button>
      {hourly && (
        <button
          type="button"
          title={
            row.regularMinutes
              ? `Edit hours for ${row.employeeName}`
              : `Enter hours for ${row.employeeName}`
          }
          aria-label={`Enter hours for ${row.employeeName} on ${day}`}
          className={`grid size-[32px] place-items-center rounded-[8px] border transition ${
            row.regularMinutes
              ? "border-info bg-info-soft text-info"
              : "border-info-soft bg-white text-info hover:border-info hover:bg-info-soft"
          }`}
          onClick={() => {
            setHours(
              row.regularMinutes
                ? String(Number((row.regularMinutes / 60).toFixed(2)))
                : String(row.standardDailyHours || 8),
            );
            setOpen(true);
          }}
        >
          <Clock3 size={15} />
        </button>
      )}
    </div>
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
      <div className="row" style={{ justifyContent: "center" }}>
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
