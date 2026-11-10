import { parseArgs } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { driveMockCompetition } from './mock-driver.js';
const { values } = parseArgs({ options: {
  competition: { type: 'string' }, qualify: { type: 'boolean' }, 'complete-payments': { type: 'boolean' },
  watch: { type: 'boolean' }, 'duration-seconds': { type: 'string', default: '600' },
} });
if (!values.competition) throw new Error('Usage: npm run mock:drive -- --competition cmp_ID --qualify --complete-payments [--watch]');
const duration = Number(values['duration-seconds']);
if (!Number.isInteger(duration) || duration < 1 || duration > 3600) throw new Error('Duration must be 1..3600 seconds.');
const until = Date.now() + duration * 1000;
do {
  const result = await driveMockCompetition({ baseUrl: process.env.MOCK_API_URL ?? 'http://127.0.0.1:4010', competitionId: values.competition,
    qualify: values.qualify, completePayments: values['complete-payments'] });
  if (!values.watch || result.qualified || result.completed) console.log(JSON.stringify(result));
  if (!values.watch || Date.now() >= until) break;
  await delay(Math.min(2000, Math.max(1, until - Date.now())));
} while (Date.now() < until);
