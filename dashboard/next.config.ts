import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* Force this app as the Turbopack root so the parent dir (other project) is not used */
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
