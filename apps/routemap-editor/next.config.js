/** @type {import('next').NextConfig} */
const nextConfig = {
  // @repo/routemap ships raw TS; Next must transpile it.
  transpilePackages: ["@repo/routemap"],

  // A static bundle, because nothing here needs a server: no route handlers, no
  // server actions, no cookies. The editor talks to the MediaWiki API straight from
  // the browser (`origin=*`) and keeps diagrams in localStorage.
  //
  // That keeps the hosting choice open — the same `out/` directory works on Toolforge,
  // GitHub Pages or any static host — and means there's no server process to run,
  // scale or attack.
  output: "export",

  // Export has no image optimiser. Nothing here uses `next/image` (BSicons and logos
  // are plain <img>s pointing at Commons), but this keeps the build honest if someone
  // reaches for it later.
  images: { unoptimized: true },
};

export default nextConfig;
