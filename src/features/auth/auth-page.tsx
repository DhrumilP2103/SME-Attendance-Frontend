"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Eye,
  EyeOff,
  ArrowRight,
  Check,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Logo, Button, Field, Avatar, Select } from "@/components/ui";
import { useData } from "@/app/providers";
import { api, mutate, clearSessionToken } from "@/lib/api";
import type { AuthUser } from "@/types";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Enter your password."),
  rememberMe: z.boolean(),
});
async function landingPath() {
  try {
    const me = await api<AuthUser>("/auth/me");
    return me.data.role === "HR" ? "/attendance" : "/dashboard";
  } catch {
    return "/dashboard";
  }
}
export default function AuthPage({ mode }: { mode: string }) {
  const router = useRouter(),
    client = useQueryClient();
  const options = useData<{ demoAvailable: boolean }>("/auth/options");
  const [show, setShow] = useState(false),
    [showNew, setShowNew] = useState(false),
    [showConfirm, setShowConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [role, setRole] = useState("ADMIN");
  const tokenRef = useRef("");
  const login = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });
  useEffect(() => {
    tokenRef.current ||=
      new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    if (tokenRef.current)
      window.history.replaceState(null, "", window.location.pathname);
  }, []);
  const isLogin = mode === "login",
    forgot = mode === "forgot-password";
  const title = isLogin
    ? "Welcome back."
    : forgot
      ? "Forgot your password?"
      : mode === "activate-account"
        ? "Welcome to the team."
        : "A fresh start.";
  async function signIn(body: z.infer<typeof loginSchema>) {
    setBusy(true);
    setError("");
    try {
      await mutate("/auth/login", "POST", body);
      client.clear();
      router.replace(await landingPath());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function demo() {
    setBusy(true);
    setError("");
    try {
      clearSessionToken();
      await mutate("/auth/demo", "POST", { role });
      client.clear();
      router.replace(await landingPath());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-art">
        <Logo />
        <div className="auth-copy">
          <span className="badge badge-present">
            <Sparkles size={12} /> A little less admin. A lot more clarity.
          </span>
          <h1 style={{ marginTop: 24 }}>
            Employees.
            <br />
            Your progress.
            <br />
            All in sync.
          </h1>
          <p>
            Make every workday count. One thoughtful workspace for attendance,
            your team, and everything in between.
          </p>
          <div className="auth-illustration">
            <div className="row">
              <Avatar name="Your Team" />
              <div>
                <strong style={{ fontSize: 13 }}>
                  A great day starts together
                </strong>
                <p style={{ fontSize: 10, color: "#8ba08e" }}>
                  Simpler attendance. Happier teams.
                </p>
              </div>
              <Check size={18} className="green" />
            </div>
            <div className="progress-track">
              <span style={{ width: "85%" }} />
            </div>
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                marginTop: 12,
                fontSize: 10,
                color: "#829587",
              }}
            >
              <span>Less paperwork</span>
              <span>More possibilities ↗</span>
            </div>
          </div>
        </div>
        <p className="auth-note">Built for the people behind your business.</p>
      </section>
      <main className="auth-main">
        <div className="auth-form">
          <div className="mobile-logo">
            <Logo />
          </div>
          <h1>{title}</h1>
          <p>
            {isLogin
              ? "Sign in to bring your workday into focus."
              : forgot
                ? "We’ll send you a link to get back into your account."
                : "Choose a strong password to secure your workspace."}
          </p>
          {message ? (
            <>
              <div className="notice">
                <Check size={18} />
                {message}
              </div>
              <Link href="/login" className="btn btn-primary">
                Back to sign in <ArrowRight size={16} />
              </Link>
            </>
          ) : isLogin ? (
            <form onSubmit={login.handleSubmit(signIn)}>
              <Field label="Email address">
                <input
                  {...login.register("email")}
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="username"
                  required
                />
              </Field>
              <Field label="Password">
                <div className="password-input">
                  <input
                    {...login.register("password")}
                    type={show ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={show ? "Hide password" : "Show password"}
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </Field>
              <div className="auth-extras">
                <label className="check-label">
                  <input type="checkbox" {...login.register("rememberMe")} />
                  Remember me
                </label>
                <Link href="/forgot-password">Forgot password?</Link>
              </div>
              {error && (
                <div role="alert" className="auth-error">
                  {error}
                </div>
              )}
              {login.formState.errors.email && (
                <p className="form-error">Enter a valid email address.</p>
              )}
              <Button type="submit" busy={busy}>
                Sign in <ArrowRight size={16} />
              </Button>
            </form>
          ) : (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                setError("");
                const form = new FormData(event.currentTarget);
                try {
                  const password = String(form.get("password") || "");
                  if (!forgot && password !== form.get("confirm"))
                    throw new Error("The passwords do not match.");
                  if (!forgot && !tokenRef.current)
                    throw new Error(
                      "Open the full link from your invitation or reset email.",
                    );
                  const result = await mutate<{ message: string }>(
                    forgot
                      ? "/auth/forgot-password"
                      : mode === "activate-account"
                        ? "/auth/activate"
                        : "/auth/reset-password",
                    "POST",
                    forgot
                      ? { email: form.get("email") }
                      : { token: tokenRef.current, password },
                  );
                  setMessage(result.data.message);
                  clearSessionToken();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {forgot ? (
                <Field label="Email address">
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="you@company.com"
                    autoComplete="email"
                  />
                </Field>
              ) : (
                <>
                  <Field label="New password" hint="At least 12 characters.">
                    <div className="password-input">
                      <input
                        name="password"
                        type={showNew ? "text" : "password"}
                        minLength={12}
                        maxLength={128}
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={showNew ? "Hide password" : "Show password"}
                        onClick={() => setShowNew(!showNew)}
                      >
                        {showNew ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </Field>
                  <Field label="Confirm password">
                    <div className="password-input">
                      <input
                        name="confirm"
                        type={showConfirm ? "text" : "password"}
                        minLength={12}
                        maxLength={128}
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={
                          showConfirm ? "Hide password" : "Show password"
                        }
                        onClick={() => setShowConfirm(!showConfirm)}
                      >
                        {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </Field>
                </>
              )}
              {error && (
                <div role="alert" className="auth-error">
                  {error}
                </div>
              )}
              <Button busy={busy}>
                {forgot ? "Send reset link" : "Save password"}
                <ArrowRight size={16} />
              </Button>
            </form>
          )}
          {isLogin && options.data?.data.demoAvailable && (
            <div className="auth-demo">
              <Select
                compact
                ariaLabel="Demo role"
                className="demo-select"
                value={role}
                onChange={setRole}
                options={[
                  { value: "ADMIN", label: "Administrator workspace" },
                  { value: "HR", label: "HR workspace" },
                  { value: "EMPLOYEE", label: "Employee workspace" },
                ]}
              />
              <Button variant="secondary" busy={busy} onClick={demo}>
                Explore local demo <ArrowRight size={15} />
              </Button>
              <p>Development only · Sample data saved in local MongoDB.</p>
            </div>
          )}
          <div className="auth-bottom">
            <ShieldCheck
              size={13}
              style={{ verticalAlign: "middle", marginRight: 5 }}
            />{" "}
            Secure access. By invitation only.
          </div>
          {!isLogin && (
            <p className="auth-bottom">
              <Link href="/login">← Back to sign in</Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
