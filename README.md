# AI-Genius Authentication & Authorization System

A secure, enterprise-grade, stateless authentication and authorization subsystem built using Node.js, Express.js, and MongoDB (Mongoose). It features JWT Access & Refresh Token Lifecycles, Refresh Token Rotation with Automatic Reuse Detection (replay defense), Role-Based Access Control (RBAC), Account Lockouts, Rate Limiting, NoSQL Injection protection, Helmet security headers, and Audit Logging.

---

## Table of Contents
1. [Setup and Installation](#setup-and-installation)
2. [Project Architecture](#project-architecture)
3. [Authentication & Authorization Flow Diagrams](#authentication--authorization-flow-diagrams)
4. [JWT Lifecycle & Refresh Token Rotation](#jwt-lifecycle--refresh-token-rotation)
5. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
6. [Security Protections](#security-protections)
7. [API Endpoints Documentation](#api-endpoints-documentation)
8. [Sample API Payloads (Postman Requests/Responses)](#sample-api-payloads)

---

## Setup and Installation

### Prerequisites
- **Node.js**: version `>=16.0.0`
- **MongoDB**: A running instance (local or Atlas)

### Steps
1. **Clone the Repository** and navigate to the project directory:
   ```bash
   cd "web tech assignment"
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment Variables**:
   Create a `.env` file in the root directory (based on `.env.example`):
   ```env
   PORT=5000
   NODE_ENV=development
   MONGO_URI=mongodb://localhost:27017/ai_genius_auth
   JWT_SECRET=ai_genius_jwt_access_secret_key_987654321_abcdef
   JWT_REFRESH_SECRET=ai_genius_jwt_refresh_secret_key_123456789_zyxwvuts
   JWT_ACCESS_EXPIRE=15m
   JWT_REFRESH_EXPIRE=7d
   JWT_COOKIE_EXPIRE=7
   ```
4. **Seed the Database (Optional)**:
   The database will automatically self-seed with sample accounts on first startup if the `Users` collection is empty. However, you can run the seeder manually:
   ```bash
   node seed/seed.js
   ```
   *Seeded Users:*
   - **Admin**: `admin@aigenius.com` / `Admin123!`
   - **Premium User**: `premium@aigenius.com` / `Premium123!`
   - **Free User**: `free@aigenius.com` / `Free123!`

5. **Start the Server**:
   - For production:
     ```bash
     npm start
     ```
   - For development (with hot-reloads):
     ```bash
     npm run dev
     ```
   The backend server runs on `http://localhost:5000`. Open the URL in your browser to interact with the frontend UI.

6. **Run Verification & Security Tests**:
   Ensure the server is running on port 5000, then execute:
   - Run integration tests:
     ```bash
     node test-endpoints.js
     ```
   - Run security checks (lockouts, rotation reuse, validations, rate limits):
     ```bash
     node scratch/test-security.js
     ```
     *(Note: The scratch file is located in the conversation's generated logs directory, or can be run relative to your local setup).*

---

## Project Architecture

The codebase follows a clean, decoupled MVC/service pattern:

```text
project/
├── config/
│   └── db.js               # Database config constants
├── controllers/
│   ├── aiController.js     # Protected AI endpoint handlers
│   └── authController.js   # Auth management (login, register, logout, profile)
├── database/
│   └── db.js               # Mongoose connection initializer
├── middleware/
│   ├── auditLogger.js      # Audit log recording middleware
│   ├── auth.js             # protect() JWT check & restrictTo() RBAC
│   ├── errorHandler.js     # Centralized error mapping
│   └── rateLimiter.js      # Brute-force & DDoS rate limits
├── models/
│   ├── AuditLog.js         # Security events log schema
│   ├── RefreshToken.js     # Whitelisted active refresh tokens schema
│   └── User.js             # User accounts schema (with lockout methods)
├── routes/
│   ├── ai.js               # Protected AI API paths
│   ├── auth.js             # Authentication API paths
│   └── user.js             # Profile & Change Password paths
├── seed/
│   └── seed.js             # Database seeding script
├── services/
│   └── tokenService.js     # JWT generation and rotation logic
├── utils/
│   ├── errors.js           # Custom AppError helper class
│   └── validators.js       # express-validator request schemas
├── public/                 # Frontend SPA assets
│   ├── index.html          # HTML UI
│   ├── style.css           # Vanilla CSS styles
│   └── app.js              # Frontend vanilla JS app
├── app.js                  # Express application setup
├── server.js               # Server starter (Db connect, auto-seed, port listener)
├── package.json
└── README.md
```

---

## Authentication & Authorization Flow Diagrams

### 1. User Registration & Login Flow
```text
[ Client ]                        [ Server ]                          [ MongoDB ]
    |                                 |                                    |
    |--- 1. POST /register ---------->|                                    |
    |    (email, password, role)      |--- 2. Validate & HASH password --->| (Save User)
    |<-- 201 Success -----------------|                                    |
    |                                 |                                    |
    |                                 |                                    |
    |--- 3. POST /login ------------->|                                    |
    |    (email, password)            |--- 4. Check Lockout & Hashed Pass->|
    |                                 |--- 5. Generate Access & Refresh -->| (Save RefreshToken)
    |                                 |--- 6. Set httpOnly Cookie -------->|
    |<-- 200 { success, accessToken }-|                                    |
```

### 2. JWT Verification & RBAC Middleware Flow
```text
[ Client ]               [ protect Middleware ]       [ restrictTo Middleware ]      [ Controller ]
    |                              |                              |                        |
    |-- GET /api/ai/premium ------>|                              |                        |
    |   (Auth: Bearer <Token>)     |-- 1. Verify Signature ------|                        |
    |                              |-- 2. Fetch User & Lock state |                        |
    |                              |-- 3. Set req.user -----------|                        |
    |                              |                              |-- 4. Check Role -----|                        |
    |                              |                              |      (Premium/Admin?)  |                        |
    |                              |                              |                        |-- 5. Process prompt ->|
    |<-- 200 Response Payload -------------------------------------------------------------|
```

### 3. Refresh Token Rotation (RTR) & Reuse Detection Flow
```text
[ Client ]                        [ Server (tokenService) ]           [ MongoDB ]
    |                                 |                                    |
    |--- 1. POST /refresh ----------->|                                    |
    |    (Cookie: refreshToken)       |--- 2. Verify Signature ----------->| (Find Token)
    |                                 |                                    |
    |                                 |-- CASE A: Token Valid & Active ----|
    |                                 |   - Mark old token as revoked      | (Revoke old token)
    |                                 |   - Generate new Access & Refresh  | (Save new token)
    |                                 |   - Set new cookie                 |
    |<-- 200 { success, accessToken }-|                                    |
    |                                 |                                    |
    |                                 |-- CASE B: Token Already Revoked ---|
    |                                 |   (REUSE DETECTED / BREACH!)       |
    |                                 |   - Revoke ALL user tokens ------->| (Delete all tokens)
    |<-- 401 Unauthorized ------------|                                    |
```

---

## JWT Lifecycle & Refresh Token Rotation

### JWT Access Token (Short-lived)
- **Life**: 15 minutes (`JWT_ACCESS_EXPIRE=15m`)
- **Payload**: Contains `{ id, email, role, jti }`.
- **Purpose**: Stateless verification. The server decrypts and validates the signature on every request without contacting the database, making requests fast and scalable.

### JWT Refresh Token (Long-lived)
- **Life**: 7 days (`JWT_REFRESH_EXPIRE=7d`)
- **Payload**: Contains `{ id, email, role, jti }`.
- **Storage**: Stored in a database whitelist (`refreshtokens` collection) and sent to the client inside a secure, `httpOnly`, `sameSite: "strict"` cookie. It cannot be accessed by client-side Javascript, protecting it from Cross-Site Scripting (XSS) attacks.

### Refresh Token Rotation (RTR)
When the access token expires, the client calls `/api/auth/refresh`. The server:
1. Validates the incoming refresh token.
2. Checks if it is in the database whitelist.
3. Invalidates the old refresh token (`revoked: true`) and links it to the new one (`replacedByToken`).
4. Generates a fresh access token and a brand-new rotated refresh token.
5. Saves the new refresh token in the database whitelist and returns it to the client via cookie.

### Automatic Reuse Detection (Replay Defense)
If an attacker steals a revoked refresh token and attempts to replay it:
1. The server detects that the token presented has `revoked: true`.
2. This suggests a session hijack. The server immediately takes drastic actions to secure the account: it **invalidates and deletes all active refresh tokens** for that user from the database.
3. The server rejects the request with a `401 Unauthorized` response.
4. The legitimate user is forced to log in again, terminating the attacker's access immediately.

---

## Role-Based Access Control (RBAC)

RBAC allows endpoints to limit access based on the user's role:

| Endpoint | Free_User | Premium_User | Admin |
|---|---|---|---|
| `GET /api/ai/free-model` | ✓ | ✓ | ✓ |
| `POST /api/ai/premium-model` | ✗ (403) | ✓ | ✓ |
| `DELETE /api/ai/purge-cache` | ✗ (403) | ✗ (403) | ✓ |

Implemented via the `restrictTo(...roles)` middleware factory. It inspects `req.user.role` (populated by the `protect` middleware) and returns `403 Forbidden` if the role is not included in the allowed list.

---

## Security Protections

1. **Password Hashing**: Passwords are hashed with `bcryptjs` using a salt work factor of 10 during user creation. Plan text passwords never touch the database.
2. **Helmet HTTP Headers**: Helmet secures the app by setting various HTTP headers to prevent Clickjacking, MIME-sniffing, and XSS, and enforces a strict Content Security Policy.
3. **NoSQL Injection Prevention**: Utilizes `express-mongo-sanitize` to strip `$` and `.` characters from queries, preventing NoSQL injection attempts.
4. **Rate Limiting**: Uses `express-rate-limit` to restrict brute-force attacks on the `/api/auth/login` endpoint (maximum 20 attempts per 15 minutes) and general API misuse (100 requests per 15 minutes).
5. **Account Lockouts**: Accounts are locked for 15 minutes after 5 consecutive failed login attempts. Further requests are blocked early at the controller level.
6. **Audit Logs**: Critical API calls (registrations, logins, password changes, admin operations) are recorded in the `AuditLog` collection, logging the user, action, IP address, and user agent.
7. **CORS Protection**: CORS middleware restricts resource access to authorized origins and governs credentials/cookies transmission.
8. **Stateless JWT Verification**: Access tokens are verified using a server-side secret (`JWT_SECRET`) to ensure integrity.

---

## API Endpoints Documentation

### Authentication Routes (`/api/auth`)

#### 1. Register User
- **Method**: `POST`
- **Path**: `/api/auth/register`
- **Access**: Public
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!",
    "role": "Premium_User" // Optional, defaults to "Free_User"
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "user": {
      "id": "603f9f1b9b0d88001579abcd",
      "email": "user@example.com",
      "role": "Premium_User"
    }
  }
  ```

#### 2. Login User
- **Method**: `POST`
- **Path**: `/api/auth/login`
- **Access**: Public (Rate-limited to 20 reqs/15m)
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```
- **Headers Returned**:
  `Set-Cookie: refreshToken=...; HttpOnly; SameSite=Strict; Path=/; Max-Age=...`
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "603f9f1b9b0d88001579abcd",
      "email": "user@example.com",
      "role": "Premium_User"
    }
  }
  ```

#### 3. Refresh Access Token
- **Method**: `POST`
- **Path**: `/api/auth/refresh`
- **Access**: Public (requires HttpOnly refresh token cookie)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

#### 4. Logout User
- **Method**: `POST`
- **Path**: `/api/auth/logout`
- **Access**: Public (requires HttpOnly refresh token cookie)
- **Headers Returned**: Clears cookie
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Logged out successfully"
  }
  ```

### User Management Routes (`/api/user`)

#### 5. Get User Profile
- **Method**: `GET`
- **Path**: `/api/user/profile`
- **Access**: Private (Authenticated roles)
- **Headers**: `Authorization: Bearer <Access_Token>`
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "user": {
      "id": "603f9f1b9b0d88001579abcd",
      "email": "user@example.com",
      "role": "Premium_User",
      "createdAt": "2026-06-05T16:00:00.000Z"
    }
  }
  ```

#### 6. Change Password
- **Method**: `POST`
- **Path**: `/api/user/change-password`
- **Access**: Private (Authenticated roles)
- **Headers**: `Authorization: Bearer <Access_Token>`
- **Body**:
  ```json
  {
    "oldPassword": "Password123!",
    "newPassword": "NewPassword123!"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Password changed successfully"
  }
  ```

### AI Endpoint Routes (`/api/ai`)

#### 7. Access Free Model
- **Method**: `GET`
- **Path**: `/api/ai/free-model`
- **Access**: Private (Free_User, Premium_User, Admin)
- **Headers**: `Authorization: Bearer <Access_Token>`
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Free AI model response",
    "model": "AI-Genius Free-Text v1",
    "user": { ... },
    "data": { ... }
  }
  ```

#### 8. Access Premium Model
- **Method**: `POST`
- **Path**: `/api/ai/premium-model`
- **Access**: Private (Premium_User, Admin only)
- **Headers**: `Authorization: Bearer <Access_Token>`
- **Body**:
  ```json
  {
    "prompt": "Custom Prompt here"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Premium AI model response",
    "model": "AI-Genius Premium-GPT4x & DALL-E 3 Combo",
    "data": { ... }
  }
  ```

#### 9. Purge System Cache
- **Method**: `DELETE`
- **Path**: `/api/ai/purge-cache`
- **Access**: Private (Admin only)
- **Headers**: `Authorization: Bearer <Access_Token>`
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "AI cache purged successfully",
    "action": "PURGE_CACHE"
  }
  ```

---

## Sample API Payloads

Here are examples of real request/response interactions matching the Postman collection exports.

### 1. Register User (Valid)
- **POST** `http://localhost:5000/api/auth/register`
- **Request Body**:
  ```json
  {
    "email": "test_register@aigenius.com",
    "password": "Password123!",
    "role": "Free_User"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "user": {
      "id": "6a22fec4fb4c536930bbb123",
      "email": "test_register@aigenius.com",
      "role": "Free_User"
    }
  }
  ```

### 2. Login User (Success)
- **POST** `http://localhost:5000/api/auth/login`
- **Request Body**:
  ```json
  {
    "email": "free@aigenius.com",
    "password": "Free123!"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhMjJmZWM0ZmI0YzUzNjkzMGJiYmIxZSIsImVtYWlsIjoiZnJlZUBhaWdlbml1cy5jb20iLCJyb2xlIjoiRnJlZV9Vc2VyIn0.abcdef...",
    "user": {
      "id": "6a22fec4fb4c536930bbbee1",
      "email": "free@aigenius.com",
      "role": "Free_User"
    }
  }
  ```

### 3. Login User (Incorrect Password Fail)
- **POST** `http://localhost:5000/api/auth/login`
- **Request Body**:
  ```json
  {
    "email": "free@aigenius.com",
    "password": "WrongPassword!"
  }
  ```
- **Response (401 Unauthorized)**:
  ```json
  {
    "success": false,
    "message": "Invalid credentials"
  }
  ```

### 4. Login User (Account Lockout)
After 5 failed attempts:
- **POST** `http://localhost:5000/api/auth/login`
- **Request Body**:
  ```json
  {
    "email": "free@aigenius.com",
    "password": "Free123!"
  }
  ```
- **Response (401 Unauthorized)**:
  ```json
  {
    "success": false,
    "message": "Your account is locked due to multiple failed login attempts. Please try again later."
  }
  ```

### 5. Access Premium Model (Forbidden for Free_User)
- **POST** `http://localhost:5000/api/ai/premium-model`
- **Headers**: `Authorization: Bearer <Free_User_Access_Token>`
- **Response (403 Forbidden)**:
  ```json
  {
    "success": false,
    "message": "Forbidden: Role 'Free_User' is not authorized to access this resource"
  }
  ```

### 6. Centralized Error Handler Catching Route 404
- **GET** `http://localhost:5000/api/ai/non-existent-route`
- **Response (404 Not Found)**:
  ```json
  {
    "success": false,
    "message": "API endpoint '/api/ai/non-existent-route' not found"
  }
  ```
