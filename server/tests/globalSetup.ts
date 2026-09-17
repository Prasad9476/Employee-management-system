import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Recreates a throwaway SQLite database for the test run.
export default function globalSetup(): void {
  const dbFile = path.join(__dirname, '..', 'prisma', 'test.db');
  if (fs.existsSync(dbFile)) {
    fs.unlinkSync(dbFile);
  }

  const prismaCli = path.join(__dirname, '..', 'node_modules', 'prisma', 'build', 'index.js');
  execSync(`node "${prismaCli}" db push --skip-generate`, {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });
}