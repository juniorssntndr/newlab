import {
  billingResultSchema,
  comprobanteDraftSchema,
  pedidoBillingSnapshotSchema
} from '@newlab/contracts';
import { backendContractsFixture } from '../backend/src/contracts/consumerContractFixture.js';
import { frontendContractsFixture } from '../frontend/src/contracts/consumerContractFixture.js';

const fixturesByConsumer = [
  ['backend', backendContractsFixture],
  ['frontend', frontendContractsFixture]
];

const schemaChecks = [
  ['pedidoBillingSnapshot', pedidoBillingSnapshotSchema],
  ['comprobanteDraft', comprobanteDraftSchema],
  ['billingResult', billingResultSchema]
];

const failures = [];

for (const [consumerName, fixtures] of fixturesByConsumer) {
  for (const [schemaName, schema] of schemaChecks) {
    const value = fixtures[schemaName];
    const parsed = schema.safeParse(value);

    if (!parsed.success) {
      failures.push({
        consumerName,
        schemaName,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.') || '(root)',
          message: issue.message
        }))
      });
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`Contract compatibility failed for ${failure.consumerName}.${failure.schemaName}`);
    for (const issue of failure.issues) {
      console.error(`  - ${issue.path}: ${issue.message}`);
    }
  }
  process.exit(1);
}

console.log('Contract compatibility checks passed for backend and frontend fixtures.');
