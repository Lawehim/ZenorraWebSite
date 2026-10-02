// Runs in each integration worker before tests import the Prisma client.
process.env.DATABASE_URL = "postgresql://zenorra:zenorra-local-dev@127.0.0.1:54339/zenorra_test?schema=public";
process.env.SESSION_SECRET = "test-secret-test-secret-test-secret";
process.env.MEDIA_DIR = ".data/test-uploads";
