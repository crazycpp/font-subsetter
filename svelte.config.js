import adapter from "@sveltejs/adapter-static";

const requestedBasePath = process.env.BASE_PATH ?? "";
const base =
  requestedBasePath === "/" ? "" : requestedBasePath.replace(/\/+$/, "");

if (base && !base.startsWith("/")) {
  throw new Error("BASE_PATH must be empty or begin with '/'.");
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({ fallback: "200.html" }),
    paths: { base },
    prerender: { entries: ["*"] },
  },
};

export default config;
