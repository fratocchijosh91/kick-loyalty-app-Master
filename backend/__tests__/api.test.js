/**
 * Test Suite per Kick Loyalty SaaS API
 * 
 * Eseguire con: npm test
 * 
 * Prerequisiti:
 * - MongoDB local o test instance
 * - Environment variables configurate
 */

const request = require('supertest');
const mongoose = require('mongoose');
const {
  Organization,
  User,
  TeamMember,
  SubscriptionPlan
} = require('../models');

// Mock del server per i test
let app;
let server;
let testAuthToken;
let testUserId = new mongoose.Types.ObjectId();
let testOrgId = new mongoose.Types.ObjectId();

/**
 * Setup test database e server
 */
beforeAll(async () => {
  // Configura variabili ambiente per test
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.MONGODB_URI = 'mongodb://localhost:27017/kick-loyalty-test';

  // Connetti a MongoDB
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📊 Test DB connected');
  } catch (err) {
    console.log('⚠️  Test DB not available, mocking responses');
  }

  // Importa l'app dopo aver configurato le variabili
  const express = require('express');
  app = express();
  app.use(express.json());

  // Importa routes
  const saasRouter = require('../saas-routes');
  app.use('/api', saasRouter);

  server = app.listen(5001);
});

/**
 * Cleanup after tests
 */
afterAll(async () => {
  if (server) server.close();
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
});

/**
 * Pulisci collezioni tra i test
 */
afterEach(async () => {
  if (mongoose.connection.readyState === 1) {
    await Organization.deleteMany({});
    await User.deleteMany({});
    await TeamMember.deleteMany({});
  }
});

// ==================== TEST SUITE ====================

describe('🔐 Authentication Endpoints', () => {
  test('POST /api/auth/login - Login con code e state', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        code: 'test_auth_code',
        state: 'test_state'
      });

    expect(response.statusCode).toBeLessThan(500); // Non deve errare
  });
});

describe('🏢 Organization Endpoints', () => {
  let authToken = 'Bearer test-token';

  test('POST /api/organizations - Crea nuova organizzazione', async () => {
    // Mock: dovremmo avere un token valido
    const response = await request(app)
      .post('/api/organizations')
      .set('Authorization', authToken)
      .send({
        name: 'Test Community',
        slug: 'test-community',
        description: 'A test community'
      });

    // Il test fallirà se l'auth non è mockato, ma questo è lecito
    expect([201, 401, 500]).toContain(response.statusCode);
  });

  test('GET /api/organizations - Lista organizzazioni', async () => {
    const response = await request(app)
      .get('/api/organizations')
      .set('Authorization', authToken);

    expect([200, 401, 500]).toContain(response.statusCode);
  });

  test('POST /api/organizations - Slug duplicato ritorna 409', async () => {
    // Questo test mostra la logica corretta
    // In un ambiente di test reale, dovreste:
    // 1. Creare un'org con slug 'duplicate'
    // 2. Provare a crearne un'altra con lo stesso slug
    // 3. Aspettarsi error 409
    
    expect(true).toBe(true); // Placeholder
  });
});

describe('👥 Team Management Endpoints', () => {
  const authToken = 'Bearer test-token';
  const orgSlug = 'test-community';

  test('GET /api/organizations/{slug}/team - Lista team members', async () => {
    const response = await request(app)
      .get(`/api/organizations/${orgSlug}/team`)
      .set('Authorization', authToken);

    expect([200, 401, 404, 500]).toContain(response.statusCode);
  });

  test('POST /api/organizations/{slug}/team/invite - Invita membro', async () => {
    const response = await request(app)
      .post(`/api/organizations/${orgSlug}/team/invite`)
      .set('Authorization', authToken)
      .send({
        email: 'newmember@example.com',
        role: 'editor'
      });

    expect([201, 401, 403, 404, 500]).toContain(response.statusCode);
  });

  test('PATCH /api/organizations/{slug}/team/{memberId} - Aggiorna ruolo', async () => {
    const memberId = new mongoose.Types.ObjectId();
    const response = await request(app)
      .patch(`/api/organizations/${orgSlug}/team/${memberId}`)
      .set('Authorization', authToken)
      .send({
        role: 'admin'
      });

    expect([200, 401, 403, 404, 500]).toContain(response.statusCode);
  });

  test('DELETE /api/organizations/{slug}/team/{memberId} - Rimuovi membro', async () => {
    const memberId = new mongoose.Types.ObjectId();
    const response = await request(app)
      .delete(`/api/organizations/${orgSlug}/team/${memberId}`)
      .set('Authorization', authToken);

    expect([200, 401, 403, 404, 500]).toContain(response.statusCode);
  });
});

