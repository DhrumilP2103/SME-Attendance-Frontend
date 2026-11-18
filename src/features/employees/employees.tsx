"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  LayoutGrid,
  List,
  ArrowUpRight,
  UserPlus,
  Pencil,
  Mail,
  Eye,
  EyeOff,
  Users,
  Trash2,
  TriangleAlert,
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
  PageHeading,
  Pagination,
  SearchInput,
  Select,
} from "@/components/ui";
import { mutate, queryString } from "@/lib/api";
import { dateLabel, dateNow, major, minor, money } from "@/lib/format";
import type { AuthUser, Employee } from "@/types";

export default function Employees({
  user,
  employeeId,
}: {
  user: AuthUser;
  employeeId?: string;
}) {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [status, setStatus] = useState(""),
    [account, setAccount] = useState(""),
    [grid, setGrid] = useState(false),
    [pendingDelete, setPendingDelete] = useState<Employee | null>(null),
    [deleting, setDeleting] = useState(false);
  const router = useRouter(),
    toast = useToast(),
    client = useQueryClient();
  const query = useData<Employee[]>(
    `/employees?${queryString({ search, page, limit: 10, status, accountRole: account })}`,
  );
  const selected = useData<Employee>(
    `/employees/${employeeId}`,
    Boolean(employeeId && employeeId !== "new"),
  );
  const canPay = user.effectivePermissions.canViewSalaryImpact,
    isOwn = (employee: Employee) => employee._id === user.employeeId;
  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await mutate(`/employees/${pendingDelete._id}`, "DELETE", {});
      await client.invalidateQueries();
      toast(`${pendingDelete.fullName} and all related records were deleted.`);
      setPendingDelete(null);
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setDeleting(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Employees"
        description="Great teams start with knowing the people behind them."
      >
        {canPay && (
          <Link className="btn btn-primary" href="/employees/new">
            <UserPlus size={15} />
            Add employee
          </Link>
        )}
      </PageHeading>
      <div className="tabs">
        {[
          ["", "All employees"],
          ["ACTIVE", "Active"],
          ["INACTIVE", "Inactive"],
        ].map(([key, name]) => (
          <button
            className={status === key ? "active" : ""}
            key={key}
            onClick={() => {
              setStatus(key);
              setPage(1);
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
          />
          <Select
            ariaLabel="Filter by account type"
            compact
            searchable={false}
            value={account}
            style={{ width: 150 }}
            onChange={(v) => {
              setAccount(v);
              setPage(1);
            }}
            options={[
              { value: "", label: "All accounts" },
              { value: "HR", label: "HR only" },
              { value: "EMPLOYEE", label: "EMP only" },
            ]}
          />
          <span className="toolbar-spacer" />
          <span className="muted" style={{ fontSize: 11 }}>
            {query.data?.meta?.total || 0} employees
          </span>
          <button
            aria-label="Table view"
            className={`icon-button ${!grid ? "green" : ""}`}
            onClick={() => setGrid(false)}
          >
            <List size={18} />
          </button>
          <button
            aria-label="Card view"
            className={`icon-button ${grid ? "green" : ""}`}
            onClick={() => setGrid(true)}
          >
            <LayoutGrid size={17} />
          </button>
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} retry={() => query.refetch()} />
        ) : !query.data.data.length ? (
          <Empty />
        ) : grid ? (
          <div className="employee-grid" style={{ padding: 20 }}>
            {query.data.data.map((employee, index) => (
              <article
                className={`employee-card${employee.accountRole === "HR" ? " bg-[#f4fbf7] ring-1 ring-inset ring-[#d6ecdf]" : ""}`}
                key={employee._id}
              >
                <div className="card-top">
                  <Avatar
                    name={employee.fullName}
                    src={employee.profilePhotoUrl}
                    index={index}
                    size="lg"
                  />
                  <div className="flex items-center gap-[6px]">
                    {employee.accountRole === "HR" && (
                      <span className="rounded-full bg-[#e2f2e9] px-[7px] py-[1px] text-[9px] font-bold uppercase tracking-[0.08em] text-[#17664e]">
                        HR
                      </span>
                    )}
                    <Badge status={employee.status} />
                  </div>
                </div>
                <h3>{employee.fullName}</h3>
                {employee.email && <p>{employee.email}</p>}
                <div className="card-bottom">
                  <Link
                    href={`/employees/${employee._id}`}
                    className="section-link"
                  >
                    View profile <ArrowUpRight size={14} />
                  </Link>
                  <button
                    type="button"
                    className="icon-button size-[30px] text-danger hover:bg-danger-soft"
                    aria-label={`Delete ${employee.fullName}`}
                    title={
                      isOwn(employee)
                        ? "You cannot delete your own account."
                        : `Delete ${employee.fullName}`
                    }
                    disabled={isOwn(employee)}
                    onClick={() => setPendingDelete(employee)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table-mobile">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Joining date</th>
                  <th>Pay type</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {query.data.data.map((employee, index) => (
                  <tr
                    className={
                      employee.accountRole === "HR" ? "bg-[#f4fbf7]" : ""
                    }
                    key={employee._id}
                  >
                    <td>
                      <div className="person">
                        <Avatar
                          name={employee.fullName}
                          src={employee.profilePhotoUrl}
                          index={index}
                        />
                        <div>
                          <div className="flex items-center gap-[6px]">
                            <strong>{employee.fullName}</strong>
                            {employee.accountRole === "HR" && (
                              <span className="rounded-full bg-[#e2f2e9] px-[7px] py-[1px] text-[9px] font-bold uppercase tracking-[0.08em] text-[#17664e]">
                                HR
                              </span>
                            )}
                          </div>
                          <small>
                            {employee.employeeCode}
                            {employee.email ? ` · ${employee.email}` : ""}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td data-label="Joined">
                      {dateLabel(employee.joiningDate)}
                    </td>
                    <td data-label="Pay type">
                      {employee.payType === "SALARIED" ? "Salaried" : "Hourly"}
                      {canPay && (
                        <small style={{ display: "block" }}>
                          {money(
                            employee.payType === "SALARIED"
                              ? employee.baseSalary || 0
                              : employee.hourlyRate || 0,
                            user.company.currency,
                          )}
                          {employee.payType === "SALARIED" ? "/mo" : "/hr"}
                        </small>
                      )}
                    </td>
                    <td data-label="Status">
                      <Badge status={employee.status} />
                    </td>
                    <td>
                      <div className="flex items-center gap-[4px]">
                        <Link
                          className="icon-button"
                          aria-label={`Edit ${employee.fullName}`}
                          href={`/employees/${employee._id}`}
                        >
                          <Pencil size={15} />
                        </Link>
                        <button
                          type="button"
                          className="icon-button text-danger hover:bg-danger-soft"
                          aria-label={`Delete ${employee.fullName}`}
                          title={
                            isOwn(employee)
                              ? "You cannot delete your own account."
                              : `Delete ${employee.fullName}`
                          }
                          disabled={isOwn(employee)}
                          onClick={() => setPendingDelete(employee)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {query.data?.meta && (
          <Pagination
            page={page}
            total={query.data.meta.total}
            onChange={setPage}
          />
        )}
      </section>
      {employeeId === "new" ? (
        <EmployeeForm user={user} onClose={() => router.push("/employees")} />
      ) : employeeId && selected.data ? (
        <EmployeeForm
          user={user}
          employee={selected.data.data}
          key={`${employeeId}-${selected.data.data.version}`}
          onClose={() => router.push("/employees")}
        />
      ) : employeeId && selected.error ? (
        <Modal
          title="Profile unavailable"
          onClose={() => router.push("/employees")}
        >
          <ErrorState error={selected.error} />
        </Modal>
      ) : null}
      {pendingDelete && (
        <Modal
          title="Delete employee?"
          description={`${pendingDelete.fullName} · ${pendingDelete.employeeCode}`}
          onClose={() => {
            if (!deleting) setPendingDelete(null);
          }}
        >
          <div className="form-body">
            <div className="flex items-start gap-3 rounded-[9px] border border-danger-line bg-danger-soft p-[15px] text-danger">
              <TriangleAlert size={18} />
              <div className="text-[12px] leading-[1.5]">
                <strong>This action cannot be undone.</strong>
                <p className="mt-[6px]">
                  Deleting {pendingDelete.fullName} permanently removes the
                  employee profile, sign-in account and sessions, attendance and
                  approved-hours history, and any queued invitations.
                </p>
              </div>
            </div>
          </div>
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              busy={deleting}
              onClick={confirmDelete}
            >
              <Trash2 size={15} />
              Delete permanently
            </Button>
          </div>
        </Modal>
      )}
      <div className="footer">
        <span>
          <Users size={12} style={{ display: "inline", marginRight: 5 }} />A
          little organization goes a long way.
        </span>
        <button
          className="section-link"
          onClick={() => {
            void query.refetch();
            toast("Employee directory refreshed.");
          }}
        >
          Refresh directory
        </button>
      </div>
    </>
  );
}
function EmployeeForm({
  user,
  employee,
  onClose,
}: {
  user: AuthUser;
  employee?: Employee;
  onClose: () => void;
}) {
  const [payType, setPayType] = useState(employee?.payType || "SALARIED"),
    [accountType, setAccountType] = useState<"EMP" | "HR">("EMP"),
    [showPassword, setShowPassword] = useState(false),
    [showConfirm, setShowConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const client = useQueryClient(),
    toast = useToast();
  const canPay = user.effectivePermissions.canViewSalaryImpact;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget),
      value = (key: string) => String(form.get(key) || ""),
      email = value("email").trim().toLowerCase(),
      password = value("password");
    try {
      const body: Record<string, unknown> = {
        fullName: value("fullName"),
        phone: value("phone"),
        joiningDate: value("joiningDate"),
        assignedClientOrCustomer: null,
        shift: {
          startTime: value("startTime"),
          endTime: value("endTime"),
          graceMinutes: Number(value("grace")),
          standardDailyHours: Number(value("hours")),
        },
        weeklyOffDays: form.getAll("off").map(Number),
      };
      if (!employee) {
        if (email) body.email = email;
        if (password || value("confirm")) {
          if (!email)
            throw new Error(
              "Add an email address so this account can sign in.",
            );
          if (password.length < 6)
            throw new Error("Use at least 6 characters for the password.");
          if (password !== value("confirm"))
            throw new Error("The passwords do not match.");
          body.password = password;
        }
        body.role =
          user.role === "ADMIN" && accountType === "HR" ? "HR" : "EMPLOYEE";
      } else {
        if (email) body.email = email;
        body.version = employee.version;
        body.status = value("status");
      }
      if (canPay)
        Object.assign(body, {
          payType,
          baseSalary:
            payType === "SALARIED"
              ? minor(value("salary"), user.company.currency)
              : 0,
          hourlyRate:
            payType === "HOURLY"
              ? minor(value("rate"), user.company.currency)
              : 0,
          salaryDivisorPolicy:
            payType === "SALARIED"
              ? value("divisor") || "FIXED_30"
              : employee?.salaryDivisorPolicy || "FIXED_30",
        });
      if (
        employee?.status === "ACTIVE" &&
        body.status === "INACTIVE" &&
        !window.confirm(
          `Deactivate ${employee.fullName}? New attendance will be blocked.`,
        )
      )
        return;
      await mutate(
        employee ? `/employees/${employee._id}` : "/employees",
        employee ? "PATCH" : "POST",
        body,
      );
      await client.invalidateQueries();
      toast(
        employee
          ? "Employee profile updated."
          : password
            ? user.role === "ADMIN" && accountType === "HR"
              ? "HR account created. They can sign in with the password you set."
              : "Employee added. They can sign in with the password you set."
            : "Employee added. Add an email and password later to enable sign-in.",
      );
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={employee ? "Employee profile" : "Make room for someone great."}
      description={
        employee
          ? `${employee.employeeCode}${employee.email ? ` · ${employee.email}` : ""}`
          : "Add their details now and set a password only if they need sign-in access."
      }
      wide
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-body">
          {!employee && user.role === "ADMIN" && (
            <div style={{ marginBottom: 18 }}>
              <div className="row">
                <button
                  type="button"
                  className={`btn ${accountType === "HR" ? "btn-primary" : "btn-secondary"}`}
                  aria-pressed={accountType === "HR"}
                  onClick={() => setAccountType("HR")}
                >
                  Create HR
                </button>
                <button
                  type="button"
                  className={`btn ${accountType === "EMP" ? "btn-primary" : "btn-secondary"}`}
                  aria-pressed={accountType === "EMP"}
                  onClick={() => setAccountType("EMP")}
                >
                  Create EMP
                </button>
              </div>
              <p className="text-[11px] text-muted" style={{ marginTop: 8 }}>
                {accountType === "HR"
                  ? "HR account: full people-management access plus a linked employee profile."
                  : "Employee account: self-service access, attendance and payroll only."}
              </p>
            </div>
          )}
          <div className="form-grid">
            <Field label="Full name">
              <input
                name="fullName"
                defaultValue={employee?.fullName}
                required
                maxLength={120}
                placeholder="e.g. Alex Morgan"
              />
            </Field>
            <Field
              label="Email address"
              hint={
                employee?.email
                  ? undefined
                  : "Optional. Required only when this person needs sign-in access."
              }
            >
              <input
                name="email"
                type="email"
                defaultValue={employee?.email}
                placeholder="alex@company.com"
              />
            </Field>
            {!employee && (
              <>
                <Field
                  label="Password"
                  hint="Optional · At least 6 characters. Leave blank to skip sign-in access."
                >
                  <div className="password-input">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      minLength={6}
                      maxLength={128}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </Field>
                <Field label="Confirm password">
                  <div className="password-input">
                    <input
                      name="confirm"
                      type={showConfirm ? "text" : "password"}
                      minLength={6}
                      maxLength={128}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                      onClick={() => setShowConfirm(!showConfirm)}
                    >
                      {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </Field>
              </>
            )}
            <Field label="Phone number">
              <input
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                defaultValue={employee?.phone}
                maxLength={15}
                onInput={(e) => {
                  e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "");
                }}
                placeholder="9876543210"
              />
            </Field>
            <Field label="Joining date">
              <input
                name="joiningDate"
                type="date"
                defaultValue={
                  employee?.joiningDate || dateNow(user.company.timezone)
                }
                required
              />
            </Field>
            <div className="form-section">Working schedule</div>
            <Field label="Shift starts">
              <input
                name="startTime"
                type="time"
                defaultValue={employee?.shift?.startTime || "09:00"}
                required
              />
            </Field>
            <Field label="Shift ends">
              <input
                name="endTime"
                type="time"
                defaultValue={employee?.shift?.endTime || "18:00"}
                required
              />
            </Field>
            <Field label="Standard daily hours">
              <input
                name="hours"
                type="number"
                min="1"
                max="16"
                step="0.5"
                defaultValue={employee?.shift?.standardDailyHours || 8}
                required
              />
            </Field>
            <Field label="Grace period (minutes)">
              <input
                name="grace"
                type="number"
                min="0"
                max="120"
                defaultValue={employee?.shift?.graceMinutes ?? 15}
                required
              />
            </Field>
            <div className="full">
              <span style={{ fontSize: 12 }}>Weekly off days</span>
              <div className="row" style={{ flexWrap: "wrap", marginTop: 8 }}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day, index) => (
                    <label className="check-label" key={day}>
                      <input
                        type="checkbox"
                        name="off"
                        value={index}
                        defaultChecked={(
                          employee?.weeklyOffDays || [0]
                        ).includes(index)}
                      />
                      {day}
                    </label>
                  ),
                )}
              </div>
            </div>
            {canPay && (
              <>
                <div className="form-section">
                  Compensation · {user.company.currency}
                </div>
                <Field label="Pay structure">
                  <Select
                    ariaLabel="Pay structure"
                    value={payType}
                    onChange={(v) =>
                      setPayType(v as "SALARIED" | "HOURLY")
                    }
                    options={[
                      { value: "SALARIED", label: "Monthly salary" },
                      { value: "HOURLY", label: "Hourly rate" },
                    ]}
                  />
                </Field>
                {payType === "SALARIED" ? (
                  <Field label="Base monthly salary">
                    <input
                      name="salary"
                      type="number"
                      min="0.01"
                      step="0.01"
                      defaultValue={
                        major(
                          employee?.baseSalary || 0,
                          user.company.currency,
                        ) || ""
                      }
                      required
                    />
                  </Field>
                ) : (
                  <Field label="Hourly rate">
                    <input
                      name="rate"
                      type="number"
                      min="0.01"
                      step="0.01"
                      defaultValue={
                        major(
                          employee?.hourlyRate || 0,
                          user.company.currency,
                        ) || ""
                      }
                      required
                    />
                  </Field>
                )}
                {payType === "SALARIED" && (
                  <Field label="Salary divisor">
                    <Select
                      name="divisor"
                      ariaLabel="Salary divisor"
                      defaultValue={employee?.salaryDivisorPolicy || "FIXED_30"}
                      options={[
                        { value: "FIXED_30", label: "30 fixed days" },
                        { value: "FIXED_26", label: "26 working days" },
                        { value: "CALENDAR", label: "Actual calendar days" },
                      ]}
                    />
                  </Field>
                )}
              </>
            )}
            {employee && (
              <Field
                label="Employment status"
                hint="Inactive employees cannot record new attendance."
              >
                <Select
                  name="status"
                  ariaLabel="Employment status"
                  defaultValue={employee.status}
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                  ]}
                />
              </Field>
            )}
          </div>
          {error && (
            <div role="alert" className="auth-error">
              {error}
            </div>
          )}
        </div>
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button busy={busy}>
            {employee ? (
              "Save changes"
            ) : (
              <>
                <Plus size={15} />
                Add employee
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
