import worker from "../../src/worker.mjs";

// Cloudflare Pages Functions adapter for /api/* requests.
export async function onRequest(context) {
  return worker.fetch(context.request, context.env, context);
}
