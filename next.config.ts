import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native addon; keep it external so route handlers can
  // require the prebuilt binary instead of trying to bundle it.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
