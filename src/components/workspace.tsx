"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

const menuItemClass =
  "flex items-center gap-[9px] rounded-[7px] px-[9px] py-2 text-[11.5px] font-medium text-moss hover:bg-mint hover:text-green-dark [&>svg:last-child]:ml-auto [&>svg:last-child]:text-[#a9b3ad] hover:[&>svg:last-child]:text-green";

export default function Workspace() {
  const pathname = usePathname(),
    router = useRouter(),
    client = useQueryClient(),
    auth = useUser(),
    toast = useToast();
  const [open, setOpen] = useState(false),
    [help, setHelp] = useState(false),
    [expired, setExpired] = useState(false),
    [switchOpen, setSwitchOpen] = useState(false);
  const switchRef = useRef<HTMLDivElement>(null),
    switchBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const expire = () => {
      setExpired(true);
      client.clear();
      clearSessionToken();
      router.replace("/login");
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        if (switchOpen) {
          setSwitchOpen(false);
          switchBtnRef.current?.focus({ preventScroll: true });
        }
      }
    };
    window.addEventListener("session-expired", expire);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("session-expired", expire);
      window.removeEventListener("keydown", escape);
    };
  }, [client, router, switchOpen]);
  useEffect(() => {
    if (!switchOpen) return;
    const outside = (e: PointerEvent) => {
      if (!switchRef.current?.contains(e.target as Node)) setSwitchOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [switchOpen]);
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
      allowed: !!user.employeeId || p.canViewSalaryImpact,
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
        <div className="workspace-menu-wrap" ref={switchRef}>
          <button
            type="button"
            ref={switchBtnRef}
            className={`workspace-switch ${switchOpen ? "open" : ""}`}
            aria-expanded={switchOpen}
            aria-haspopup="menu"
            aria-label={`Workspace: ${user.company.name}`}
            onClick={() => setSwitchOpen((v) => !v)}
          >
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
          </button>
          {switchOpen && (
            <div
              className="animate-pop-in absolute top-[calc(100%+6px)] left-0 z-[70] flex w-full min-w-0 max-w-full origin-top-left flex-col items-stretch gap-0 overflow-hidden rounded-[10px] border border-[#dbe4dd] bg-white shadow-[0_14px_44px_#10352426,0_2px_8px_#10352414] outline-none"
              role="menu"
              aria-label="Workspace details and shortcuts"
            >
              <div className="flex items-center gap-[9px] border-b border-line bg-[linear-gradient(135deg,#f2faf5,#fdfefe)] px-3 pt-3 pb-[10px]">
                <span className="company-icon">
                  <Building2 size={17} />
                </span>
                <div className="min-w-0">
                  <strong className="block truncate text-[12px]">
                    {user.company.name}
                  </strong>
                  <small className="block truncate text-[9.5px]">
                    {user.demoWorkspace
                      ? "Local demo · sample data"
                      : "Live workspace · one company"}
                  </small>
                </div>
              </div>
              <dl className="m-0 grid gap-[6px] border-b border-line px-3 py-[9px]">
                <div className="flex justify-between gap-[10px] text-[10.5px]">
                  <dt className="text-muted">Currency</dt>
                  <dd className="m-0 truncate text-right font-semibold text-ink">
                    {user.company.currency}
                  </dd>
                </div>
                <div className="flex justify-between gap-[10px] text-[10.5px]">
                  <dt className="text-muted">Timezone</dt>
                  <dd className="m-0 truncate text-right font-semibold text-ink">
                    {user.company.timezone}
                  </dd>
                </div>
                <div className="flex justify-between gap-[10px] text-[10.5px]">
                  <dt className="text-muted">Your role</dt>
                  <dd className="m-0 truncate text-right font-semibold text-ink">
                    {label(user.role)}
                  </dd>
                </div>
              </dl>
              <div className="grid gap-[2px] p-[5px]">
                {user.role === "ADMIN" && (
                  <>
                    <Link
                      href="/settings/company"
                      role="menuitem"
                      className={menuItemClass}
                      onClick={() => {
                        setSwitchOpen(false);
                        setOpen(false);
                      }}
                    >
                      <Settings2 size={15} />
                      Company settings
                      <ChevronRight size={13} />
                    </Link>
                    <Link
                      href="/settings/eod"
                      role="menuitem"
                      className={menuItemClass}
                      onClick={() => {
                        setSwitchOpen(false);
                        setOpen(false);
                      }}
                    >
                      <Mail size={15} />
                      EOD automation
                      <ChevronRight size={13} />
                    </Link>
                  </>
                )}
                <Link
                  href="/profile"
                  role="menuitem"
                  className={menuItemClass}
                  onClick={() => {
                    setSwitchOpen(false);
                    setOpen(false);
                  }}
                >
                  <UserCircle size={15} />
                  My profile
                  <ChevronRight size={13} />
                </Link>
              </div>
              <p className="m-0 border-t border-line bg-paper px-3 pt-2 pb-[10px] text-[9.5px] leading-[1.45] text-[#939d97]">
                {user.role === "ADMIN"
                  ? "One workspace per account. Rename it or change currency in Company settings."
                  : "Workspace details are managed by your administrator."}
              </p>
            </div>
          )}
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
            .filter((item) => item.href !== "/payroll")
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
          {/* <div className="sidebar-note">
            <strong>More time for what matters.</strong>Less administration.
            <br />
            More room for employees.
          </div> */}
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
