# Frontend Architecture Guide

## Overview

hasteCRM's frontend is built with Next.js 14, React 18, TypeScript, and Tailwind CSS. This guide provides complete implementation patterns and component examples for Claude Code.

## Table of Contents

1. [Project Structure](#project-structure)
2. [Component Architecture](#component-architecture)
3. [State Management with Zustand](#state-management-with-zustand)
4. [UI Components with Shadcn/ui](#ui-components-with-shadcnui)
5. [Data Fetching Patterns](#data-fetching-patterns)
6. [Error Handling](#error-handling)
7. [Performance Optimization](#performance-optimization)
8. [Testing Strategy](#testing-strategy)

## Project Structure

```
apps/web/
├── src/
│   ├── app/                    # Next.js 14 app directory
│   │   ├── (auth)/            # Auth group (login, register, etc.)
│   │   ├── (dashboard)/       # Main app routes
│   │   │   ├── contacts/      # Contact management
│   │   │   ├── emails/        # Email interface
│   │   │   ├── pipelines/     # Pipeline views
│   │   │   └── settings/      # User settings
│   │   ├── api/              # API routes (if needed)
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Landing page
│   ├── components/           # React components
│   │   ├── ui/              # Shadcn/ui components
│   │   ├── contacts/        # Contact-specific components
│   │   ├── emails/          # Email components
│   │   ├── shared/          # Shared components
│   │   └── layouts/         # Layout components
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utility functions
│   │   ├── api/            # API client
│   │   ├── utils/          # Helper functions
│   │   └── validations/    # Zod schemas
│   ├── stores/             # Zustand stores
│   ├── styles/             # Global styles
│   └── types/              # TypeScript types
├── public/                 # Static assets
├── tests/                  # Test files
└── package.json
```

## Component Architecture

### Base Component Pattern

```typescript
// components/contacts/ContactCard.tsx
import { FC, memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreVertical, Mail, Phone } from 'lucide-react';
import { Contact } from '@/types/contact';
import { useContactActions } from '@/hooks/useContactActions';

interface ContactCardProps {
  contact: Contact;
  onSelect?: (contact: Contact) => void;
  selected?: boolean;
}

export const ContactCard: FC<ContactCardProps> = memo(({ contact, onSelect, selected }) => {
  const { archiveContact, favoriteContact } = useContactActions();
  
  const initials = `${contact.firstName?.[0] || ''}${contact.lastName?.[0] || ''}`.toUpperCase();
  
  return (
    <Card 
      className={`cursor-pointer transition-all ${selected ? 'ring-2 ring-primary' : ''}`}
      onClick={() => onSelect?.(contact)}
    >
      <CardHeader className="flex flex-row items-center gap-4">
        <Avatar>
          <AvatarImage src={contact.avatarUrl} alt={contact.fullName} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1">
          <CardTitle className="text-lg">{contact.fullName}</CardTitle>
          <CardDescription>{contact.title} at {contact.company?.name}</CardDescription>
        </div>
        
        <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </CardHeader>
      
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {contact.tags.map((tag) => (
            <Badge key={tag.id} variant="secondary">{tag.name}</Badge>
          ))}
        </div>
        
        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          {contact.email && (
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              <span>{contact.email}</span>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              <span>{contact.phone}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

ContactCard.displayName = 'ContactCard';
```

### List Component with Virtualization

```typescript
// components/contacts/ContactList.tsx
import { FC, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useContactStore } from '@/stores/contactStore';
import { ContactCard } from './ContactCard';
import { ContactListSkeleton } from './ContactListSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

export const ContactList: FC = () => {
  const { 
    contacts, 
    isLoading, 
    error, 
    selectedIds, 
    toggleSelection,
    searchQuery 
  } = useContactStore();
  
  const filteredContacts = useMemo(() => {
    if (!searchQuery) return contacts;
    
    const query = searchQuery.toLowerCase();
    return contacts.filter(contact => 
      contact.fullName.toLowerCase().includes(query) ||
      contact.email?.toLowerCase().includes(query) ||
      contact.company?.name.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);
  
  const parentRef = React.useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: filteredContacts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 5,
  });
  
  const handleSelect = useCallback((contact: Contact) => {
    toggleSelection(contact.id);
  }, [toggleSelection]);
  
  if (isLoading) return <ContactListSkeleton />;
  if (error) return <ErrorBoundary error={error} />;
  if (filteredContacts.length === 0) {
    return <EmptyState 
      title="No contacts found" 
      description="Create your first contact to get started"
      action={{ label: 'Create Contact', href: '/contacts/new' }}
    />;
  }
  
  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const contact = filteredContacts[virtualItem.index];
          return (
            <div
              key={contact.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <ContactCard
                contact={contact}
                selected={selectedIds.has(contact.id)}
                onSelect={handleSelect}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

### Form Component with Validation

```typescript
// components/contacts/ContactForm.tsx
import { FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useContactStore } from '@/stores/contactStore';
import { useToast } from '@/components/ui/use-toast';

const contactSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactFormProps {
  contact?: Contact;
  onSuccess?: () => void;
}

export const ContactForm: FC<ContactFormProps> = ({ contact, onSuccess }) => {
  const { createContact, updateContact } = useContactStore();
  const { toast } = useToast();
  
  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: contact?.firstName || '',
      lastName: contact?.lastName || '',
      email: contact?.email || '',
      phone: contact?.phone || '',
      title: contact?.title || '',
      company: contact?.company?.name || '',
      notes: contact?.notes || '',
      tags: contact?.tags.map(t => t.name) || [],
    },
  });
  
  const onSubmit = async (data: ContactFormData) => {
    try {
      if (contact) {
        await updateContact(contact.id, data);
        toast({ title: 'Contact updated successfully' });
      } else {
        await createContact(data);
        toast({ title: 'Contact created successfully' });
      }
      onSuccess?.();
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input type="tel" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="company"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea {...field} rows={4} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => form.reset()}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : contact ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Form>
  );
};
```

## State Management with Zustand

### Contact Store Implementation

```typescript
// stores/contactStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Contact, ContactFilters, ContactFormData } from '@/types/contact';
import { contactApi } from '@/lib/api/contacts';
import { debounce } from '@/lib/utils';

interface ContactState {
  // Data
  contacts: Contact[];
  selectedIds: Set<string>;
  searchQuery: string;
  filters: ContactFilters;
  sortBy: 'name' | 'created' | 'updated';
  sortOrder: 'asc' | 'desc';
  
  // UI State
  isLoading: boolean;
  error: Error | null;
  totalCount: number;
  currentPage: number;
  pageSize: number;
  
  // Actions
  fetchContacts: () => Promise<void>;
  createContact: (data: ContactFormData) => Promise<Contact>;
  updateContact: (id: string, data: Partial<ContactFormData>) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  bulkDelete: (ids: string[]) => Promise<void>;
  
  // Selection
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  
  // Search & Filter
  setSearchQuery: (query: string) => void;
  setFilters: (filters: ContactFilters) => void;
  setSorting: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  
  // Pagination
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

export const useContactStore = create<ContactState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        contacts: [],
        selectedIds: new Set(),
        searchQuery: '',
        filters: {},
        sortBy: 'created',
        sortOrder: 'desc',
        isLoading: false,
        error: null,
        totalCount: 0,
        currentPage: 1,
        pageSize: 25,
        
        // Fetch contacts with current filters
        fetchContacts: async () => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });
          
          try {
            const { searchQuery, filters, sortBy, sortOrder, currentPage, pageSize } = get();
            const response = await contactApi.list({
              search: searchQuery,
              ...filters,
              sortBy,
              sortOrder,
              page: currentPage,
              limit: pageSize,
            });
            
            set((state) => {
              state.contacts = response.data;
              state.totalCount = response.totalCount;
              state.isLoading = false;
            });
          } catch (error) {
            set((state) => {
              state.error = error as Error;
              state.isLoading = false;
            });
          }
        },
        
        // Create new contact
        createContact: async (data) => {
          const contact = await contactApi.create(data);
          set((state) => {
            state.contacts.unshift(contact);
            state.totalCount += 1;
          });
          return contact;
        },
        
        // Update existing contact
        updateContact: async (id, data) => {
          const updated = await contactApi.update(id, data);
          set((state) => {
            const index = state.contacts.findIndex(c => c.id === id);
            if (index !== -1) {
              state.contacts[index] = updated;
            }
          });
        },
        
        // Delete contact
        deleteContact: async (id) => {
          await contactApi.delete(id);
          set((state) => {
            state.contacts = state.contacts.filter(c => c.id !== id);
            state.selectedIds.delete(id);
            state.totalCount -= 1;
          });
        },
        
        // Bulk delete
        bulkDelete: async (ids) => {
          await contactApi.bulkDelete(ids);
          set((state) => {
            state.contacts = state.contacts.filter(c => !ids.includes(c.id));
            ids.forEach(id => state.selectedIds.delete(id));
            state.totalCount -= ids.length;
          });
        },
        
        // Selection management
        toggleSelection: (id) => {
          set((state) => {
            if (state.selectedIds.has(id)) {
              state.selectedIds.delete(id);
            } else {
              state.selectedIds.add(id);
            }
          });
        },
        
        selectAll: () => {
          set((state) => {
            state.contacts.forEach(c => state.selectedIds.add(c.id));
          });
        },
        
        clearSelection: () => {
          set((state) => {
            state.selectedIds.clear();
          });
        },
        
        // Search with debounce
        setSearchQuery: debounce((query: string) => {
          set((state) => {
            state.searchQuery = query;
            state.currentPage = 1;
          });
          get().fetchContacts();
        }, 300),
        
        // Filters
        setFilters: (filters) => {
          set((state) => {
            state.filters = filters;
            state.currentPage = 1;
          });
          get().fetchContacts();
        },
        
        // Sorting
        setSorting: (sortBy, sortOrder) => {
          set((state) => {
            state.sortBy = sortBy as any;
            state.sortOrder = sortOrder;
          });
          get().fetchContacts();
        },
        
        // Pagination
        setPage: (page) => {
          set((state) => {
            state.currentPage = page;
          });
          get().fetchContacts();
        },
        
        setPageSize: (size) => {
          set((state) => {
            state.pageSize = size;
            state.currentPage = 1;
          });
          get().fetchContacts();
        },
      })),
      {
        name: 'contact-store',
        partialize: (state) => ({
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
          pageSize: state.pageSize,
        }),
      }
    )
  )
);
```

### Auth Store Implementation

```typescript
// stores/authStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { User, LoginCredentials, RegisterData } from '@/types/auth';
import { authApi } from '@/lib/api/auth';
import { router } from 'next/navigation';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        
        login: async (credentials) => {
          set({ isLoading: true });
          try {
            const response = await authApi.login(credentials);
            set({
              user: response.user,
              accessToken: response.accessToken,
              refreshToken: response.refreshToken,
              isAuthenticated: true,
              isLoading: false,
            });
            router.push('/dashboard');
          } catch (error) {
            set({ isLoading: false });
            throw error;
          }
        },
        
        register: async (data) => {
          set({ isLoading: true });
          try {
            const response = await authApi.register(data);
            set({
              user: response.user,
              accessToken: response.accessToken,
              refreshToken: response.refreshToken,
              isAuthenticated: true,
              isLoading: false,
            });
            router.push('/onboarding');
          } catch (error) {
            set({ isLoading: false });
            throw error;
          }
        },
        
        logout: async () => {
          const { refreshToken } = get();
          if (refreshToken) {
            try {
              await authApi.logout(refreshToken);
            } catch (error) {
              console.error('Logout error:', error);
            }
          }
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          });
          router.push('/login');
        },
        
        refreshSession: async () => {
          const { refreshToken } = get();
          if (!refreshToken) {
            get().logout();
            return;
          }
          
          try {
            const response = await authApi.refresh(refreshToken);
            set({
              accessToken: response.accessToken,
              refreshToken: response.refreshToken,
            });
          } catch (error) {
            get().logout();
            throw error;
          }
        },
        
        updateProfile: async (data) => {
          const updated = await authApi.updateProfile(data);
          set({ user: updated });
        },
      }),
      {
        name: 'auth-store',
        partialize: (state) => ({
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
        }),
      }
    )
  )
);
```

## UI Components with Shadcn/ui

### Installation and Setup

```bash
# Install Shadcn/ui CLI
npx shadcn-ui@latest init

