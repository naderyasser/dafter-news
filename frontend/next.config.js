/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Where the build lands. Defaults to `.next`, which is what the systemd
   * service serves.
   *
   * The override exists because this repo is deployed in place: the running
   * `next start` reads `.next` from this same directory, so a `npm run build`
   * done merely to check that the code compiles overwrites the build being
   * served, and the live site starts answering from a half-new bundle until
   * something restarts it. Verify with
   *
   *   NEXT_DIST_DIR=.next-verify npm run build
   *
   * and leave the deployed build alone; only the actual deploy writes `.next`.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

module.exports = nextConfig;
