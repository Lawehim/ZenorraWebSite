import nextJest from "next/jest.js";
import type { Config } from "jest";

// next/jest compiles with SWC — no Vite/Vitest anywhere in the toolchain.
const createJestConfig = nextJest({ dir: "./" });

const shared: Config = {
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/.data/"],
};

async function config(): Promise<Config> {
  const unit = await createJestConfig({
    ...shared,
    displayName: "unit",
    testEnvironment: "node",
    testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
  })();
  const components = await createJestConfig({
    ...shared,
    displayName: "components",
    testEnvironment: "jsdom",
    setupFilesAfterEnv: ["<rootDir>/tests/setup/jest.dom.ts"],
    testMatch: ["<rootDir>/tests/components/**/*.test.tsx"],
  })();
  const integration = await createJestConfig({
    ...shared,
    displayName: "integration",
    testEnvironment: "node",
    testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
    globalSetup: "<rootDir>/tests/setup/db.global-setup.ts",
    globalTeardown: "<rootDir>/tests/setup/db.global-teardown.ts",
    setupFiles: ["<rootDir>/tests/setup/db.env.ts"],
  })();
  return {
    projects: [unit, components, integration],
    collectCoverageFrom: ["lib/**/*.ts", "server/**/*.ts", "components/**/*.tsx", "!**/*.d.ts"],
  };
}

export default config;
