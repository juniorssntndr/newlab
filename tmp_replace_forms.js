const fs = require('fs');
const filePath = 'd:/Archivos personales/Antigravity/NEWLAB/frontend/src/pages/FacturarPedido.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace all className="input-field"
content = content.replace(/className="input-field"/g, 'className="form-input"');
// Fix selects to use form-select (since they were replaced by form-input above)
content = content.replace(/<select\s+className="form-input"/g, '<select className="form-select"');
content = content.replace(/<select\n\s*className="form-input"/g, '<select\n                                className="form-select"');

// Fix Layout - change flex layout to a real class
content = content.replace(
    /className="facturacion-layout animate-fade-in" style=\{\{[^\}]+\}\}/,
    'className="facturacion-layout animate-fade-in"'
);

// Remove the flex: '1 1 700px' from Left Column wrapper
content = content.replace(
    /<div style=\{\{ flex: '1 1 700px', display: 'flex', flexDirection: 'column', gap: '1.5rem' \}\}>/,
    '<div className="facturacion-main" style={{ display: \'flex\', flexDirection: \'column\', gap: \'1.5rem\' }}>'
);

// Remove the flex: '0 1 380px' from Right Column wrapper
content = content.replace(
    /<div style=\{\{ flex: '0 1 380px', position: 'sticky', top: '2rem' \}\}>/,
    '<div className="facturacion-sidebar" style={{ position: \'sticky\', top: \'2rem\' }}>'
);

// On line 364, the styling for input within table:
// style={{ padding: '0.5rem', minWidth: '200px', background: 'transparent', border: '1px solid transparent', transition: 'border 0.2s', boxShadow: 'none' }}
// This overrides the form-input background. I'll leave it but let's make sure it doesn't break in dark mode.
// Actually, I'll remove the `background: 'transparent'` stuff in JS events and let CSS handle focus properly.
content = content.replace(/onFocus=\{\(e\) => \{ e\.target\.style\.borderColor = 'var\(--color-primary\)'; e\.target\.style\.background = 'var\(--color-bg\)'; \}\}/g, '');
content = content.replace(/onBlur=\{\(e\) => \{ e\.target\.style\.borderColor = 'transparent'; e\.target\.style\.background = 'transparent'; \}\}/g, '');
// Clean up the inline styles for those inputs so they just use standard form-input
content = content.replace(/style=\{\{ padding: '0.5rem', minWidth: '200px', background: 'transparent', border: '1px solid transparent', transition: 'border 0.2s', boxShadow: 'none' \}\}/g, 'style={{ minWidth: \'200px\' }}');

fs.writeFileSync(filePath, content, 'utf8');
console.log('JSX layout and inputs fixed');
