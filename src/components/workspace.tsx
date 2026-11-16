"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  CalendarCheck2,
  Wallet,
  ShieldCheck,
  BarChart3,
  Settings2,
  Mail,
  UserCircle,
  LogOut,
  ChevronDown,
  ChevronRight,
  Building2,
  Menu,
  CircleHelp,
  CalendarDays,
  X,
  Clock3,
} from "lucide-react";
import { useUser, useToast } from "@/app/providers";
import { Avatar, ErrorState, Loading, Logo, Modal, Notice } from "./ui";
import { ApiError, mutate, clearSessionToken } from "@/lib/api";
import { dateNow, dateLabel, label } from "@/lib/format";
import Dashboard from "@/features/dashboard/dashboard";
import Employees from "@/features/employees/employees";
import Attendance from "@/features/attendance/attendance";
import Reports from "@/features/reports/reports";
import Rights from "@/features/rights/rights";
import Settings from "@/features/settings/settings";

export default function Workspace() {
  const pathname = usePathname(),
    router = useRouter(),
    client = useQueryClient(),
    auth = useUser(),
    toast = useToast();
  const [open, setOpen] = useState(false),
    [help, setHelp] = useState(false),
    [expired, setExpired] = useState(false);
  useEffect(() => {
    const expire = () => {
      setExpired(true);
      client.clear();
      clearSessionToken();
      router.replace("/login");
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("session-expired", expire);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("session-expired", expire);
      window.removeEventListener("keydown", escape);
    };
  }, [client, router]);
  useEffect(() => {
    if (auth.error instanceof ApiError && auth.error.status === 401)
      router.replace("/login");
  }, [auth.error, router]);
  if (
    expired ||
    auth.isPending ||
    (auth.error instanceof ApiError && auth.error.status === 401)
  )
    return <Loading />;
  if (auth.error)
    return <ErrorState error={auth.error} retry={() => auth.refetch()} />;
  const user = auth.data.data,
    p = user.effectivePermissions;
  const nav = [
    {
      href: "/dashboard",
      name: "Dashboard",
      icon: LayoutDashboard,
      allowed: true,
    },
    {
      href: "/employees",
      name: "Employees",
      icon: Users,
      allowed: p.canManageEmployees,
    },
    {
      href: "/attendance",
      name: "Attendance",
      icon: CalendarCheck2,
      allowed: user.role !== "EMPLOYEE",
    },
    {
      href: "/my-attendance",
      name: "My attendance",
      icon: Clock3,
      allowed: !!user.employeeId,
    },
    {
      href: "/payroll",
      name: "Payroll",
      icon: Wallet,
      allowed:
        user.role !== "CUSTOMER" &&
        (!!user.employeeId || p.canViewSalaryImpact),
    },
    {
      href: "/reports",
      name: "Reports",
      icon: BarChart3,
      allowed: p.canGenerateReports || !!user.employeeId,
    },
    {
      href: "/rights",
      name: "Rights management",
      icon: ShieldCheck,
      allowed: user.role === "ADMIN",
    },
    {
      href: "/settings/company",
      name: "Company settings",
      icon: Settings2,
      allowed: user.role === "ADMIN",
    },
    {
      href: "/settings/eod",
      name: "EOD automation",
      icon: Mail,
      allowed: user.role === "ADMIN",
    },
    { href: "/profile", name: "My profile", icon: UserCircle, allowed: true },
  ].filter((n) => n.allowed);
  const active = nav.find(
    (n) => pathname === n.href || pathname.startsWith(`${n.href}/`),
  );
  const accessible = Boolean(active);
  const mobile = nav
    .filter((n) =>
      user.role === "EMPLOYEE"
        ? ["/dashboard", "/my-attendance", "/reports", "/profile"].includes(
            n.href,
          )
        : ["/dashboard", "/attendance", "/employees", "/reports"].includes(
            n.href,
          ),
    )
    .slice(0, 4);
  async function logout() {
    try {
      await mutate("/auth/logout", "POST", {});
      setExpired(true);
      clearSessionToken();
      client.clear();
      router.replace("/login");
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  return (
    <>
      <button
        className={`mobile-overlay ${open ? "open" : ""}`}
        aria-label="Close navigation"
        onClick={() => setOpen(false)}
      />
      <aside
        className={`sidebar ${open ? "open" : ""}`}
        aria-label="Workspace navigation"
      >
        <Link href="/dashboard" onClick={() => setOpen(false)}>
          <Logo />
        </Link>
        <div className="workspace-switch">
          <div className="company-icon">
            <Building2 size={19} />
          </div>
          <div>
            <strong>{user.company.name}</strong>
            <small>
              {user.demoWorkspace ? "Local demo workspace" : "Your workspace"}
            </small>
          </div>
          <ChevronDown size={13} />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {nav
            .slice(
              0,
              nav.findIndex((n) => n.href.startsWith("/settings")) < 0
                ? nav.length - 1
                : nav.findIndex((n) => n.href.startsWith("/settings")),
            )
            .map((item) => (
              <Link
                key={item.href}
                className={`nav-item ${active?.href === item.href ? "active" : ""}`}
                href={item.href}
                onClick={() => setOpen(false)}
              >
                <item.icon size={18} strokeWidth={1.65} />
                {item.name}
              </Link>
            ))}
          <div className="nav-divider" />
          <p className="nav-label">PREFERENCES</p>
          {nav
            .filter(
              (n) => n.href.startsWith("/settings") || n.href === "/profile",
            )
            .map((item) => (
              <Link
                key={item.href}
                className={`nav-item ${active?.href === item.href ? "active" : ""}`}
                href={item.href}
                onClick={() => setOpen(false)}
              >
                <item.icon size={18} strokeWidth={1.65} />
                {item.name}
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <strong>More time for what matters.</strong>Less administration.
            <br />
            More room for your people.
          </div>
          <div className="sidebar-user">
            <Avatar name={user.name} />
            <div>
              <strong>{user.name}</strong>
              <small>{label(user.role)}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={logout}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={12} />
            <strong>{active?.name || "Page unavailable"}</strong>
          </div>
          <div className="topbar-right">
            <span className="today-label">
              <CalendarDays size={13} />
              {dateLabel(dateNow(user.company.timezone), { weekday: "short" })}
            </span>
            <button
              className="icon-button"
              aria-label="Workspace help"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={18} />
            </button>
            <Link
              className="topbar-user"
              href="/profile"
              aria-label="Open your profile"
            >
              <Avatar name={user.name} size="sm" />
            </Link>
          </div>
        </header>
        <main className="content" key={pathname}>
          {!accessible ? (
            <ErrorState
              error={
                new Error(
                  "This page is unavailable or you do not have permission to access it.",
                )
              }
            />
          ) : pathname === "/dashboard" ? (
            <Dashboard user={user} />
          ) : pathname.startsWith("/employees") ? (
            <Employees user={user} employeeId={pathname.split("/")[2]} />
          ) : pathname === "/attendance" || pathname === "/my-attendance" ? (
            <Attendance user={user} self={pathname === "/my-attendance"} />
          ) : pathname === "/reports" || pathname === "/payroll" ? (
            <Reports user={user} payroll={pathname === "/payroll"} />
          ) : pathname === "/rights" ? (
            <Rights />
          ) : (
            <Settings
              user={user}
              section={
                pathname === "/profile" ? "profile" : pathname.split("/")[2]
              }
            />
          )}
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Quick navigation">
        {mobile.map((item) => (
          <Link
            href={item.href}
            key={item.href}
            className={active?.href === item.href ? "active" : ""}
          >
            <item.icon size={20} strokeWidth={1.7} />
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>
      {help && (
        <Modal
          title="A little help goes a long way."
          onClose={() => setHelp(false)}
        >
          <div className="form-body stack">
            <p>
              Use the attendance register to view or mark the day. Employee
              profiles hold shift and pay settings. Reports bring your records
              together.
            </p>
            <Notice>
              Payroll figures are estimates until business policies are
              confirmed. Only authorized roles can see compensation.
            </Notice>
            {user.demoWorkspace && (
              <Notice>
                You’re exploring local sample data. Changes persist in MongoDB.
                Outgoing emails are saved locally until SMTP is configured.
              </Notice>
            )}
            <p className="muted" style={{ fontSize: 12 }}>
              Need access to a page? Ask your administrator to review your
              permissions under Rights Management.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
