# Insighta Labs+ Intelligence API

**A high-performance demographic profile querying system with OAuth 2.0 PKCE, RBAC, and advanced filtering capabilities.**

## Stage 3 Features

### 🔐 Authentication & Security
- **OAuth 2.0 with PKCE** - Secure GitHub-based authentication
- **JWT Tokens** - Access & refresh token management
- **Role-Based Access Control (RBAC)** - Admin & Analyst roles
- **Token Storage & Revocation** - Secure token management in database
- **Rate Limiting** - Prevent abuse with configurable request limits
- **Request Logging** - Track all API usage for audit trails

### 📊 Data Access
- **Advanced Filtering** - Filter by gender, age group, country, probabilities
- **Sorting** - Sort by age, creation date, gender probability
- **Pagination** - Limit results up to 50 per request
- **Natural Language Search** - Parse human-readable queries

### 📤 Data Export
- **CSV Export** - Download filtered results as CSV
- **JSON Export** - Download filtered results as JSON
- **Configurable Limits** - Control max export rows

### 📈 Monitoring
- **Request Logging** - All requests logged with status, response time, IP
- **User Tracking** - Monitor per-user API usage
- **Performance Metrics** - Response time tracking

## Prerequisites

- Node.js 16+
- PostgreSQL 12+
- GitHub OAuth Application (for authentication)

## Installation

1. **Clone the repository**
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

4. **Configure GitHub OAuth**
   - Create OAuth App: https://github.com/settings/developers
   - Set callback URL: `http://localhost:3000/api/v1/auth/callback`
   - Add credentials to `.env.local`

5. **Configure database**
   ```bash
   # Update DATABASE_URL in .env.local
   export DATABASE_URL="postgres://user:password@localhost:5432/insighta"
   ```

6. **Start the server**
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication

**POST /api/v1/auth/oauth/initiate**
- Initiates OAuth 2.0 flow with PKCE
- Returns authorization URL
```bash
curl http://localhost:3000/api/v1/auth/oauth/initiate
```

**GET /api/v1/auth/callback**
- OAuth callback endpoint
- Exchanges authorization code for tokens

**POST /api/v1/auth/refresh**
- Refreshes access token using refresh token
```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"your_refresh_token"}'
```

**POST /api/v1/auth/logout**
- Logs out user and invalidates tokens
```bash
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Authorization: Bearer your_access_token"
```

### Profiles Query

**GET /api/v1/profiles**
- Query profiles with advanced filters
- Requires authentication

```bash
curl -X GET 'http://localhost:3000/api/v1/profiles?gender=male&age_group=adult&page=1&limit=10' \
  -H "Authorization: Bearer your_access_token"
```

**Query Parameters:**
- `gender` - `male` or `female`
- `age_group` - `child`, `teenager`, `adult`, `senior`
- `country_id` - ISO country code (e.g., `NG`, `KE`, `ZA`)
- `min_age` - Minimum age
- `max_age` - Maximum age
- `min_gender_probability` - 0-1
- `min_country_probability` - 0-1
- `sort_by` - `age`, `created_at`, `gender_probability`
- `order` - `asc` or `desc`
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 10, max: 50)

### Natural Language Search

**GET /api/v1/search**
- Parse natural language queries
- Requires authentication

```bash
curl -X GET 'http://localhost:3000/api/v1/search?q=young%20females%20from%20Nigeria' \
  -H "Authorization: Bearer your_access_token"
```

**Supported Query Examples:**
- "young males from Nigeria"
- "females aged 30 or older from Kenya"
- "children from South Africa"
- "teenagers"
- "adults aged 25-40"

### Data Export

**GET /api/v1/export/csv**
- Export filtered profiles as CSV
- Requires analyst or admin role

```bash
curl -X GET 'http://localhost:3000/api/v1/export/csv?gender=male&limit=1000' \
  -H "Authorization: Bearer your_access_token" \
  -H "Accept: text/csv" \
  -o profiles.csv
```

**GET /api/v1/export/json**
- Export filtered profiles as JSON
- Requires analyst or admin role

```bash
curl -X GET 'http://localhost:3000/api/v1/export/json?country_id=NG' \
  -H "Authorization: Bearer your_access_token" \
  -H "Accept: application/json" \
  -o profiles.json
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  github_id INT UNIQUE NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255),
  avatar_url TEXT,
  role VARCHAR(50) DEFAULT 'analyst',
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Profiles Table
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  gender VARCHAR(10) NOT NULL,
  gender_probability FLOAT NOT NULL,
  age INT NOT NULL,
  age_group VARCHAR(20) NOT NULL,
  country_id VARCHAR(2) NOT NULL,
  country_name VARCHAR(100) NOT NULL,
  country_probability FLOAT NOT NULL,
  created_at TIMESTAMP
);
```

### Request Logs Table
```sql
CREATE TABLE request_logs (
  id UUID PRIMARY KEY,
  user_id UUID,
  method VARCHAR(10),
  path VARCHAR(500),
  status_code INT,
  response_time_ms INT,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP
);
```

## Configuration

Key environment variables in `.env.local`:

```bash
# Database
DATABASE_URL=postgres://...

# OAuth
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_REDIRECT_URI=http://localhost:3000/api/v1/auth/callback

# JWT
JWT_ACCESS_SECRET=your_secret
JWT_REFRESH_SECRET=your_secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Export
MAX_CSV_ROWS=50000
```

## Response Examples

### Success Response
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

### Error Response
```json
{
  "status": "error",
  "message": "Invalid pagination parameters"
}
```

## Security Considerations

1. **OAuth 2.0 PKCE** - Protects against authorization code interception
2. **JWT Tokens** - Short-lived access tokens (15m) + long-lived refresh tokens (7d)
3. **Role-Based Access** - Different permissions for admin vs analyst roles
4. **Rate Limiting** - 100 requests per 15 minutes (configurable)
5. **Request Logging** - Track all API access for audit trails
6. **HTTPS Recommended** - Use HTTPS in production
7. **Token Secrets** - Keep JWT secrets strong and in environment variables

## Development

**Run in development mode**
```bash
npm run dev
```

**Seed database**
```bash
npm run seed
```

**Build for production**
```bash
npm run build
```

**Start production server**
```bash
npm start
```

## License

ISC
