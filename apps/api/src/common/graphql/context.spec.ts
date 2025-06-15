import { createGraphQLContext } from "./context";

describe("createGraphQLContext", () => {
  it("should add missing Passport methods to request", () => {
    const req: any = {};
    const res = {};
    
    createGraphQLContext({ req, res });
    
    expect(req.login).toBeDefined();
    expect(req.logIn).toBeDefined();
    expect(req.logout).toBeDefined();
    expect(req.logOut).toBeDefined();
    expect(req.isAuthenticated).toBeDefined();
    expect(context).toEqual({ req, res });
    
    // Test that the methods work correctly
    expect(req.login()).toBeUndefined();
    expect(req.logIn()).toBeUndefined();
    expect(req.logout()).toBeUndefined();
    expect(req.logOut()).toBeUndefined();
    expect(req.isAuthenticated()).toBe(false);
  });

  it("should preserve existing Passport methods", () => {
    const mockLogin = jest.fn();
    const mockLogout = jest.fn();
    const mockIsAuthenticated = jest.fn().mockReturnValue(true);
    
    const req: any = {
      user: { id: "123" },
      login: mockLogin,
      logIn: mockLogin,
      logout: mockLogout,
      logOut: mockLogout,
      isAuthenticated: mockIsAuthenticated,
    };
    const res = {};
    
    createGraphQLContext({ req, res });
    
    expect(req.login).toBe(mockLogin);
    expect(req.logIn).toBe(mockLogin);
    expect(req.logout).toBe(mockLogout);
    expect(req.logOut).toBe(mockLogout);
    expect(req.isAuthenticated).toBe(mockIsAuthenticated);
    expect(context).toEqual({ req, res });
  });

  it("should handle null request", () => {
    const req = null;
    const res = {};
    
    createGraphQLContext({ req, res });
    
    expect(context).toEqual({ req, res });
  });

  it("should handle undefined request", () => {
    const req = undefined;
    const res = {};
    
    createGraphQLContext({ req, res });
    
    expect(context).toEqual({ req, res });
  });

  it("should set isAuthenticated to return true when user exists", () => {
    const req: any = {
      user: { id: "123", email: "test@example.com" },
    };
    const res = {};
    
    createGraphQLContext({ req, res });
    
    expect(req.isAuthenticated).toBeDefined();
    expect(req.isAuthenticated()).toBe(true);
  });

  it("should set isAuthenticated to return false when user does not exist", () => {
    const req: any = {};
    const res = {};
    
    createGraphQLContext({ req, res });
    
    expect(req.isAuthenticated).toBeDefined();
    expect(req.isAuthenticated()).toBe(false);
  });

  it("should set logIn to be the same as login", () => {
    const req: any = {};
    const res = {};
    
    createGraphQLContext({ req, res });
    
    expect(req.logIn).toBe(req.login);
  });

  it("should set logOut to be the same as logout", () => {
    const req: any = {};
    const res = {};
    
    createGraphQLContext({ req, res });
    
    expect(req.logOut).toBe(req.logout);
  });

  it("should handle request with partial Passport methods", () => {
    const mockLogin = jest.fn();
    const req: any = {
      login: mockLogin,
      // Missing other Passport methods
    };
    const res = {};
    
    createGraphQLContext({ req, res });
    
    // Should preserve existing login
    expect(req.login).toBe(mockLogin);
    expect(req.logIn).toBe(mockLogin);
    
    // Should add missing methods
    expect(req.logout).toBeDefined();
    expect(req.logOut).toBe(req.logout);
    expect(req.isAuthenticated).toBeDefined();
  });

  it("should handle request with user but no isAuthenticated method", () => {
    const req: any = {
      user: { id: "456", name: "Test User" },
      login: jest.fn(),
      logout: jest.fn(),
    };
    const res = {};
    
    createGraphQLContext({ req, res });
    
    // Should add isAuthenticated that returns true
    expect(req.isAuthenticated()).toBe(true);
  });

  it("should return the full context object", () => {
    const req: any = { custom: "value" };
    const res: any = { status: 200 };
    
    createGraphQLContext({ req, res });
    
    expect(context.req).toBe(req);
    expect(context.res).toBe(res);
    expect(context.req.custom).toBe("value");
    expect(context.res.status).toBe(200);
  });
});