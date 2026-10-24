import { request as httpRequest } from "node:http";
import { expect, test } from "@playwright/test";

test("analytics validates anonymous milestones and accepts idempotent writes", async ({ request, baseURL }) => {
  const payload = { event: "home_viewed", mode: "public", session: crypto.randomUUID() };
  const post = (data: unknown, headers?: Record<string, string>) => request.post("/api/analytics", { data, headers });
  expect((await post({ ...payload, riot_id: "NeverStored#NA1" })).status()).toBe(400);
  expect((await post({ ...payload, event: "arbitrary" })).status()).toBe(400);
  expect((await post({ ...payload, session: "player-id" })).status()).toBe(400);
  expect((await post(payload, { origin: "https://other.invalid" })).status()).toBe(403);
  expect((await post(payload, { dnt: "1" })).status()).toBe(204);
  expect((await post(payload, { origin: baseURL! })).status()).toBe(204);
  expect((await post(payload, { origin: baseURL! })).status()).toBe(204);
  for (const event of ["deck_empty", "first_card_viewed"]) {
    for (const mode of ["demo", "member"]) {
      expect((await post({ ...payload, event, mode }, { origin: baseURL! })).status()).toBe(204);
      expect((await post({ ...payload, event, mode, candidate_id: "never-collected" })).status()).toBe(400);
    }
  }
});

test("analytics rejects a chunked upload before the sender finishes its body", async ({ baseURL }) => {
  const status = await new Promise<number | undefined>((resolve, reject) => {
    const req = httpRequest(`${baseURL}/api/analytics`, {
      method: "POST", headers: { "Content-Type": "application/json", "Transfer-Encoding": "chunked" },
    }, (response) => {
      response.resume();
      req.end();
      resolve(response.statusCode);
    });
    req.setTimeout(5000, () => req.destroy(new Error("Oversized upload was not rejected before the body ended")));
    req.on("error", reject);
    // No Content-Length and no end(): the server must stop reading as soon as it exceeds its cap.
    req.write(" ".repeat(513));
  });
  expect(status).toBe(413);
});
