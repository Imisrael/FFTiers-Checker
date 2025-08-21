// ingest.js
import PocketBase from 'pocketbase';
import fs from 'fs/promises';

// --- CONFIGURATION ---
// 👉 Replace with your PocketBase instance URL
const POCKETBASE_URL = 'http://127.0.0.1:8090';
// 👉 Replace with your admin email and password
const ADMIN_EMAIL = 'israelimru@gmail.com';
const ADMIN_PASSWORD = 'bwd0fbt2exc-yqe7GEK';

// The name of your big board collection
const BIG_BOARD_COLLECTION = 'big_board_rankings';
// --- END CONFIGURATION ---

// Initialize PocketBase client
const pb = new PocketBase(POCKETBASE_URL);

/**
 * Main function to run the ingestion process.
 */
async function main() {
    try {
        console.log('🚀 Starting ingestion process...');

        // 1. Authenticate as admin
        console.log('Authenticating with PocketBase...');
        await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
        console.log('✅ Authentication successful.');

        // 2. Load the rankings data from the JSON file
        console.log('Reading rankings.json file...');
        const rankingsData = JSON.parse(await fs.readFile('../../files/big_board_tiers.json', 'utf-8'));
        console.log('✅ JSON file loaded.');

        // 3. Cache related collections for performance
        // This is MUCH faster than querying for each player/format inside the loop.
        console.log('Caching players and scoring formats from PocketBase...');

        const allPlayers = await pb.collection('players').getFullList({
            // Assuming the player record has a relation to 'positions'
            // This will fetch the full position object along with the player
            expand: 'position'
        });
        const allScoringFormats = await pb.collection('scoring_formats').getFullList();

        // Create maps for quick lookups (name -> record ID)
        const playersMap = new Map(allPlayers.map(p => [p.name, p]));
        const scoringFormatsMap = new Map(allScoringFormats.map(sf => [sf.name, sf.id]));

        console.log(`✅ Cached ${playersMap.size} players and ${scoringFormatsMap.size} scoring formats.`);

        // 4. Loop through the rankings data and create records
        console.log('Ingesting rankings...');
        let createdCount = 0;
        let skippedCount = 0;

        // Loop over each scoring format (e.g., "Standard", "PPR")
        for (const formatName in rankingsData) {
            console.log(`\n--- Processing format: ${formatName} ---`);
            const scoringFormatId = scoringFormatsMap.get(formatName);

            if (!scoringFormatId) {
                console.warn(`⚠️  Scoring format "${formatName}" not found in database. Skipping all its rankings.`);
                continue;
            }

            const tiers = rankingsData[formatName];

            // Loop over each tier array (the array of comma-separated strings)
            for (let i = 0; i < tiers.length; i++) {
                const tierNumber = i + 1; // Tiers are 1-based
                const playerNames = tiers[i].split(',').map(name => name.trim());

                // Loop over each player name in the current tier
                for (const playerName of playerNames) {
                    const playerRecord = playersMap.get(playerName);

                    if (!playerRecord) {
                        console.warn(`- ⚠️  Player "${playerName}" not found in database. Skipping.`);
                        skippedCount++;
                        continue;
                    }

                    // The position ID is retrieved from the expanded player record
                    // This assumes your 'players' collection has a 'position' relation field.
                    const positionId = playerRecord.position;

                    const dataToCreate = {
                        player: playerRecord.id,
                        format: scoringFormatId,
                        position: positionId,
                        tier: tierNumber,
                    };

                    try {
                        await pb.collection(BIG_BOARD_COLLECTION).create(dataToCreate);
                        console.log(`- ✅ Created record for ${playerName} (Tier ${tierNumber})`);
                        createdCount++;
                    } catch (createError) {
                        console.error(`- ❌ Failed to create record for ${playerName}:`, createError.message);
                    }
                }
            }
        }

        console.log('\n\n--- Ingestion Complete! ---');
        console.log(`🎉 Successfully created ${createdCount} ranking records.`);
        console.log(`🤔 Skipped ${skippedCount} records due to missing players/formats.`);

    } catch (error) {
        console.error('\n❌ An unexpected error occurred:', error.message);
        if (error.data) {
            console.error('Error details:', error.data);
        }
    }
}

// Run the script
main();