# Install components needed for CRM
npx shadcn-ui@latest add alert dialog button card form input label table tabs toast select checkbox radio-group dropdown-menu context-menu popover calendar date-picker command palette sheet drawer avatar badge separator skeleton tooltip accordion collapsible scroll-area
```

### Custom Theme Configuration

```typescript
// app/globals.css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }
  
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}
```

## Data Fetching Patterns

### API Client Setup

```typescript
// lib/api/client.ts
import axios, { AxiosError, AxiosInstance } from 'axios';
import { useAuthStore } from '@/stores/authStore';

class ApiClient {
  private client: AxiosInstance;
  
  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = useAuthStore.getState().accessToken;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            await useAuthStore.getState().refreshSession();
            const token = useAuthStore.getState().accessToken;
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            useAuthStore.getState().logout();
            return Promise.reject(refreshError);
          }
        }
        
        return Promise.reject(error);
      }
    );
  }
  
  get<T>(url: string, config?: any) {
    return this.client.get<T>(url, config);
  }
  
  post<T>(url: string, data?: any, config?: any) {
    return this.client.post<T>(url, data, config);
  }
  
  put<T>(url: string, data?: any, config?: any) {
    return this.client.put<T>(url, data, config);
  }
  
  patch<T>(url: string, data?: any, config?: any) {
    return this.client.patch<T>(url, data, config);
  }
  
  delete<T>(url: string, config?: any) {
    return this.client.delete<T>(url, config);
  }
}

