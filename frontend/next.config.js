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
  // Development only: the QA recipe drives the dev server at 127.0.0.1:3399
  // (so the browser and the API on 127.0.0.1:8899 are one site for cookies),
  // and Next 16 treats a bare IP as a foreign origin and answers 403 for the
  // /_next/ chunks it requests — the login form then never hydrates.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "https", hostname: "**" },
    ],
    // A month, not the 60-second default. The default made the optimizer
    // re-validate every variant against /media/ once a minute per reader —
    // and uploaded news photos never change under the same filename (Django
    // suffixes re-uploads). Combined with scripts/deploy-frontend.sh carrying
    // .next/cache/images across deploys, this is what keeps a thumbnail from
    // ever being re-encoded in front of a reader.
    minimumCacheTTL: 2678400,
    // The optimizer refuses upstreams that resolve to a private IP (an SSRF
    // guard). In development the API — and so every /media/ photo — lives on
    // 127.0.0.1, which left every image on the dev site a 400. Development
    // only: production reads its photos through the public hostname.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
  },
};

module.exports = nextConfig;
