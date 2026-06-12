import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["dhtmlx-gantt"],
  turbopack: {
    // pdfjs-dist legacy build — avoids ESM worker issues in Next.js 16+ Turbopack
    resolveAlias: {
      'pdfjs-dist': 'pdfjs-dist/legacy/build/pdf',
    },
  },
};

export default nextConfig;
