# Insighta Labs+ Intelligence API

**A high-performance demographic profile querying system with OAuth 2.0 PKCE, RBAC, and advanced filtering capabilities for CLI and web interfaces.**

**Live Backend:** `https://insighta-intelligence-api-production-0611.up.railway.app`

---

## 📚 Table of Contents

- [System Architecture](#system-architecture)
- [Authentication Flow](#authentication-flow)
- [API Endpoints](#api-endpoints)
- [Role-Based Access Control](#role-based-access-control)
- [Token Handling](#token-handling)
- [Natural Language Parsing](#natural-language-parsing)
- [Installation & Setup](#installation--setup)
- [Environment Variables](#environment-variables)
- [Security Considerations](#security-considerations)
- [Deployment](#deployment)

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Insighta Labs+ Platform                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐    ┌──────────────────┐    ┌────────────┐ │
│  │   CLI Tool       │    │   Web Portal     │    │  GitHub    │ │
│  │ (Node.js)        │    │   (Next.js)      │    │   OAuth    │ │
│  └────────┬─────────┘    └────────┬─────────┘    └──────┬─────┘ │
│           │                       │                     │        │
│           └───────────────────────┼─────────────────────┘        │
│                                   │                              │
│           ┌───────────────────────▼───────────────────────┐     │
│           │     Insighta Labs+ Backend API                │     │
│           │  (Node.js + Express on Railway)              │     │
│           ├───────────────────────────────────────────────┤     │
│           │  • OAuth 2.0 PKCE Authentication             │     │
│           │  • JWT Token Management (Access+Refresh)     │     │
│           │  • Role-Based Access Control (RBAC)          │     │
│           │  • Profile Query & Filtering                 │     │
│           │  • Natural Language Search Parser            │     │
│           │  • CSV/JSON Export                           │     │
│           │  • Rate Limiting & Request Logging           │     │
│           │  • Request Logging & Audit Trail             │     │
│           └───────────────────────┬───────────────────────┘     │
│                                   │                              │
│           ┌───────────────────────▼───────────────────────┐     │
│           │     PostgreSQL Database (Railway)            │     │
│           ├───────────────────────────────────────────────┤     │
│           │  • Users (id, github_id, role, tokens)       │     │
│           │  • Profiles (demographic data)               │     │
│           │  • Tokens (JWT storage & revocation)         │     │
│           │  • Request Logs (audit trail)                │     │
│           └───────────────────────────────────────────────┘     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Authentication Flow

### OAuth 2.0 PKCE Flow (Secure for Public Clients)

```
┌─────────────┐                                      ┌──────────────┐
│  CLI/Web    │                                      │  GitHub      │
│  Client     │                                      │  OAuth       │
└──────┬──────┘                                      └──────┬───────┘
       │                                                    │
       │ 1. Generate code_verifier & code_challenge       │
       │    (locally, never sent to server)                │
       │                                                    │
       │ 2. GET /api/v1/auth/oauth/initiate               │
       │    (returns authorization URL)                   │
       │                                                    │
       │ 3. Redirect user to GitHub OAuth                 │
       │────────────────────────────────────────────────► │
       │                                                    │
       │                 4. User authorizes                │
       │                                                    │
       │ 5. GitHub redirects to /api/v1/auth/callback     │
       │    with authorization code                       │
       │◄─────────────────────────────────────────────────│
       │                                                    │
       │ 6. Exchange code + code_verifier for access token│
       │    (backend validates code_challenge)             │
       │                                                    │
       │ 7. Backend returns:                              │
       │    - access_token (15m expiry)                   │
       │    - refresh_token (7d expiry)                   │
       │    - user info                                   │
       │                                                    │
       ▼                                                    ▼
```

### Token Flow Diagram

```
Client Request
    │
    ├─ Has valid access_token? → YES → Send Request with Bearer Token
    │                                        │
    │                                        ▼
    │                                  Backend validates JWT
    │                                        │
    │                                        ├─ Valid? → ✅ Process Request
    │                                        │
    │                                        └─ Expired? → Check refresh_token
    │
    └─ NO or Expired Access Token
         │
         ├─ Has refresh_token? → YES → POST /api/v1/auth/refresh
         │                                   │
         │                                   ▼
         │                            Backend validates refresh_token
         │                                   │
         │                                   ├─ Valid? → Issue new access_token
         │                                   │
         │                                   └─ Expired? → Require login again
         │
         └─ NO → Redirect to /api/v1/auth/oauth/initiate (login)
```

---

## 📡 API Endpoints

### Base URL
```
https://insighta-intelligence-api-production-0611.up.railway.app
```

### Authentication Endpoints

#### **POST /api/v1/auth/oauth/initiate**
Initiates OAuth 2.0 flow with PKCE

**Request:**
```bash
curl https://insighta-intelligence-api-production-0611.up.railway.app/api/v1/auth/oauth/initiate
```

**Response (200):**
```json
{
  "status": "success",
  "authorization_url": "https://github.com/login/oauth/authorize?client_id=...",
  "state": "random_state_string_for_csrf_protection"
}
```

---

#### **GET /api/v1/auth/callback**
OAuth callback endpoint - exchanges authorization code for tokens

**Query Parameters:**
- `code` (string) - Authorization code from GitHub
- `state` (string) - CSRF protection token

**Response (302):**
- Sets HTTP-only cookies (for web portal)
- Returns tokens in JSON (for CLI)

**Response Body (200):**
```json
{
  "status": "success",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "github_id": 12345,
    "username": "john_doe",
    "email": "john@example.com",
    "avatar_url": "https://avatars.githubusercontent.com/u/12345?v=4",
    "role": "analyst"
  }
}
```

---

#### **POST /api/v1/auth/refresh**
Refresh access token using refresh token

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "status": "success",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 900
}
```

**Response (401):**
```json
{
  "status": "error",
  "message": "Invalid or expired refresh token"
}
```

---

#### **POST /api/v1/auth/logout**
Logout and invalidate tokens

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Logged out successfully"
}
```

---

### Profile Query Endpoints

#### **GET /api/v1/profiles**
Query profiles with advanced filtering, sorting, and pagination

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Query Parameters:**
```
gender               - male, female
age_group            - child, teenager, adult, senior
country_id           - ISO country code (NG, KE, ZA, etc.)
min_age              - Minimum age (0-100)
max_age              - Maximum age (0-100)
min_gender_probability - 0-1 (filter by confidence)
min_country_probability - 0-1 (filter by confidence)
sort_by              - age, created_at, gender_probability
order                - asc, desc (default: desc)
page                 - Page number (default: 1)
limit                - Results per page (default: 10, max: 50)
```

**Example Request:**
```bash
curl -X GET 'https://insighta-intelligence-api-production-0611.up.railway.app/api/v1/profiles?gender=male&age_group=adult&country_id=NG&page=1&limit=10' \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Response (200):**
```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 1250,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "John Doe",
      "gender": "male",
      "gender_probability": 0.95,
      "age": 28,
      "age_group": "adult",
      "country_id": "NG",
      "country_name": "Nigeria",
      "country_probability": 0.87,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Response (401):**
```json
{
  "status": "error",
  "message": "Access token required"
}
```

---

#### **GET /api/v1/search**
Natural language search for profiles

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Query Parameters:**
```
q - Natural language query
```

**Supported Query Examples:**
- "young males from Nigeria"
- "females aged 30 or older from Kenya"
- "children from South Africa"
- "teenagers"
- "adults aged 25-40"
- "senior males"

**Example Request:**
```bash
curl -X GET 'https://insighta-intelligence-api-production-0611.up.railway.app/api/v1/search?q=young%20females%20from%20Nigeria' \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Response (200):**
```json
{
  "status": "success",
  "query": "young females from Nigeria",
  "filters": {
    "gender": "female",
    "age_group": "teenager",
    "country_id": "NG"
  },
  "page": 1,
  "limit": 10,
  "total": 342,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Jane Smith",
      "gender": "female",
      "gender_probability": 0.92,
      "age": 17,
      "age_group": "teenager",
      "country_id": "NG",
      "country_name": "Nigeria",
      "country_probability": 0.89,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### Data Export Endpoints

#### **GET /api/v1/export/csv**
Export filtered profiles as CSV (requires analyst or admin role)

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
Accept: text/csv
```

**Query Parameters:**
Same as `/api/v1/profiles` (gender, age_group, country_id, etc.)

**Example Request:**
```bash
curl -X GET 'https://insighta-intelligence-api-production-0611.up.railway.app/api/v1/export/csv?gender=male&country_id=NG' \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Accept: text/csv" \
  -o profiles.csv
```

**Response (200):**
```csv
id,name,gender,gender_probability,age,age_group,country_id,country_name,country_probability
550e8400-e29b-41d4-a716-446655440000,John Doe,male,0.95,28,adult,NG,Nigeria,0.87
550e8400-e29b-41d4-a716-446655440001,Jane Smith,female,0.92,17,teenager,NG,Nigeria,0.89
```

---

#### **GET /api/v1/export/json**
Export filtered profiles as JSON (requires analyst or admin role)

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
Accept: application/json
```

**Example Request:**
```bash
curl -X GET 'https://insighta-intelligence-api-production-0611.up.railway.app/api/v1/export/json?country_id=KE' \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -o profiles.json
```

**Response (200):**
```json
{
  "status": "success",
  "total": 1250,
  "exported_count": 100,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "John Doe",
      "gender": "male",
      "gender_probability": 0.95,
      "age": 28,
      "age_group": "adult",
      "country_id": "KE",
      "country_name": "Kenya",
      "country_probability": 0.87,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

## 👥 Role-Based Access Control

### Roles

| Role | Permissions |
|------|-----------|
| **admin** | All endpoints, user management, system config |
| **analyst** | Query, search, export profiles |

### Enforcement

All protected endpoints check the `Authorization` header:

```
Authorization: Bearer <access_token>
```

The JWT payload contains:
```json
{
  "sub": "user_id",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "john_doe",
  "role": "analyst",
  "iat": 1234567890,
  "exp": 1234569690
}
```

### Access Control Rules

```javascript
// GET /api/v1/profiles
Required Role: analyst or admin
Check: token.role !== 'analyst' && token.role !== 'admin' → 403

// GET /api/v1/export/csv
Required Role: analyst or admin
Check: token.role !== 'analyst' && token.role !== 'admin' → 403

// GET /api/v1/export/json
Required Role: analyst or admin
Check: token.role !== 'analyst' && token.role !== 'admin' → 403
```

---

## 🔑 Token Handling

### Token Types

**Access Token (JWT)**
- Duration: 15 minutes
- Used for: Authenticating API requests
- Storage: Memory (CLI), HTTP-only cookie (Web)
- Usage: `Authorization: Bearer <access_token>`

**Refresh Token (JWT)**
- Duration: 7 days
- Used for: Obtaining new access token
- Storage: Memory (CLI), HTTP-only cookie (Web)
- Usage: POST body in `/api/v1/auth/refresh`

### Token Validation

```
1. Extract token from Authorization header
2. Verify JWT signature using JWT_ACCESS_SECRET
3. Check token expiry (iat + exp)
4. Check token revocation status in database
5. If all valid, allow request
```

### Auto-Refresh Strategy

```
CLI:
  1. Before each request, check if access_token expired
  2. If expiry < 2 minutes away → call /api/v1/auth/refresh
  3. Use new access_token for request

Web:
  1. Axios interceptor checks response status
  2. If 401 Unauthorized → POST /api/auth/refresh
  3. Retry original request with new token
```

### Credential Storage

**CLI (~/.insighta/credentials.json):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "john_doe",
    "role": "analyst"
  },
  "expires_at": 1234569690
}
```

**Web Portal (HTTP-only Cookies):**
```
Set-Cookie: accessToken=...; HttpOnly; Secure; SameSite=Strict; Max-Age=900
Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
```

---

## 🔍 Natural Language Parsing

### Parser Logic

The NL parser converts human-readable queries to API filters:

```
Input: "young females from Nigeria"
Output: {
  gender: "female",
  age_group: "teenager",
  country_id: "NG"
}

Input: "adults aged 25-40 from Kenya"
Output: {
  age_group: "adult",
  min_age: 25,
  max_age: 40,
  country_id: "KE"
}

Input: "senior males"
Output: {
  gender: "male",
  age_group: "senior"
}
```

### Supported Keywords

**Gender:**
- male, man, boy, male → gender: "male"
- female, woman, girl, lady → gender: "female"

**Age Groups:**
- child, kid, boy, girl → age_group: "child"
- teenager, teen, adolescent → age_group: "teenager"
- adult, man, woman → age_group: "adult"
- senior, elderly, old → age_group: "senior"
- young → age_group: "teenager" or "adult"

**Countries:** Country names or ISO codes
- Nigeria (NG), Kenya (KE), South Africa (ZA), Egypt (EG), etc.

**Age Ranges:**
- "25-40" → min_age: 25, max_age: 40
- "older than 30" → min_age: 30
- "younger than 20" → max_age: 20

### Example Parsing

```javascript
// lib/nlp-parser.js

export const parseNaturalLanguage = (query) => {
  const filters = {};
  const lowerQuery = query.toLowerCase();

  // Gender detection
  if (lowerQuery.includes('male') || lowerQuery.includes('man') || lowerQuery.includes('boy')) {
    filters.gender = 'male';
  } else if (lowerQuery.includes('female') || lowerQuery.includes('woman') || lowerQuery.includes('girl')) {
    filters.gender = 'female';
  }

  // Age group detection
  if (lowerQuery.includes('child') || lowerQuery.includes('kid')) {
    filters.age_group = 'child';
  } else if (lowerQuery.includes('teenager') || lowerQuery.includes('teen')) {
    filters.age_group = 'teenager';
  } else if (lowerQuery.includes('adult')) {
    filters.age_group = 'adult';
  } else if (lowerQuery.includes('senior') || lowerQuery.includes('elderly')) {
    filters.age_group = 'senior';
  } else if (lowerQuery.includes('young')) {
    filters.age_group = 'teenager'; // default for "young"
  }

  // Country detection
  const countryMap = { 'nigeria': 'NG', 'kenya': 'KE', ... };
  for (const [country, code] of Object.entries(countryMap)) {
    if (lowerQuery.includes(country)) {
      filters.country_id = code;
    }
  }

  // Age range detection
  const ageRangeMatch = query.match(/(\d+)\s*-\s*(\d+)/);
  if (ageRangeMatch) {
    filters.min_age = parseInt(ageRangeMatch[1]);
    filters.max_age = parseInt(ageRangeMatch[2]);
  }

  return filters;
};
```

---

## 💻 Installation & Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- GitHub OAuth App credentials

### Local Development

1. **Clone repository**
```bash
git clone https://github.com/Jiggy40-cpu/insighta-intelligence-api.git
cd insighta-intelligence-api
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env.local
```

4. **Create GitHub OAuth App**
   - Go to https://github.com/settings/developers
   - Click "New OAuth App"
   - Set callback URL to `http://localhost:3000/api/v1/auth/callback`
   - Copy Client ID and Secret to `.env.local`

5. **Configure database**
```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/insighta"
```

6. **Start development server**
```bash
npm run dev
```

Server runs on `http://localhost:3000`

---

## 🔧 Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# GitHub OAuth
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_REDIRECT_URI=http://localhost:3000/api/v1/auth/callback
GITHUB_OAUTH_URL=https://github.com/login/oauth
GITHUB_API_URL=https://api.github.com

# JWT Tokens
JWT_ACCESS_SECRET=random_secret_32_chars_minimum
JWT_REFRESH_SECRET=random_secret_32_chars_minimum
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# Export
MAX_CSV_ROWS=50000

# Server
PORT=3000
NODE_ENV=development
```

---

## 🔒 Security Considerations

### 1. OAuth 2.0 PKCE
- Protects against authorization code interception
- Code verifier never sent over HTTPS (only to token endpoint)
- Code challenge sent to authorization server

### 2. JWT Tokens
- Short-lived access tokens (15 minutes)
- Long-lived refresh tokens (7 days)
- Tokens signed with strong secrets (32+ chars)
- Token revocation tracked in database

### 3. HTTP-Only Cookies (Web Portal)
- Cookies not accessible via JavaScript (prevents XSS theft)
- Secure flag (only sent over HTTPS)
- SameSite=Strict (prevents CSRF attacks)

### 4. CSRF Protection
- State parameter in OAuth flow
- CSRF tokens in form submissions
- Token validation before state changes

### 5. Rate Limiting
- 100 requests per 15 minutes per IP
- Configurable via environment variables
- Prevents brute force attacks

### 6. Request Logging
- All requests logged for audit trail
- User ID, IP address, endpoint, status code tracked
- Used for security monitoring

### 7. HTTPS Recommended
- Always use HTTPS in production
- Set Secure flag on cookies
- Redirect HTTP to HTTPS

### 8. Secrets Management
- JWT secrets stored in environment variables
- GitHub OAuth secrets stored securely
- Never commit secrets to repository
- Use `.env.local` and `.env.example` pattern

---

## 🚀 Deployment

### Railway Deployment

1. **Push to GitHub**
```bash
git add .
git commit -m "Stage 3: Complete platform"
git push origin main
```

2. **Configure Railway**
   - Connect GitHub repository
   - Add PostgreSQL service
   - Set environment variables
   - Deploy

3. **Update GitHub OAuth Callback**
   - Go to https://github.com/settings/developers
   - Update callback URL to production URL:
   ```
   https://insighta-intelligence-api-production-0611.up.railway.app/api/v1/auth/callback
   ```

4. **Database Migration**
   - Railway auto-creates PostgreSQL instance
   - Tables created on first run
   - Seed data can be loaded via `npm run seed`

---

## 📊 Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id INT UNIQUE NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255),
  avatar_url TEXT,
  role VARCHAR(50) DEFAULT 'analyst',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tokens Table
```sql
CREATE TABLE tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  token_type VARCHAR(50),
  expires_at TIMESTAMP NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Profiles Table
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  gender VARCHAR(10) NOT NULL,
  gender_probability FLOAT NOT NULL,
  age INT NOT NULL,
  age_group VARCHAR(20) NOT NULL,
  country_id VARCHAR(2) NOT NULL,
  country_name VARCHAR(100) NOT NULL,
  country_probability FLOAT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Request Logs Table
```sql
CREATE TABLE request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  method VARCHAR(10),
  path VARCHAR(500),
  status_code INT,
  response_time_ms INT,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 📝 License

ISC

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

---

## 📞 Support

For issues or questions:
1. Check the README and documentation
2. Review GitHub Issues
3. Create a new issue with detailed description
