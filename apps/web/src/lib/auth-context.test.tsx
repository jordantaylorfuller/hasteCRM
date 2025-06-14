import React from 'react';
import { waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { AuthProvider, useAuth } from './auth-context';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { api } from './api';

// Mock dependencies
jest.mock('next/navigation');
jest.mock('js-cookie');
jest.mock('./api');

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockCookies = Cookies as jest.Mocked<typeof Cookies>;
const mockApi = api as jest.Mocked<typeof api>;

describe('AuthContext', () => {
  const mockPush = jest.fn();
  const mockRefresh = jest.fn();

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    status: 'ACTIVE',
    twoFactorEnabled: false,
  };

  const mockWorkspace = {
    id: 'workspace-123',
    name: 'Test Workspace',
    slug: 'test-workspace',
    plan: 'PRO',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
      back: jest.fn(),
      forward: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    } as any);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  describe('useAuth hook', () => {
    it('throws error when used outside AuthProvider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');
      
      consoleError.mockRestore();
    });

    it('provides auth context when used within AuthProvider', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      expect(result.current).toBeDefined();
      expect(result.current.user).toBeNull();
      expect(result.current.workspace).toBeNull();
      expect(result.current.loading).toBe(true);
    });
  });

  describe('initial load', () => {
    it('loads user from token on mount', async () => {
      mockCookies.get.mockReturnValue('valid-token');
      mockApi.get.mockResolvedValue({
        data: { user: mockUser, workspace: mockWorkspace },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.workspace).toEqual(mockWorkspace);
      });

      expect(mockApi.get).toHaveBeenCalledWith('/auth/me');
    });

    it('handles missing token', async () => {
      mockCookies.get.mockReturnValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.user).toBeNull();
        expect(result.current.workspace).toBeNull();
      });

      expect(mockApi.get).not.toHaveBeenCalled();
    });

    it('handles failed user fetch', async () => {
      mockCookies.get.mockReturnValue('valid-token');
      mockApi.get.mockRejectedValue(new Error('Unauthorized'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.user).toBeNull();
        expect(result.current.workspace).toBeNull();
      });

      expect(mockCookies.remove).toHaveBeenCalledWith('accessToken');
    });
  });

  describe('login', () => {
    it('logs in successfully', async () => {
      mockApi.post.mockResolvedValue({
        data: {
          accessToken: 'new-token',
          refreshToken: 'refresh-token',
          user: mockUser,
          workspace: mockWorkspace,
        },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(mockApi.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });

      expect(mockCookies.set).toHaveBeenCalledWith('accessToken', 'new-token', {
        expires: 7,
        sameSite: 'lax',
      });

      expect(mockCookies.set).toHaveBeenCalledWith('refreshToken', 'refresh-token', {
        expires: 30,
        sameSite: 'lax',
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.workspace).toEqual(mockWorkspace);
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    it('handles login with 2FA required', async () => {
      mockApi.post.mockResolvedValue({
        data: {
          requiresTwoFactor: true,
          tempToken: 'temp-token',
        },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(mockPush).toHaveBeenCalledWith('/login/2fa?token=temp-token');
    });

    it('handles login failure', async () => {
      mockApi.post.mockRejectedValue(new Error('Invalid credentials'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await expect(
        act(async () => {
          await result.current.login('test@example.com', 'wrong-password');
        })
      ).rejects.toThrow('Invalid credentials');

      expect(result.current.user).toBeNull();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('registers successfully', async () => {
      mockApi.post.mockResolvedValue({
        data: {
          accessToken: 'new-token',
          refreshToken: 'refresh-token',
          user: mockUser,
          workspace: mockWorkspace,
        },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      const registerData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        workspaceName: 'Test Workspace',
      };

      await act(async () => {
        await result.current.register(registerData);
      });

      expect(mockApi.post).toHaveBeenCalledWith('/auth/register', registerData);

      expect(mockCookies.set).toHaveBeenCalledWith('accessToken', 'new-token', {
        expires: 7,
        sameSite: 'lax',
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.workspace).toEqual(mockWorkspace);
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    it('handles registration failure', async () => {
      mockApi.post.mockRejectedValue(new Error('Email already exists'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await expect(
        act(async () => {
          await result.current.register({
            email: 'existing@example.com',
            password: 'password123',
            firstName: 'Test',
            lastName: 'User',
            workspaceName: 'Test Workspace',
          });
        })
      ).rejects.toThrow('Email already exists');

      expect(result.current.user).toBeNull();
    });
  });

  describe('logout', () => {
    it('logs out successfully', async () => {
      // Set initial user
      mockCookies.get.mockReturnValue('valid-token');
      mockApi.get.mockResolvedValue({
        data: { user: mockUser, workspace: mockWorkspace },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Logout
      mockApi.post.mockResolvedValue({});

      await act(async () => {
        await result.current.logout();
      });

      expect(mockApi.post).toHaveBeenCalledWith('/auth/logout');
      expect(mockCookies.remove).toHaveBeenCalledWith('accessToken');
      expect(mockCookies.remove).toHaveBeenCalledWith('refreshToken');
      expect(result.current.user).toBeNull();
      expect(result.current.workspace).toBeNull();
      expect(mockPush).toHaveBeenCalledWith('/login');
    });

    it('handles logout failure gracefully', async () => {
      mockApi.post.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.logout();
      });

      // Should still clear local state even if API call fails
      expect(mockCookies.remove).toHaveBeenCalledWith('accessToken');
      expect(mockCookies.remove).toHaveBeenCalledWith('refreshToken');
      expect(result.current.user).toBeNull();
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  describe('refreshUser', () => {
    it('refreshes user data', async () => {
      mockCookies.get.mockReturnValue('valid-token');
      mockApi.get.mockResolvedValue({
        data: { user: mockUser, workspace: mockWorkspace },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Update user data
      const updatedUser = { ...mockUser, firstName: 'Updated' };
      mockApi.get.mockResolvedValue({
        data: { user: updatedUser, workspace: mockWorkspace },
      });

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(result.current.user).toEqual(updatedUser);
    });

    it('handles refresh failure', async () => {
      mockCookies.get.mockReturnValue('valid-token');
      mockApi.get
        .mockResolvedValueOnce({
          data: { user: mockUser, workspace: mockWorkspace },
        })
        .mockRejectedValueOnce(new Error('Failed to refresh'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(consoleError).toHaveBeenCalledWith(
        'Failed to refresh user:',
        expect.any(Error)
      );

      consoleError.mockRestore();
    });
  });

  describe('token refresh', () => {
    it('refreshes token automatically', async () => {
      jest.useFakeTimers();

      mockCookies.get.mockReturnValue('valid-token');
      mockApi.get.mockResolvedValue({
        data: { user: mockUser, workspace: mockWorkspace },
      });
      mockApi.post.mockResolvedValue({
        data: {
          accessToken: 'refreshed-token',
          refreshToken: 'new-refresh-token',
        },
      });

      renderHook(() => useAuth(), { wrapper });

      // Fast-forward to token refresh time (30 minutes)
      act(() => {
        jest.advanceTimersByTime(30 * 60 * 1000);
      });

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/auth/refresh');
        expect(mockCookies.set).toHaveBeenCalledWith(
          'accessToken',
          'refreshed-token',
          expect.any(Object)
        );
      });

      jest.useRealTimers();
    });
  });
});