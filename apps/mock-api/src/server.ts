import { createMock } from './app.js';
const { app, tick } = await createMock();
const timer = setInterval(tick, 1000);
timer.unref();
app.addHook('onClose', async () => { clearInterval(timer); });
await app.listen({ host: '127.0.0.1', port: 4010 });
console.log('provable.bid contract mock: http://127.0.0.1:4010 (simulated payments only)');
