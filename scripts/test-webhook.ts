#!/usr/bin/env ts-node
/**
 * Webhook Testing Script for FleetFlow Stripe Integration
 * 
 * This script helps test Stripe webhook handling locally using the Stripe CLI
 * or by simulating webhook events.
 * 
 * Usage:
 *   npx ts-node scripts/test-webhook.ts
 * 
 * Prerequisites:
 *   - Install Stripe CLI: https://stripe.com/docs/stripe-cli
 *   - Login to Stripe CLI: stripe login
 *   - Forward webhooks: stripe listen --forward-to localhost:3000/api/stripe/webhook
 */

import { stripe } from '../lib/stripe';
import { PlanType } from '../lib/subscription';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!webhookSecret) {
  console.warn('⚠️  STRIPE_WEBHOOK_SECRET not set. Webhook signature verification will fail.');
}

console.log('🔧 FleetFlow Webhook Testing Utility\n');

// Test webhook payload construction
function createMockCheckoutSession(userId: string): any {
  return {
    id: 'cs_test_' + Math.random().toString(36).substring(7),
    object: 'checkout.session',
    metadata: { userId },
    customer: 'cus_test_' + Math.random().toString(36).substring(7),
    subscription: 'sub_test_' + Math.random().toString(36).substring(7),
    mode: 'subscription',
    payment_status: 'paid',
    amount_total: 2900,
    currency: 'usd',
  };
}

function createMockSubscription(userId: string, plan: PlanType): any {
  const priceIds: Record<PlanType, string> = {
    'STARTER': 'price_starter_monthly',
    'PROFESSIONAL': 'price_professional_monthly',
    'ENTERPRISE': 'price_enterprise_monthly',
  };

  return {
    id: 'sub_test_' + Math.random().toString(36).substring(7),
    object: 'subscription',
    customer: 'cus_test_' + Math.random().toString(36).substring(7),
    metadata: { userId },
    status: 'active',
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    cancel_at_period_end: false,
    items: {
      data: [{
        id: 'si_test_' + Math.random().toString(36).substring(7),
        price: {
          id: priceIds[plan],
          product: 'prod_test_' + Math.random().toString(36).substring(7),
        },
      }],
    },
  };
}

function createMockInvoice(subscriptionId: string): any {
  return {
    id: 'in_test_' + Math.random().toString(36).substring(7),
    object: 'invoice',
    subscription: subscriptionId,
    customer: 'cus_test_' + Math.random().toString(36).substring(7),
    amount_paid: 2900,
    currency: 'usd',
    status: 'paid',
    invoice_pdf: 'https://pay.stripe.com/invoice/acct_test/invoice_test/pdf',
    period_start: Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60,
    period_end: Math.floor(Date.now() / 1000),
    created: Math.floor(Date.now() / 1000),
  };
}

// Print testing instructions
console.log('📚 Testing Instructions:\n');

console.log('1. Start your development server:');
console.log('   npm run dev\n');

console.log('2. In a separate terminal, forward Stripe webhooks:');
console.log('   stripe listen --forward-to localhost:3000/api/stripe/webhook\n');

console.log('3. Copy the webhook signing secret and add to .env.local:');
console.log('   STRIPE_WEBHOOK_SECRET=whsec_...\n');

console.log('4. Trigger test events from Stripe CLI:\n');

console.log('   # Test checkout.session.completed');
console.log('   stripe trigger checkout.session.completed\n');

console.log('   # Test invoice.paid');
console.log('   stripe trigger invoice.paid\n');

console.log('   # Test invoice.payment_failed');
console.log('   stripe trigger invoice.payment_failed\n');

console.log('   # Test customer.subscription.updated');
console.log('   stripe trigger customer.subscription.updated\n');

console.log('   # Test customer.subscription.deleted');
console.log('   stripe trigger customer.subscription.deleted\n');

console.log('\n🧪 Sample Webhook Payloads:\n');

const testUserId = 'test_user_' + Math.random().toString(36).substring(7);

console.log('checkout.session.completed:');
console.log(JSON.stringify(createMockCheckoutSession(testUserId), null, 2));
console.log('\n');

console.log('customer.subscription.created (Starter):');
console.log(JSON.stringify(createMockSubscription(testUserId, 'STARTER'), null, 2));
console.log('\n');

console.log('invoice.paid:');
console.log(JSON.stringify(createMockInvoice('sub_test_123'), null, 2));
console.log('\n');

// Health check instructions
console.log('🏥 Health Check:\n');

console.log('Test your webhook endpoint with:');
console.log('curl -X POST http://localhost:3000/api/stripe/webhook -H "Content-Type: application/json" -d "{\\"test\\": true}"');
console.log('');

console.log('Expected response for missing signature:');
console.log('  {"error":"Missing stripe-signature header"}\n');

console.log('✅ Tips:\n');
console.log('- Webhooks must be sent to a publicly accessible URL (use ngrok for local testing)');
console.log('- The webhook secret changes each time you run stripe listen');
console.log('- Always verify webhook signatures in production');
console.log('- Check server logs for webhook processing details\n');

console.log('📖 Documentation:');
console.log('- Stripe Webhooks: https://stripe.com/docs/webhooks');
console.log('- Stripe CLI: https://stripe.com/docs/stripe-cli');
console.log('- Testing Webhooks: https://stripe.com/docs/webhooks/test\n');
