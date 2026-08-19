import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "bcryptjs",
    "@sendgrid/mail",
    "sharp",
  ],
};

export default nextConfig;
