import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Starting seed...');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Missing');

// Import after dotenv is loaded
import('./db.js').then(async ({ initializeDatabase, seedDatabase }) => {
  try {
    const profilesPath = path.resolve(__dirname, '../data/profiles.json');
    console.log('📄 Looking for:', profilesPath);

    if (!fs.existsSync(profilesPath)) {
      console.error('❌ File not found!');
      process.exit(1);
    }

    const rawData = fs.readFileSync(profilesPath, 'utf-8');
    console.log('📄 Raw file size:', rawData.length, 'bytes');

    let profiles;
    try {
      const parsed = JSON.parse(rawData);
      console.log('📦 Parsed type:', typeof parsed, 'Keys:', Object.keys(parsed || {}));
      
      // Extract profiles array
      if (Array.isArray(parsed)) {
        profiles = parsed;
      } else if (parsed && parsed.profiles && Array.isArray(parsed.profiles)) {
        profiles = parsed.profiles;
        console.log('📦 Extracted from .profiles key');
      } else if (parsed && parsed.data && Array.isArray(parsed.data)) {
        profiles = parsed.data;
        console.log('📦 Extracted from .data key');
      } else {
        console.error('❌ Could not find profiles array');
        process.exit(1);
      }
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError.message);
      process.exit(1);
    }

    if (!Array.isArray(profiles)) {
      console.error('❌ profiles is not an array. Type:', typeof profiles);
      process.exit(1);
    }

    console.log(`✅ Loaded ${profiles.length} profiles`);

    if (profiles.length === 0) {
      console.warn('⚠️ No profiles to seed');
      process.exit(0);
    }

    console.log('🔧 Initializing database...');
    await initializeDatabase();

    console.log('🌱 Seeding database...');
    await seedDatabase(profiles);

    console.log('✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}).catch(err => {
  console.error('❌ Failed to load modules:', err.message);
  process.exit(1);
});