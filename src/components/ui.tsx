"use client";
import {
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Loader2,
  Layers3,
  Search,
  Inbox,
} from "lucide-react";
import { initials, label } from "@/lib/format";
export {
  Select,
  type SelectOption,
  type SelectGroup,
  type SelectItem,
} from "./ui/select";
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-icon">
        <Layers3 size={23} strokeWidth={2.4} />
      </span>
      {!compact && (
        <span>
          SME<span className="brand-light">attendance</span>
        </span>
      )}
    </div>
  );
}
export function Button({
  children,
  variant = "primary",
  busy,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      aria-busy={busy || props["aria-busy"]}
      className={`btn btn-${variant} ${className}`}
    >
      {busy && <Loader2 size={16} className="spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
export function Avatar({
  name,
  size = "",
  index = 0,
  src,
}: {
  name: string;
  size?: string;
  index?: number;
  src?: string;
}) {
  const [failed, setFailed] = useState("");
  return (
    <span className={`avatar ${size} avatar-${index % 6}`}>
      {src && src !== failed ? (
        <Image
          src={src}
          alt={name}
          width={58}
          height={58}
          unoptimized
          referrerPolicy="no-referrer"
          onError={() => setFailed(src)}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            objectFit: "cover",
          }}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
export function Badge({ status }: { status: string }) {
  return (
    <span
      className={`badge badge-${status.toLowerCase().replaceAll("_", "-")}`}
    >
      <i />
      {label(status)}
    </span>
  );
}
export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading-state" role="status">
      <Loader2 className="spin" size={25} />
      <p>Loading your workspace…</p>
    </div>
  );
}
export function Empty({
  title = "No records found",
  description = "Try changing your filters or add your first record.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty-state">
      <Inbox size={32} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <CircleAlert size={26} />
      <h3>We couldn’t load this page</h3>
      <p>{error.message}</p>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function SearchInput({
  value,
  onChange,
  placeholder = "Search employees…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-input">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
export function Pagination({
  page,
  total,
  limit = 10,
  itemLabel = "records",
  onChange,
}: {
  page: number;
  total: number;
  limit?: number;
  itemLabel?: string;
  onChange: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        Showing {total ? (page - 1) * limit + 1 : 0}–
        {Math.min(page * limit, total)} of {total} {itemLabel}
      </span>
      <div>
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <ArrowLeft size={15} />
        </Button>
        <span>
          {page} / {Math.max(1, Math.ceil(total / limit))}
        </span>
        <Button
          variant="secondary"
          disabled={page * limit >= total}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          <ArrowRight size={15} />
        </Button>
      </div>
    </div>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className={wide ? "modal-wide" : ""}>
        <div className="modal-heading">
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className={description ? undefined : "sr-only"}>
              {description || title}
            </DialogDescription>
          </div>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function NumberInput(
  props: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onWheel">,
) {
  return (
    <input
      {...props}
      type="number"
      onWheel={(event) => event.currentTarget.blur()}
    />
  );
}

export function Field({
  label: text,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{text}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice">
      <CircleAlert size={18} />
      <div>{children}</div>
    </div>
  );
}
