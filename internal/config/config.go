// Package config reads the server's environment and command-line configuration.
package config

import (
	"flag"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
)

// Config contains all process-level runtime configuration.
type Config struct {
	Port             int
	DatabaseURL      string
	MediaDir         string
	LogLevel         string
	LogFormat        string
	AdminUsername    string
	AdminPassword    string
	AdminTOTPSecret  string
	GuestEnabled     bool
	CookieSecure     bool
	EntraEnabled     bool
	EntraTenantID    string
	EntraClientID    string
	EntraSecretFile  string
	EntraRedirectURL string
	Healthcheck      bool
	HealthcheckURL   string
}

// Parse reads environment defaults and applies command-line overrides.
func Parse(args []string) (Config, error) {
	guestEnabled, err := envBoolAlias("WIREDRAFT_GUEST_ENABLED", "NETDIAGRAM_GUEST_ENABLED", true)
	if err != nil {
		return Config{}, err
	}
	cookieSecure, err := envBoolAlias("WIREDRAFT_COOKIE_SECURE", "NETDIAGRAM_COOKIE_SECURE", false)
	if err != nil {
		return Config{}, err
	}
	cfg := Config{
		Port:             envInt("PORT", 8080),
		DatabaseURL:      envString("DATABASE_URL", ""),
		MediaDir:         envString("WIREDRAFT_MEDIA_DIR", "data/media"),
		LogLevel:         envString("LOG_LEVEL", "info"),
		LogFormat:        envString("LOG_FORMAT", "json"),
		AdminUsername:    envStringAlias("WIREDRAFT_ADMIN_USER", "NETDIAGRAM_ADMIN_USER", "admin"),
		AdminPassword:    envStringAlias("WIREDRAFT_ADMIN_PASSWORD", "NETDIAGRAM_ADMIN_PASSWORD", ""),
		AdminTOTPSecret:  envStringAlias("WIREDRAFT_ADMIN_TOTP_SECRET", "NETDIAGRAM_ADMIN_TOTP_SECRET", ""),
		GuestEnabled:     guestEnabled,
		CookieSecure:     cookieSecure,
		EntraEnabled:     false,
		EntraTenantID:    strings.TrimSpace(os.Getenv("WIREDRAFT_ENTRA_TENANT_ID")),
		EntraClientID:    strings.TrimSpace(os.Getenv("WIREDRAFT_ENTRA_CLIENT_ID")),
		EntraSecretFile:  strings.TrimSpace(os.Getenv("WIREDRAFT_ENTRA_CLIENT_SECRET_FILE")),
		EntraRedirectURL: strings.TrimSpace(os.Getenv("WIREDRAFT_ENTRA_REDIRECT_URL")),
		HealthcheckURL:   envString("HEALTHCHECK_URL", "http://127.0.0.1:8080/api/v1/health"),
	}
	if cfg.EntraEnabled, err = envBool("WIREDRAFT_ENTRA_ENABLED", false); err != nil {
		return Config{}, err
	}

	set := flag.NewFlagSet("wiredraft", flag.ContinueOnError)
	set.IntVar(&cfg.Port, "port", cfg.Port, "HTTP listen port")
	set.StringVar(&cfg.MediaDir, "media-dir", cfg.MediaDir, "private uploaded-photo directory")
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
	if cfg.MediaDir == "" {
		return Config{}, fmt.Errorf("media directory must not be empty")
	}
	if cfg.EntraEnabled {
		if cfg.EntraTenantID == "" || cfg.EntraClientID == "" || cfg.EntraSecretFile == "" || cfg.EntraRedirectURL == "" {
			return Config{}, fmt.Errorf("enabled Entra login requires tenant id, client id, client secret file, and redirect url")
		}
		redirectURL, parseErr := url.Parse(cfg.EntraRedirectURL)
		if parseErr != nil || redirectURL.Scheme != "https" || redirectURL.Host == "" || redirectURL.RawQuery != "" || redirectURL.Fragment != "" {
			return Config{}, fmt.Errorf("WIREDRAFT_ENTRA_REDIRECT_URL must be an absolute HTTPS URL without query or fragment")
		}
		if !cfg.CookieSecure {
			return Config{}, fmt.Errorf("WIREDRAFT_COOKIE_SECURE must be true when Entra login is enabled")
		}
	}
	return cfg, nil
}

func envString(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func envStringAlias(name, legacyName, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return envString(legacyName, fallback)
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

func envBool(name string, fallback bool) (bool, error) {
	value := os.Getenv(name)
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return false, fmt.Errorf("%s must be true or false: %w", name, err)
	}
	return parsed, nil
}

func envBoolAlias(name, legacyName string, fallback bool) (bool, error) {
	if os.Getenv(name) != "" {
		return envBool(name, fallback)
	}
	return envBool(legacyName, fallback)
}
