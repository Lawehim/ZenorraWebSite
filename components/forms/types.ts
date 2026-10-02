export type SubmitOutcome =
  | { ok: true; reference: string; firstName?: string }
  | { ok: false; message: string; field?: string; errors?: Record<string, string>; status?: number };

/** POST JSON to a public endpoint, returning the parsed outcome; throws only on network failure. */
export async function postJson(url: string, body: unknown): Promise<SubmitOutcome> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  try {
    return (await res.json()) as SubmitOutcome;
  } catch {
    return { ok: false, message: "Something went wrong on our side. Your details are still here — please try again." };
  }
}
