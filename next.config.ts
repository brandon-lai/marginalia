import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // jsdom, Readability and postgres are server-only. Keep them out of the
  // client graph — a server-only import inside a module the client bundle
  // reaches produces UnhandledSchemeError on node: builtins.
  serverExternalPackages: ["jsdom", "@mozilla/readability", "postgres", "shiki"],

  // The demo vault is read from disk at runtime through a computed path, so
  // nothing imports it and Next's file tracing would leave it out of the
  // serverless bundle entirely. The build stays green and every route 500s on
  // a missing directory. Declare it.
  outputFileTracingIncludes: {
    "/**": ["./demo-vault/**/*"],
  },
}

export default nextConfig
