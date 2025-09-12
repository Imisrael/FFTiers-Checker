// node ingest.js --week=1 --year=2025

import PocketBase from 'pocketbase';
import fs from 'fs/promises';
import path from 'path';

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

    // --- INITIALIZE POCKETBASE CLIENT ---
    const pb = new PocketBase(POCKETBASE_URL);

    try {
        await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
        console.log(`Successfully authenticated as admin: ${pb.authStore.model.email}`);
    } catch (error) {
        console.error('Error: Failed to authenticate as admin.', error);
        process.exit(1);
    }

    // --- READ AND PARSE JSON FILE ---
    let rankingsData;
    try {
        const fileContent = await fs.readFile(path.resolve(JSON_FILE_PATH), 'utf-8');
        rankingsData = JSON.parse(fileContent);
        console.log('Successfully parsed rankings.json file.');
    } catch (error) {
        console.error(`Error: Failed to read or parse JSON file at ${JSON_FILE_PATH}`, error);
        process.exit(1);
    }

    // --- CACHES AND HELPERS ---
    const positionCache = new Map();
    const formatCache = new Map();
    const playerCache = new Map();

    // Generic helper to find an existing record or create a new one.
    const getOrCreate = async (collection, field, value, cache) => {
        if (cache.has(value)) {
            return cache.get(value);
        }
        try {
            const record = await pb.collection(collection).getFirstListItem(`${field}="${value}"`);
            cache.set(value, record.id);
            return record.id;
        } catch (error) {
            // Error code 404 means "Not Found"
            if (error.status === 404) {
                console.log(`Creating new record in '${collection}': ${value}`);
                const newRecord = await pb.collection(collection).create({ [field]: value });
                cache.set(value, newRecord.id);
                return newRecord.id;
            }
            // Re-throw other errors
            throw error;
        }
    };

    // Specialized version for players to handle the relation field.
    const getOrCreatePlayer = async (playerName, primaryPositionID) => {
        if (playerCache.has(playerName)) {
            return playerCache.get(playerName);
        }
        try {
            const record = await pb.collection('players').getFirstListItem(`name="${playerName}"`);
            playerCache.set(playerName, record.id);
            return record.id;
        } catch (error) {
            if (error.status === 404) {
                console.log(`Creating new player: ${playerName}`);
                const newRecord = await pb.collection('players').create({
                    name: playerName,
                    position: primaryPositionID
                });
                playerCache.set(playerName, newRecord.id);
                return newRecord.id;
            }
            throw error;
        }
    };


    // --- DATA INGESTION LOGIC ---
    for (const [position, formats] of Object.entries(rankingsData)) {
        try {
            const positionID = await getOrCreate('positions', 'name', position, positionCache);
            
            for (const [formatName, tiers] of Object.entries(formats)) {
                const formatID = await getOrCreate('scoring_formats', 'name', formatName, formatCache);
                let positionRank = 1;
                for (let i = 0; i < tiers.length; i++) {
                    const tier = i + 1; // Tiers are 1-based
                    const playerNames = tiers[i].split(', ');

                    for (const playerName of playerNames) {
                        const playerID = await getOrCreatePlayer(playerName, positionID);

                        const payload = {
                            player: playerID,
                            position: positionID,
                            format: formatID,
                            tier: tier,
                            week: week,
                            year: year,
                            positionRank: positionRank
                        };

                        try {
                            await pb.collection('weekly_rankings').create(payload);
                            console.log(`Successfully created ranking for: ${playerName} (Tier ${tier}, ${position}, ${formatName}), positonRank: ${positionRank}`);
                            positionRank++;
                        } catch (createError) {
                            console.warn(`Warning: Failed to create weekly ranking for ${playerName}:`, createError.message);
                        }
                    }
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
