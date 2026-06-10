import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSupabaseStorageConfig } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../uploads');

const buildFileName = (originalName = 'file', prefix = 'file') => {
    const ext = path.extname(originalName).toLowerCase() || '.bin';
    const base = path.basename(originalName, ext).replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 40) || 'file';
    return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}-${base}${ext}`;
};

const getSupabaseClient = () => {
    const { url, serviceRoleKey } = getSupabaseStorageConfig();
    if (!url || !serviceRoleKey) return null;
    return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
};

const uploadToLocalDisk = async (file, prefix) => {
    await fs.mkdir(uploadsDir, { recursive: true });
    const fileName = buildFileName(file.originalname, prefix);
    const destination = path.join(uploadsDir, fileName);
    await fs.writeFile(destination, file.buffer);
    return `/uploads/${fileName}`;
};

const uploadToSupabase = async (file, folder, prefix) => {
    const client = getSupabaseClient();
    if (!client) return null;

    const { bucket } = getSupabaseStorageConfig();
    const fileName = buildFileName(file.originalname, prefix);
    const filePath = `${folder}/${fileName}`;

    const { error } = await client.storage.from(bucket).upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
    });
    if (error) {
        throw new Error(`Error al subir imagen a storage: ${error.message}`);
    }

    const { data } = client.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
};

export const uploadProductImage = async (file) => {
    if (!file) return null;
    const uploaded = await uploadToSupabase(file, 'productos', 'product');
    if (uploaded) return uploaded;
    return uploadToLocalDisk(file, 'product');
};

export const uploadOrderCaseImage = async ({ file, orderId }) => {
    if (!file) return null;
    const safeOrderId = String(orderId || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '-');
    const uploaded = await uploadToSupabase(file, `pedidos/${safeOrderId}`, `order-${safeOrderId}`);
    if (uploaded) return uploaded;
    return uploadToLocalDisk(file, `order-${safeOrderId}`);
};
