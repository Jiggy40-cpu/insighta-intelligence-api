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

export const initializeDatabase = async () => {
  try {
    const client = await getClient();

    const createTableQuery = `
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

      CREATE INDEX IF NOT EXISTS idx_gender ON profiles(gender);
      CREATE INDEX IF NOT EXISTS idx_age_group ON profiles(age_group);
      CREATE INDEX IF NOT EXISTS idx_country_id ON profiles(country_id);
      CREATE INDEX IF NOT EXISTS idx_age ON profiles(age);
      CREATE INDEX IF NOT EXISTS idx_created_at ON profiles(created_at);
    `;

    await client.query(createTableQuery);
    console.log('✅ Database initialized');
  } catch (error) {
    console.error('Database init error:', error.message);
  }
};

export const seedDatabase = async (profiles) => {
  const client = await getClient();

  const countResult = await client.query('SELECT COUNT(*) FROM profiles');
  const count = parseInt(countResult.rows[0].count);

  if (count > 0) {
    console.log(`✅ Database already has ${count} profiles. Skipping seed.`);
    return;
  }

  console.log(`🌱 Seeding ${profiles.length} profiles...`);
  
  let inserted = 0;
  for (const profile of profiles) {
    try {
      const query = `
        INSERT INTO profiles (id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (name) DO NOTHING
      `;

      const values = [
        uuidv7(),
        profile.name,
        profile.gender,
        profile.gender_probability || 0.5,
        profile.age,
        profile.age_group,
        profile.country_id,
        profile.country_name,
        profile.country_probability || 0.5,
        new Date().toISOString(),
      ];

      await client.query(query, values);
      inserted++;
    } catch (error) {
      console.error(`Error inserting ${profile.name}:`, error.message);
    }
  }

  console.log(`✅ Inserted ${inserted}/${profiles.length} profiles`);
};

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