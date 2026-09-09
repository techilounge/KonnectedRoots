const {test} = require('node:test');
const assert = require('node:assert/strict');
const {functionsConfig} = require('../lib/config');

test('Functions secrets fail lazily with variable names only', () => {
  const config = functionsConfig({});
  assert.equal(config.appUrl, 'https://konnectedroots.app');
  assert.equal(config.resendApiKey, undefined);
  assert.throws(() => config.stripeSecretKey, /^Error: Missing Functions configuration: STRIPE_SECRET_KEY$/);
  assert.throws(() => config.stripeWebhookSecret, /^Error: Missing Functions configuration: STRIPE_WEBHOOK_SECRET$/);
});

test('Functions config preserves isolated app URL and price selection', () => {
  const config = functionsConfig({APP_URL: 'https://example.test', STRIPE_PRICE_PRO_MONTHLY: 'price_fixture'});
  assert.equal(config.appUrl, 'https://example.test');
  assert.equal(config.prices.pro_monthly, 'price_fixture');
  assert.equal(config.prices.family_monthly, '');
});
