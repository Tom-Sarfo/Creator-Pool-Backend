# Frontend Environment Variables - Creator Pool Integration

## Overview

This document outlines all the environment variables that the frontend needs to integrate with the Creator Pool backend. These variables are essential for proper API communication, authentication, and third-party service integrations.

## 🔧 Required Environment Variables

### 1. **API Configuration**

```bash
# Backend API URL
REACT_APP_API_URL=http://localhost:3000

# WebSocket URL for real-time updates
REACT_APP_WS_URL=ws://localhost:3000

# API Base URL (alternative naming)
REACT_APP_BASE_URL=http://localhost:3000
```

### 2. **Authentication & JWT**

```bash
# JWT Secret (must match backend)
REACT_APP_JWT_SECRET=creator-pool-super-secret-jwt-key-2024

# Token storage keys
REACT_APP_ACCESS_TOKEN_KEY=accessToken
REACT_APP_REFRESH_TOKEN_KEY=refreshToken

# Token expiration times (should match backend)
REACT_APP_ACCESS_TOKEN_EXPIRES_IN=15m
REACT_APP_REFRESH_TOKEN_EXPIRES_IN=7d
```

### 3. **YouTube Integration**

```bash
# YouTube OAuth Configuration
REACT_APP_YOUTUBE_CLIENT_ID=your_youtube_client_id
REACT_APP_YOUTUBE_CLIENT_SECRET=your_youtube_client_secret
REACT_APP_YOUTUBE_REDIRECT_URI=http://localhost:3000/api/youtube/callback

# YouTube API Key (for additional features)
REACT_APP_YOUTUBE_API_KEY=your_youtube_api_key
```

### 4. **Payment Processing**

```bash
# Stripe Configuration
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
REACT_APP_STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key

# PayPal Configuration
REACT_APP_PAYPAL_CLIENT_ID=your_paypal_client_id
REACT_APP_PAYPAL_CLIENT_SECRET=your_paypal_client_secret
REACT_APP_PAYPAL_MODE=sandbox
```

### 5. **Google OAuth (Alternative Authentication)**

```bash
# Google OAuth Configuration
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
REACT_APP_GOOGLE_CLIENT_SECRET=your_google_client_secret
REACT_APP_GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
```

### 6. **Application Configuration**

```bash
# Environment
REACT_APP_NODE_ENV=development

# Frontend URL (for CORS and redirects)
REACT_APP_FRONTEND_URL=http://localhost:3001

# App Name and Version
REACT_APP_APP_NAME=Creator Pool
REACT_APP_APP_VERSION=1.0.0

# Feature Flags
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_NOTIFICATIONS=true
REACT_APP_ENABLE_REAL_TIME=true
```

### 7. **External Services**

```bash
# Analytics (if using Google Analytics)
REACT_APP_GA_TRACKING_ID=GA-XXXXXXXXX

# Sentry (for error tracking)
REACT_APP_SENTRY_DSN=your_sentry_dsn

# Email Service (if using SendGrid, etc.)
REACT_APP_EMAIL_SERVICE_API_KEY=your_email_service_key
```

## 🚀 Environment Setup Instructions

### 1. **Create Environment File**

Create a `.env` file in your React Router v7 project root:

```bash
# Copy the example file
cp .env.example .env

# Edit with your actual values
nano .env
```

### 2. **Backend Environment Variables**

Ensure your backend has these corresponding environment variables:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=creator_pool
DB_PASSWORD=your_password
DB_NAME=creator_pool

# JWT
JWT_SECRET=creator-pool-super-secret-jwt-key-2024
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=creator-pool-super-secret-jwt-key-2024
JWT_REFRESH_EXPIRES_IN=7d

# YouTube API
YOUTUBE_CLIENT_ID=your_youtube_client_id
YOUTUBE_CLIENT_SECRET=your_youtube_client_secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/api/youtube/callback

# Payment Processing
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=sandbox

# App Configuration
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3001
```

### 3. **Frontend Service Configuration**

Update your frontend services to use these environment variables:

```typescript
// services/api.service.ts
export class ApiService {
  private baseUrl = process.env.REACT_APP_API_URL || "http://localhost:3000";

  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = localStorage.getItem(
      process.env.REACT_APP_ACCESS_TOKEN_KEY || "accessToken"
    );

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }
}

// services/youtube.service.ts
export class YouTubeService {
  private baseUrl = process.env.REACT_APP_API_URL || "http://localhost:3000";