export const apiClient = new ApiClient();
```

### React Query Integration

```typescript
// lib/api/hooks/useContacts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactApi } from '@/lib/api/contacts';
import { Contact, ContactFilters } from '@/types/contact';

export const useContacts = (filters?: ContactFilters) => {
  return useQuery({
    queryKey: ['contacts', filters],
    queryFn: () => contactApi.list(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useContact = (id: string) => {
  return useQuery({
    queryKey: ['contact', id],
    queryFn: () => contactApi.get(id),
    enabled: !!id,
  });
};

export const useCreateContact = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: contactApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.setQueryData(['contact', data.id], data);
    },
  });
};

export const useUpdateContact = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      contactApi.update(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.setQueryData(['contact', variables.id], data);
    },
  });
};

export const useDeleteContact = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: contactApi.delete,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.removeQueries({ queryKey: ['contact', id] });
    },
  });
};
```

## Error Handling

### Global Error Boundary

```typescript
// components/shared/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };
  
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    // Send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Sentry.captureException(error);
    }
  }
  
  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="flex items-center justify-center min-h-[400px] p-4">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription className="mt-2">
              {this.state.error?.message || 'An unexpected error occurred'}
            </AlertDescription>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </Button>
          </Alert>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

### API Error Handler

```typescript
// lib/api/errorHandler.ts
import { AxiosError } from 'axios';
import { toast } from '@/components/ui/use-toast';

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: any;
}

export class ApiErrorHandler {
  static handle(error: unknown): ApiError {
    if (error instanceof AxiosError) {
      const data = error.response?.data;
      
      // Handle specific error codes
      switch (error.response?.status) {
        case 400:
          return {
            message: data?.message || 'Invalid request',
            code: data?.code || 'BAD_REQUEST',
            statusCode: 400,
            details: data?.details,
          };
          
        case 401:
          return {
            message: 'Please login to continue',
            code: 'UNAUTHORIZED',
            statusCode: 401,
          };
          
        case 403:
          return {
            message: 'You do not have permission to perform this action',
            code: 'FORBIDDEN',
            statusCode: 403,
          };
          
        case 404:
          return {
            message: data?.message || 'Resource not found',
            code: 'NOT_FOUND',
            statusCode: 404,
          };
          
        case 422:
          return {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            statusCode: 422,
            details: data?.errors,
          };
          
        case 429:
          return {
            message: 'Too many requests. Please try again later.',
            code: 'RATE_LIMITED',
            statusCode: 429,
          };
          
        case 500:
          return {
            message: 'Something went wrong. Please try again later.',
            code: 'INTERNAL_SERVER_ERROR',
            statusCode: 500,
          };
          
        default:
          return {
            message: data?.message || 'An unexpected error occurred',
            code: data?.code || 'UNKNOWN_ERROR',
            statusCode: error.response?.status,
          };
      }
    }
    
    // Handle network errors
    if (error instanceof Error) {
      if (error.message === 'Network Error') {
        return {
          message: 'Unable to connect to the server. Please check your internet connection.',
          code: 'NETWORK_ERROR',
        };
      }
      
      return {
        message: error.message,
        code: 'CLIENT_ERROR',
      };
    }
    
    return {
      message: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
    };
  }
  
  static showToast(error: unknown) {
    const apiError = this.handle(error);
    
    toast({
      title: 'Error',
      description: apiError.message,
      variant: 'destructive',
    });
  }
}
```

