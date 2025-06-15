import { test as base } from "@playwright/test";

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface TestFixtures {
  testUser: TestUser;
  authenticatedPage: any;
}

export const test = base.extend<TestFixtures>({
  testUser: async ({}, use) => {
    // Create a unique test user for each test
    const timestamp = Date.now();
    const user: TestUser = {
      email: `test-${timestamp}@example.com`,
      password: "Test123!@#",
      firstName: "Test",
      lastName: "User",
    };
    await use(user);
  },

  authenticatedPage: async ({ page, testUser }, use) => {
    // Set up authenticated state
    // In a real app, you would either:
    // 1. Use API to create user and get auth token
    // 2. Use UI to register/login
    // For now, we'll use the UI approach

    await use(page);
  },
});

export { expect } from "@playwright/test";
