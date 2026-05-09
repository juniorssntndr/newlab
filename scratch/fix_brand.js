const fs = require('fs');
const path = require('path');

const files = [
    'frontend/src/styles/global.css',
    'frontend/src/styles/afinix-landing.css',
    'frontend/src/pages/hooks/useLandingTheme.js',
    'frontend/src/pages/AfinixLanding.jsx',
    'frontend/src/pages/afinixLanding/AfinixLandingSections.jsx',
    'frontend/src/pages/afinixLanding/afinixLandingContent.js',
    'frontend/src/pages/afinixLanding/AfinixLandingBelowFold.jsx',
    'frontend/src/components/afinix/LandingThemeToggle.jsx',
    'frontend/src/pages/afinixLanding/AfinixLandingBoot.jsx',
    'frontend/src/pages/Login.jsx',
    'frontend/src/components/Sidebar.jsx'
];

files.forEach(file => {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        content = content.replace(/affinix/g, 'afinix');
        content = content.replace(/Affinix/g, 'Afinix');
        content = content.replace(/AFFINIX/g, 'AFINIX');
        fs.writeFileSync(fullPath, content);
        console.log(`Fixed ${file}`);
    } else {
        console.warn(`File not found: ${file}`);
    }
});
