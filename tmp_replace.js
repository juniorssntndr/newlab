const fs = require('fs');
const filePath = 'd:/Archivos personales/Antigravity/NEWLAB/frontend/src/pages/FacturarPedido.jsx';
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(/--primary-color/g, '--color-primary')
    .replace(/--text-secondary/g, '--color-text-secondary')
    .replace(/--text-primary/g, '--color-text')
    .replace(/--bg-secondary/g, '--color-bg-alt')
    .replace(/--bg-surface/g, '--color-surface')
    .replace(/--border-color/g, '--color-border')
    .replace(/--bg-primary/g, '--color-bg');
fs.writeFileSync(filePath, content, 'utf8');
console.log('Replaced variables successfully');
