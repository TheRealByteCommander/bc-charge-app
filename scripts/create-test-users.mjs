import { initDb, insertUser } from '../server/db.mjs';
import crypto from 'crypto';

async function createTestUsers() {
  try {
    const db = await initDb();
    console.log('Database initialized.');

    const users = [];
    for (let i = 1; i <= 20; i++) {
      const id = crypto.randomUUID();
      const lastName = `Test_User${i}`;
      const email = `${lastName.toLowerCase()}@example.com`;
      const passwordHash = 'hashed_password_placeholder';
      const profile = {
        firstName: `Test`,
        lastName: lastName,
        displayName: lastName,
      };

      await insertUser({
        id,
        email,
        passwordHash,
        profile,
        stripeCustomerId: `cus_test_${i}`,
      });

      users.push({ id, email, lastName });
    }

    console.log('Successfully created 20 test users:');
    console.table(users);
  } catch (error) {
    console.error('Error creating test users:', error);
    process.exit(1);
  }
}

createTestUsers();
