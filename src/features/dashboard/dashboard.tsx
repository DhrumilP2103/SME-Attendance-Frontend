"use client";
import Link from "next/link";
import {
  Users,
  UserCheck,
  UserX,
  Clock3,
  ArrowUpRight,
  ArrowRight,
  Plus,
  CalendarDays,
  CircleCheck,
  ClipboardCheck,
  FileBarChart2,
  Mail,
  ShieldCheck,
  TrendingUp,
  LogIn,
  LogOut,
  Timer,
} from "lucide-react";
import { useData } from "@/app/providers";
import {
  Avatar,
  Badge,
  Empty,
  ErrorState,
  Loading,
  PageHeading,
} from "@/components/ui";
import { dateLabel, time, money } from "@/lib/format";
import { queryString } from "@/lib/api";
import { ReportExport } from "@/features/reports/report-export";
import type { AuthUser, DashboardData } from "@/types";

export default function Dashboard({ user }: { user: AuthUser }) {
  const query = useData<DashboardData>("/dashboard/summary");
  if (query.isPending) return <Loading />;
  if (query.error)
    return <ErrorState error={query.error} retry={() => query.refetch()} />;
  const d = query.data.data,
    p = user.effectivePermissions;
  const isEmployee = user.role === "EMPLOYEE";
  const myRow = d.recent[0];
  const myStatus = d.present
    ? "Present"
    : d.absent
      ? "Absent"
      : d.halfDay
        ? "Half Day"
        : d.leave
          ? "On Leave"
          : d.holiday
            ? "Holiday"
            : d.unmarked
              ? "Not Marked"
              : "No record";
  const stats = isEmployee
    ? [
        {
          name: "My status today",
          value: myStatus,
          icon: UserCheck,
          color: "",
          hint: dateLabel(d.date, { weekday: "long" }),
          tag: "",
        },
        {
          name: "Check-in today",
          value: time(myRow?.inTime ?? null, user.company.timezone),
          icon: LogIn,
          color: "blue",
          hint: "Recorded check-in",
          tag: "",
        },
        {
          name: "Check-out today",
          value: time(myRow?.outTime ?? null, user.company.timezone),
          icon: LogOut,
          color: "orange",
          hint: "Recorded check-out",
          tag: "",
        },
        {
          name: "Hours today",
          value: `${d.totalHours}h`,
          icon: Timer,
          color: "purple",
          hint: "Regular hours recorded",
          tag: "",
        },
      ]
    : [
        {
          name: "Total employees",
          value: d.headcount,
          icon: Users,
          color: "",
          hint: "Active in your workspace",
          tag: "Your team",
        },
        {
          name: "Present today",
          value: d.present,
          icon: UserCheck,
          color: "blue",
          hint: "of today’s attendance",
          tag: `${d.attendanceRate}%`,
        },
        {
          name: "Absent today",
          value: d.absent,
          icon: UserX,
          color: "orange",
          hint: `${d.leave} on leave · ${d.unmarked} unmarked`,
          tag: "",
        },
        {
          name: "Overtime today",
          value: d.overtime,
          icon: Clock3,
          color: "purple",
          hint: p.canViewSalaryImpact
            ? `${money(d.otAmount, user.company.currency)} in approved OT`
            : "Extra efforts, recognized",
          tag: "",
        },
      ];
  const max = Math.max(5, ...d.trend.map((t) => t.total));
  const parts = [
    { name: "Present", count: d.present, color: "#368163" },
    { name: "Absent", count: d.absent, color: "#e5b5a0" },
    { name: "On leave", count: d.leave, color: "#e9d6a3" },
    {
      name: "Other",
      count: d.total - d.present - d.absent - d.leave,
      color: "#e6ece4",
    },
  ];
  let angle = 0;
  const gradient = parts
    .map((part) => {
      const start = angle;
      angle += (part.count / Math.max(1, d.total)) * 360;
      return `${part.color} ${start}deg ${angle}deg`;
    })
    .join(",");
  return (
    <>
      <PageHeading
        title="Dashboard"
        description="A little clarity for a more productive day."
      >
        {p.canExportReports && p.canGenerateReports && (
          <ReportExport
            variant="secondary"
            endpoint="/reports/attendance/export"
            filters={queryString({ from: d.date, to: d.date })}
            filename={`Attendance_${d.date}`}
          />
        )}
        {p.canMarkTeamAttendance && (
          <Link className="btn btn-primary" href="/attendance">
            <Plus size={15} />
            Mark attendance
          </Link>
        )}
      </PageHeading>
      <div className="welcome-banner">
        <div>
          <h2>
            Good to see you, {user.name.split(" ")[0]}{" "}
            <span style={{ fontSize: 20 }}>☀</span>
          </h2>
          <p>
            {user.role === "EMPLOYEE"
              ? "Here’s your workday at a glance. A fresh start, a clear plan, and a little more focus."
              : "Here’s what’s happening with your team today. Let’s make it a great workday."}
          </p>
        </div>
        <div className="welcome-graphic">
          <div className="graphic-ring">
            <ClipboardCheck size={32} strokeWidth={1.5} />
          </div>
          <div>
            <span>EVERY DAY COUNTS</span>
            <strong>People first.</strong>
          </div>
        </div>
      </div>
      <div className="stats-grid">
        {stats.map((stat) => (
          <div className="stat-card" key={stat.name}>
            <div className="stat-top">
              <span>{stat.name}</span>
              <span className={`stat-icon ${stat.color}`}>
                <stat.icon size={17} />
              </span>
            </div>
            <h3>
              {typeof stat.value === "number"
                ? String(stat.value).padStart(2, "0")
                : stat.value}
            </h3>
            <div className="stat-bottom">
              {stat.tag && <strong>{stat.tag}</strong>}
              <span>{stat.hint}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>{isEmployee ? "My attendance" : "Attendance overview"}</h2>
              <p>
                {isEmployee
                  ? "Your last 7 days"
                  : "A pulse on your team’s week"}
              </p>
            </div>
            <div className="chart-legend">
              <span>
                <i />
                Present
              </span>
              <span>
                <i className="light" />
                Other records
              </span>
            </div>
          </div>
          <div
            className="chart"
            role="img"
            aria-label={d.trend
              .map(
                (day) =>
                  `${day.label}: ${day.present} present, ${day.total - day.present} other`,
              )
              .join("; ")}
          >
            <div className="chart-grid">
              {[1, 0.75, 0.5, 0.25, 0].map((v) => (
                <div key={v}>
                  <span>{Math.round(max * v)}</span>
                </div>
              ))}
            </div>
            <div className="chart-bars">
              {d.trend.map((day) => (
                <div className="bar-group" key={day.date}>
                  <div
                    className="bar"
                    title={`${day.present} present`}
                    style={{ height: `${(day.present / max) * 100}%` }}
                  />
                  <div
                    className="bar light"
                    title={`${day.total - day.present} other`}
                    style={{
                      height: `${((day.total - day.present) / max) * 100}%`,
                    }}
                  />
                  <small>{day.label}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="chart-footer">
            <TrendingUp size={12} /> Last 7 days · Based on recorded attendance
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Today’s breakdown</h2>
              <p>{dateLabel(d.date, { weekday: "short" })}</p>
            </div>
            <CalendarDays size={15} className="muted" />
          </div>
          <div className="donut-area">
            <div
              className="donut"
              style={{
                background: d.total ? `conic-gradient(${gradient})` : "#e6ece4",
              }}
              role="img"
              aria-label={`${d.total} attendance records`}
            >
              <div className="donut-center">
                <strong>{d.total}</strong>
                <span>{isEmployee ? "Records" : "Employees"}</span>
              </div>
            </div>
            <div className="donut-legend">
              {parts.map((part) => (
                <div key={part.name}>
                  <i style={{ background: part.color }} />
                  <span>{part.name}</span>
                  <strong>{part.count}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="rate-footer">
            <span>Today’s attendance rate</span>
            <strong>{d.attendanceRate}%</strong>
          </div>
        </section>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>{isEmployee ? "My check-ins" : "Recent check-ins"}</h2>
              <p>
                {isEmployee
                  ? "Today’s recorded check-ins"
                  : "Your team, showing up and getting started"}
              </p>
            </div>
            <Link
              className="section-link"
              href={user.role === "EMPLOYEE" ? "/my-attendance" : "/attendance"}
            >
              View all <ArrowRight size={13} />
            </Link>
          </div>
          {d.recent.length ? (
            <div className="table-wrap">
              <table className="table-mobile">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Check-in</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent.map((row, index) => (
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
                      <td data-label="Check-in" className="mono">
                        {time(row.inTime, user.company.timezone)}
                      </td>
                      <td data-label="Status">
                        <Badge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title={isEmployee ? "No check-in yet" : "A fresh start"}
              description={
                isEmployee
                  ? "Your check-in will appear here once it is recorded."
                  : "Check-ins will appear here as the workday begins."
              }
            />
          )}
        </section>
        <div className="stack">
          <section className="panel">
            <div className="panel-header">
              <h2>Make things happen</h2>
              <ArrowUpRight size={15} className="muted" />
            </div>
            <div className="quick-actions">
              {p.canManageEmployees && (
                <Link className="quick-action" href="/employees/new">
                  <Plus size={17} />
                  Add employee
                </Link>
              )}
              <Link
                className="quick-action"
                href={user.employeeId ? "/my-attendance" : "/attendance"}
              >
                <CircleCheck size={17} />
                {user.employeeId ? "My attendance" : "Attendance"}
              </Link>
              <Link className="quick-action" href="/reports">
                <FileBarChart2 size={17} />
                View reports
              </Link>
              {user.role === "ADMIN" && (
                <Link className="quick-action" href="/settings/eod">
                  <Mail size={17} />
                  EOD reports
                </Link>
              )}
            </div>
          </section>
        </div>
      </div>
      <div className="footer">
        <span>
          Small details. Stronger teams. © {new Date().getFullYear()} SME
          Attendance
        </span>
        <span>
          <ShieldCheck size={12} />
          Your workspace, securely connected
        </span>
      </div>
    </>
  );
}