## Performance Optimization

### Image Optimization

```typescript
// components/shared/OptimizedImage.tsx
import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width = 400,
  height = 400,
  className,
  priority = false,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  
  if (error) {
    return (
      <div 
        className={cn(
          'bg-muted flex items-center justify-center',
          className
        )}
        style={{ width, height }}
      >
        <span className="text-muted-foreground text-xs">Failed to load</span>
      </div>
    );
  }
  
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {isLoading && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        onLoadingComplete={() => setIsLoading(false)}
        onError={() => setError(true)}
        className={cn(
          'transition-opacity duration-300',
          isLoading ? 'opacity-0' : 'opacity-100'
        )}
      />
    </div>
  );
};
```

### Code Splitting

```typescript
// app/(dashboard)/contacts/page.tsx
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { ContactListSkeleton } from '@/components/contacts/ContactListSkeleton';

// Lazy load heavy components
const ContactList = dynamic(
  () => import('@/components/contacts/ContactList').then(mod => mod.ContactList),
  { 
    loading: () => <ContactListSkeleton />,
    ssr: false 
  }
);

const ContactFilters = dynamic(
  () => import('@/components/contacts/ContactFilters').then(mod => mod.ContactFilters),
  { ssr: false }
);

export default function ContactsPage() {
  return (
    <div className="flex h-full">
      <aside className="w-64 border-r">
        <Suspense fallback={<div className="p-4">Loading filters...</div>}>
          <ContactFilters />
        </Suspense>
      </aside>
      
      <main className="flex-1">
        <Suspense fallback={<ContactListSkeleton />}>
          <ContactList />
        </Suspense>
      </main>
    </div>
  );
}
```

