import PocketBase from 'pocketbase';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config'

const POCKETBASE_URL = 'http://127.0.0.1:8091';
const ADMIN_EMAIL = 'israelimru@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JSON_FILE_PATH = '../../files/tiers.json';

const pb = new PocketBase(POCKETBASE_URL);
await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

const records = await pb.collection('big_board_rankings').getFullList({ sort: '-created' });

const seen = new Set();
const toDelete = [];

for (const r of records) {
  const key = `${r.player}|${r.format}`;
  if (key.includes('undefined')) throw new Error(`Bad key, aborting: ${JSON.stringify(r)}`);
  if (seen.has(key)) toDelete.push(r.id);
  else seen.add(key);
}

console.log(`${toDelete.length} dupes of ${records.length} total`);
if (toDelete.length > records.length * 0.6) throw new Error('Deleting >60%, aborting');

// comment this out for a dry run
for (const id of toDelete) {
  await pb.collection('big_board_rankings').delete(id);
}
console.log('done');
// // nuke the older preseason snapshots
// const junk = await pb.collection('weekly_rankings').getFullList({
//     filter: 'year = 2026 && (week = 50 || week = 51)',
// });
// console.log(`deleting ${junk.length}`);
// for (const r of junk) await pb.collection('weekly_rankings').delete(r.id);

// // relabel the survivor
// const keep = await pb.collection('weekly_rankings').getFullList({
//     filter: 'year = 2026 && week = 52',
// });
// console.log(`relabeling ${keep.length}`);
// for (const r of keep) await pb.collection('weekly_rankings').update(r.id, { week: 0 });


