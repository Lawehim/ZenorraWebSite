import { db } from "@/lib/db";
import { enqueue, processQueue, MAX_ATTEMPTS, type Transport } from "@/server/services/notifications";
import { resetDb } from "./helpers";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

const now = new Date("2026-09-02T09:00:00Z");
const later = (mins: number) => new Date(now.getTime() + mins * 60_000);

describe("notification outbox (FR-NOTIF-009, TC-NOTIF-004/005)", () => {
  it("delivers queued messages exactly once", async () => {
    const sent: string[] = [];
    const t: Transport = { send: async (n) => void sent.push(n.to) };
    await enqueue({ channel: "email", to: "ada@x.ng", template: "lead.received", payload: {} });
    await processQueue(t, now);
    await processQueue(t, later(60));
    expect(sent).toEqual(["ada@x.ng"]);
    expect((await db.notification.findFirstOrThrow()).status).toBe("SENT");
  });

  it("retries with backoff and succeeds on the third attempt", async () => {
    let calls = 0;
    const t: Transport = {
      send: async () => {
        calls++;
        if (calls < 3) throw new Error("429 Too Many Requests");
      },
    };
    await enqueue({ channel: "email", to: "ada@x.ng", template: "lead.received", payload: {} });
    await processQueue(t, now);
    await processQueue(t, now); // not due yet — backoff respected
    expect(calls).toBe(1);
    await processQueue(t, later(3));
    await processQueue(t, later(30));
    expect(calls).toBe(3);
    expect((await db.notification.findFirstOrThrow()).status).toBe("SENT");
  });

  it("marks the message failed after the final attempt and logs it on the lead", async () => {
    const lead = await db.lead.create({ data: { reference: "ZN-2026-00001", name: "Ada", source: "advisor" } });
    const t: Transport = { send: async () => Promise.reject(new Error("provider down")) };
    await enqueue({ channel: "sms", to: "+2348039921140", template: "booking.sms", payload: {}, leadId: lead.id });
    for (let i = 0; i < MAX_ATTEMPTS; i++) await processQueue(t, later(i * 40));
    const n = await db.notification.findFirstOrThrow();
    expect(n.status).toBe("FAILED");
    expect(n.lastError).toBe("provider down");
    expect(await db.leadActivity.count({ where: { leadId: lead.id, type: "delivery-failed" } })).toBe(1);
    expect(await db.lead.count()).toBe(1); // the lead itself is never lost
  });
});
