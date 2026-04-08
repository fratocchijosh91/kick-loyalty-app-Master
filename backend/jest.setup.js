/**
 * Jest Setup File
 * Configura timeout, mock, e altri setup per i test
 */

// Aumenta timeout per test che fanno richieste HTTP
jest.setTimeout(10000);

// Disabilita console.log nel test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

// Setup variabili ambiente per test
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-that-is-very-long';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
process.env.KICKAPI_ID = 'test_kick_api_id';
process.env.KICKAPI_SECRET = 'test_kick_api_secret';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.EMAIL_PROVIDER = 'test';

// Mock per Stripe (per evitare richieste reali)
jest.mock('stripe', () => {
  return jest.fn(() => ({
    customers: {
      create: jest.fn().mockResolvedValue({ id: 'cus_test123' }),
      retrieve: jest.fn().mockResolvedValue({ id: 'cus_test123' }),
    },
    subscriptions: {
      create: jest.fn().mockResolvedValue({ id: 'sub_test123', status: 'active' }),
      cancel: jest.fn().mockResolvedValue({ status: 'canceled' }),
    },
    invoices: {
      create: jest.fn().mockResolvedValue({ id: 'in_test123' }),
    },
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({ id: 'cs_test123', url: 'https://checkout.mock.com' }),
      },
    },
  }));
});

// Mock per Axios (per evitare richieste HTTP vere)
jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({ data: {} }),
  post: jest.fn().mockResolvedValue({ data: {} }),
  patch: jest.fn().mockResolvedValue({ data: {} }),
}));
