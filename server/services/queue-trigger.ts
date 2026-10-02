// Kick the outbox after a submission so messages go out within seconds (FR-NOTIF-001's 60s target)
// without making the visitor wait. A cron hitting /api/cron/notifications is the safety net.
import { processQueue, logTransport } from "./notifications";
import { resolveTransport } from "./transports";

let scheduled = false;

export function processQueueSoon() {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    processQueue(resolveTransport() ?? logTransport).catch(() => {
      /* failures are recorded per message; never surface to the visitor */
    });
  }, 250);
}
