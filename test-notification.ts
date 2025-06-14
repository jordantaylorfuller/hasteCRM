import {
  playNotificationSound,
  notifyAndWaitForInput,
  notifyTaskComplete,
  notifyError,
} from "./apps/api/src/common/utils/notification";
import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function testNotifications() {
  console.log("🧪 Testing Notification System\n");

  // Test 1: Simple notification sound
  console.log("1. Playing single notification sound...");
  await playNotificationSound();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Test 2: Input required notification
  await notifyAndWaitForInput("Please press ENTER to continue testing...");

  await new Promise((resolve) => {
    rl.question("Press ENTER to continue: ", () => {
      resolve(undefined);
    });
  });

  // Test 3: Task complete notification
  console.log("\n2. Simulating task completion...");
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await notifyTaskComplete("Phase 1 Authentication Implementation");

  // Test 4: Error notification
  console.log("\n3. Simulating error...");
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await notifyError("Failed to connect to database");

  // Test 5: Multiple notifications
  console.log("\n4. Playing multiple notification sounds...");
  for (let i = 0; i < 3; i++) {
    console.log(`   Beep ${i + 1}/3`);
    await playNotificationSound();
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log("\n✅ Notification tests complete!");
  rl.close();
}

// Run the test
testNotifications().catch(console.error);
