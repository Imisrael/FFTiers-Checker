// node ingest.js --week=1 --year=2025

import PocketBase from 'pocketbase';
import fs from 'fs/promises';
import path from 'path';

// --- CONFIGURATION ---
const POCKETBASE_URL = 'http://127.0.0.1:8091';
const ADMIN_EMAIL = 'israelimru@gmail.com';
const ADMIN_PASSWORD = 'bwd0fbt2exc-yqe7GEK';
const JSON_FILE_PATH = '../../files/tiers.json';

// --- HELPER TO PARSE COMMAND-LINE ARGUMENTS ---
function getArgs() {
    const args = {};
    process.argv.slice(2).forEach(arg => {
        if (arg.startsWith('--')) {
            const [key, value] = arg.substring(2).split('=');
            args[key] = value;
        }
    });
    return args;
}

// --- CLEANUP FUNCTION ---
async function deleteAllRankingsForWeek(pb, week, year) {
    console.log(`\nDeleting existing rankings for Week: ${week}, Year: ${year}...`);
    try {
        const records = await pb.collection('weekly_rankings').getFullList({
            filter: `week = ${week} && year = ${year}`,
            // --- Turn off autocancel for this bulk fetch operation ---
            $autoCancel: false,
        });

        if (records.length === 0) {
            console.log("No existing records found to delete.");
            return;
        }

        console.log(`Found ${records.length} records to delete.`);

        const deletePromises = records.map(record => pb.collection('weekly_rankings').delete(record.id, {
             // --- Turn off autocancel for each delete operation ---
            $autoCancel: false,
        }));
        
        await Promise.all(deletePromises);

        console.log("Successfully deleted all old records for the week.");
    } catch (error) {
        console.error("Error during cleanup:", error);
        throw new Error("Failed to delete old records. Halting script.");
    }
}


// --- MAIN SCRIPT LOGIC ---
async function main() {
    const args = getArgs();
    const week = parseInt(args.week, 10);
    const year = parseInt(args.year, 10);

    if (isNaN(week) || isNaN(year)) {
        console.error('Error: You must provide both --week and --year flags.');
        console.error('Example: node ingest.js --week=1 --year=2025');
        process.exit(1);
    }

    console.log(`Starting ingestion for Year: ${year}, Week: ${week}`);
    
    // --- THIS IS THE CRITICAL FIX ---
    // Initialize the client with auto-cancellation disabled globally
    const pb = new PocketBase(POCKETBASE_URL);
    pb.autoCancellation(false);


    try {
        await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
        console.log(`Successfully authenticated as admin: ${pb.authStore.model.email}`);
    } catch (error) {
        console.error('Error: Failed to authenticate as admin.', error);
        process.exit(1);
    }

    await deleteAllRankingsForWeek(pb, week, year);

    let rankingsData;
    try {
        const fileContent = await fs.readFile(path.resolve(JSON_FILE_PATH), 'utf-8');
        rankingsData = JSON.parse(fileContent);
        console.log('\nSuccessfully parsed rankings.json file.');
    } catch (error) {
        console.error(`Error: Failed to read or parse JSON file at ${JSON_FILE_PATH}`, error);
        process.exit(1);
    }

    const positionCache = new Map();
    const formatCache = new Map();
    const playerCache = new Map();

    const getOrCreate = async (collection, field, value, cache) => {
        if (cache.has(value)) return cache.get(value);
        try {
            const record = await pb.collection(collection).getFirstListItem(`${field}="${value}"`);
            cache.set(value, record.id);
            return record.id;
        } catch (error) {
            if (error.status === 404) {
                const newRecord = await pb.collection(collection).create({ [field]: value });
                cache.set(value, newRecord.id);
                return newRecord.id;
            }
            throw error;
        }
    };

    const getOrCreatePlayer = async (playerName, primaryPositionID) => {
        const cleanPlayerName = playerName.trim();
        if (playerCache.has(cleanPlayerName)) return playerCache.get(cleanPlayerName);

        const escapedName = cleanPlayerName.replace(/'/g, "''");
        const filter = `name="${escapedName}"`;
        try {
            const record = await pb.collection('players').getFirstListItem(filter);
            playerCache.set(cleanPlayerName, record.id);
            return record.id;
        } catch (error) {
            if (error.status === 404) {
                const newRecord = await pb.collection('players').create({ name: cleanPlayerName, position: primaryPositionID });
                playerCache.set(cleanPlayerName, newRecord.id);
                return newRecord.id;
            }
            console.error(`Error finding/creating player: ${cleanPlayerName}`, error);
            throw error;
        }
    };

    for (const [position, formats] of Object.entries(rankingsData)) {
        try {
            const positionID = await getOrCreate('positions', 'name', position, positionCache);
            for (const [formatName, tiers] of Object.entries(formats)) {
                const formatID = await getOrCreate('scoring_formats', 'name', formatName, formatCache);
                let positionRank = 1;

                for (let i = 0; i < tiers.length; i++) {
                    const tier = i + 1;
                    const playerNames = tiers[i].split(',').map(name => name.trim()).filter(Boolean);
                    if (playerNames.length === 0) continue;

                    console.log(`\nProcessing ${position} > ${formatName} > Tier ${tier} (${playerNames.length} players)...`);
                    
                    const createPromises = playerNames.map(async (playerName) => {
                        const payload = {
                            player: await getOrCreatePlayer(playerName, positionID),
                            position: positionID,
                            format: formatID,
                            tier: tier,
                            week: week,
                            year: year,
                            positionRank: positionRank++,
                        };
                        return pb.collection('weekly_rankings').create(payload);
                    });

                    const results = await Promise.allSettled(createPromises);
                    
                    results.forEach((result, index) => {
                        if (result.status === 'rejected') {
                            console.warn(`\t- Failed to process player "${playerNames[index]}":`, result.reason?.message || result.reason);
                        }
                    });

                    console.log(`\t...Tier ${tier} completed.`);
                }
            }
        } catch (processError) {
            console.error(`Error processing position ${position}:`, processError);
        }
    }

    console.log('\nIngestion process completed!');
}

main().catch(err => {
    console.error('An unexpected error occurred:', err);
    process.exit(1);
});
