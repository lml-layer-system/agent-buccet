// Agent Buccet — Witness Server
//
// Receives signed ledger checkpoints from Agent Buccet installations and stores
// them in an embedded SQLite database with WAL mode.
//
// The checkpoint is already cryptographically signed by the client (ed25519).
// This server is an independent, always-on store that the local agent process
// cannot reach to suppress — a compromised runtime cannot erase its own trail.
//
// Routes:
//
//	GET  /health      — liveness probe
//	POST /checkpoint  — store a BoundaryLedgerCheckpoint
//
// Configuration (environment variables):
//
//	PORT                    TCP port to listen on (default: 3000)
//	WITNESS_DB_PATH         SQLite database path (default: ./data/checkpoints.db)
//	WITNESS_ALLOWED_ORIGINS CORS allowed origins (default: *)
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	_ "modernc.org/sqlite"
)

// checkpoint mirrors the BoundaryLedgerCheckpoint type from the TypeScript client.
type checkpoint struct {
	CheckpointID     string  `json:"checkpoint_id"`
	GeneratedAt      string  `json:"generated_at"`
	SignerID         string  `json:"signer_id"`
	SignatureAlgo    string  `json:"signature_algo"`
	TotalRecords     int64   `json:"total_records"`
	LatestRecordID   *string `json:"latest_record_id,omitempty"`
	LatestRecordHash *string `json:"latest_record_hash,omitempty"`
	ChainOK          bool    `json:"chain_ok"`
	CryptographicOK  bool    `json:"cryptographic_ok"`
	Signature        string  `json:"signature"`
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func initDB(db *sql.DB) error {
	pragmas := []string{
		"PRAGMA journal_mode=WAL;",
		"PRAGMA synchronous=NORMAL;",
	}
	for _, p := range pragmas {
		if _, err := db.Exec(p); err != nil {
			return fmt.Errorf("pragma %q: %w", p, err)
		}
	}

	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS checkpoints (
		checkpoint_id      TEXT PRIMARY KEY,
		signer_id          TEXT NOT NULL,
		signature          TEXT NOT NULL,
		signature_algo     TEXT NOT NULL,
		generated_at       TEXT NOT NULL,
		total_records      INTEGER NOT NULL,
		latest_record_id   TEXT,
		latest_record_hash TEXT,
		chain_ok           INTEGER NOT NULL,
		cryptographic_ok   INTEGER NOT NULL,
		received_at        TEXT NOT NULL,
		raw_json           TEXT NOT NULL
	)`)
	return err
}

func corsHeaders(w http.ResponseWriter, allowedOrigins string) {
	w.Header().Set("Access-Control-Allow-Origin", allowedOrigins)
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func newMux(db *sql.DB, allowedOrigins string) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		corsHeaders(w, allowedOrigins)

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		// Route: GET /health
		if r.Method == http.MethodGet && r.URL.Path == "/health" {
			writeJSON(w, http.StatusOK, map[string]string{
				"status":  "ok",
				"service": "buccet-witness",
			})
			return
		}

		// Route: POST /checkpoint
		if r.Method == http.MethodPost && r.URL.Path == "/checkpoint" {
			handleCheckpoint(w, r, db)
			return
		}

		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
	})

	return mux
}

func handleCheckpoint(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20)) // 1 MB limit
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to read body"})
		return
	}

	var cp checkpoint
	if err := json.Unmarshal(body, &cp); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}

	// Validate required fields.
	missing := []string{}
	if strings.TrimSpace(cp.CheckpointID) == "" {
		missing = append(missing, "checkpoint_id")
	}
	if strings.TrimSpace(cp.SignerID) == "" {
		missing = append(missing, "signer_id")
	}
	if strings.TrimSpace(cp.Signature) == "" {
		missing = append(missing, "signature")
	}
	if strings.TrimSpace(cp.GeneratedAt) == "" {
		missing = append(missing, "generated_at")
	}
	if len(missing) > 0 {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{
			"error": "missing required fields: " + strings.Join(missing, ", "),
		})
		return
	}

	receivedAt := time.Now().UTC().Format(time.RFC3339)

	chainOK := 0
	if cp.ChainOK {
		chainOK = 1
	}
	cryptoOK := 0
	if cp.CryptographicOK {
		cryptoOK = 1
	}

	_, err = db.Exec(`
		INSERT INTO checkpoints
			(checkpoint_id, signer_id, signature, signature_algo, generated_at,
			 total_records, latest_record_id, latest_record_hash,
			 chain_ok, cryptographic_ok, received_at, raw_json)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		cp.CheckpointID,
		cp.SignerID,
		cp.Signature,
		cp.SignatureAlgo,
		cp.GeneratedAt,
		cp.TotalRecords,
		cp.LatestRecordID,
		cp.LatestRecordHash,
		chainOK,
		cryptoOK,
		receivedAt,
		string(body),
	)
	if err != nil {
		// SQLite PRIMARY KEY violation → duplicate submission.
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			writeJSON(w, http.StatusConflict, map[string]string{
				"error":         "checkpoint already exists",
				"checkpoint_id": cp.CheckpointID,
			})
			return
		}
		log.Printf("[witness] db insert failed checkpoint_id=%s: %v", cp.CheckpointID, err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "storage failure"})
		return
	}

	log.Printf("[witness] stored checkpoint_id=%s signer=%s total_records=%d",
		cp.CheckpointID, cp.SignerID, cp.TotalRecords)

	writeJSON(w, http.StatusOK, map[string]string{
		"accepted":      "true",
		"checkpoint_id": cp.CheckpointID,
		"received_at":   receivedAt,
	})
}

func main() {
	port := envOr("PORT", "3000")
	dbPath := envOr("WITNESS_DB_PATH", filepath.Join("data", "checkpoints.db"))
	allowedOrigins := envOr("WITNESS_ALLOWED_ORIGINS", "*")

	// Ensure the DB directory exists.
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		log.Fatalf("[witness] failed to create DB directory: %v", err)
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatalf("[witness] failed to open DB: %v", err)
	}
	defer db.Close()

	// Single writer connection — SQLite WAL handles concurrent readers fine.
	db.SetMaxOpenConns(1)

	if err := initDB(db); err != nil {
		log.Fatalf("[witness] failed to initialize DB schema: %v", err)
	}

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      newMux(db, allowedOrigins),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Printf("[witness] listening on :%s", port)
		log.Printf("[witness] db: %s", dbPath)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[witness] server error: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("[witness] shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("[witness] shutdown error: %v", err)
	}
}
