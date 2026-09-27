import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const token = jwt.sign(
    { id: 1, tipo: 'admin', email: 'admin@newlab.test' },
    process.env.JWT_SECRET || 'dev-secret-key-change-in-production'
);

async function test() {
    try {
        const port = process.env.PORT || 3001;
        const res = await fetch(`http://localhost:${port}/api/facturacion/empresa`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        const data = await res.json();
        console.log(`HTTP ${res.status}:`, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Test failed:", err.message);
    }
}

test();
