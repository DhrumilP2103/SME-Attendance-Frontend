"use client";
import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import {
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
  Field,
  Loading,
  Modal,
  Notice,
  PageHeading,
  Pagination,
  SearchInput,
  Select,
} from "@/components/ui";
import { dateNow, dateLabel, label, time, money } from "@/lib/format";
import { api, download, mutate, queryString } from "@/lib/api";
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
    [page, setPage] = useState(1),
    // The school-register grid is the default team view.
    [view, setView] = useState<"MONTHLY" | "WEEKLY" | "DAY">("MONTHLY"),
    [hoursTarget, setHoursTarget] = useState<{
      employee: AttendanceRow;
      workDate: string;
      value: string;
    } | null>(null),
    [savingHours, setSavingHours] = useState(false),
    [busyCell, setBusyCell] = useState("");
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
  const query = useData<AttendanceRow[]>(`/attendance?${filters}`, self);
  const canMark = !self && p.canMarkTeamAttendance;
  const missing = useData<MissingHours>(
    `/attendance/missing-hours?${queryString({ from: missingFrom, to: yesterday })}`,
    canMark && Boolean(yesterday),
  );
  const missingDays = [
    ...new Set(missing.data?.data.rows.map((row) => row.workDate) || []),
  ];
  // Every team view uses the register grid; the view only picks the range.
  const grid = !self;
  const range = useMemo(() => {
    const anchor = DateTime.fromISO(date);
    if (view === "DAY")
      return { from: date, to: date, days: [date], label: date };
    if (view === "WEEKLY") {
      const start = anchor.startOf("week");
      return {
        from: start.toISODate() || date,
        to: anchor.endOf("week").toISODate() || date,
        days: Array.from(
          { length: 7 },
          (_, index) => start.plus({ days: index }).toISODate() || date,
        ),
        label: `${start.toFormat("d LLL")} – ${start.plus({ days: 6 }).toFormat("d LLL yyyy")}`,
      };
    }
    const start = anchor.startOf("month");
    return {
      from: start.toISODate() || date,
      to: anchor.endOf("month").toISODate() || date,
      days: Array.from(
        { length: anchor.daysInMonth || 30 },
        (_, index) => start.plus({ days: index }).toISODate() || date,
      ),
      label: start.toFormat("LLLL yyyy"),
    };
  }, [date, view]);
  // Future days stay visible in the grid but cannot carry a mark yet.
  const fetchTo = grid && range.to > today ? today : range.to;
  // One day gives the active roster (unmarked people included); each person's
  // range is then fetched separately so a month never hits the page limit.
  const roster = useData<AttendanceRow[]>(
    `/attendance?from=${fetchTo}&to=${fetchTo}&limit=100`,
    grid,
  );
  const employees = roster.data?.data || [];
  const rangeQueries = useQueries({
    queries: employees.map((employee) => {
      const path = `/attendance?from=${range.from}&to=${fetchTo}&employeeId=${employee.employeeId}&limit=100`;
      return {
        queryKey: [path],
        queryFn: () => api<AttendanceRow[]>(path),
        enabled: grid,
        retry: false,
        staleTime: 15000,
      };
    }),
  });
  const records = useMemo(() => {
    const map = new Map<string, AttendanceRow>();
    for (const result of rangeQueries)
      for (const row of result.data?.data || [])
        map.set(`${row.employeeId}|${row.workDate}`, row);
    return map;
  }, [rangeQueries]);
  const gridPending =
    grid &&
    (roster.isPending || rangeQueries.some((result) => result.isPending));
  const term = search.trim().toLowerCase();
  const gridRows = employees.filter(
    (employee) =>
      !term ||
      [employee.employeeName, employee.employeeCode, employee.email].some(
        (value) => value?.toLowerCase().includes(term),
      ),
  );
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
  function cellTarget(employee: AttendanceRow, workDate: string) {
    const record = records.get(`${employee.employeeId}|${workDate}`);
    return (
      record || {
        ...employee,
        workDate,
        status: "UNMARKED",
        version: 0,
      }
    );
  }
  async function cycleCell(employee: AttendanceRow, workDate: string) {
    const key = `${employee.employeeId}|${workDate}`;
    if (!canMark || workDate > today || busyCell || hoursTarget) return;
    const record = records.get(key);
    // The register cycles – → A → P → –; the last tap clears the saved record.
    if (record?.status === "PRESENT") {
      // A Present day saved without hours keeps the hours editor within reach.
      if (employee.payType === "HOURLY" && !record.regularMinutes) {
        setHoursTarget({ employee, workDate, value: "" });
        return;
      }
      setBusyCell(key);
      try {
        await api(
          `/attendance/${employee.employeeId}/${workDate}?version=${record.version}`,
          { method: "DELETE" },
        );
        await client.invalidateQueries();
        toast(
          `${employee.employeeName} is unmarked on ${dateLabel(workDate)}.`,
        );
      } catch (e) {
        toast((e as Error).message, true);
      } finally {
        setBusyCell("");
      }
      return;
    }
    if (!record || record.status === "UNMARKED") {
      setBusyCell(key);
      await quickMark(cellTarget(employee, workDate), "ABSENT");
      setBusyCell("");
      return;
    }
    if (employee.payType === "HOURLY") {
      setHoursTarget({
        employee,
        workDate,
        value: record?.regularMinutes
          ? String(Number((record.regularMinutes / 60).toFixed(2)))
          : String(employee.standardDailyHours || 8),
      });
      return;
    }
    setBusyCell(key);
    await quickMark(cellTarget(employee, workDate), "PRESENT");
    setBusyCell("");
  }
  async function saveCellHours(skip = false) {
    if (!hoursTarget) return;
    const { employee, workDate, value } = hoursTarget;
    const parsed = Number(value.trim());
    setSavingHours(true);
    const saved = await quickMark(
      cellTarget(employee, workDate),
      "PRESENT",
      !skip && value.trim() && Number.isFinite(parsed) && parsed > 0
        ? parsed
        : undefined,
    );
    setSavingHours(false);
    if (saved) setHoursTarget(null);
  }
  async function markAbsentFromHours() {
    if (!hoursTarget) return;
    setSavingHours(true);
    const saved = await quickMark(
      cellTarget(hoursTarget.employee, hoursTarget.workDate),
      "ABSENT",
    );
    setSavingHours(false);
    if (saved) setHoursTarget(null);
  }
  async function clearFromHours() {
    if (!hoursTarget) return;
    const { employee, workDate } = hoursTarget;
    const record = records.get(`${employee.employeeId}|${workDate}`);
    if (!record) {
      setHoursTarget(null);
      return;
    }
    setSavingHours(true);
    try {
      await api(
        `/attendance/${employee.employeeId}/${workDate}?version=${record.version}`,
        { method: "DELETE" },
      );
      await client.invalidateQueries();
      toast(`${employee.employeeName} is unmarked on ${dateLabel(workDate)}.`);
      setHoursTarget(null);
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setSavingHours(false);
    }
  }
  const hoursRecord = hoursTarget
    ? records.get(`${hoursTarget.employee.employeeId}|${hoursTarget.workDate}`)
    : undefined;
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
                grid
                  ? `/reports/attendance/export?${queryString({ from: range.from, to: fetchTo, format: "csv" })}`
                  : `/reports/attendance/export?${filters}&format=csv`,
                `Attendance_${grid ? range.label.replace(/\s+/g, "_") : date}.csv`,
              ).catch((e) => toast(e.message, true))
            }
          >
            <Download size={15} />
            Export CSV
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => {
            if (grid) {
              void roster.refetch();
              for (const result of rangeQueries) void result.refetch();
            } else void query.refetch();
          }}
        >
          <RefreshCw size={14} />
          Refresh
        </Button>
      </PageHeading>
      {self && (
        <div style={{ marginBottom: 22 }}>
          <PunchCard user={user} />
        </div>
      )}
      {!self && (
        <div className="tabs" aria-label="Attendance view">
          {(
            [
              ["MONTHLY", "Monthly"],
              ["WEEKLY", "Weekly"],
              ["DAY", "Day"],
            ] as const
          ).map(([id, text]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              className={view === id ? "active" : ""}
              onClick={() => {
                setView(id);
                setPage(1);
              }}
            >
              {text}
            </button>
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
                  setView("DAY");
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
          {view === "MONTHLY" && !self ? (
            <input
              type="month"
              aria-label="Attendance month"
              value={date.slice(0, 7)}
              max={today.slice(0, 7)}
              onChange={(e) => {
                if (!e.target.value) return;
                setDate(`${e.target.value}-01`);
                setPage(1);
              }}
            />
          ) : view === "WEEKLY" && !self ? (
            <input
              type="date"
              aria-label="Week containing date"
              value={date}
              max={today}
              onChange={(e) => {
                if (!e.target.value) return;
                setDate(e.target.value);
                setPage(1);
              }}
            />
          ) : (
            <input
              type="date"
              aria-label="Attendance date"
              value={date}
              max={today}
              onChange={(e) => {
                if (!e.target.value) return;
                setDate(e.target.value);
                setPage(1);
              }}
            />
          )}
          {view === "WEEKLY" && !self && <small>{range.label}</small>}
          {self && (
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
          )}
          <span className="toolbar-spacer" />
          <small>{user.company.timezone}</small>
        </div>
        {grid ? (
          gridPending ? (
            <Loading />
          ) : roster.error ? (
            <ErrorState error={roster.error} retry={() => roster.refetch()} />
          ) : !gridRows.length ? (
            <Empty />
          ) : (
            <RegisterGrid
              rows={gridRows}
              days={range.days}
              records={records}
              today={today}
              canMark={canMark}
              busyCell={busyCell}
              onCycle={cycleCell}
            />
          )
        ) : query.isPending ? (
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
        {!grid && query.data?.meta && (
          <Pagination
            page={page}
            total={query.data.meta.total}
            onChange={setPage}
          />
        )}
      </section>
      {hoursTarget && (
        <Modal
          title={`Hours for ${hoursTarget.employee.employeeName}`}
          description={`${dateLabel(hoursTarget.workDate)} · ${hoursTarget.employee.employeeCode}`}
          onClose={() => {
            if (!savingHours) setHoursTarget(null);
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveCellHours();
            }}
          >
            <div className="form-body">
              <Field
                label="Hours worked"
                hint={
                  hoursRecord?.status === "PRESENT"
                    ? `Hours were skipped for this Present day. Add them now, or mark absent / dash below.`
                    : `Optional · up to ${hoursTarget.employee.standardDailyHours || 8} hours. Skip hours saves Present without them.`
                }
              >
                <input
                  type="number"
                  min="0.25"
                  max={hoursTarget.employee.standardDailyHours || 8}
                  step="0.25"
                  autoFocus
                  placeholder="Optional"
                  value={hoursTarget.value}
                  onChange={(e) =>
                    setHoursTarget({ ...hoursTarget, value: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="form-actions">
              {hoursRecord?.status === "PRESENT" && (
                <div className="mr-auto flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="text-danger"
                    disabled={savingHours}
                    onClick={() => void markAbsentFromHours()}
                  >
                    Mark absent
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={savingHours}
                    onClick={() => void clearFromHours()}
                  >
                    Dash (–)
                  </Button>
                </div>
              )}
              <Button
                type="button"
                variant="secondary"
                disabled={savingHours}
                onClick={() => setHoursTarget(null)}
              >
                Cancel
              </Button>
              {hoursRecord?.status !== "PRESENT" && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={savingHours}
                  onClick={() => void saveCellHours(true)}
                >
                  Skip hours
                </Button>
              )}
              <Button busy={savingHours}>
                <Check size={15} />
                Save hours
              </Button>
            </div>
          </form>
        </Modal>
      )}
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
function hoursLabel(minutes: number) {
  const hours = Math.round((minutes / 60) * 10) / 10;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}
function RegisterGrid({
  rows,
  days,
  records,
  today,
  canMark,
  busyCell,
  onCycle,
}: {
  rows: AttendanceRow[];
  days: string[];
  records: Map<string, AttendanceRow>;
  today: string;
  canMark: boolean;
  busyCell: string;
  onCycle: (employee: AttendanceRow, workDate: string) => void;
}) {
  const totals = new Map<string, { present: number; minutes: number }>();
  for (const employee of rows) {
    let present = 0,
      minutes = 0;
    for (const day of days) {
      const record = records.get(`${employee.employeeId}|${day}`);
      if (!record) continue;
      if (record.status === "PRESENT") present += 1;
      minutes +=
        record.regularMinutes || Math.round((record.totalHours || 0) * 60);
    }
    totals.set(employee.employeeId, { present, minutes });
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th className="sticky left-0 z-[2] w-[180px] min-w-[180px] bg-[#fafbf9]">
              Employee
            </th>
            {days.map((day) => {
              const current = DateTime.fromISO(day);
              return (
                <th
                  key={day}
                  className={`w-[38px] min-w-[38px] px-0 py-[7px] text-center ${
                    current.weekday > 5 ? "bg-[#f3f5f2]" : ""
                  }`}
                >
                  <div className="text-[11px] font-semibold">{current.day}</div>
                  <div className="text-[8px] font-normal tracking-normal text-[#9aa49b]">
                    {current.toFormat("ccc")}
                  </div>
                </th>
              );
            })}
            <th aria-hidden className="p-0" />
            <th className="sticky right-0 z-[2] w-[92px] min-w-[92px] bg-[#fafbf9] px-[10px] text-center">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((employee, index) => (
            <tr key={employee.employeeId}>
              <td className="sticky left-0 z-[1] w-[180px] min-w-[180px] bg-white">
                <div className="person">
                  <Avatar name={employee.employeeName} index={index} />
                  <div>
                    <strong>{employee.employeeName}</strong>
                    <small>{employee.employeeCode}</small>
                  </div>
                </div>
              </td>
              {days.map((day) => {
                const key = `${employee.employeeId}|${day}`,
                  record = records.get(key),
                  status = record?.status,
                  future = day > today,
                  present = status === "PRESENT",
                  absent = status === "ABSENT",
                  mark = present
                    ? "P"
                    : absent
                      ? "A"
                      : status === "HALF_DAY"
                        ? "½"
                        : status === "LEAVE"
                          ? "L"
                          : status === "HOLIDAY"
                            ? "H"
                            : "–",
                  hoursMissing =
                    present &&
                    employee.payType === "HOURLY" &&
                    !record?.regularMinutes;
                return (
                  <td key={day} className="px-[3px] py-[4px] text-center">
                    <button
                      type="button"
                      disabled={!canMark || future || busyCell === key}
                      aria-label={`${employee.employeeName} · ${dateLabel(day)} · ${status ? label(status) : "Unmarked"}`}
                      title={`${dateLabel(day)} · ${status ? label(status) : "Unmarked"}${hoursMissing ? " · hours missing" : ""}`}
                      onClick={() => onCycle(employee, day)}
                      className={`relative mx-auto grid size-[34px] place-items-center rounded-[7px] border text-[11px] font-extrabold transition ${
                        future
                          ? "cursor-not-allowed border-transparent text-[#cfd6cf]"
                          : present
                            ? "border-ok bg-ok text-white shadow-sm hover:opacity-90"
                            : absent
                              ? "border-bad bg-bad text-white shadow-sm hover:opacity-90"
                              : status
                                ? "border-warn/40 bg-warn/10 text-warn hover:opacity-90"
                                : "border-transparent text-[#b9c2ba] hover:border-ok-soft hover:bg-ok-soft hover:text-ok"
                      }`}
                    >
                      {mark}
                      {hoursMissing && (
                        <span className="absolute right-[3px] top-[3px] size-[5px] rounded-full bg-white ring-1 ring-warn" />
                      )}
                    </button>
                  </td>
                );
              })}
              <td aria-hidden className="p-0" />
              <td className="sticky right-0 z-[1] w-[92px] min-w-[92px] bg-white px-[10px] text-center">
                {employee.payType === "HOURLY" ? (
                  <div
                    className="text-[11px] font-semibold text-[#33413a]"
                    title="Total hours worked in this view"
                  >
                    {hoursLabel(totals.get(employee.employeeId)?.minutes || 0)}{" "}
                    h
                  </div>
                ) : (
                  <>
                    <div
                      className="text-[11px] font-semibold text-ok"
                      title="Present days in this view"
                    >
                      {totals.get(employee.employeeId)?.present || 0} d
                    </div>
                    <div
                      className="text-[9px] text-[#8b958e]"
                      title="Approved or worked hours in this view"
                    >
                      {hoursLabel(
                        totals.get(employee.employeeId)?.minutes || 0,
                      )}{" "}
                      h
                    </div>
                  </>
                )}
              </td>
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
