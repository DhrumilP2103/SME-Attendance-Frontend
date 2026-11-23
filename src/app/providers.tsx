"use client";
import {
  QueryClient,
  QueryClientProvider,
  useIsFetching,
  useQuery,
} from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, X, AlertCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { AuthUser } from "@/types";

const ToastContext = createContext<(message: string, error?: boolean) => void>(
  () => {},
);
export const useToast = () => useContext(ToastContext);
export function useUser() {
  return useQuery({
    queryKey: ["auth"],
    queryFn: () => api<AuthUser>("/auth/me"),
    retry: false,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}
export function useData<T>(path: string, enabled = true) {
  return useQuery({
    queryKey: [path],
    queryFn: () => api<T>(path),
    enabled,
    retry: false,
    staleTime: 15000,
  });
}
function QueryLoadingIndicator() {
  const fetching = useIsFetching();
  if (!fetching) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed top-4 right-4 z-100 flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink shadow-sm"
    >
      <Loader2 size={16} className="spin" aria-hidden="true" />
      Loading data…
    </div>
  );
}

export default function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: true },
        },
      }),
  );
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const notify = useCallback(
    (message: string, error = false) => setToast({ message, error }),
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);
  return (
    <QueryClientProvider client={client}>
      <QueryLoadingIndicator />
      <ToastContext.Provider value={notify}>
        {children}
        {toast && (
          <div
            className={`toast ${toast.error ? "toast-error" : ""}`}
            role={toast.error ? "alert" : "status"}
          >
            {toast.error ? (
              <AlertCircle size={20} />
            ) : (
              <CheckCircle2 size={20} />
            )}
            <span>{toast.message}</span>
            <button aria-label="Dismiss message" onClick={() => setToast(null)}>
              <X size={16} />
            </button>
          </div>
        )}
      </ToastContext.Provider>
    </QueryClientProvider>
  );
}
