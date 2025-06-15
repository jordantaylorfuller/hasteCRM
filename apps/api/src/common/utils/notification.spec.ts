// Mock child_process and util before imports
const mockExec = jest.fn();
jest.mock("child_process", () => ({
  exec: mockExec,
}));

const mockExecAsync = jest.fn();
jest.mock("util", () => ({
  promisify: jest.fn(() => mockExecAsync),
}));

import {
  playNotificationSound,
  notifyAndWaitForInput,
  notifyTaskComplete,
  notifyError,
} from "./notification";

describe("Notification Utils", () => {
  let originalPlatform: PropertyDescriptor;
  let consoleLogSpy: jest.SpyInstance;
  let stdoutWriteSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExecAsync.mockResolvedValue({});
    
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    stdoutWriteSpy = jest.spyOn(process.stdout, "write").mockImplementation();
    
    originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    stdoutWriteSpy.mockRestore();
    if (originalPlatform) {
      Object.defineProperty(process, "platform", originalPlatform);
    }
  });

  describe("playNotificationSound", () => {
    it("should play sound on macOS", async () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      
      await playNotificationSound();
      
      expect(mockExecAsync).toHaveBeenCalledWith(
        "afplay /System/Library/Sounds/Ping.aiff"
      );
    });

    it("should play sound on Linux", async () => {
      Object.defineProperty(process, "platform", { value: "linux" });
      
      await playNotificationSound();
      
      expect(mockExecAsync).toHaveBeenCalledWith(
        "paplay /usr/share/sounds/freedesktop/stereo/message.oga"
      );
    });

    it("should fallback to beep on Linux if paplay fails", async () => {
      Object.defineProperty(process, "platform", { value: "linux" });
      mockExecAsync
        .mockRejectedValueOnce(new Error("paplay not found"))
        .mockResolvedValueOnce({});
      
      await playNotificationSound();
      
      expect(mockExecAsync).toHaveBeenCalledTimes(2);
      expect(mockExecAsync).toHaveBeenLastCalledWith('echo -e "\\a"');
    });

    it("should play sound on Windows", async () => {
      Object.defineProperty(process, "platform", { value: "win32" });
      
      await playNotificationSound();
      
      expect(mockExecAsync).toHaveBeenCalledWith(
        "powershell -c [console]::beep(1000,500)"
      );
    });

    it("should fallback to console bell on error", async () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      mockExecAsync.mockRejectedValue(new Error("Command failed"));
      
      await playNotificationSound();
      
      expect(stdoutWriteSpy).toHaveBeenCalledWith("\x07");
    });

    it("should handle unknown platform", async () => {
      Object.defineProperty(process, "platform", { value: "unknown" });
      
      await playNotificationSound();
      
      // On unknown platform, no sound is played
      expect(mockExecAsync).not.toHaveBeenCalled();
      expect(stdoutWriteSpy).not.toHaveBeenCalled();
    });
  });

  describe("notifyAndWaitForInput", () => {
    it("should display message and play sound 3 times", async () => {
      await notifyAndWaitForInput("Please confirm action");
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("USER INPUT REQUIRED"));
      expect(consoleLogSpy).toHaveBeenCalledWith("Please confirm action");
      expect(mockExecAsync).toHaveBeenCalledTimes(3);
    });
  });

  describe("notifyTaskComplete", () => {
    it("should display task completion message and play sound", async () => {
      const mockDate = new Date("2025-06-14T12:00:00");
      jest.spyOn(global, "Date").mockImplementation(() => mockDate);
      
      await notifyTaskComplete("Database backup");
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("TASK COMPLETE"));
      expect(consoleLogSpy).toHaveBeenCalledWith("Task: Database backup");
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("12:00:00"));
      expect(mockExecAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe("notifyError", () => {
    it("should display error message and play error sound on macOS", async () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      
      await notifyError("Connection failed");
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("ERROR OCCURRED"));
      expect(consoleLogSpy).toHaveBeenCalledWith("Connection failed");
      expect(mockExecAsync).toHaveBeenCalledWith(
        "afplay /System/Library/Sounds/Basso.aiff"
      );
    });

    it("should use double beep on non-macOS platforms", async () => {
      Object.defineProperty(process, "platform", { value: "linux" });
      
      await notifyError("Connection failed");
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("ERROR OCCURRED"));
      expect(stdoutWriteSpy).toHaveBeenCalledWith("\x07\x07");
    });

    it("should handle error gracefully if macOS sound fails", async () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      mockExecAsync.mockRejectedValue(new Error("Sound not found"));
      
      await notifyError("Connection failed");
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("ERROR OCCURRED"));
      expect(mockExecAsync).toHaveBeenCalledWith(
        "afplay /System/Library/Sounds/Basso.aiff"
      );
      // The error is caught and ignored - no fallback
      expect(stdoutWriteSpy).not.toHaveBeenCalledWith("\x07\x07");
    });
  });
});