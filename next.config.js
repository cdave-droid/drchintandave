import { withPayload } from "@payloadcms/next/withPayload";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    reactCompiler: false,
  },
  async rewrites() {
    return [
      {
        source: "/api/predict",
        destination:
          process.env.MORTPRED_API_URL || "http://localhost:8000/api/predict",
      },
    ];
  },
};

export default withPayload(nextConfig);