  async getAuthUrl(): Promise<string> {
    const response = await this.apiService.request<{ authUrl: string }>(
      "/youtube/auth-url"
    );
    return response.authUrl;
  }
}

// services/websocket.service.ts
export class WebSocketService {
  private wsUrl = process.env.REACT_APP_WS_URL || "ws://localhost:3000";

  connect(token: string): void {
    const url = `${this.wsUrl}?token=${token}`;
    this.socket = new WebSocket(url);
    // ... rest of WebSocket logic
  }
}
```

## 🔐 Security Considerations

### 1. **Environment Variable Security**

- **Never commit `.env` files** to version control
- Use `.env.example` for documentation
- Use different values for development, staging, and production
- Rotate secrets regularly in production

### 2. **Frontend Security**

```bash
# Production environment variables should be:
REACT_APP_API_URL=https://api.creatorpool.com
REACT_APP_WS_URL=wss://api.creatorpool.com
REACT_APP_NODE_ENV=production
```

### 3. **CORS Configuration**

Ensure your backend CORS configuration includes your frontend URL:

```typescript
// In your backend main.ts
app.enableCors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:3001",
    "http://localhost:3000",
    "http://localhost:3001",
  ],
  credentials: true,
});
```

## 📱 Mobile App Integration

If you're building a mobile app (React Native), use these environment variables:

```bash
# React Native environment variables
API_URL=http://localhost:3000
WS_URL=ws://localhost:3000
YOUTUBE_CLIENT_ID=your_youtube_client_id
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
```

## 🧪 Testing Environment

For testing, create a `.env.test` file:

```bash
REACT_APP_API_URL=http://localhost:3000
REACT_APP_NODE_ENV=test
REACT_APP_ENABLE_ANALYTICS=false
REACT_APP_ENABLE_NOTIFICATIONS=false
```

## 🚀 Deployment Configuration

### 1. **Vercel Deployment**

```bash
# In Vercel dashboard, add these environment variables:
REACT_APP_API_URL=https://your-backend-api.vercel.app
REACT_APP_WS_URL=wss://your-backend-api.vercel.app
REACT_APP_YOUTUBE_CLIENT_ID=your_youtube_client_id
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
```

### 2. **Netlify Deployment**

```bash
# In Netlify dashboard, add these environment variables:
REACT_APP_API_URL=https://your-backend-api.netlify.app
REACT_APP_WS_URL=wss://your-backend-api.netlify.app
REACT_APP_YOUTUBE_CLIENT_ID=your_youtube_client_id
```

### 3. **Docker Deployment**

```dockerfile
# Dockerfile
FROM node:18-alpine

# Copy environment file
COPY .env .env

# Build the app
RUN npm run build

# Expose port
EXPOSE 3001

# Start the app
CMD ["npm", "start"]
```

## 🔍 Troubleshooting

### Common Issues:

1. **CORS Errors**: Ensure `REACT_APP_API_URL` matches backend CORS configuration
2. **Authentication Failures**: Verify JWT secrets match between frontend and backend
3. **WebSocket Connection Issues**: Check `REACT_APP_WS_URL` and backend WebSocket configuration
4. **YouTube OAuth Issues**: Ensure `REACT_APP_YOUTUBE_CLIENT_ID` is correctly configured

### Debug Mode:

```bash
# Enable debug logging
REACT_APP_DEBUG=true
REACT_APP_LOG_LEVEL=debug
```

## 📋 Environment Variables Checklist

- [ ] `REACT_APP_API_URL` - Backend API URL
- [ ] `REACT_APP_WS_URL` - WebSocket URL
- [ ] `REACT_APP_YOUTUBE_CLIENT_ID` - YouTube OAuth client ID
- [ ] `REACT_APP_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- [ ] `REACT_APP_GOOGLE_CLIENT_ID` - Google OAuth client ID (if using)
- [ ] `REACT_APP_NODE_ENV` - Environment (development/production)
- [ ] `REACT_APP_FRONTEND_URL` - Frontend URL for redirects

## 🎯 Next Steps

1. **Set up your `.env` file** with the required variables
2. **Configure your backend** with corresponding environment variables
3. **Test API connectivity** using the provided service examples
4. **Implement authentication flow** with JWT tokens
5. **Set up YouTube OAuth** integration
6. **Configure payment processing** with Stripe/PayPal
7. **Test real-time features** with WebSocket connection

---

This configuration will enable your frontend to fully integrate with the Creator Pool backend, including authentication, YouTube channel synchronization, real-time updates, and payment processing.
