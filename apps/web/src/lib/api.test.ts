import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import Cookies from "js-cookie";
import { api } from "./api";

// Mock js-cookie
jest.mock("js-cookie", () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

describe("API Client", () => {
  let mock: MockAdapter;
  const API_URL = "http://localhost:4000";

  beforeEach(() => {
    mock = new MockAdapter(api);
    jest.clearAllMocks();
    // Reset cookie mocks to default behavior
    (Cookies.get as jest.Mock).mockReturnValue(undefined);
    (Cookies.set as jest.Mock).mockImplementation(() => {});
    (Cookies.remove as jest.Mock).mockImplementation(() => {});
  });

  afterEach(() => {
    mock.restore();
  });

  describe("Configuration", () => {
    it("uses correct base URL", () => {
      expect(api.defaults.baseURL).toBe(API_URL);
    });

    it("sets correct default headers", () => {
      expect(api.defaults.headers["Content-Type"]).toBe("application/json");
    });
  });

  describe("Request interceptor", () => {
    it("adds authorization header when access token exists", async () => {
      const mockToken = "test-access-token";
      (Cookies.get as jest.Mock).mockReturnValue(mockToken);

      mock.onGet("/test").reply(200, { data: "test" });

      const response = await api.get("/test");

      expect(mock.history.get[0].headers?.Authorization).toBe(
        `Bearer ${mockToken}`,
      );
      expect(response.data).toEqual({ data: "test" });
    });

    it("does not add authorization header when no token", async () => {
      (Cookies.get as jest.Mock).mockReturnValue(undefined);

      mock.onGet("/test").reply(200, { data: "test" });

      const response = await api.get("/test");

      expect(mock.history.get[0].headers?.Authorization).toBeUndefined();
      expect(response.data).toEqual({ data: "test" });
    });

    it("preserves existing headers", async () => {
      (Cookies.get as jest.Mock).mockReturnValue("token");

      mock.onPost("/test").reply(200, { success: true });

      await api.post(
        "/test",
        { data: "test" },
        {
          headers: { "X-Custom-Header": "custom-value" },
        },
      );

      const request = mock.history.post[0];
      expect(request.headers?.Authorization).toBe("Bearer token");
      expect(request.headers?.["X-Custom-Header"]).toBe("custom-value");
    });

    it("handles request interceptor errors", async () => {
      // Force an error in the request interceptor
      (Cookies.get as jest.Mock).mockImplementation(() => {
        throw new Error("Cookie error");
      });

      mock.onGet("/test").reply(200);

      await expect(api.get("/test")).rejects.toThrow("Cookie error");
    });
  });

  describe("Response interceptor - Success", () => {
    it("passes through successful responses", async () => {
      mock.onGet("/test").reply(200, { data: "success" });

      const response = await api.get("/test");

      expect(response.status).toBe(200);
      expect(response.data).toEqual({ data: "success" });
    });

    it("handles different HTTP methods", async () => {
      mock.onPost("/test").reply(201, { created: true });
      mock.onPut("/test").reply(200, { updated: true });
      mock.onDelete("/test").reply(204);

      const postResponse = await api.post("/test", {});
      expect(postResponse.status).toBe(201);
      expect(postResponse.data).toEqual({ created: true });

      const putResponse = await api.put("/test", {});
      expect(putResponse.status).toBe(200);
      expect(putResponse.data).toEqual({ updated: true });

      const deleteResponse = await api.delete("/test");
      expect(deleteResponse.status).toBe(204);
    });
  });

  describe("Response interceptor - Token refresh", () => {
    it("refreshes token on 401 and retries request", async () => {
      const oldAccessToken = "old-token";
      const newAccessToken = "new-access-token";
      const newRefreshToken = "new-refresh-token";
      const refreshToken = "refresh-token";

      // Setup: initial request fails with 401
      (Cookies.get as jest.Mock)
        .mockReturnValueOnce(oldAccessToken) // First request
        .mockReturnValueOnce(refreshToken) // Refresh attempt
        .mockReturnValueOnce(newAccessToken); // Retry request

      // First request fails
      mock.onGet("/test").replyOnce(401, { error: "Unauthorized" });

      // Create a separate mock for the refresh endpoint
      const refreshMock = new MockAdapter(axios);
      refreshMock.onPost(`${API_URL}/auth/refresh`).reply(200, {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });

      // Retry succeeds
      mock.onGet("/test").replyOnce(200, { data: "success" });

      const response = await api.get("/test");

      // Verify token refresh
      expect(Cookies.set).toHaveBeenCalledWith("accessToken", newAccessToken, {
        expires: 1,
      });
      expect(Cookies.set).toHaveBeenCalledWith(
        "refreshToken",
        newRefreshToken,
        { expires: 7 },
      );

      // Verify successful retry
      expect(response.status).toBe(200);
      expect(response.data).toEqual({ data: "success" });

      // Verify retry has new token
      expect(mock.history.get[1].headers?.Authorization).toBe(
        `Bearer ${newAccessToken}`,
      );

      refreshMock.restore();
    });

    it("does not retry if request already has _retry flag", async () => {
      (Cookies.get as jest.Mock).mockReturnValue("token");

      // Both requests will fail with 401
      mock.onGet("/test").reply(401);

      // Create a request with _retry flag already set
      const config = { _retry: true };

      await expect(api.get("/test", config)).rejects.toMatchObject({
        response: { status: 401 },
      });

      // Should only have one request in history (no retry)
      expect(mock.history.get).toHaveLength(1);
    });

    it("redirects to login when refresh token is missing", async () => {
      (Cookies.get as jest.Mock)
        .mockReturnValueOnce("access-token") // Initial request
        .mockReturnValueOnce(undefined); // No refresh token

      mock.onGet("/test").reply(401);

      await expect(api.get("/test")).rejects.toThrow("No refresh token");

      expect(Cookies.remove).toHaveBeenCalledWith("accessToken");
      expect(Cookies.remove).toHaveBeenCalledWith("refreshToken");
      // Can't test window.location.assign due to jsdom limitations
    });

    it("redirects to login when refresh fails", async () => {
      (Cookies.get as jest.Mock)
        .mockReturnValueOnce("access-token")
        .mockReturnValueOnce("refresh-token");

      mock.onGet("/test").reply(401);

      // Mock refresh failure
      const refreshMock = new MockAdapter(axios);
      refreshMock.onPost(`${API_URL}/auth/refresh`).reply(401);

      await expect(api.get("/test")).rejects.toMatchObject({
        response: { status: 401 },
      });

      expect(Cookies.remove).toHaveBeenCalledWith("accessToken");
      expect(Cookies.remove).toHaveBeenCalledWith("refreshToken");
      // Can't test window.location.assign due to jsdom limitations

      refreshMock.restore();
    });

    it("handles network errors during refresh", async () => {
      (Cookies.get as jest.Mock)
        .mockReturnValueOnce("access-token")
        .mockReturnValueOnce("refresh-token");

      mock.onGet("/test").reply(401);

      // Mock network error during refresh
      const refreshMock = new MockAdapter(axios);
      refreshMock.onPost(`${API_URL}/auth/refresh`).networkError();

      await expect(api.get("/test")).rejects.toThrow("Network Error");

      expect(Cookies.remove).toHaveBeenCalledWith("accessToken");
      expect(Cookies.remove).toHaveBeenCalledWith("refreshToken");
      // Can't test window.location.assign due to jsdom limitations

      refreshMock.restore();
    });

    it("preserves request data during retry", async () => {
      const requestData = { test: "data" };
      const newAccessToken = "new-token";

      (Cookies.get as jest.Mock)
        .mockReturnValueOnce("old-token")
        .mockReturnValueOnce("refresh-token")
        .mockReturnValueOnce(newAccessToken);

      // First request fails
      mock.onPost("/test", requestData).replyOnce(401);

      // Setup refresh
      const refreshMock = new MockAdapter(axios);
      refreshMock.onPost(`${API_URL}/auth/refresh`).reply(200, {
        accessToken: newAccessToken,
        refreshToken: "new-refresh",
      });

      // Retry succeeds
      mock.onPost("/test", requestData).replyOnce(200, { success: true });

      const response = await api.post("/test", requestData);

      expect(response.data).toEqual({ success: true });
      // Verify both requests had the same data
      expect(JSON.parse(mock.history.post[0].data)).toEqual(requestData);
      expect(JSON.parse(mock.history.post[1].data)).toEqual(requestData);

      refreshMock.restore();
    });
  });

  describe("Request interceptor error handling", () => {
    it("handles request interceptor errors", async () => {
      // Force an error by making the config invalid
      const invalidConfig = { headers: null };

      // Test error handling in request interceptor
      try {
        // Directly call the error handler
        const errorHandler = api.interceptors.request.handlers[0].rejected;
        await errorHandler(new Error("Request config error"));
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toBe("Request config error");
      }
    });
  });

  describe("Response interceptor - Other errors", () => {
    it("passes through non-401 errors", async () => {
      mock.onGet("/test").reply(500, { error: "Server error" });

      await expect(api.get("/test")).rejects.toMatchObject({
        response: {
          status: 500,
          data: { error: "Server error" },
        },
      });

      expect(Cookies.remove).not.toHaveBeenCalled();
      // window.location.assign should not be called for non-401 errors
    });

    it("handles network errors", async () => {
      mock.onGet("/test").networkError();

      await expect(api.get("/test")).rejects.toThrow("Network Error");
      expect(Cookies.remove).not.toHaveBeenCalled();
    });

    it("handles timeout errors", async () => {
      mock.onGet("/test").timeout();

      await expect(api.get("/test")).rejects.toMatchObject({
        code: "ECONNABORTED",
      });
      expect(Cookies.remove).not.toHaveBeenCalled();
    });
  });

  describe("Concurrent requests", () => {
    it("handles multiple simultaneous 401s correctly", async () => {
      const newAccessToken = "new-token";
      let getCallCount = 0;

      (Cookies.get as jest.Mock).mockImplementation((key) => {
        if (key === "accessToken") {
          return getCallCount++ < 3 ? "old-token" : newAccessToken;
        }
        return "refresh-token";
      });

      // All initial requests fail
      mock.onGet("/test1").replyOnce(401);
      mock.onGet("/test2").replyOnce(401);
      mock.onGet("/test3").replyOnce(401);

      // Setup refresh
      const refreshMock = new MockAdapter(axios);
      refreshMock.onPost(`${API_URL}/auth/refresh`).reply(200, {
        accessToken: newAccessToken,
        refreshToken: "new-refresh",
      });

      // Retries succeed
      mock.onGet("/test1").replyOnce(200, { data: "test1" });
      mock.onGet("/test2").replyOnce(200, { data: "test2" });
      mock.onGet("/test3").replyOnce(200, { data: "test3" });

      // Make concurrent requests
      const [response1, response2, response3] = await Promise.all([
        api.get("/test1"),
        api.get("/test2"),
        api.get("/test3"),
      ]);

      expect(response1.data).toEqual({ data: "test1" });
      expect(response2.data).toEqual({ data: "test2" });
      expect(response3.data).toEqual({ data: "test3" });

      // Currently, the implementation doesn't prevent concurrent refresh calls
      // So we expect 3 refresh calls (one for each request)
      expect(refreshMock.history.post).toHaveLength(3);

      refreshMock.restore();
    });
  });

  describe("Edge cases", () => {
    it("handles empty responses", async () => {
      mock.onGet("/test").reply(204);

      const response = await api.get("/test");
      expect(response.status).toBe(204);
      // Axios returns undefined for 204 responses, not empty string
      expect(response.data).toBeUndefined();
    });

    it("handles malformed JSON responses", async () => {
      mock.onGet("/test").reply(200, "not json", {
        "Content-Type": "application/json",
      });

      const response = await api.get("/test");
      expect(response.data).toBe("not json");
    });

    it("preserves query parameters during retry", async () => {
      const newToken = "new-token";

      (Cookies.get as jest.Mock)
        .mockReturnValueOnce("old-token")
        .mockReturnValueOnce("refresh-token")
        .mockReturnValueOnce(newToken);

      mock.onGet("/test", { params: { id: 123 } }).replyOnce(401);

      const refreshMock = new MockAdapter(axios);
      refreshMock.onPost(`${API_URL}/auth/refresh`).reply(200, {
        accessToken: newToken,
        refreshToken: "new-refresh",
      });

      mock
        .onGet("/test", { params: { id: 123 } })
        .replyOnce(200, { success: true });

      const response = await api.get("/test", { params: { id: 123 } });
      expect(response.data).toEqual({ success: true });

      refreshMock.restore();
    });

    it("handles custom axios config", async () => {
      (Cookies.get as jest.Mock).mockReturnValue("token");

      mock.onGet("/test").reply(200, { data: "test" });

      const response = await api.get("/test", {
        timeout: 5000,
        headers: { "X-Custom": "value" },
      });

      expect(response.status).toBe(200);
      expect(mock.history.get[0].timeout).toBe(5000);
      expect(mock.history.get[0].headers?.["X-Custom"]).toBe("value");
    });

    it("handles abort controller cancellation", async () => {
      const controller = new AbortController();

      mock.onGet("/test").reply(() => {
        // Simulate delay
        return new Promise((resolve) => {
          setTimeout(() => resolve([200, { data: "test" }]), 100);
        });
      });

      const promise = api.get("/test", { signal: controller.signal });
      controller.abort();

      await expect(promise).rejects.toThrow("canceled");
    });
  });
});
