import dotenv from 'dotenv';
dotenv.config();
import { removeExpiredOrderApprovalHtml } from '../src/services/storage.js';

const removed = await removeExpiredOrderApprovalHtml();
console.log(`Removed ${removed} expired private viewer export(s).`);
