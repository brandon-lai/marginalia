import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // jsdom and Readability are server-only. Keep them out of the client graph.
  serverExternalPackages: ["jsdom", "@mozilla/readability", "postgres", "shiki"],
}

export default nextConfig
