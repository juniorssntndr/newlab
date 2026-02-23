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
    await check('Backend health', `${backendBaseUrl.replace(/\/$/, '')}/api/health`);
    console.log('OK: backend health');

    if (frontendUrl) {
        await check('Frontend home', frontendUrl);
        console.log('OK: frontend home');
    }
};

run().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
