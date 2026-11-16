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
  Users,
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
    [grid, setGrid] = useState(false);
  const router = useRouter(),
    toast = useToast();
  const query = useData<Employee[]>(
    `/employees?${queryString({ search, page, limit: 10, status })}`,
  );
  const selected = useData<Employee>(
    `/employees/${employeeId}`,
    Boolean(employeeId && employeeId !== "new"),
  );
  const canPay = user.effectivePermissions.canViewSalaryImpact;
  return (
    <>
      <PageHeading
        title="Your people"
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
              <article className="employee-card" key={employee._id}>
                <div className="card-top">
                  <Avatar
                    name={employee.fullName}
                    src={employee.profilePhotoUrl}
                    index={index}
                    size="lg"
                  />
                  <Badge status={employee.status} />
                </div>
                <h3>{employee.fullName}</h3>
                <p>{employee.designation}</p>
                <p>{employee.email}</p>
                <div className="card-bottom">
                  <span>{employee.department}</span>
                  <Link
                    href={`/employees/${employee._id}`}
                    className="section-link"
                  >
                    View profile <ArrowUpRight size={14} />
                  </Link>
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
                  <th>Department</th>
                  <th>Joining date</th>
                  <th>Pay type</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {query.data.data.map((employee, index) => (
                  <tr key={employee._id}>
                    <td>
                      <div className="person">
                        <Avatar
                          name={employee.fullName}
                          src={employee.profilePhotoUrl}
                          index={index}
                        />
                        <div>
                          <strong>{employee.fullName}</strong>
                          <small>
                            {employee.employeeCode} · {employee.email}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td data-label="Department">
                      <strong>{employee.department}</strong>
                      <small style={{ display: "block" }}>
                        {employee.designation}
                      </small>
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
                      <Link
                        className="icon-button"
                        aria-label={`Edit ${employee.fullName}`}
                        href={`/employees/${employee._id}`}
                      >
                        <Pencil size={15} />
                      </Link>
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
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const client = useQueryClient(),
    toast = useToast();
  const customers = useData<{ _id: string; name: string }[]>(
    "/employees/customers",
  );
  const canPay = user.effectivePermissions.canViewSalaryImpact;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget),
      value = (key: string) => String(form.get(key) || "");
    try {
      const body: Record<string, unknown> = {
        fullName: value("fullName"),
        phone: value("phone"),
        joiningDate: value("joiningDate"),
        department: value("department"),
        designation: value("designation"),
        profilePhotoUrl: value("profilePhotoUrl"),
        assignedClientOrCustomer: customers.data
          ? value("customer") || null
          : employee?.assignedClientOrCustomer || null,
        shift: {
          startTime: value("startTime"),
          endTime: value("endTime"),
          graceMinutes: Number(value("grace")),
          standardDailyHours: Number(value("hours")),
        },
        weeklyOffDays: form.getAll("off").map(Number),
      };
      if (!employee) body.email = value("email");
      else {
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
          salaryDivisorPolicy: value("divisor") || "FIXED_30",
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
          : "Employee added. The account invitation has been queued.",
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
          ? `${employee.employeeCode} · ${employee.email}`
          : "Add their details. We’ll take care of the invitation."
      }
      wide
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-body">
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
                !employee
                  ? "An existing, unlinked Employee account with this email will be linked automatically."
                  : undefined
              }
            >
              <input
                name="email"
                type="email"
                defaultValue={employee?.email}
                required
                disabled={!!employee}
                placeholder="alex@company.com"
              />
            </Field>
            <Field label="Phone number">
              <input
                name="phone"
                defaultValue={employee?.phone}
                maxLength={30}
                placeholder="+91 98765 43210"
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
            <Field label="Department">
              <input
                name="department"
                defaultValue={employee?.department}
                required
                maxLength={120}
                placeholder="e.g. Engineering"
              />
            </Field>
            <Field label="Designation">
              <input
                name="designation"
                defaultValue={employee?.designation}
                required
                maxLength={120}
                placeholder="e.g. Software Engineer"
              />
            </Field>
            <Field label="Assigned customer">
              <select
                name="customer"
                disabled={customers.isPending || !!customers.error}
                defaultValue={employee?.assignedClientOrCustomer || ""}
              >
                <option value="">No assignment</option>
                {customers.data?.data.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Profile photo URL">
              <input
                name="profilePhotoUrl"
                type="url"
                defaultValue={employee?.profilePhotoUrl}
                placeholder="https://…"
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
              <div className="flex" style={{ flexWrap: "wrap", marginTop: 8 }}>
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
                  <select
                    value={payType}
                    onChange={(e) =>
                      setPayType(e.target.value as "SALARIED" | "HOURLY")
                    }
                  >
                    <option value="SALARIED">Monthly salary</option>
                    <option value="HOURLY">Hourly rate</option>
                  </select>
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
                <Field label="Salary divisor">
                  <select
                    name="divisor"
                    defaultValue={employee?.salaryDivisorPolicy || "FIXED_30"}
                  >
                    <option value="FIXED_30">30 fixed days</option>
                    <option value="FIXED_26">26 working days</option>
                    <option value="CALENDAR">Actual calendar days</option>
                  </select>
                </Field>
              </>
            )}
            {employee && (
              <Field
                label="Employment status"
                hint="Inactive employees cannot record new attendance."
              >
                <select name="status" defaultValue={employee.status}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
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
          {employee && (
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                mutate(
                  `/users/${employee.userId}/invitations/resend`,
                  "POST",
                  {},
                )
                  .then(() => toast("Invitation queued."))
                  .catch((e) => toast(e.message, true))
              }
            >
              <Mail size={14} />
              Resend invite
            </Button>
          )}
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
