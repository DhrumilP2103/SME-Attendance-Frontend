export type Role = "ADMIN" | "HR" | "EMPLOYEE" | "CUSTOMER";
export type Permission =
  | "canLogin"
  | "canTakeSelfAttendance"
  | "canMarkTeamAttendance"
  | "canToggleOT"
  | "canViewAllAttendance"
  | "canGenerateReports"
  | "canExportReports"
  | "canViewSalaryImpact"
  | "canConfigureCronEOD"
  | "canManageRights"
  | "canManageEmployees";
export interface Company {
  name: string;
  currency: string;
  timezone: string;
}
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  effectivePermissions: Record<Permission, boolean>;
  employeeId: string | null;
  company: Company;
  demo: boolean;
  demoWorkspace: boolean;
}
export interface Summary {
  total: number;
  present: number;
  absent: number;
  halfDay: number;
  leave: number;
  holiday: number;
  unmarked: number;
  incomplete: number;
  overtime: number;
  otAmount: number;
  totalHours: number;
}
export interface Envelope<T> {
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    summary?: Summary;
    departments?: string[];
  };
}
export interface AttendanceRow {
  id: string | null;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  email: string;
  department: string;
  designation: string;
  workDate: string;
  status: string;
  inTime: string | null;
  outTime: string | null;
  totalHours: number;
  regularMinutes: number;
  regularApproved: boolean;
  isIncomplete: boolean;
  isOvertime: boolean;
  otAmount?: number;
  otRemark?: string;
  version: number;
  shiftStart: string;
}
export interface Employee {
  _id: string;
  userId: string;
  fullName: string;
  employeeCode: string;
  email: string;
  phone: string;
  joiningDate: string;
  department: string;
  designation: string;
  payType: "SALARIED" | "HOURLY";
  baseSalary?: number;
  hourlyRate?: number;
  salaryDivisorPolicy: string;
  status: "ACTIVE" | "INACTIVE";
  shift: {
    startTime: string;
    endTime: string;
    graceMinutes: number;
    standardDailyHours: number;
  };
  weeklyOffDays: number[];
  assignedClientOrCustomer: string | null;
  profilePhotoUrl: string;
  version: number;
}
export interface DashboardData extends Summary {
  date: string;
  company: Company;
  headcount: number;
  attendanceRate: number;
  trend: (Summary & { date: string; label: string })[];
  departments: { name: string; total: number; present: number }[];
  recent: AttendanceRow[];
}
export interface PayRow {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  payType: string;
  month: string;
  currency: string;
  basePay: number;
  deductions: number;
  approvedOt: number;
  netPayable: number;
  regularMinutes: number;
  absences: number;
  unmarkedDays: number;
  completeness: string;
  warnings: string[];
  policy: { divisor: number; rounding: string; finalized: boolean };
}
export interface Account {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  activated: boolean;
  customPermissions: Partial<Record<Permission, boolean>>;
  effectivePermissions: Record<Permission, boolean>;
  invitation?: { status: string; error?: string };
}
export interface RolePolicy {
  role: Role;
  permissions: Record<Permission, boolean>;
  configurable: Permission[];
}
export interface EodConfig {
  isEnabled: boolean;
  scheduledTime: string;
  timezone: string;
  adminRecipients: string[];
  sections: {
    summary: boolean;
    absent: boolean;
    incomplete: boolean;
    overtime: boolean;
  };
  emailDelivery: string;
}
export interface EodRun {
  _id: string;
  workDate: string;
  trigger: string;
  status: string;
  createdAt: string;
  result?: string;
  error?: string;
}
