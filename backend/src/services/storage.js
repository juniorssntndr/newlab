import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSupabaseStorageConfig, getViewerConfig } from '../config/env.js';

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

export const uploadOrderApprovalHtml = async ({ file, orderId, version = 1 }) => {
    if (!file) return null;
    const safeOrderId = String(orderId || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '-');
    const ext = path.extname(file.originalname || '').toLowerCase() || '.html';
    const base = path.basename(file.originalname || 'diseno', ext).replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 40) || 'diseno';
    const fileName = `diseno-v${version}-${Date.now()}-${base}${ext}`;

    // Exocad exports are executable HTML. They must never be published from /uploads or a public bucket.
    const root = getViewerConfig().storageDir || path.resolve(__dirname, '../../private-viewers');
    const orderApprovalDir = path.join(root, 'orders', safeOrderId);
    await fs.mkdir(root, { recursive: true, mode: 0o700 });
    await fs.chmod(root, 0o700);
    await fs.mkdir(orderApprovalDir, { recursive: true, mode: 0o700 });
    await fs.chmod(orderApprovalDir, 0o700);
    const destination = path.join(orderApprovalDir, fileName);
    await fs.writeFile(destination, file.buffer, { mode: 0o600 });
    await fs.chmod(destination, 0o600);
    return `private-viewer://orders/${safeOrderId}/${fileName}`;
};

const safePrivateRelativePath = (key) => {
    if (!String(key || '').startsWith('private-viewer://')) return null;
    const relative = key.slice('private-viewer://'.length);
    if (!/^orders\/[A-Za-z0-9_-]+\/[^/]+\.html?$/i.test(relative)) return null;
    return relative;
};

export const readOrderApprovalHtml = async (key) => {
    const relative = safePrivateRelativePath(key);
    if (!relative) return null;
    const root = getViewerConfig().storageDir || path.resolve(__dirname, '../../private-viewers');
    const target = path.resolve(root, relative);
    if (!target.startsWith(`${path.resolve(root)}${path.sep}`)) return null;
    try { return await fs.readFile(target); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};

export const removeExpiredOrderApprovalHtml = async (now = Date.now()) => {
    const root = getViewerConfig().storageDir || path.resolve(__dirname, '../../private-viewers');
    const cutoff = now - getViewerConfig().retentionDays * 86400000;
    let removed = 0;
    const walk = async (dir) => {
        let entries; try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
        for (const entry of entries) {
            const target = path.join(dir, entry.name);
            if (entry.isDirectory()) await walk(target);
            else if (entry.isFile() && /\.html?$/i.test(entry.name) && (await fs.stat(target)).mtimeMs < cutoff) { await fs.rm(target); removed += 1; }
        }
    };
    await walk(root); return removed;
};
