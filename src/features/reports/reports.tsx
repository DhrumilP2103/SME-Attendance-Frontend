"use client";
import { useState } from "react";
import {
  Download,
  FileBarChart2,
  Wallet,
  Clock3,
  CalendarCheck,
  ArrowUpRight,
  Info,
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
  SearchInput,
  Select,
} from "@/components/ui";
import { AttendanceTable } from "@/features/attendance/attendance";
import { download, queryString } from "@/lib/api";
import { dateNow, money } from "@/lib/format";
import type { AttendanceRow, AuthUser, PayRow } from "@/types";

type EmployeeOption = { _id: string; fullName: string; employeeCode: string };

export default function Reports({
  user,
  payroll = false,
}: {
  user: AuthUser;
  payroll?: boolean;
}) {
  const today = dateNow(user.company.timezone);
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`),
    [to, setTo] = useState(today),
    [month, setMonth] = useState(today.slice(0, 7)),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [employeeId, setEmployeeId] = useState(""),
    [format, setFormat] = useState("csv"),
    [reportType, setReportType] = useState("attendance"),
    [exporting, setExporting] = useState(false),
    [selected, setSelected] = useState<PayRow | null>(null);
  const toast = useToast();
  const canFilterEmployee =
    !payroll && user.effectivePermissions.canGenerateReports;
  const salaryMode = payroll || reportType === "salary";
  const canSalaryReport =
    !!user.employeeId || user.effectivePermissions.canViewSalaryImpact;
  const people = useData<EmployeeOption[]>(
    `/employees?${queryString({ limit: 100 })}`,
    canFilterEmployee,
  );
  const filters = queryString({
    from,
    to,
    page,
    search,
    employeeId,
    limit: 10,
  });
  const reports = useData<AttendanceRow[]>(
    `/reports/attendance?${filters}`,
    !salaryMode,
  );
  const pay = useData<PayRow[]>(
    `/payroll/monthly?${queryString({
      month,
      page,
      limit: 10,
      ...(payroll ? {} : { search, employeeId }),
    })}`,
    salaryMode,
  );
  const query = salaryMode ? pay : reports;
  const summary = reports.data?.meta?.summary;
  async function exportFile() {
    setExporting(true);
    try {
      const chosen = people.data?.data.find((p) => p._id === employeeId);
      if (salaryMode) {
        await download(
          `/reports/payroll/export?${queryString({ month, search, employeeId, format })}`,
          `Salary_${chosen ? `${chosen.employeeCode}_` : ""}${month}.${format}`,
        );
      } else {
        await download(
          `/reports/attendance/export?${filters}&format=${format}`,
          `Attendance_${chosen ? `${chosen.employeeCode}_` : ""}${from}_${to}.${format}`,
        );
      }
      toast("Your report is ready.");
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <PageHeading
        title={payroll ? "Payroll overview" : "A clearer picture"}
        description={
          salaryMode
            ? "The hours, effort, and earnings behind every month."
            : "Useful insights. Thoughtful decisions. Less guesswork."
        }
      >
        {!payroll &&
          user.effectivePermissions.canExportReports &&
          user.effectivePermissions.canGenerateReports && (
            <>
              <Select
                compact
                ariaLabel="Export format"
                value={format}
                onChange={setFormat}
                style={{ width: 94 }}
                options={[
                  { value: "csv", label: "CSV" },
                  { value: "xlsx", label: "Excel" },
                  { value: "pdf", label: "PDF" },
                ]}
              />
              <Button busy={exporting} onClick={exportFile}>
                <Download size={15} />
                Export report
              </Button>
            </>
          )}
      </PageHeading>
      {salaryMode ? (
        <Notice>
          <strong>Estimates, not finalized payroll.</strong> Leave, half-day,
          and prorating policies still need business approval. Unmarked days are
          flagged, not automatically deducted. Select an employee to see the
          calculation.
        </Notice>
      ) : (
        summary && (
          <div className="stats-grid">
            {[
              {
                title: "Attendance records",
                value: summary.total,
                icon: FileBarChart2,
              },
              {
                title: "Present days",
                value: summary.present,
                icon: CalendarCheck,
              },
              {
                title: "Recorded hours",
                value: `${summary.totalHours}h`,
                icon: Clock3,
              },
              {
                title: "Overtime entries",
                value: summary.overtime,
                icon: Wallet,
              },
            ].map((s) => (
              <div className="stat-card" key={s.title}>
                <div className="stat-top">
                  {s.title}
                  <s.icon size={16} />
                </div>
                <h3>{s.value}</h3>
                <div className="stat-bottom">
                  Across your selected date range
                </div>
              </div>
            ))}
          </div>
        )
      )}
      <section className="panel">
        <div className="toolbar">
          {!payroll && canSalaryReport && (
            <Select
              compact
              ariaLabel="Report type"
              searchable={false}
              value={reportType}
              style={{ width: 150 }}
              onChange={(v) => {
                setReportType(v);
                setPage(1);
              }}
              options={[
                { value: "attendance", label: "Attendance report" },
                { value: "salary", label: "Salary report" },
              ]}
            />
          )}
          {!payroll && (
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search employee name…"
            />
          )}
          {canFilterEmployee && (
            <Select
              compact
              ariaLabel="Employee filter"
              value={employeeId}
              onChange={(v) => {
                setEmployeeId(v);
                setPage(1);
              }}
              style={{ width: 230 }}
              options={[
                { value: "", label: "All employees" },
                ...(people.data?.data || []).map((p) => ({
                  value: p._id,
                  label: `${p.fullName} · ${p.employeeCode}`,
                })),
              ]}
            />
          )}
          {salaryMode ? (
            <input
              aria-label="Payroll month"
              type="month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setPage(1);
              }}
            />
          ) : (
            <>
              <input
                aria-label="Report start date"
                type="date"
                value={from}
                max={to}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
              />
              <span className="muted">→</span>
              <input
                aria-label="Report end date"
                type="date"
                value={to}
                min={from}
                max={today}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
              />
            </>
          )}
          <span className="toolbar-spacer" />
          <small>
            {salaryMode
              ? `${user.company.currency} · Monthly estimates`
              : "Scoped to your access permissions"}
          </small>
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} retry={() => query.refetch()} />
        ) : !query.data?.data.length ? (
          <Empty />
        ) : salaryMode ? (
          <div className="table-wrap">
            <table className="table-mobile">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Base / regular pay</th>
                  <th>Deductions</th>
                  <th>Approved OT</th>
                  <th>Net estimate</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pay.data?.data.map((row, index) => (
                  <tr key={row.employeeId}>
                    <td>
                      <div className="person">
                        <Avatar name={row.employeeName} index={index} />
                        <div>
                          <strong>{row.employeeName}</strong>
                          <small>{row.employeeCode}</small>
                        </div>
                      </div>
                    </td>
                    <td data-label="Base / regular pay">
                      {money(row.basePay, row.currency)}
                    </td>
                    <td data-label="Deductions" style={{ color: "#bd7d68" }}>
                      −{money(row.deductions, row.currency)}
                    </td>
                    <td data-label="Approved OT" className="green">
                      +{money(row.approvedOt, row.currency)}
                    </td>
                    <td data-label="Net estimate">
                      <strong>{money(row.netPayable, row.currency)}</strong>
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        onClick={() => setSelected(row)}
                        aria-label={`View payroll calculation for ${row.employeeName}`}
                      >
                        <ArrowUpRight size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AttendanceTable
            rows={reports.data?.data || []}
            user={user}
            showDate
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
      {selected && (
        <Modal
          title={selected.employeeName}
          description={`${selected.month} · ${selected.employeeCode}`}
          onClose={() => setSelected(null)}
        >
          <div className="form-body">
            <Badge status="ESTIMATE" />
            <div style={{ marginTop: 20 }} className="stack">
              {[
                ["Base / approved regular pay", selected.basePay],
                ["Absence deductions", -selected.deductions],
                ["Approved overtime", selected.approvedOt],
                ["Net calculated estimate", selected.netPayable],
              ].map(([name, amount]) => (
                <div key={name} className="row space-between">
                  <span>{name}</span>
                  <strong>{money(Number(amount), selected.currency)}</strong>
                </div>
              ))}
            </div>
            <div className="notice" style={{ marginTop: 24 }}>
              <Info size={17} />
              <div>
                {selected.warnings.map((warning) => (
                  <p key={warning} style={{ marginBottom: 7 }}>
                    {warning}
                  </p>
                ))}
              </div>
            </div>
            <p className="muted" style={{ fontSize: 11 }}>
              Divisor: {selected.policy.divisor} days · Approved regular time:{" "}
              {(selected.regularMinutes / 60).toFixed(1)}h<br />
              {selected.policy.rounding}.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