## Testing Strategy

### Component Testing

```typescript
// tests/components/ContactCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ContactCard } from '@/components/contacts/ContactCard';
import { mockContact } from '@/tests/mocks/contact';

describe('ContactCard', () => {
  it('renders contact information correctly', () => {
    render(<ContactCard contact={mockContact} />);
    
    expect(screen.getByText(mockContact.fullName)).toBeInTheDocument();
    expect(screen.getByText(`${mockContact.title} at ${mockContact.company.name}`)).toBeInTheDocument();
    expect(screen.getByText(mockContact.email)).toBeInTheDocument();
  });
  
  it('calls onSelect when clicked', () => {
    const onSelect = jest.fn();
    render(<ContactCard contact={mockContact} onSelect={onSelect} />);
    
    fireEvent.click(screen.getByRole('article'));
    expect(onSelect).toHaveBeenCalledWith(mockContact);
  });
  
  it('shows selected state', () => {
    const { container } = render(
      <ContactCard contact={mockContact} selected={true} />
    );
    
    expect(container.firstChild).toHaveClass('ring-2 ring-primary');
  });
});
```

### Integration Testing

```typescript
// tests/integration/contacts.test.tsx
import { renderWithProviders, screen, waitFor } from '@/tests/utils';
import ContactsPage from '@/app/(dashboard)/contacts/page';
import { server } from '@/tests/mocks/server';
import { rest } from 'msw';

describe('Contacts Page', () => {
  it('loads and displays contacts', async () => {
    renderWithProviders(<ContactsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('jane@haste.nyc')).toBeInTheDocument();
    });
  });
  
  it('handles search correctly', async () => {
    renderWithProviders(<ContactsPage />);
    
    const searchInput = await screen.findByPlaceholderText('Search contacts...');
    fireEvent.change(searchInput, { target: { value: 'john' } });
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
    });
  });
  
  it('shows error state on API failure', async () => {
    server.use(
      rest.get('/api/contacts', (req, res, ctx) => {
        return res(ctx.status(500));
      })
    );
    
    renderWithProviders(<ContactsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });
});
```

This completes the frontend architecture guide with comprehensive examples for React components, state management, UI components, data fetching, error handling, performance optimization, and testing strategies.