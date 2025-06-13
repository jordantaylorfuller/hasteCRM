import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Play a system notification sound
 * Works on macOS, Linux, and Windows
 */
export async function playNotificationSound(): Promise<void> {
  try {
    const platform = process.platform;

    if (platform === "darwin") {
      // macOS - play system sound
      await execAsync("afplay /System/Library/Sounds/Ping.aiff");
    } else if (platform === "linux") {
      // Linux - try different methods
      try {
        await execAsync(
          "paplay /usr/share/sounds/freedesktop/stereo/message.oga",
        );
      } catch {
        // Fallback to beep
        await execAsync('echo -e "\\a"');
      }
    } else if (platform === "win32") {
      // Windows - use PowerShell
      await execAsync("powershell -c [console]::beep(1000,500)");
    }
  } catch (error) {
    // Fallback to console bell
    process.stdout.write("\x07");
  }
}

/**
 * Play a sound and wait for user input
 * @param message - Message to display
 */
export async function notifyAndWaitForInput(message: string): Promise<void> {
  console.log("\n" + "=".repeat(50));
  console.log("🔔 USER INPUT REQUIRED");
  console.log("=".repeat(50));
  console.log(message);
  console.log("=".repeat(50) + "\n");

  // Play notification sound 3 times
  for (let i = 0; i < 3; i++) {
    await playNotificationSound();
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * Notify when a long-running task completes
 * @param taskName - Name of the completed task
 */
export async function notifyTaskComplete(taskName: string): Promise<void> {
  console.log("\n" + "=".repeat(50));
  console.log("✅ TASK COMPLETE");
  console.log("=".repeat(50));
  console.log(`Task: ${taskName}`);
  console.log(`Time: ${new Date().toLocaleTimeString()}`);
  console.log("=".repeat(50) + "\n");

  // Play notification sound
  await playNotificationSound();
}

/**
 * Notify on error with sound
 * @param error - Error message
 */
export async function notifyError(error: string): Promise<void> {
  console.log("\n" + "=".repeat(50));
  console.log("❌ ERROR OCCURRED");
  console.log("=".repeat(50));
  console.log(error);
  console.log("=".repeat(50) + "\n");

  // Play error sound (lower pitch)
  if (process.platform === "darwin") {
    await execAsync("afplay /System/Library/Sounds/Basso.aiff").catch(() => {
      return undefined;
    });
  } else {
    // Double beep for error
    process.stdout.write("\x07\x07");
  }
}