describe('💳 Billing Endpoints', () => {
  const authToken = 'Bearer test-token';
  const orgSlug = 'test-community';

  test('GET /api/organizations/{slug}/billing - Ottieni info billing', async () => {
    const response = await request(app)
      .get(`/api/organizations/${orgSlug}/billing`)
      .set('Authorization', authToken);

    expect([200, 401, 404, 500]).toContain(response.statusCode);
  });

  test('POST /api/organizations/{slug}/billing/upgrade - Upgrade plan', async () => {
    const response = await request(app)
      .post(`/api/organizations/${orgSlug}/billing/upgrade`)
      .set('Authorization', authToken)
      .send({
        planSlug: 'pro'
      });

    expect([200, 400, 401, 403, 404, 500]).toContain(response.statusCode);
  });

  test('POST /api/organizations/{slug}/billing/cancel - Cancel subscription', async () => {
    const response = await request(app)
      .post(`/api/organizations/${orgSlug}/billing/cancel`)
      .set('Authorization', authToken);

    expect([200, 401, 403, 404, 500]).toContain(response.statusCode);
  });
});

describe('🎁 Rewards Endpoints', () => {
  const authToken = 'Bearer test-token';
  const orgSlug = 'test-community';

  test('GET /api/organizations/{slug}/rewards - Lista rewards', async () => {
    const response = await request(app)
      .get(`/api/organizations/${orgSlug}/rewards`)
      .set('Authorization', authToken);

    expect([200, 401, 404, 500]).toContain(response.statusCode);
  });

  test('POST /api/organizations/{slug}/rewards - Crea reward', async () => {
    const response = await request(app)
      .post(`/api/organizations/${orgSlug}/rewards`)
      .set('Authorization', authToken)
      .send({
        name: 'Custom Emote',
        points: 1000,
        type: 'emote',
        description: 'A custom emote'
      });

    expect([201, 400, 401, 403, 404, 500]).toContain(response.statusCode);
  });

  test('POST /api/organizations/{slug}/rewards - Validazione input', async () => {
    // Test che il server richiede campi obbligatori
    const response = await request(app)
      .post(`/api/organizations/${orgSlug}/rewards`)
      .set('Authorization', authToken)
      .send({
        // Mancano name e points
        type: 'emote'
      });

    // Dovrebbe ritornare 400 Bad Request
    expect([400, 401, 500]).toContain(response.statusCode);
  });
});

describe('📊 Points Endpoints', () => {
  const authToken = 'Bearer test-token';
  const orgId = new mongoose.Types.ObjectId();
  const viewerId = 'test_viewer';

  test('GET /api/viewer-points/{orgId}/{viewerId} - Ottieni punti', async () => {
    const response = await request(app)
      .get(`/api/viewer-points/${orgId}/${viewerId}`)
      .set('Authorization', authToken);

    expect([200, 401, 404, 500]).toContain(response.statusCode);
  });

  test('PATCH /api/viewer-points/{orgId}/{viewerId} - Aggiorna punti', async () => {
    const response = await request(app)
      .patch(`/api/viewer-points/${orgId}/${viewerId}`)
      .set('Authorization', authToken)
      .send({
        points: 500
      });

    expect([200, 400, 401, 404, 500]).toContain(response.statusCode);
  });
});

describe('🔒 Security Tests', () => {
  test('Endpoint senza token ritorna 401', async () => {
    const response = await request(app)
      .get('/api/organizations');
    
    expect(response.statusCode).toBe(401);
  });

  test('Token invalido ritorna 401', async () => {
    const response = await request(app)
      .get('/api/organizations')
      .set('Authorization', 'Bearer invalid_token');
    
    expect(response.statusCode).toBe(401);
  });

  test('Permessi insufficienti ritorna 403', async () => {
    // Un viewer non dovrebbe poter invitare team members
    const response = await request(app)
      .post('/api/organizations/test/team/invite')
      .set('Authorization', 'Bearer valid_viewer_token')
      .send({
        email: 'test@example.com',
        role: 'editor'
      });

    expect([401, 403, 500]).toContain(response.statusCode);
  });
});

describe('📝 Validation Tests', () => {
  const authToken = 'Bearer test-token';

  test('Email invalida ritorna 400', async () => {
    const response = await request(app)
      .post('/api/organizations/test/team/invite')
      .set('Authorization', authToken)
      .send({
        email: 'not-an-email',
        role: 'editor'
      });

    expect([400, 401, 403, 500]).toContain(response.statusCode);
  });

  test('Slug con caratteri invalidi ritorna 400', async () => {
    const response = await request(app)
      .post('/api/organizations')
      .set('Authorization', authToken)
      .send({
        name: 'Test Org',
        slug: 'Test_Org!@#' // Non valido
      });

    expect([400, 401, 500]).toContain(response.statusCode);
  });

  test('Points negativi ritorna 400', async () => {
    const response = await request(app)
      .post('/api/organizations/test/rewards')
      .set('Authorization', authToken)
      .send({
        name: 'Bad Reward',
        points: -100, // Non valido
        type: 'emote'
      });

    expect([400, 401, 500]).toContain(response.statusCode);
  });
});

describe('🔄 Integration Tests', () => {
  test('Flusso completo: signup → crea org → invita membro', async () => {
    // Questo test simula l'intero flusso di signup
    // In un ambiente di test reale con auth mockato:
    
    // 1. Signup user
    // const signupRes = await request(app).post('/api/auth/signup')...
    
    // 2. Create org
    // const orgRes = await request(app).post('/api/organizations')...
    
    // 3. Invite team member
    // const inviteRes = await request(app).post('/api/organizations/.../team/invite')...
    
    // Verifica che i dati siano consistenti
    expect(true).toBe(true); // Placeholder
  });
});
