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
    sub: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    status: 'ACTIVE',
    twoFactorEnabled: false,
    workspaceId: 'workspace-123',
    workspaceName: 'Test Workspace',
    workspaceSlug: 'test-workspace',
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

    it('provides auth context when used within AuthProvider', async () => {
      mockCookies.get.mockReturnValue(null);
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      expect(result.current).toBeDefined();
      expect(result.current.user).toBeNull();
      expect(result.current.workspace).toBeNull();
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('initial load', () => {
    it('loads user from token on mount', async () => {
      mockCookies.get.mockReturnValue('valid-token');
      mockApi.post.mockResolvedValue({
        data: mockUser,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.user).toEqual({
          id: mockUser.sub,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          status: mockUser.status,
          twoFactorEnabled: mockUser.twoFactorEnabled,
        });
        expect(result.current.workspace).toEqual({
          id: mockUser.workspaceId,
          name: mockUser.workspaceName,
          slug: mockUser.workspaceSlug,
          plan: mockUser.plan,
        });
      });

      expect(mockApi.post).toHaveBeenCalledWith('/auth/me');
    });

    it('handles missing token', async () => {
      mockCookies.get.mockReturnValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.user).toBeNull();
        expect(result.current.workspace).toBeNull();
      });

      expect(mockApi.post).not.toHaveBeenCalled();
    });

    it('handles failed user fetch', async () => {
      mockCookies.get.mockReturnValue('valid-token');
      mockApi.post.mockRejectedValue(new Error('Unauthorized'));

      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.user).toBeNull();
        expect(result.current.workspace).toBeNull();
      });

      expect(mockCookies.remove).toHaveBeenCalledWith('accessToken');
      expect(mockCookies.remove).toHaveBeenCalledWith('refreshToken');
      
      consoleError.mockRestore();
    });
  });

  describe('login', () => {
    it('logs in successfully', async () => {
      mockCookies.get.mockReturnValue(null);
      
      const loginResponse = {
        accessToken: 'new-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          status: 'ACTIVE',
          twoFactorEnabled: false,
        },
        workspace: {
          id: 'workspace-123',
          name: 'Test Workspace',
          slug: 'test-workspace',
          plan: 'PRO',
        },
      };
      
      mockApi.post.mockResolvedValue({
        data: loginResponse,
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
        expires: 1,
      });

      expect(mockCookies.set).toHaveBeenCalledWith('refreshToken', 'refresh-token', {
        expires: 7,
      });

      expect(result.current.user).toEqual(loginResponse.user);
      expect(result.current.workspace).toEqual(loginResponse.workspace);
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    it('handles login error properly', async () => {
      mockCookies.get.mockReturnValue(null);
      
      const errorResponse = {
        response: {
          data: {
            message: 'Invalid email or password',
          },
        },
      };
      
      mockApi.post.mockRejectedValue(errorResponse);

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      try {
        await act(async () => {
          await result.current.login('test@example.com', 'wrong-password');
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBe('Invalid email or password');
      }
    });

    it('handles login failure', async () => {
      mockCookies.get.mockReturnValue(null);
      mockApi.post.mockRejectedValue({
        response: {
          data: {
            message: 'Invalid credentials'
          }
        }
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      try {
        await act(async () => {
          await result.current.login('test@example.com', 'wrong-password');
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBe('Invalid credentials');
      }

      expect(result.current.user).toBeNull();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('registers successfully', async () => {
      mockCookies.get.mockReturnValue(null);
      
      const registerResponse = {
        accessToken: 'new-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          status: 'ACTIVE',
          twoFactorEnabled: false,
        },
        workspace: {
          id: 'workspace-123',
          name: 'Test Workspace',
          slug: 'test-workspace',
          plan: 'FREE',
        },
      };
      
      mockApi.post.mockResolvedValue({
        data: registerResponse,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

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
        expires: 1,
      });

      expect(result.current.user).toEqual(registerResponse.user);
      expect(result.current.workspace).toEqual(registerResponse.workspace);
      expect(mockPush).toHaveBeenCalledWith('/verify-email');
    });

    it('handles registration failure', async () => {
      mockCookies.get.mockReturnValue(null);
      
      const errorResponse = {
        response: {
          data: {
            message: 'Email already exists',
          },
        },
      };
      
      mockApi.post.mockRejectedValue(errorResponse);

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      try {
        await act(async () => {
          await result.current.register({
            email: 'existing@example.com',
            password: 'password123',
            firstName: 'Test',
            lastName: 'User',
            workspaceName: 'Test Workspace',
          });
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBe('Email already exists');
      }

      expect(result.current.user).toBeNull();
    });
  });

  describe('logout', () => {
    it('logs out successfully', async () => {
      // Set initial user
      mockCookies.get.mockReturnValue('valid-token');
      mockApi.post.mockResolvedValueOnce({
        data: mockUser,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toBeTruthy();
      });

      // Clear mocks before logout
      jest.clearAllMocks();
      
      // Logout
      mockApi.post.mockResolvedValueOnce({});

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
      mockCookies.get.mockReturnValue(null);
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
      mockApi.post.mockResolvedValue({
        data: mockUser,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toBeTruthy();
      });

      // Update user data
      const updatedUser = { ...mockUser, firstName: 'Updated' };
      mockApi.post.mockResolvedValue({
        data: updatedUser,
      });

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(result.current.user?.firstName).toEqual('Updated');
    });

    it('handles refresh failure', async () => {
      mockCookies.get.mockReturnValue('valid-token');
      mockApi.post
        .mockResolvedValueOnce({
          data: mockUser,
        })
        .mockRejectedValueOnce(new Error('Failed to refresh'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toBeTruthy();
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

  describe('Error handling edge cases', () => {
    it('handles login error without response property', async () => {
      mockCookies.get.mockReturnValue(null);
      mockApi.post.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      try {
        await act(async () => {
          await result.current.login('test@example.com', 'password');
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBe('Login failed');
      }
    });

    it('handles login error with empty response data', async () => {
      mockCookies.get.mockReturnValue(null);
      mockApi.post.mockRejectedValue({ response: { data: {} } });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      try {
        await act(async () => {
          await result.current.login('test@example.com', 'password');
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBe('Login failed');
      }
    });

    it('handles register error without response property', async () => {
      mockCookies.get.mockReturnValue(null);
      mockApi.post.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      try {
        await act(async () => {
          await result.current.register({
            email: 'test@example.com',
            password: 'password123',
            firstName: 'Test',
            lastName: 'User',
            workspaceName: 'Test Workspace',
          });
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBe('Registration failed');
      }
    });

    it('handles register error with empty response data', async () => {
      mockCookies.get.mockReturnValue(null);
      mockApi.post.mockRejectedValue({ response: { data: {} } });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      try {
        await act(async () => {
          await result.current.register({
            email: 'test@example.com',
            password: 'password123',
            firstName: 'Test',
            lastName: 'User',
            workspaceName: 'Test Workspace',
          });
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBe('Registration failed');
      }
    });
  });
});