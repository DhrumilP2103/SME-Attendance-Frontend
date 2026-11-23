import { DateTime } from "luxon";
import { Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui";
import { dateLabel, label } from "@/lib/format";
import type { AttendanceRow } from "@/types";

function hoursLabel(minutes: number) {
  return Number((minutes / 60).toFixed(2));
}
export function RegisterGrid({
  rows,
  days,
  records,
  today,
  canMark = false,
  busyCell = "",
  onCycle,
  onShowOt,
}: {
  rows: AttendanceRow[];
  days: string[];
  records: Map<string, AttendanceRow>;
  today: string;
  canMark?: boolean;
  busyCell?: string;
  onCycle?: (employee: AttendanceRow, workDate: string) => void;
  onShowOt?: (
    employee: AttendanceRow,
    workDate: string,
    record: AttendanceRow,
  ) => void;
}) {
  const Cell = onCycle ? "button" : "span";
  const spansMonths = days[0]?.slice(0, 7) !== days.at(-1)?.slice(0, 7);
  const employeeTotals = rows.map((employee) => {
    let present = 0,
      minutes = 0,
      overtimeMinutes = 0,
      overtimeAvailable = true;
    for (const day of days) {
      const record = records.get(`${employee.employeeId}|${day}`);
      if (!record) continue;
      if (record.status === "PRESENT") present += 1;
      minutes +=
        record.regularMinutes ||
        (employee.payType === "HOURLY" ? 0 : Math.round((record.totalHours || 0) * 60));
      if (record.isOvertime) {
        overtimeAvailable &&= record.otHours !== undefined;
        overtimeMinutes += (record.otHours ?? 0) * 60;
      }
    }
    return {
      employee,
      present,
      minutes: minutes + overtimeMinutes,
      overtime: overtimeAvailable ? overtimeMinutes : null,
    };
  });
  return (
    <div className="table-wrap attendance-register" tabIndex={0} role="region" aria-label="Attendance register">
      <table>
        <thead>
          <tr>
            <th className="sticky left-0 z-[2] register-employee w-[180px] min-w-[180px] bg-[#fafbf9]">
              Employee
            </th>
            {days.map((day) => {
              const current = DateTime.fromISO(day);
              return (
                <th
                  key={day}
                  scope="col"
                  className={`w-[38px] min-w-[38px] px-0 py-[7px] text-center ${
                    current.weekday > 5 ? "bg-[#f3f5f2]" : ""
                  }`}
                >
                  <div className="text-[11px] font-semibold">{current.day}</div>
                  <div className="text-[8px] font-normal tracking-normal text-[#9aa49b]">
                    {current.toFormat("ccc")}
                  </div>
                  {spansMonths && (day === days[0] || current.day === 1) && (
                    <div className="text-[8px]">{current.toFormat("LLL")}</div>
                  )}
                </th>
              );
            })}
            <th aria-hidden className="p-0" />
            <th scope="col" className="register-total sticky right-[92px] z-[2] min-w-[76px] bg-[#fafbf9] px-2 text-center">
              Total OT
            </th>
            <th scope="col" className="register-total sticky right-0 z-[2] w-[92px] min-w-[92px] bg-[#fafbf9] px-[10px] text-center">
              Total Hr
            </th>
          </tr>
        </thead>
        <tbody>
          {employeeTotals.map(({ employee, present, minutes, overtime }, index) => (
            <tr key={employee.employeeId}>
              <td className="sticky left-0 z-[1] register-employee w-[180px] min-w-[180px] bg-white">
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
                  saving = busyCell === key,
                  future = day > today,
                  present = status === "PRESENT",
                  absent = status === "ABSENT",
                  isOt = Boolean(record?.isOvertime),
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
                    <Cell
                      type={onCycle ? "button" : undefined}
                      disabled={onCycle ? !canMark || future || saving : undefined}
                      aria-busy={saving}
                      aria-label={`${employee.employeeName} · ${dateLabel(day)} · ${status ? label(status) : "Unmarked"}${isOt ? " · Overtime" : ""}`}
                      title={`${dateLabel(day)} · ${status ? label(status) : "Unmarked"}${isOt ? record?.otHours === undefined ? " · Overtime" : ` · OT: ${record.otHours} hrs` : ""}${hoursMissing ? " · hours missing" : ""}`}
                      onClick={onCycle && (() => {
                        if (isOt && record) {
                          onShowOt?.(employee, day, record);
                        } else {
                          onCycle(employee, day);
                        }
                      })}
                      className={`relative mx-auto grid size-[34px] place-items-center rounded-[7px] border text-[11px] font-extrabold transition ${
                        future
                          ? `border-transparent text-[#cfd6cf] ${onCycle ? "cursor-not-allowed" : ""}`
                          : isOt
                            ? `border-amber-500 ${present ? "bg-ok text-white" : "bg-warn/20 text-warn"} shadow-sm ring-2 ring-amber-500/80 ring-offset-1 enabled:hover:opacity-90`
                            : present
                              ? "border-ok bg-ok text-white shadow-sm enabled:hover:opacity-90"
                              : absent
                                ? "border-bad bg-bad text-white shadow-sm enabled:hover:opacity-90"
                                : status
                                  ? "border-warn/40 bg-warn/10 text-warn enabled:hover:opacity-90"
                                  : "border-transparent text-[#b9c2ba] enabled:hover:border-ok-soft enabled:hover:bg-ok-soft enabled:hover:text-ok"
                      }`}
                    >
                      {saving ? (
                        <Loader2 size={15} className="spin" aria-hidden="true" />
                      ) : (
                        mark
                      )}
                      {isOt && (
                        <span
                          className="absolute -top-[5px] -right-[5px] z-[2] rounded-full bg-amber-500 text-white px-[4px] py-[0.5px] text-[7.5px] font-black tracking-wider shadow-sm ring-1 ring-white"
                          title={record?.otHours === undefined ? "Overtime" : `OT: ${record.otHours} hrs`}
                        >
                          OT
                        </span>
                      )}
                      {hoursMissing && !isOt && (
                        <span className="absolute right-[3px] top-[3px] size-[5px] rounded-full bg-white ring-1 ring-warn" />
                      )}
                    </Cell>
                  </td>
                );
              })}
              <td aria-hidden className="p-0" />
              <td className="register-total sticky right-[92px] z-[1] min-w-[76px] bg-white px-2 text-center" title="Overtime hours in this view">
                {overtime === null ? "–" : `${hoursLabel(overtime)} h`}
              </td>
              <td className="register-total sticky right-0 z-[1] w-[92px] min-w-[92px] bg-white px-[10px] text-center">
                {employee.payType !== "HOURLY" && (
                  <div className="text-[11px] font-semibold text-ok" title="Present days in this view">
                    {present} d
                  </div>
                )}
                {(employee.payType === "HOURLY" || hoursLabel(minutes) > 0) && (
                  <div className="text-[11px] font-semibold text-[#33413a]" title="Total hours including overtime in this view">
                    {hoursLabel(minutes)} h
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
