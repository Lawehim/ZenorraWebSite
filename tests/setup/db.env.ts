// Runs in each integration worker before tests import the Prisma client.
// DATABASE_URL comes from globalSetup (a fresh embedded Postgres on a free port).
process.env.SESSION_SECRET = "test-secret-test-secret-test-secret";
process.env.MEDIA_DIR = ".data/test-uploads";
