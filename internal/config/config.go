// Package config reads the server's environment and command-line configuration.
package config

import (
	"flag"
	"fmt"
	"os"
	"strconv"
)

// Config contains all process-level runtime configuration.
type Config struct {
	Port           int
	DataDir        string
	LogLevel       string
	LogFormat      string
	Healthcheck    bool
	HealthcheckURL string
}

// Parse reads environment defaults and applies command-line overrides.
func Parse(args []string) (Config, error) {
	cfg := Config{
		Port:           envInt("PORT", 8080),
		DataDir:        envString("DATA_DIR", "data"),
		LogLevel:       envString("LOG_LEVEL", "info"),
		LogFormat:      envString("LOG_FORMAT", "json"),
		HealthcheckURL: envString("HEALTHCHECK_URL", "http://127.0.0.1:8080/api/v1/health"),
	}

	set := flag.NewFlagSet("netdiagram", flag.ContinueOnError)
	set.IntVar(&cfg.Port, "port", cfg.Port, "HTTP listen port")
	set.StringVar(&cfg.DataDir, "data-dir", cfg.DataDir, "topology data directory")
	set.StringVar(&cfg.LogLevel, "log-level", cfg.LogLevel, "debug, info, warn, or error")
	set.StringVar(&cfg.LogFormat, "log-format", cfg.LogFormat, "json or text")
	set.BoolVar(&cfg.Healthcheck, "healthcheck", false, "probe a running server and exit")
	set.StringVar(&cfg.HealthcheckURL, "healthcheck-url", cfg.HealthcheckURL, "URL used by -healthcheck")
	if err := set.Parse(args); err != nil {
		return Config{}, fmt.Errorf("parsing flags: %w", err)
	}
	if cfg.Port < 1 || cfg.Port > 65535 {
		return Config{}, fmt.Errorf("port must be between 1 and 65535")
	}
	if cfg.DataDir == "" {
		return Config{}, fmt.Errorf("data directory must not be empty")
	}
	return cfg, nil
}

func envString(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func envInt(name string, fallback int) int {
	value := os.Getenv(name)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}
