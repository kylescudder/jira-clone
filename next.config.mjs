/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true
  },
  typescript: {
    ignoreBuildErrors: true
  },
  images: {
    unoptimized: true
  },
  // Expose env vars to the client bundle where needed
  // Note: values defined here become public at build time
  env: {
    // Keep existing server-side usage of JIRA_BASE_URL working in client components
    JIRA_BASE_URL: process.env.JIRA_BASE_URL,
    // Also support the conventional public-prefixed name for future client usage
    NEXT_PUBLIC_JIRA_BASE_URL:
      process.env.NEXT_PUBLIC_JIRA_BASE_URL ?? process.env.JIRA_BASE_URL
  }
}

export default nextConfig
