require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

const serviceAccount = {
  "type": "service_account",
  "project_id": "hortitrack",
  "private_key_id": "62a972fd8c3f9c2ec5b36010e084c5f854da321c",
  "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  "client_email": "firebase-adminsdk-fbsvc@hortitrack.iam.gserviceaccount.com",
  "client_id": "111374743050043984354",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40hortitrack.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://hortitrack-default-rtdb.europe-west1.firebasedatabase.app"
});

const db = admin.firestore();

const addDummyBatch = async () => {
  const batch = {
    batchNumber: 'DUMMY-001',
    plantFamily: 'Dummy Family',
    plantVariety: 'Dummy Variety',
    status: 'Propagation',
    quantity: 10,
    size: 'Seed',
    location: 'Greenhouse 1',
    plantingDate: '2024-01-01',
    initialQuantity: 10,
    qrCode: 'dummy-qr-code',
    logHistory: [{ date: new Date().toISOString(), action: 'Dummy batch created.' }],
  };

  try {
    await db.collection('batches').add(batch);
    console.log('Dummy batch added successfully.');
  } catch (error) {
    console.error('Error adding dummy batch:', error);
  } finally {
    process.exit();
  }
};

addDummyBatch();
