package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

const pocketbaseUrl = "http://127.0.0.1:8090"
const rankingsJsonFile = "../../files/tiers.json"

type AllRankings map[string]map[string][]string

// --- Structs for PocketBase API Payloads ---

// Payload for creating a record in the 'players' collection.
type PlayerPayload struct {
	PlayerName string `json:"playerName"`
	Position   string `json:"position"`
}

// Payload for creating a record in the 'rankings' collection.
type RankingPayload struct {
	Tier          int      `json:"tier"`
	Position      string   `json:"position"`
	Type          string   `json:"type"`
	PlayersInTier []string `json:"playersInTier"`
}

// Response from PocketBase after creating a record, we only need the ID.
type CreateResponse struct {
	ID string `json:"id"`
}

// --- Main Ingestion Logic ---

func main() {
	log.Println("Starting PocketBase ingestion script...")

	// Read and parse the JSON file
	jsonFile, err := os.Open(rankingsJsonFile)
	if err != nil {
		log.Fatalf("FATAL: Could not open %s. Make sure the file exists. Error: %v", rankingsJsonFile, err)
	}
	defer jsonFile.Close()

	byteValue, _ := io.ReadAll(jsonFile)
	var allRankings AllRankings
	if err := json.Unmarshal(byteValue, &allRankings); err != nil {
		log.Fatalf("FATAL: Could not parse JSON. Error: %v", err)
	}

	// This cache prevents us from creating duplicate players.
	// It maps a player's name to their PocketBase record ID.
	playerCache := make(map[string]string)
	client := &http.Client{Timeout: 10 * time.Second}

	// --- Process all rankings from the file ---
	for position, rankingTypes := range allRankings {
		for rankingType, tiers := range rankingTypes {
			log.Printf("Processing %s - %s...", position, rankingType)
			for i, tierStr := range tiers {
				tierNumber := i + 1
				playerNames := strings.Split(tierStr, ", ")

				var playerIDsInTier []string
				for _, playerName := range playerNames {
					cleanPlayerName := strings.TrimSpace(playerName)
					if cleanPlayerName == "" {
						continue
					}

					playerID, err := createPlayerIfNeeded(client, playerCache, cleanPlayerName, position)
					if err != nil {
						log.Printf("WARN: Could not create player '%s'. Skipping. Error: %v", cleanPlayerName, err)
						continue
					}
					playerIDsInTier = append(playerIDsInTier, playerID)
				}

				// Now create the ranking record with the list of player IDs
				if err := createRanking(client, tierNumber, position, rankingType, playerIDsInTier); err != nil {
					log.Printf("WARN: Could not create ranking for %s %s Tier %d. Error: %v", position, rankingType, tierNumber, err)
				}
			}
		}
	}

	log.Println("Ingestion script finished successfully!")
}

// createPlayerIfNeeded checks a local cache to see if a player has already been created.
// If not, it sends a POST request to PocketBase to create the player and returns the new ID.
func createPlayerIfNeeded(client *http.Client, cache map[string]string, name, position string) (string, error) {
	// If player is already in our cache, return the ID immediately.
	if id, ok := cache[name]; ok {
		return id, nil
	}

	// Player not in cache, create them in PocketBase.
	log.Printf("  -> Creating player: %s", name)
	payload := PlayerPayload{
		PlayerName: name,
		Position:   position,
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("could not marshal player payload: %w", err)
	}

	// Send POST request to the 'players' collection
	req, err := http.NewRequest("POST", pocketbaseUrl+"/api/collections/players/records", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return "", fmt.Errorf("could not create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("pocketbase returned non-200 status for player create: %s - %s", resp.Status, string(body))
	}

	var createResp CreateResponse
	if err := json.NewDecoder(resp.Body).Decode(&createResp); err != nil {
		return "", fmt.Errorf("could not decode pocketbase response: %w", err)
	}

	// Add the new player's ID to the cache and return it.
	cache[name] = createResp.ID
	return createResp.ID, nil
}

// createRanking sends a POST request to PocketBase to create a new ranking record.
func createRanking(client *http.Client, tier int, position, rankingType string, playerIDs []string) error {
	log.Printf("  -> Creating ranking: %s %s Tier %d with %d players", position, rankingType, tier, len(playerIDs))
	payload := RankingPayload{
		Tier:          tier,
		Position:      position,
		Type:          rankingType,
		PlayersInTier: playerIDs,
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("could not marshal ranking payload: %w", err)
	}

	// Send POST request to the 'rankings' collection
	req, err := http.NewRequest("POST", pocketbaseUrl+"/api/collections/rankings/records", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return fmt.Errorf("could not create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("pocketbase returned non-200 status for ranking create: %s - %s", resp.Status, string(body))
	}

	return nil
}
