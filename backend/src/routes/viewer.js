import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { getViewerConfig } from '../config/env.js';
import { readOrderApprovalHtml } from '../services/storage.js';
import { verifyViewerCapability } from '../modules/orders/application/services/orderViewerService.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const legacyRoot = path.resolve(directory, '../../uploads');
const readLegacy = async (key) => {
    if (!String(key).startsWith('legacy-viewer://pedidos/')) return null;
    const relative = key.slice('legacy-viewer://'.length);
    if (!/^pedidos\/[A-Za-z0-9_-]+\/aprobaciones\/[^/]+\.html?$/i.test(relative)) return null;
    const target = path.resolve(legacyRoot, relative);
    if (!target.startsWith(`${legacyRoot}${path.sep}`)) return null;
    try { return await fs.readFile(target); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};

const viewerRoutes = Router();
const loadViewer = async (req, res) => {
    try {
        const configuredHost = new URL(getViewerConfig().origin).hostname;
        if (process.env.NODE_ENV === 'production' && req.hostname !== configuredHost) return false;
        const claim = verifyViewerCapability(req.params.token);
        if (claim.typ !== 'order-viewer' || !claim.orderId || !claim.approvalId || !claim.objectKey) return res.status(403).send('Forbidden');
        const bytes = String(claim.objectKey).startsWith('private-viewer://') ? await readOrderApprovalHtml(claim.objectKey) : await readLegacy(claim.objectKey);
        if (!bytes) return null;
        return { claim, bytes };
    } catch { return false; }
};

const viewerHeaders = (res, frameAncestors) => {
    // Helmet set SAMEORIGIN globally; this route deliberately permits only the configured app origins.
    res.removeHeader('X-Frame-Options');
    res.set({ 'Cache-Control': 'no-store, private, max-age=0', 'Pragma': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'cross-origin', 'Content-Security-Policy': `frame-ancestors ${frameAncestors || "'none'"}; base-uri 'none'` });
};

viewerRoutes.get('/session/:token', async (req, res) => {
    const loaded = await loadViewer(req, res);
    if (loaded === false) return res.status(403).send('Viewer session expired or invalid');
    if (!loaded) return res.status(404).send('Viewer file not found');
    viewerHeaders(res, loaded.claim.parentOrigin);
    const documentUrl = `/viewer/document/${encodeURIComponent(req.params.token)}`;
    // The shell is trusted viewer-origin code. The Exocad payload remains byte-for-byte at /document.
    return res.type('html').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>AFINIX 3D Viewer</title><style>html,body,iframe{width:100%;height:100%;margin:0;border:0;background:#020617}</style><iframe id="design" src="${documentUrl}" title="Diseño 3D"></iframe><script>const f=document.getElementById('design');const targetOrigin=${JSON.stringify(loaded.claim.parentOrigin)};const allowLocalHttp=${JSON.stringify(process.env.NODE_ENV !== 'production')};const isAllowedParent=(value)=>{try{const origin=new URL(value);return origin.protocol==='https:'||(allowLocalHttp&&origin.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(origin.hostname));}catch{return false;}};let done=false;const report=(type,detail)=>{if(done||!isAllowedParent(targetOrigin))return;done=true;parent.postMessage({type:'afinix-viewer-'+type,detail},targetOrigin);};const timer=setTimeout(()=>report('error','timeout'),20000);f.addEventListener('load',()=>{let attempts=0;const check=()=>{try{const d=f.contentDocument;const canvases=[...d.querySelectorAll('canvas')];const ready=canvases.some(c=>{try{return !!(c.getContext('webgl2')||c.getContext('webgl')||c.getContext('experimental-webgl'));}catch{return false;}});if(ready){clearTimeout(timer);report('ready','webgl');return;}if(++attempts<80)return setTimeout(check,250);report('error','webgl-unavailable');}catch{report('error','inspection-failed');}};check();});f.addEventListener('error',()=>report('error','document-load-failed'));</script>`);
});

viewerRoutes.get('/document/:token', async (req, res) => {
    const loaded = await loadViewer(req, res);
    if (loaded === false) return res.status(403).send('Viewer session expired or invalid');
    if (!loaded) return res.status(404).send('Viewer file not found');
    try {
        const { bytes } = loaded;
        // CSP checks every ancestor, not only the immediate parent. The raw
        // document is inside the viewer shell, which itself is inside AFINIX.
        viewerHeaders(res, `'self' ${loaded.claim.parentOrigin}`);
        res.set('Content-Type', 'text/html; charset=utf-8');
        return res.send(bytes);
    } catch { return res.status(500).send('Viewer unavailable'); }
});
export default viewerRoutes;
