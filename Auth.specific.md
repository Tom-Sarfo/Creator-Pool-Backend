# Frontend Authentication Integration Plan

## Overview

This document outlines how the frontend should integrate with the Creator Pool Backend authentication system. The backend provides a comprehensive JWT-based authentication system with role-based access control, token refresh, and user management.

## Authentication Flow Architecture

### 1. Token Management Strategy

- **Access Token**: Short-lived (15 minutes) for API requests
- **Refresh Token**: Long-lived (7 days) for token renewal
- **Token Rotation**: Refresh tokens are rotated on each use for security
- **Token Blacklisting**: Logged-out tokens are blacklisted

### 2. User Roles & Permissions

```typescript
enum UserRole {
  USER = "user", // Default role (predictors)
  CREATOR = "creator", // Content creators
  ADMIN = "admin", // Platform administrators
}
```

## API Endpoints & Frontend Integration

### Base URL

```
http://localhost:3000/auth
```

### 1. User Registration

**Endpoint**: `POST /auth/register`

**Request Body**:

```typescript
interface RegisterRequest {
  email: string; // Required
  password: string; // Required, min 8 chars
  firstName?: string; // Optional
  lastName?: string; // Optional
  phone?: string; // Optional
  role?: UserRole; // Optional, defaults to "user"
}
```

**Response**:

```typescript
interface RegisterResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    walletBalance: number;
    createdAt: string;
    updatedAt: string;
  };
  accessToken: string;
  refreshToken: string;
}
```

**Frontend Implementation**:

```typescript
// Registration form submission
const register = async (formData: RegisterRequest) => {
  const response = await fetch("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });

  if (response.ok) {
    const data = await response.json();
    // Store tokens securely
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    // Update user context/state
    setUser(data.user);
    return data;
  }
  throw new Error("Registration failed");
};
```

### 2. User Login

**Endpoint**: `POST /auth/login`

**Request Body**:

```typescript
interface LoginRequest {
  email: string;
  password: string;
}
```

**Response**: Same as registration response

**Frontend Implementation**:

```typescript
const login = async (credentials: LoginRequest) => {
  const response = await fetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  if (response.ok) {
    const data = await response.json();
    // Store tokens securely
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    setUser(data.user);
    return data;
  }
  throw new Error("Login failed");
};
```

### 3. Token Refresh

**Endpoint**: `POST /auth/refresh`

**Request Body**:

```typescript
interface RefreshRequest {
  refreshToken: string;
}
```

**Response**:

```typescript
interface RefreshResponse {
  accessToken: string;
  refreshToken: string; // New refresh token (rotation)
}
```

**Frontend Implementation**:

```typescript
const refreshTokens = async () => {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) throw new Error("No refresh token");

  const response = await fetch("/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (response.ok) {
    const data = await response.json();
    // Update stored tokens
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    return data.accessToken;
  }

  // Refresh failed - redirect to login
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  throw new Error("Token refresh failed");
};
```

### 4. Logout

**Endpoint**: `POST /auth/logout`

**Request Body**:

```typescript
interface LogoutRequest {
  refreshToken: string;
}
```

**Response**:

```typescript
interface LogoutResponse {
  message: string;
}
```

**Frontend Implementation**:

```typescript
const logout = async () => {
  const refreshToken = localStorage.getItem("refreshToken");

  if (refreshToken) {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({ refreshToken }),
      });
    } catch (error) {
      console.error("Logout request failed:", error);
    }
  }

  // Clear local storage regardless
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  setUser(null);
};
```

### 5. Logout All Devices

**Endpoint**: `POST /auth/logout-all`

**Frontend Implementation**:

```typescript
const logoutAllDevices = async () => {
  await fetch("/auth/logout-all", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
    },
  });

  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  setUser(null);
};
```

## Protected Routes & User Profile

### 6. Get User Profile

**Endpoint**: `GET /auth/profile`

**Response**:

```typescript
interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  walletBalance: number;
  googleId?: string;
  youtubeChannelId?: string;
  createdAt: string;
  updatedAt: string;
}
```

**Frontend Implementation**:

```typescript
const getProfile = async () => {
  const response = await fetch("/auth/profile", {
    headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
  });

  if (response.ok) {
    return await response.json();
  }
  throw new Error("Failed to fetch profile");
};
```

### 7. Update User Profile

**Endpoint**: `PUT /auth/profile`

**Request Body**:

```typescript
interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}
```

**Frontend Implementation**:

```typescript
const updateProfile = async (updates: UpdateProfileRequest) => {
  const response = await fetch("/auth/profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
    },
    body: JSON.stringify(updates),
  });

  if (response.ok) {
    const updatedProfile = await response.json();
    setUser(updatedProfile);
    return updatedProfile;
  }
  throw new Error("Profile update failed");
};
```

## Role-Based Access Control

### 8. Admin Endpoints

#### Get All Users (Admin Only)

**Endpoint**: `GET /auth/admin/users`

**Frontend Implementation**:

