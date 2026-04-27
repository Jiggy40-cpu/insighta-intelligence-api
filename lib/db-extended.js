import pkg from 'pg';
import { randomUUID } from 'crypto';

const { Client } = pkg;
const uuidv7 = randomUUID;

let client = null;

export const getClient = async () => {
  if (!client) {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
  }
  return client;
};

// Initialize schema for Stage 3
export const initializeExtendedDatabase = async () => {
  try {
    const client = await getClient();

    const createTablesQuery = `
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        github_id INT UNIQUE NOT NULL,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255),
        avatar_url TEXT,
        role VARCHAR(50) DEFAULT 'analyst',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Tokens table
      CREATE TABLE IF NOT EXISTS tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        token_type VARCHAR(50),
        expires_at TIMESTAMP NOT NULL,
        revoked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- API Keys table
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key_hash VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255),
        last_used_at TIMESTAMP,
        revoked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Request logs table
      CREATE TABLE IF NOT EXISTS request_logs (
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

      -- Existing profiles table
      CREATE TABLE IF NOT EXISTS profiles (
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

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
      CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
      CREATE INDEX IF NOT EXISTS idx_request_logs_user_id ON request_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_profiles_gender ON profiles(gender);
      CREATE INDEX IF NOT EXISTS idx_profiles_age_group ON profiles(age_group);
      CREATE INDEX IF NOT EXISTS idx_profiles_country_id ON profiles(country_id);
      CREATE INDEX IF NOT EXISTS idx_profiles_age ON profiles(age);
      CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);
    `;

    await client.query(createTablesQuery);
    console.log('✅ Extended database initialized');
  } catch (error) {
    console.error('Database init error:', error.message);
  }
};

// User operations
export const createOrUpdateUser = async (githubUser) => {
  const client = await getClient();

  const query = `
    INSERT INTO users (github_id, username, email, avatar_url, role)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (github_id) DO UPDATE SET
      email = $3,
      avatar_url = $4,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;

  const result = await client.query(query, [
    githubUser.id,
    githubUser.login,
    githubUser.email,
    githubUser.avatar_url,
    'analyst'
  ]);

  return result.rows[0];
};

// Get user by ID
export const getUserById = async (userId) => {
  const client = await getClient();
  const result = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
  return result.rows[0] || null;
};

// Get user by GitHub ID
export const getUserByGithubId = async (githubId) => {
  const client = await getClient();
  const result = await client.query('SELECT * FROM users WHERE github_id = $1', [githubId]);
  return result.rows[0] || null;
};

// Store token
export const storeToken = async (userId, tokenHash, tokenType, expiresAt) => {
  const client = await getClient();
  const query = `
    INSERT INTO tokens (user_id, token_hash, token_type, expires_at)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const result = await client.query(query, [userId, tokenHash, tokenType, expiresAt]);
  return result.rows[0];
};

// Log request
export const logRequest = async (userId, method, path, statusCode, responseTimeMs, ipAddress, userAgent) => {
  const client = await getClient();
  const query = `
    INSERT INTO request_logs (user_id, method, path, status_code, response_time_ms, ip_address, user_agent)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  return client.query(query, [userId, method, path, statusCode, responseTimeMs, ipAddress, userAgent]);
};

// Query profiles (existing function, enhanced)
export const queryProfiles = async (filters, sort, pagination) => {
  const client = await getClient();

  let query = 'SELECT * FROM profiles WHERE 1=1';
  const values = [];
  let paramCount = 1;

  if (filters.gender) {
    query += ` AND gender = $${paramCount}`;
    values.push(filters.gender);
    paramCount++;
  }

  if (filters.age_group) {
    query += ` AND age_group = $${paramCount}`;
    values.push(filters.age_group);
    paramCount++;
  }

  if (filters.country_id) {
    query += ` AND country_id = $${paramCount}`;
    values.push(filters.country_id);
    paramCount++;
  }

  if (filters.min_age !== undefined) {
    query += ` AND age >= $${paramCount}`;
    values.push(filters.min_age);
    paramCount++;
  }

  if (filters.max_age !== undefined) {
    query += ` AND age <= $${paramCount}`;
    values.push(filters.max_age);
    paramCount++;
  }

  if (filters.min_gender_probability !== undefined) {
    query += ` AND gender_probability >= $${paramCount}`;
    values.push(filters.min_gender_probability);
    paramCount++;
  }

  if (filters.min_country_probability !== undefined) {
    query += ` AND country_probability >= $${paramCount}`;
    values.push(filters.min_country_probability);
    paramCount++;
  }

  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
  const countResult = await client.query(countQuery, values);
  const total = parseInt(countResult.rows[0].count);

  if (sort.by && ['age', 'created_at', 'gender_probability'].includes(sort.by)) {
    query += ` ORDER BY ${sort.by} ${sort.order === 'desc' ? 'DESC' : 'ASC'}`;
  } else {
    query += ' ORDER BY created_at DESC';
  }

  const limit = Math.min(pagination.limit || 10, 50);
  const page = pagination.page || 1;
  const offset = (page - 1) * limit;

  query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  values.push(limit, offset);

  const result = await client.query(query, values);

  return {
    data: result.rows,
    total,
    page,
    limit,
  };
};
