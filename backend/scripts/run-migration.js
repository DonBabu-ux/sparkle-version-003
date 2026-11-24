'use strict';
/**
 * Cloudinary → Cloudflare R2 Migration Runner
 * Usage:
 *   node backend/scripts/run-migration.js [options]
 *
 * Options:
 *   --batch=N           Number of assets per run (default: 25)
 *   --dry-run=true|false  Simulate only, no actual transfer (default: false)
 *   --destructive=true  DELETE Cloudinary source after verified R2 upload (default: false)
 *   --all               Migrate all remaining assets in a single run (batch=999)
 *
 * Examples:
 *   node backend/scripts/run-migration.js --batch=25 --dry-run=false
 *   node backend/scripts/run-migration.js --all --dry-run=false
 *   node backend/scripts/run-migration.js --all --destructive=true  (deletes Cloudinary after verify)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mediaMigration = require('../services/mediaMigration.service');

// Parse CLI args
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  })
);

const batchSize      = args.all ? 9999 : parseInt(args.batch ?? '25', 10);
const dryRun         = String(args['dry-run'] ?? 'false') === 'true';
const destructive    = String(args.destructive ?? 'false') === 'true';

console.log(`\n=== Sparkle Media Migration Runner ===`);
console.log(`  Batch size : ${batchSize}`);
console.log(`  Dry run    : ${dryRun}`);
console.log(`  Destructive: ${destructive}`);
console.log(`======================================\n`);

if (destructive && !dryRun) {
  console.warn('⚠️  DESTRUCTIVE MODE: Cloudinary originals will be DELETED after verified R2 upload!');
  console.warn('   You have 5 seconds to cancel (Ctrl+C)...\n');
}

const delay = (destructive && !dryRun) ? 5000 : 0;

setTimeout(async () => {
  try {
    const result = await mediaMigration.runBatch({
      batchSize,
      dryRun,
      allowDestructiveDeletion: destructive,
    });

    console.log('\n=== Migration Complete ===');
    console.log(`  Total    : ${result.total}`);
    console.log(`  Succeeded: ${result.succeeded}`);
    console.log(`  Failed   : ${result.failed}`);
    console.log(`  Dry run  : ${result.dryRun}`);

    if (result.failed > 0) {
      console.log('\nFailed items:');
      result.items
        .filter(i => i.status !== 'dry_run_success' && i.status !== 'migrated')
        .forEach(i => console.log(`  [${i.status}] ${i.mediaId} — ${i.error || i.sourceUrl}`));
    }

    if (result.succeeded > 0 && !dryRun) {
      console.log(`\n✅ ${result.succeeded} asset(s) migrated to R2.`);
      if (!destructive) {
        console.log('   Cloudinary originals were NOT deleted (safe mode).');
        console.log('   Re-run with --destructive=true when you are satisfied to delete Cloudinary copies.');
      }
    }

    process.exit(result.failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('\n❌ Migration runner failed:', err.message);
    process.exit(1);
  }
}, delay);
