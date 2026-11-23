"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { useToast } from "@/app/providers";
import { Button, Select } from "@/components/ui";
import { download } from "@/lib/api";

export function ReportExport({
  endpoint,
  filters,
  filename,
  variant = "primary",
  label = "Export report",
  disabled = false,
}: {
  endpoint: string;
  filters: string;
  filename: string;
  variant?: "primary" | "secondary";
  label?: string;
  disabled?: boolean;
}) {
  const [format, setFormat] = useState("xlsx");
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  async function exportFile() {
    setExporting(true);
    try {
      const params = new URLSearchParams(filters);
      params.set("format", format);
      await download(`${endpoint}?${params}`, `${filename}.${format}`);
      toast("Your report is ready.");
    } catch (error) {
      toast((error as Error).message, true);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Select
        compact
        searchable={false}
        ariaLabel="Export format"
        value={format}
        onChange={setFormat}
        style={{ width: 94 }}
        disabled={exporting || disabled}
        options={[
          { value: "xlsx", label: "Excel" },
          { value: "pdf", label: "PDF" },
        ]}
      />
      <Button
        variant={variant}
        busy={exporting}
        disabled={disabled}
        onClick={exportFile}
      >
        <Download size={15} />
        {label}
      </Button>
    </>
  );
}
