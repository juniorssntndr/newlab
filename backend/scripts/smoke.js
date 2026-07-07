const backendBaseUrl = process.env.SMOKE_BACKEND_URL;
const frontendUrl = process.env.SMOKE_FRONTEND_URL;

if (!backendBaseUrl) {
    console.error('Missing SMOKE_BACKEND_URL');
    process.exit(1);
}

const check = async (name, url) => {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`${name} failed: ${res.status} ${res.statusText}`);
    }
    return res;
};

const run = async () => {
    const healthRes = await check('Backend health', `${backendBaseUrl.replace(/\/$/, '')}/api/health`);
    const healthBody = await healthRes.json();
    if (healthBody?.status !== 'ok') {
        throw new Error(`Backend health unexpected body: ${JSON.stringify(healthBody)}`);
    }
    console.log('OK: backend health');

    if (frontendUrl) {
        const homeRes = await check('Frontend home', frontendUrl);
        const homeHtml = await homeRes.text();
        if (/Welcome to nginx!/i.test(homeHtml)) {
            throw new Error(
                'Frontend home serves nginx default page — Coolify Publish Directory should be frontend/dist (see docs/deploy-coolify-frontend.md)',
            );
        }
        if (!/id=["']root["']/i.test(homeHtml)) {
            throw new Error('Frontend home missing React root mount (#root)');
        }
        console.log('OK: frontend home');

        const loginRes = await check('Frontend login route', `${frontendUrl.replace(/\/$/, '')}/login`);
        const loginHtml = await loginRes.text();
        if (/Welcome to nginx!/i.test(loginHtml)) {
            throw new Error('Frontend /login serves nginx default page');
        }
        if (!/id=["']root["']/i.test(loginHtml)) {
            throw new Error('Frontend /login missing React root mount (#root) — enable SPA mode in Coolify');
        }
        console.log('OK: frontend login route');
    }
};

run().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
