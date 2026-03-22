import { spawnSync } from 'node:child_process';

const COVERAGE_THRESHOLD = 90;
const commandArgs = ['--test', '--experimental-test-coverage', 'src/modules/billing/__tests__/acl.contract.test.js'];

const result = spawnSync('node', commandArgs, {
    encoding: 'utf8',
    shell: false
});

const output = `${result.stdout || ''}${result.stderr || ''}`;
process.stdout.write(output);

if (result.status !== 0) {
    process.exit(result.status || 1);
}

const match = output.match(/apisperuBillingAcl\.js\s*\|\s*(\d+\.\d+)/);
if (!match) {
    console.error('No se pudo extraer cobertura para apisperuBillingAcl.js');
    process.exit(1);
}

const lineCoverage = Number(match[1]);
if (!Number.isFinite(lineCoverage) || lineCoverage < COVERAGE_THRESHOLD) {
    console.error(`Cobertura ACL insuficiente: ${lineCoverage}% < ${COVERAGE_THRESHOLD}%`);
    process.exit(1);
}

console.log(`Cobertura ACL OK: ${lineCoverage}% >= ${COVERAGE_THRESHOLD}%`);
