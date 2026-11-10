import { randomUUID } from 'node:crypto';
import { createApiClient } from '../packages/api-client/src/index.js';

export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (!result.response.ok || result.data === undefined) throw new Error(JSON.stringify(result.error ?? { status: result.response.status }));
  return result.data;
}
export const commandHeader = () => ({ 'Idempotency-Key': randomUUID() });
export function requireMockOrigin(baseUrl: string): void {
  const url = new URL(baseUrl);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Driver requires a loopback mock origin.');
}

/** Explicit administrative fixture actions for an existing buyer-demo competition.
 * This never starts agents, creates purchases, or calls a real payment/model provider.
 */
export async function driveMockCompetition(options: {
  baseUrl: string; competitionId: string; qualify?: boolean; completePayments?: boolean;
}) {
  requireMockOrigin(options.baseUrl);
  if (!options.qualify && !options.completePayments) throw new Error('Choose --qualify and/or --complete-payments explicitly.');
  const buyer = createApiClient({ baseUrl: options.baseUrl, token: 'buyer-demo' });
  const config = unwrap(await buyer.GET('/v1/config'));
  if (config.mode !== 'mock') throw new Error('Fixture driver refuses a non-mock API.');
  const admin = createApiClient({ baseUrl: options.baseUrl, token: 'admin-demo' });
  const path = { competition_id: options.competitionId };
  const competition = unwrap(await buyer.GET('/v1/competitions/{competition_id}', { params: { path } }));
  if (competition.buyer_id !== 'buyer_demo') throw new Error('This local driver supports buyer-demo competitions only.');
  let qualified = 0;
  if (options.qualify) {
    const submissions = unwrap(await admin.GET('/v1/competitions/{competition_id}/submissions', { params: { path, query: { limit: 100 } } }));
    for (const submission of submissions.items) if (submission.qualification_status === 'pending') {
      unwrap(await admin.POST('/__mock/submissions/{submission_id}/qualification', {
        params: { path: { submission_id: submission.id }, header: commandHeader() },
        body: { status: 'qualified', failure_code: null, evaluator_version: 'manual-fixture-v1', reason: 'Explicit local fixture result; not a real evaluation.',
          artifact_hashes: submission.artifacts.map(a => ({ asset_id: a.asset_id, sha256: a.sha256 })),
          checks: competition.requirements.map(r => ({ requirement_id: r.id, passed: true, reason: 'Manually accepted by the local fixture driver.' })) },
      }));
      qualified++;
    }
  }
  let completed = 0;
  if (options.completePayments) {
    const purchases = unwrap(await buyer.GET('/v1/competitions/{competition_id}/purchases', { params: { path, query: { limit: 100 } } }));
    const paymentIds = new Set(purchases.items.map(p => p.payment_id));
    if (competition.initial_payment_id) paymentIds.add(competition.initial_payment_id);
    for (const paymentId of paymentIds) {
      const payment = unwrap(await admin.GET('/v1/payments/{payment_id}', { params: { path: { payment_id: paymentId } } }));
      if (payment.capture_state !== 'pending') continue;
      unwrap(await admin.POST('/__mock/payments/{payment_id}/observation', {
        params: { path: { payment_id: paymentId }, header: commandHeader() }, body: { observation: 'completed' },
      }));
      completed++;
    }
  }
  return { mode: 'mock', competition_id: competition.id, qualified, completed };
}
