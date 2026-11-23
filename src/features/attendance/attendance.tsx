"use client";
import { showSalaryInformation } from "@/lib/features";
import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  Clock3,
  LogIn,
  LogOut,
  Loader2,
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
  NumberInput,
  Notice,
  PageHeading,
  Pagination,
  SearchInput,
  Select,
} from "@/components/ui";
import { dateNow, dateLabel, label, time, money, major, minor } from "@/lib/format";
import { api, mutate, queryString } from "@/lib/api";
import { ReportExport } from "@/features/reports/report-export";
import { RegisterGrid } from "./register-grid";
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
    [hoursAction, setHoursAction] = useState<
      "save" | "skip" | "absent" | "clear" | null
    >(null),
    [busyCell, setBusyCell] = useState(""),
    [otModal, setOtModal] = useState<{
      open: boolean;
      editing?: boolean;
      employeeId?: string;
      workDate?: string;
      regularHours?: number;
      otHours?: number;
      otAmount?: number;
      otRemark?: string;
    } | null>(null),
    [otDetails, setOtDetails] = useState<{
      employee: AttendanceRow;
      workDate: string;
      record: AttendanceRow;
    } | null>(null),
    [savingOt, setSavingOt] = useState(false);
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
          modificationReason: `Attendance updated: ${label(next).toLowerCase()}${hours !== undefined ? ` · ${hours} regular hrs` : ""}.`,
        };
      if (next === "ABSENT") {
        Object.assign(body, { inTime: null, outTime: null });
        if (payRole) body.regularMinutes = 0;
        if (p.canToggleOT)
          Object.assign(body, { isOvertime: false, otHours: 0, otAmount: 0, otRemark: "" });
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
  function openCellHours(employee: AttendanceRow, workDate: string) {
    if (!canMark || workDate > today || (employee.joiningDate && workDate < employee.joiningDate) || busyCell || hoursTarget) return;
    const record = records.get(`${employee.employeeId}|${workDate}`);
    setHoursTarget({
      employee,
      workDate,
      value: record?.regularMinutes
        ? String(Number((record.regularMinutes / 60).toFixed(2)))
        : record?.status === "PRESENT"
          ? ""
          : String(employee.standardDailyHours || 8),
    });
  }
  async function cycleCell(employee: AttendanceRow, workDate: string) {
    const key = `${employee.employeeId}|${workDate}`;
    if (!canMark || workDate > today || (employee.joiningDate && workDate < employee.joiningDate) || busyCell || hoursTarget) return;
    const record = records.get(key);
    // The register cycles – → P → A → –.
    if (record?.status === "ABSENT") {
      setBusyCell(key);
      try {
        await api(
          `/attendance/${employee.employeeId}/${workDate}?version=${record.version}`,
          { method: "DELETE" },
        );
        await client.invalidateQueries();
        toast(`${employee.employeeName} is unmarked on ${dateLabel(workDate)}.`);
      } catch (e) {
        toast((e as Error).message, true);
      } finally {
        setBusyCell("");
      }
      return;
    }
    const next = record?.status === "PRESENT" ? "ABSENT" : "PRESENT";
    if (employee.payType === "HOURLY" && (next === "PRESENT" || !record?.regularMinutes)) {
      openCellHours(employee, workDate);
      return;
    }
    setBusyCell(key);
    try {
      await quickMark(cellTarget(employee, workDate), next);
    } finally {
      setBusyCell("");
    }
  }
  const savingHours = hoursAction !== null;
  async function saveCellHours(skip = false) {
    if (!hoursTarget) return;
    const { employee, workDate, value } = hoursTarget;
    const parsed = Number(value.trim());
    setHoursAction(skip ? "skip" : "save");
    const saved = await quickMark(
      cellTarget(employee, workDate),
      "PRESENT",
      !skip && value.trim() && Number.isFinite(parsed) && parsed > 0
        ? parsed
        : undefined,
    );
    setHoursAction(null);
    if (saved) setHoursTarget(null);
  }
  async function markAbsentFromHours() {
    if (!hoursTarget) return;
    setHoursAction("absent");
    const saved = await quickMark(
      cellTarget(hoursTarget.employee, hoursTarget.workDate),
      "ABSENT",
    );
    setHoursAction(null);
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
    setHoursAction("clear");
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
      setHoursAction(null);
    }
  }
  async function removeOvertime(target: {
    employee: AttendanceRow;
    workDate: string;
    record: AttendanceRow;
  }) {
    setSavingOt(true);
    try {
      const body: Record<string, unknown> = {
        status: target.record.status,
        isOvertime: false,
        otHours: 0,
        otAmount: 0,
        otRemark: "",
        modificationReason: "Overtime removed.",
        version: target.record.version,
      };
      await mutate(
        `/attendance/${target.employee.employeeId}/${target.workDate}`,
        "PUT",
        body,
      );
      await client.invalidateQueries();
      toast(
        `Overtime removed for ${target.employee.employeeName} on ${dateLabel(target.workDate)}.`,
      );
      setOtDetails(null);
    } catch (err) {
      toast((err as Error).message, true);
    } finally {
      setSavingOt(false);
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
          <ReportExport
            variant="secondary"
            label="Export attendance"
            endpoint="/reports/attendance/export"
            filters={grid ? queryString({ from: range.from, to: range.to, search }) : filters}
            filename={`Attendance_${grid ? range.label.replace(/\s+/g, "_") : date}`}
          />
        )}
        {p.canToggleOT && !self && (
          <Button
            variant="primary"
            onClick={() =>
              setOtModal({
                open: true,
                employeeId: employees[0]?.employeeId,
                workDate: date > today ? today : date,
                otHours: 1,
                otAmount: undefined,
                otRemark: "",
              })
            }
          >
            <Clock3 size={15} />
            Add Overtime
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
          {showSalaryInformation
            ? "Add the hours for previous days so payroll stays accurate."
            : "Add the hours for previous days to complete attendance records."}
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
              onEditHours={openCellHours}
              onShowOt={(employee, workDate, record) =>
                setOtDetails({ employee, workDate, record })
              }
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
            onShowOt={(employee, workDate, record) =>
              setOtDetails({ employee, workDate, record })
            }
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
                label="Regular Working Hours"
                hint={
                  hoursRecord?.status === "PRESENT"
                    ? `Hours for this Present day. Standard shift: ${hoursTarget.employee.standardDailyHours || 8} hrs.`
                    : `Optional · up to ${hoursTarget.employee.standardDailyHours || 8} regular hours. Standard shift: ${hoursTarget.employee.standardDailyHours || 8} hrs.`
                }
              >
                <NumberInput
                  min="0.25"
                  max={hoursTarget.employee.standardDailyHours || 8}
                  step="0.25"
                  autoFocus
                  placeholder={`e.g. ${hoursTarget.employee.standardDailyHours || 8}`}
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
                    busy={hoursAction === "absent"}
                    onClick={() => void markAbsentFromHours()}
                  >
                    Mark absent
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={savingHours}
                    busy={hoursAction === "clear"}
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
                  busy={hoursAction === "skip"}
                  onClick={() => void saveCellHours(true)}
                >
                  Skip hours
                </Button>
              )}
              <Button busy={hoursAction === "save"} disabled={savingHours}>
                <Check size={15} />
                Save hours
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {otModal && (
        <OvertimeModal
          user={user}
          employees={employees}
          initialData={otModal}
          records={records}
          onClose={() => setOtModal(null)}
          onSuccess={(empName, dt) => {
            setOtModal(null);
            void client.invalidateQueries();
            toast(`Overtime saved for ${empName} on ${dateLabel(dt)}.`);
          }}
        />
      )}
      {otDetails && (
        <OvertimeDetailsModal
          user={user}
          employee={otDetails.employee}
          workDate={otDetails.workDate}
          record={otDetails.record}
          canManage={p.canToggleOT && !self}
          onClose={() => setOtDetails(null)}
          onEdit={() => {
            const rec = otDetails.record;
            setOtModal({
              open: true,
              editing: true,
              employeeId: otDetails.employee.employeeId,
              workDate: otDetails.workDate,
              regularHours: rec.regularMinutes
                ? Number((rec.regularMinutes / 60).toFixed(2))
                : undefined,
              otHours: rec.otHours || 0,
              otAmount:
                rec.otAmount !== undefined
                  ? major(rec.otAmount, user.company.currency)
                  : undefined,
              otRemark: rec.otRemark || "",
            });
            setOtDetails(null);
          }}
          onRemove={() => void removeOvertime(otDetails)}
          removing={savingOt}
        />
      )}
    </>
  );
}
export function AttendanceTable({
  rows,
  user,
  onQuickMark,
  showDate = false,
  onShowOt,
}: {
  rows: AttendanceRow[];
  user: AuthUser;
  onQuickMark?: (
    row: AttendanceRow,
    status: "PRESENT" | "ABSENT",
    hours?: number,
  ) => Promise<boolean>;
  showDate?: boolean;
  onShowOt?: (
    employee: AttendanceRow,
    workDate: string,
    record: AttendanceRow,
  ) => void;
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
                    <button
                      type="button"
                      onClick={() => onShowOt?.(row, row.workDate, row)}
                      className="badge badge-overtime cursor-pointer hover:opacity-80 transition inline-flex items-center gap-1 font-semibold"
                      title="Click to view Overtime details"
                    >
                      <span>{money(row.otAmount, user.company.currency)}</span>
                      {row.otHours ? (
                        <span className="opacity-75 text-[10px]">
                          ({row.otHours}h)
                        </span>
                      ) : null}
                    </button>
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
    [saving, setSaving] = useState<"PRESENT" | "ABSENT" | "hours" | null>(
      null,
    );
  const busy = saving !== null;
  const hourly = row.payType === "HOURLY",
    day = dateLabel(row.workDate);
  async function mark(status: "PRESENT" | "ABSENT", worked?: number) {
    setSaving(open ? "hours" : status);
    const saved = await onMark(row, status, worked);
    setSaving(null);
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
        <NumberInput
          aria-label={`Hours worked by ${row.employeeName} on ${day}`}
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
          aria-busy={saving === "hours"}
          aria-label={`Save hours for ${row.employeeName}`}
        >
          {saving === "hours" ? (
            <Loader2 size={15} className="spin" aria-hidden="true" />
          ) : (
            <Check size={15} />
          )}
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
        aria-busy={saving === "ABSENT"}
        disabled={busy || row.status === "ABSENT"}
        className={`grid size-[32px] place-items-center rounded-[8px] border text-[12px] font-extrabold transition ${
          row.status === "ABSENT"
            ? "border-bad bg-bad text-white shadow-sm ring-2 ring-bad/25"
            : "border-bad-soft bg-bad-soft text-bad hover:border-bad hover:bg-bad hover:text-white"
        }`}
        onClick={() => void mark("ABSENT")}
      >
        {saving === "ABSENT" ? (
          <Loader2 size={15} className="spin" aria-hidden="true" />
        ) : (
          "A"
        )}
      </button>
      <button
        type="button"
        title={`Mark ${row.employeeName} present`}
        aria-label={`Mark ${row.employeeName} present on ${day}`}
        aria-pressed={row.status === "PRESENT"}
        aria-busy={saving === "PRESENT"}
        disabled={busy || row.status === "PRESENT"}
        className={`grid size-[32px] place-items-center rounded-[8px] border text-[12px] font-extrabold transition ${
          row.status === "PRESENT"
            ? "border-ok bg-ok text-white shadow-sm ring-2 ring-ok/25"
            : "border-ok-soft bg-ok-soft text-ok hover:border-ok hover:bg-ok hover:text-white"
        }`}
        onClick={() => void mark("PRESENT")}
      >
        {saving === "PRESENT" ? (
          <Loader2 size={15} className="spin" aria-hidden="true" />
        ) : (
          "P"
        )}
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

function OvertimeModal({
  user,
  employees,
  initialData,
  records,
  onClose,
  onSuccess,
}: {
  user: AuthUser;
  employees: AttendanceRow[];
  initialData: {
    editing?: boolean;
    employeeId?: string;
    workDate?: string;
    regularHours?: number;
    otHours?: number;
    otAmount?: number;
    otRemark?: string;
  };
  records: Map<string, AttendanceRow>;
  onClose: () => void;
  onSuccess: (empName: string, date: string) => void;
}) {
  const [empId, setEmpId] = useState(
    initialData.employeeId || employees[0]?.employeeId || "",
  );
  const today = dateNow(user.company.timezone);
  const [workDate, setWorkDate] = useState(initialData.workDate || today);
  const selectedEmp = employees.find((e) => e.employeeId === empId);
  const isHourly = selectedEmp?.payType === "HOURLY";
  const existingRecord = records.get(`${empId}|${workDate}`);
  const [workingHours, setWorkingHours] = useState(
    initialData.regularHours !== undefined
      ? String(initialData.regularHours)
      : existingRecord?.regularMinutes
        ? String(Number((existingRecord.regularMinutes / 60).toFixed(2)))
        : isHourly
          ? String(selectedEmp?.standardDailyHours || 8)
          : "",
  );
  const [hours, setHours] = useState(
    initialData.otHours !== undefined && initialData.otHours > 0
      ? String(initialData.otHours)
      : "1",
  );
  const [amount, setAmount] = useState(
    initialData.otAmount !== undefined && initialData.otAmount > 0
      ? String(initialData.otAmount)
      : "",
  );
  const [remark, setRemark] = useState(initialData.otRemark || "");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const options = employees.map((e) => ({
    value: e.employeeId,
    label: `${e.employeeName} (${e.employeeCode})${e.payType === "HOURLY" ? " · Hourly" : ""}`,
  }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!empId) {
      toast("Please select an employee.", true);
      return;
    }
    if (!workDate) {
      toast("Please select a date.", true);
      return;
    }
    const numHours = Number(hours.trim());
    if (!Number.isFinite(numHours) || numHours <= 0 || numHours > 24) {
      toast("Please enter valid OT hours (0.25 to 24).", true);
      return;
    }
    const amountStr = amount.trim();
    const numAmount = Number(amountStr);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      toast("Please enter a positive OT amount.", true);
      return;
    }
    const parsedWorkingHours = Number(workingHours.trim());
    if (isHourly && workingHours.trim()) {
      if (
        !Number.isFinite(parsedWorkingHours) ||
        parsedWorkingHours < 0 ||
        parsedWorkingHours > 24
      ) {
        toast("Please enter valid regular working hours (0 to 24).", true);
        return;
      }
    }

    setBusy(true);
    try {
      const existing = records.get(`${empId}|${workDate}`);
      let version = existing?.version;
      if (version === undefined) {
        try {
          const check = await api<AttendanceRow[]>(
            `/attendance?from=${workDate}&to=${workDate}&employeeId=${empId}`,
          );
          const match = check.data?.find(
            (r) => r.workDate === workDate && r.employeeId === empId,
          );
          version = match?.version || 0;
        } catch {
          version = 0;
        }
      }
      const status =
        existing?.status && ["PRESENT", "HALF_DAY"].includes(existing.status)
          ? existing.status
          : "PRESENT";
      const amountMinor = minor(amountStr, user.company.currency);
      const otRemarkText = remark.trim() || `Overtime: ${numHours} hrs`;
      const body: Record<string, unknown> = {
        status,
        ...(isHourly && workingHours.trim() && parsedWorkingHours >= 0
          ? { regularMinutes: Math.round(parsedWorkingHours * 60) }
          : {}),
        isOvertime: true,
        otHours: numHours,
        otAmount: amountMinor,
        otRemark: otRemarkText,
        modificationReason: `Overtime recorded: ${numHours} hrs (${money(amountMinor, user.company.currency)})${isHourly && workingHours.trim() ? ` · Regular: ${parsedWorkingHours} hrs` : ""}`,
        version,
      };

      await mutate(`/attendance/${empId}/${workDate}`, "PUT", body);
      const emp = employees.find((e) => e.employeeId === empId);
      onSuccess(emp?.employeeName || "Employee", workDate);
    } catch (err) {
      toast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={initialData.editing ? "Edit Overtime" : "Add Overtime"}
      description="Record overtime hours and direct compensation for an employee."
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={handleSubmit}>
        <div className="form-body">
          <Field
            label="Employee"
            hint="Select the employee for this overtime entry"
          >
            <Select
              ariaLabel="Select employee"
              disabled={initialData.editing}
              value={empId}
              onChange={(newEmpId) => {
                setEmpId(newEmpId);
                const emp = employees.find((e) => e.employeeId === newEmpId);
                if (emp?.payType === "HOURLY") {
                  const rec = records.get(`${newEmpId}|${workDate}`);
                  setWorkingHours(
                    rec?.regularMinutes
                      ? String(Number((rec.regularMinutes / 60).toFixed(2)))
                      : String(emp.standardDailyHours || 8),
                  );
                } else {
                  setWorkingHours("");
                }
              }}
              options={options}
            />
          </Field>
          <Field label="Work date" hint="Date when overtime was worked">
            <input
              type="date"
              max={today}
              disabled={initialData.editing}
              value={workDate}
              onChange={(e) => {
                const newDate = e.target.value;
                setWorkDate(newDate);
                if (isHourly) {
                  const rec = records.get(`${empId}|${newDate}`);
                  if (rec?.regularMinutes) {
                    setWorkingHours(
                      String(Number((rec.regularMinutes / 60).toFixed(2))),
                    );
                  }
                }
              }}
              required
            />
          </Field>
          {isHourly && (
            <Field
              label="Regular Working Hours"
              hint={`Daily shift hours (standard shift: ${selectedEmp?.standardDailyHours || 8} hrs)`}
            >
              <NumberInput
                step="0.25"
                min="0"
                max={selectedEmp?.standardDailyHours || 8}
                value={workingHours}
                onChange={(e) => setWorkingHours(e.target.value)}
                placeholder={`e.g. ${selectedEmp?.standardDailyHours || 8}`}
              />
            </Field>
          )}
          <Field
            label="OT Hours"
            hint="Number of overtime hours (e.g. 1, 2, 2.5)"
          >
            <NumberInput
              step="0.25"
              min="0.25"
              max="24"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="e.g. 2"
              required
            />
          </Field>
          <Field
            label={`OT Amount (${user.company.currency})`}
            hint={`Direct compensation amount in ${user.company.currency}`}
          >
            <NumberInput
              step="1"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 500"
              required
            />
          </Field>
          <Field
            label="Remark"
            hint="Optional note or reason (defaults to Overtime hours)"
          >
            <input
              type="text"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder={`e.g. Overtime: ${hours || "2"} hrs`}
            />
          </Field>
        </div>
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button busy={busy}>
            <Check size={15} />
            Save Overtime
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function OvertimeDetailsModal({
  user,
  employee,
  workDate,
  record,
  canManage,
  onClose,
  onEdit,
  onRemove,
  removing,
}: {
  user: AuthUser;
  employee: AttendanceRow;
  workDate: string;
  record: AttendanceRow;
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
  removing: boolean;
}) {
  return (
    <Modal
      title="Overtime Details"
      description={`${employee.employeeName} (${employee.employeeCode}) · ${dateLabel(workDate)}`}
      onClose={onClose}
    >
      <div className="form-body">
        <div className="rounded-lg border border-line bg-[#fafbf9] p-4 text-[13px] space-y-3">
          <div className="flex justify-between items-center py-1 border-b border-line/60">
            <span className="text-[#64746b]">Employee:</span>
            <span className="font-semibold text-[#1f2923]">
              {employee.employeeName} ({employee.employeeCode})
            </span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-line/60">
            <span className="text-[#64746b]">Date:</span>
            <span className="font-medium text-[#1f2923]">
              {dateLabel(workDate)}
            </span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-line/60">
            <span className="text-[#64746b]">Attendance Status:</span>
            <Badge status={record.status} />
          </div>
          {employee.payType === "HOURLY" && (
            <>
              <div className="flex justify-between items-center py-1 border-b border-line/60">
                <span className="text-[#64746b]">Regular Working Hours:</span>
                <span className="font-semibold text-[#1f2923]">
                  {record.regularMinutes
                    ? `${(record.regularMinutes / 60).toFixed(1)} hrs`
                    : "0 hrs"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-line/60">
                <span className="text-[#64746b]">
                  Total Hours (Regular + OT):
                </span>
                <span className="font-bold text-[#1f2923]">
                  {(
                    ((record.regularMinutes || 0) +
                      (record.otHours ? record.otHours * 60 : 0)) /
                    60
                  ).toFixed(1)}{" "}
                  hrs
                </span>
              </div>
            </>
          )}
          <div className="flex justify-between items-center py-1 border-b border-line/60">
            <span className="text-[#64746b]">OT Hours:</span>
            <span className="font-bold text-ok text-[14px]">
              {record.otHours || 0} hrs
            </span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-line/60">
            <span className="text-[#64746b]">OT Amount:</span>
            <span className="font-bold text-amber-600 text-[14px]">
              {record.otAmount !== undefined
                ? money(record.otAmount, user.company.currency)
                : "—"}
            </span>
          </div>
          <div className="flex justify-between items-start py-1">
            <span className="text-[#64746b]">Remark:</span>
            <span className="font-normal text-[#33413a] text-right max-w-[240px]">
              {record.otRemark || "None"}
            </span>
          </div>
        </div>
      </div>
      <div className="form-actions">
        {canManage && (
          <div className="mr-auto flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="text-danger"
              busy={removing}
              onClick={onRemove}
            >
              Remove OT
            </Button>
            <Button type="button" variant="primary" onClick={onEdit}>
              Edit OT
            </Button>
          </div>
        )}
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
