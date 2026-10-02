import fs from "node:fs";
import crypto from "node:crypto";

/** Create .env on first run with the local database URL and a random session secret. */
export function ensureEnv(databaseUrl) {
  if (fs.existsSync(".env")) return;
  const secret = crypto.randomBytes(32).toString("base64url");
  fs.writeFileSync(
    ".env",
    [
      `DATABASE_URL="${databaseUrl}"`,
      `SESSION_SECRET="${secret}"`,
      `APP_URL="http://localhost:3000"`,
      `# Notifications are logged to the Notification table until providers are configured:`,
      `# RESEND_API_KEY=""`,
      `# TERMII_API_KEY=""`,
      `# TERMII_SENDER_ID="Zenorra"`,
      `MEDIA_DIR="uploads"`,
      "",
    ].join("\n"),
  );
  console.log("Created .env with local defaults.");
}
