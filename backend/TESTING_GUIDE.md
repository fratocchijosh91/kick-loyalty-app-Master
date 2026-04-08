# 🧪 Testing Guide

## Overview

Il backend Kick Loyalty ha una suite di test completa usando **Jest** e **Supertest**:

✅ Unit tests per business logic
✅ Integration tests per API endpoints
✅ Security tests per autenticazione/autorizzazione
✅ Validation tests per input sanitization
✅ Coverage reports

## Setup

### 1. Installa Dipendenze

```bash
cd backend
npm install
```

Jest e Supertest sono in devDependencies.

### 2. Configura MongoDB per Test (Opzionale)

Se vuoi test integration con DB reale:

```bash
# Installa MongoDB localmente
# macOS:
brew tap mongodb/brew
brew install mongodb-community

# Avvia MongoDB
brew services start mongodb-community
```

Oppure usa un container Docker:

```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

## Esecuzione Test

### Esegui tutti i test

```bash
npm test
```

### Watch mode (riesegui al cambio file)

```bash
npm run test:watch
```

### Coverage report

```bash
npm run test:coverage
```

Genera un report HTML in `coverage/` directory.

## Struttura Test

```
backend/
├── __tests__/
│   ├── api.test.js          - Test endpoint API
│   ├── auth.test.js         - Test autenticazione
│   ├── models.test.js       - Test modelli DB
│   └── middleware.test.js   - Test middleware
├── jest.config.js           - Configurazione Jest
└── jest.setup.js            - Setup comune (mocks, variabili)
```

## Tipi di Test

### 1. **Unit Tests**

Testano funzioni singole isolate:

```javascript
test('encryptPassword - Cripta password correttamente', () => {
  const plaintext = 'mypassword123';
  const hashed = bcrypt.hashSync(plaintext, 10);
  
  const isValid = bcrypt.compareSync(plaintext, hashed);
  expect(isValid).toBe(true);
});
```

### 2. **Integration Tests**

Testano i flussi end-to-end:

```javascript
test('Complete signup flow', async () => {
  // 1. Signup user
  const signupRes = await request(app)
    .post('/api/auth/signup')
    .send({ username: 'testuser', password: 'password123' });
  
  expect(signupRes.status).toBe(201);
  const userId = signupRes.body.user.id;
  
  // 2. Login
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'testuser', password: 'password123' });
  
  expect(loginRes.status).toBe(200);
  const token = loginRes.body.token;
  
  // 3. Create organization
  const orgRes = await request(app)
    .post('/api/organizations')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Org', slug: 'test-org' });
  
  expect(orgRes.status).toBe(201);
});
```

### 3. **Security Tests**

Testano autenticazione e autorizzazione:

```javascript
test('Endpoint protetto senza token ritorna 401', async () => {
  const response = await request(app)
    .get('/api/organizations');
  
  expect(response.status).toBe(401);
});

test('Viewer non può invitare team members (403)', async () => {
  const response = await request(app)
    .post('/api/organizations/test/team/invite')
    .set('Authorization', `Bearer ${viewerToken}`)
    .send({ email: 'test@example.com', role: 'editor' });
  
  expect(response.status).toBe(403);
});
```

### 4. **Validation Tests**

Testano input validation:

```javascript
test('Email invalida ritorna 400', async () => {
  const response = await request(app)
    .post('/api/organizations/test/team/invite')
    .set('Authorization', `Bearer ${token}`)
    .send({ email: 'not-an-email', role: 'editor' });
  
  expect(response.status).toBe(400);
  expect(response.body.error).toContain('email');
});
```

## Mocking

### Mock Stripe

```javascript
// jest.setup.js
jest.mock('stripe', () => {
  return jest.fn(() => ({
    customers: {
      create: jest.fn().mockResolvedValue({ id: 'cus_test123' }),
    },
    subscriptions: {
      create: jest.fn().mockResolvedValue({ id: 'sub_test123' }),
    },
  }));
});
```

### Mock Axios per Kick API

```javascript
jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({
    data: {
      data: [{
        username: 'testuser',
        email: 'test@example.com'
      }]
    }
  }),
}));
```

### Mock Database

```javascript
jest.mock('../models', () => ({
  User: {
    create: jest.fn().mockResolvedValue({ id: 'user123' }),
    findById: jest.fn().mockResolvedValue({ username: 'testuser' }),
  },
  Organization: {
    create: jest.fn().mockResolvedValue({ id: 'org123' }),
  },
}));
```

## Best Practices

### 1. **Isola i test**

Ogni test deve essere indipendente:

```javascript
beforeEach(async () => {
  // Setup prima di ogni test
  await Organization.deleteMany({});
  await User.deleteMany({});
});

afterEach(async () => {
  // Cleanup dopo ogni test
  await Organization.deleteMany({});
  await User.deleteMany({});
});
```

### 2. **Usa fixture/factories**

Crea dati di test riusabili:

```javascript
// tests/factories.js
export const createTestOrg = async () => {
  return await Organization.create({
    name: 'Test Org',
    slug: 'test-org',
    owner: testUserId
  });
};

