import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// __dirname is backend/config/ — go up twice to reach project root where .env lives
// backend/config/ -> backend/ -> SE-Project/ (project root)
dotenv.config({ path: join(__dirname, '../../.env') });

if (!admin.apps.length) {
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase credentials in .env — ensure FIREBASE_PROJECT_ID, ' +
      'FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set.'
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

const db = admin.firestore();

export { admin, db };