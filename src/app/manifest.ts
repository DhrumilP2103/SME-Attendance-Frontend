import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SME Attendance",
    short_name: "SME",
    description: "Employees, in sync.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f9f8",
    theme_color: "#21765b",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