// Nel test:
const org = await createTestOrg();
expect(org.slug).toBe('test-org');
```

### 3. **Testa happy path e error cases**

```javascript
describe('POST /api/organizations', () => {
  // Happy path
  test('Crea organizzazione con dati validi', async () => {
    const res = await request(app)
      .post('/api/organizations')
      .send({ name: 'Test', slug: 'test' });
    
    expect(res.status).toBe(201);
  });

  // Error cases
  test('Err su slug duplicato', async () => {
    // Crea prima org
    await Organization.create({ slug: 'test' });
    
    // Prova a creare altra con stesso slug
    const res = await request(app)
      .post('/api/organizations')
      .send({ slug: 'test' });
    
    expect(res.status).toBe(409);
  });

  test('Err su campi obbligatori mancanti', async () => {
    const res = await request(app)
      .post('/api/organizations')
      .send({}); // Mancano name e slug
    
    expect(res.status).toBe(400);
  });
});
```

### 4. **Descrivi cosa testi**

```javascript
describe('Organizations API', () => {
  describe('POST /api/organizations', () => {
    describe('with valid data', () => {
      test('returns 201 and created organization', () => {});
    });

    describe('with invalid data', () => {
      test('returns 400 on missing name', () => {});
      test('returns 400 on invalid slug', () => {});
      test('returns 409 on duplicate slug', () => {});
    });
  });
});
```

## Coverage

Visualizza coverage con:

```bash
npm run test:coverage
```

Report HTML generato in `coverage/lcov-report/index.html`.

Target di coverage ideale:
- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

Per escludere file da coverage:

```javascript
// jest.config.js
"collectCoverageFrom": [
  "**/*.js",
  "!**/node_modules/**",
  "!**/__tests__/**",
  "!**/test-setup.js"
]
```

## Debugging Test

### Stampa variabili nel test

```javascript
test('example', async () => {
  const res = await request(app).get('/api/organizations');
  console.log('Response status:', res.status);
  console.log('Response body:', res.body);
  expect(res.status).toBe(200);
});
```

Esegui con output visibile:

```bash
npm test -- --verbose
```

### Debug nel codice

Aggiungi `debugger` nel test o nel codice, poi esegui:

```bash
node --inspect-brk ./node_modules/.bin/jest --runInBand
```

Apri `chrome://inspect` nel browser per il debugger.

## CI/CD Integration

### GitHub Actions

Crea `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:latest
        options: >-
          --health-cmd mongosh
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 27017:27017
    
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: 18
      
      - run: npm install
      - run: npm test -- --coverage
      
      - uses: codecov/codecov-action@v2
        with:
          files: ./coverage/lcov.info
```

## Test Comuni

### Test autenticazione

```javascript
test('Login con credenziali corrette', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'testuser', password: 'correct' });
  
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('token');
});
```

### Test quota enforcement

```javascript
test('Superare quota ritorna 429', async () => {
  // Create 50 rewards (max per Pro plan)
  for (let i = 0; i < 50; i++) {
    await request(app)
      .post(`/api/organizations/test/rewards`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Reward ${i}`, points: 100, type: 'emote' });
  }
  
  // 51st attempt dovrebbe fallire
  const res = await request(app)
    .post(`/api/organizations/test/rewards`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Reward 51', points: 100, type: 'emote' });
  
  expect(res.status).toBe(429);
});
```

### Test RBAC

```javascript
test('Admin può invitare, viewer no', async () => {
  // Admin invite
  const adminRes = await request(app)
    .post(`/api/organizations/test/team/invite`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ email: 'new@example.com', role: 'editor' });
  
  expect(adminRes.status).toBe(201);
  
  // Viewer invite
  const viewerRes = await request(app)
    .post(`/api/organizations/test/team/invite`)
    .set('Authorization', `Bearer ${viewerToken}`)
    .send({ email: 'new@example.com', role: 'editor' });
  
  expect(viewerRes.status).toBe(403);
});
```

## Tips & Tricks

### Esegui singolo test file

```bash
npm test -- __tests__/api.test.js
```

### Esegui test che matchano pattern

```bash
npm test -- --testNamePattern="Organizations"
```

### Aumenta timeout per test lento

```javascript
test('slow test', async () => {
  // test code
}, 30000); // 30 secondi
```

### Salta test temporaneamente

```javascript
test.skip('work in progress', () => {});

// O intera suite:
describe.skip('WIP feature', () => {});
```

## Prossimi Step

- [ ] Aumentare coverage al 80%+
- [ ] Aggiungere E2E tests con Cypress
- [ ] Integration con SonarQube per code quality
- [ ] Performance tests con Artillery
- [ ] Load testing con k6

## Troubleshooting

### "Cannot find module 'jest'"

```bash
npm install --save-dev jest supertest
```

### "Test timeout"

Aumenta timeout nel test:

```javascript
jest.setTimeout(30000); // 30 secondi
```

### Stripe mock non funziona

Assicurati che jest.setup.js sia caricato:

```javascript
// jest.config.js
"setupFilesAfterEnv": ["<rootDir>/jest.setup.js"]
```

### Test passa in locale ma non in CI

Potrebbe essere differenza di timezone o database state. Aggiungi:

```javascript
beforeEach(async () => {
  // Pulisci database prima di ogni test
  await mongoose.connection.collections.users.deleteMany({});
  await mongoose.connection.collections.organizations.deleteMany({});
});
```

## Support

Domande su testing? Contatta: **dev-support@kickloyalty.com**

Leggi anche: https://jestjs.io/docs/en/getting-started
