import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  typedRoutes: false,
  serverExternalPackages: ["better-sqlite3", "@libsql/client", "bcryptjs", "drizzle-orm"],
  turbopack: {
    root: process.cwd()
  }
};

export default nextConfig;