```typescript
const getAllUsers = async () => {
  const response = await fetch("/auth/admin/users", {
    headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
  });

  if (response.status === 403) {
    throw new Error("Admin access required");
  }

  if (response.ok) {
    return await response.json();
  }
  throw new Error("Failed to fetch users");
};
```

#### Get User by ID (Admin Only)

**Endpoint**: `GET /auth/admin/users/:id`

### 9. Creator Endpoints

#### Creator Dashboard

**Endpoint**: `GET /auth/creator/dashboard`

**Response**:

```typescript
interface CreatorDashboard {
  message: string;
  creator: {
    id: string;
    name: string;
    email: string;
    walletBalance: string;
    youtubeChannelId?: string;
  };
  stats: {
    totalEarnings: string;
    videosUploaded: number;
    subscribers: number;
  };
}
```

#### Update YouTube Integration

**Endpoint**: `PUT /auth/creator/youtube`

**Request Body**:

```typescript
interface YouTubeIntegration {
  youtubeChannelId: string;
  accessToken: string;
  refreshToken: string;
}
```

#### Creator Analytics

**Endpoint**: `GET /auth/creator/analytics`

**Response**:

```typescript
interface CreatorAnalytics {
  message: string;
  role: UserRole;
  analytics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
}
```

### 10. Public Profile

**Endpoint**: `GET /auth/public/:id`

**Response**:

```typescript
interface PublicProfile {
  id: string;
  name: string;
  role: UserRole;
  walletBalance: number;
  youtubeChannelId?: string;
  createdAt: string;
}
```

## Frontend Architecture Recommendations

### 1. Authentication Context/Store

```typescript
interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  updateProfile: (updates: UpdateProfileRequest) => Promise<void>;
}
```

### 2. HTTP Client with Auto-Refresh

```typescript
class ApiClient {
  private baseURL = "http://localhost:3000";

  async request(endpoint: string, options: RequestInit = {}) {
    const accessToken = localStorage.getItem("accessToken");

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        ...options.headers,
      },
    });

    // Handle token expiration
    if (response.status === 401) {
      try {
        await this.refreshTokens();
        // Retry the original request
        return this.request(endpoint, options);
      } catch (error) {
        // Redirect to login
        window.location.href = "/login";
        throw error;
      }
    }

    return response;
  }

  private async refreshTokens() {
    // Implementation from above
  }
}
```

### 3. Route Protection

```typescript
// Protected route component
const ProtectedRoute = ({ children, requiredRole }: {
  children: React.ReactNode;
  requiredRole?: UserRole
}) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/unauthorized" />;
  }

  return <>{children}</>;
};
```

### 4. Role-Based Component Rendering

```typescript
const RoleGuard = ({
  allowedRoles,
  children
}: {
  allowedRoles: UserRole[];
  children: React.ReactNode
}) => {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
};

// Usage
<RoleGuard allowedRoles={[UserRole.CREATOR, UserRole.ADMIN]}>
  <CreatorFeatures />
</RoleGuard>
```

## Error Handling & User Experience

### 1. Error Response Format

```typescript
interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}
```

### 2. Common Error Scenarios

- **401 Unauthorized**: Token expired or invalid
- **403 Forbidden**: Insufficient permissions
- **409 Conflict**: Email already exists
- **400 Bad Request**: Validation errors

### 3. Rate Limiting

- Registration: 5 attempts per minute
- Login: 5 attempts per minute
- Token refresh: 10 attempts per minute

## Security Best Practices

### 1. Token Storage

- Store tokens in `localStorage` for persistence
- Consider `httpOnly` cookies for production
- Never store tokens in `sessionStorage` for long-term apps

### 2. Token Refresh Strategy

- Implement automatic refresh before expiration
- Handle refresh failures gracefully
- Clear tokens on refresh failure

### 3. Request Interceptors

- Add authorization headers automatically
- Handle 401 responses with token refresh
- Implement request/response logging for debugging

## Testing Strategy

### 1. Unit Tests

- Test authentication context methods
- Test API client request handling
- Test token refresh logic

### 2. Integration Tests

- Test complete login/logout flow
- Test role-based access control
- Test token expiration handling

### 3. E2E Tests

- Test user registration flow
- Test protected route access
- Test role-based feature visibility

## Implementation Checklist

- [ ] Set up authentication context/store
- [ ] Implement HTTP client with auto-refresh
- [ ] Create protected route components
- [ ] Implement role-based guards
- [ ] Add error handling and user feedback
- [ ] Implement token storage management
- [ ] Add loading states and error boundaries
- [ ] Test authentication flows
- [ ] Add proper TypeScript types
- [ ] Implement proper error messages
- [ ] Add rate limiting feedback
- [ ] Test role-based access control

## Next Steps

1. **Phase 1**: Basic authentication (login, register, logout)
2. **Phase 2**: Token management and refresh
3. **Phase 3**: Role-based access control
4. **Phase 4**: Profile management
5. **Phase 5**: Creator-specific features
6. **Phase 6**: Admin features
7. **Phase 7**: Error handling and UX polish
8. **Phase 8**: Testing and optimization

This plan provides a comprehensive roadmap for integrating the frontend with the backend authentication system while maintaining security, user experience, and code quality standards.
