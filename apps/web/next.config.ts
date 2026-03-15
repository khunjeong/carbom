import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: [
    "@tripagent/ui",
    "@tripagent/types",
    "@tripagent/db",
    "@tripagent/ai",
    "@tripagent/api-clients",
  ],
};

export default nextConfig;
