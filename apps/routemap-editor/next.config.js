/** @type {import('next').NextConfig} */
const nextConfig = {
  // @repo/routemap ships raw TS; Next must transpile it.
  transpilePackages: ["@repo/routemap"],
};

export default nextConfig;
