import { createMock } from './app.js';
const { app, tick } = await createMock();
const port = Number(process.env.MOCK_API_PORT ?? 4010);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('MOCK_API_PORT must be 1..65535.');
const timer = setInterval(tick, 1000);
timer.unref();
app.addHook('onClose', async () => { clearInterval(timer); });
await app.listen({ host: '127.0.0.1', port });
console.log(`provable.bid contract mock: http://127.0.0.1:${port} (simulated payments only)`);
