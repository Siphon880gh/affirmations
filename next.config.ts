import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { STATIC_BASE_PATH_SENTINEL } from "./lib/static-base-path";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: process.env.NODE_ENV === "production" ? STATIC_BASE_PATH_SENTINEL : "",
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
