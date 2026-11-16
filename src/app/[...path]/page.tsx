import { notFound } from "next/navigation";
import AuthPage from "@/features/auth/auth-page";
import Workspace from "@/components/workspace";

const authRoutes = new Set([
  "login",
  "forgot-password",
  "reset-password",
  "activate-account",
]);
const workspaceRoutes = new Set([
  "dashboard",
  "employees",
  "attendance",
  "my-attendance",
  "reports",
  "payroll",
  "rights",
  "profile",
  "settings/company",
  "settings/eod",
]);

export default async function Page({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  const route = path.join("/");
  if (authRoutes.has(route)) return <AuthPage key={route} mode={route} />;
  if (
    workspaceRoutes.has(route) ||
    /^employees\/(new|[a-f0-9]{24})$/.test(route)
  )
    return <Workspace />;
  notFound();
}
