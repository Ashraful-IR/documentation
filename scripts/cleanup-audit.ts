/**
 * Cleans up old audit logs beyond the retention period.
 *
 * Run manually:
 *   npm run db:cleanup-audit
 *
 * Or schedule via cron:
 *   0 3 * * 0  cd /path/to/project && npm run db:cleanup-audit
 *
 * Default retention: 90 days. Override with --days=N.
 */
import "dotenv/config";
import { cleanupOldAuditLogs } from "../src/services/audit.service";

const daysArg = process.argv.find((a) => a.startsWith("--days="));
const days = daysArg ? parseInt(daysArg.split("=")[1], 10) : 90;

async function main() {
  console.log(`Cleaning up audit logs older than ${days} days...`);
  const removed = await cleanupOldAuditLogs(days);
  console.log(`Removed ${removed} old audit log(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
