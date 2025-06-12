"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { api } from "./api";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  twoFactorEnabled: boolean;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

interface AuthContextType {
  user: User | null;
  workspace: Workspace | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  workspaceName: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = async () => {
    try {
      const token = Cookies.get("accessToken");
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await api.post("/auth/me");
      const { data } = response;

      setUser({
        id: data.sub,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        status: data.status,
        twoFactorEnabled: data.twoFactorEnabled,
      });

      setWorkspace({
        id: data.workspaceId,
        name: data.workspaceName,
        slug: data.workspaceSlug,
        plan: data.plan,
      });
    } catch (error) {
      console.error("Failed to refresh user:", error);
      Cookies.remove("accessToken");
      Cookies.remove("refreshToken");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post("/auth/login", { email, password });
      const { user, workspace, accessToken, refreshToken } = response.data;

      Cookies.set("accessToken", accessToken, { expires: 1 });
      Cookies.set("refreshToken", refreshToken, { expires: 7 });

      setUser(user);
      setWorkspace(workspace);

      router.push("/dashboard");
    } catch (error: any) {
      throw error.response?.data?.message || "Login failed";
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await api.post("/auth/register", data);
      const { user, workspace, accessToken, refreshToken } = response.data;

      Cookies.set("accessToken", accessToken, { expires: 1 });
      Cookies.set("refreshToken", refreshToken, { expires: 7 });

      setUser(user);
      setWorkspace(workspace);

      // Redirect to email verification notice
      router.push("/verify-email");
    } catch (error: any) {
      throw error.response?.data?.message || "Registration failed";
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      Cookies.remove("accessToken");
      Cookies.remove("refreshToken");
      setUser(null);
      setWorkspace(null);
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, workspace, loading, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
