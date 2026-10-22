// Package config reads the server's environment and command-line configuration.
package config

import (
	"flag"
	"fmt"
	"net/netip"
	"net/url"

	"os"
	"strconv"
	"strings"
)

// Config contains all process-level runtime configuration.
type Config struct {
	Port                      int
	DatabaseURL               string
	MediaDir                  string
	LogLevel                  string
	LogFormat                 string
	AdminUsername             string
	AdminPassword             string
	AdminTOTPSecret           string
	GuestEnabled              bool
	CookieSecure              bool
	TrustedProxies            []netip.Prefix
	MaxGuestSessions          int
	MaxGuestSessionsPerClient int
	SecretKeyFile             string
	PreviousSecretKeyFile     string
	EntraEnabled              bool
	EntraTenantID             string
	EntraClientID             string
	EntraSecretFile           string
	EntraRedirectURL          string
	Healthcheck               bool
	HealthcheckURL            string
}

// Parse reads environment defaults and applies command-line overrides.
func Parse(args []string) (Config, error) {
	// Anonymous Guest access and plain-HTTP session cookies are explicit
	// opt-ins; the defaults are the safe production settings.
	guestEnabled, err := envBoolAlias("WIREDRAFT_GUEST_ENABLED", "NETDIAGRAM_GUEST_ENABLED", false)
	if err != nil {
		return Config{}, err
	}
	cookieSecure, err := envBoolAlias("WIREDRAFT_COOKIE_SECURE", "NETDIAGRAM_COOKIE_SECURE", true)
	if err != nil {
		return Config{}, err
	}
	trustedProxies, err := parseTrustedProxies(os.Getenv("WIREDRAFT_TRUSTED_PROXIES"))
	if err != nil {
		return Config{}, err
	}
	maxGuestSessions, err := envPositiveInt("WIREDRAFT_GUEST_SESSION_LIMIT")
	if err != nil {
		return Config{}, err
	}
	maxGuestSessionsPerClient, err := envPositiveInt("WIREDRAFT_GUEST_SESSIONS_PER_CLIENT")
	if err != nil {
		return Config{}, err
	}
	cfg := Config{
		Port:                      envInt("PORT", 8080),
		DatabaseURL:               envString("DATABASE_URL", ""),
		MediaDir:                  envString("WIREDRAFT_MEDIA_DIR", "data/media"),
		LogLevel:                  envString("LOG_LEVEL", "info"),
		LogFormat:                 envString("LOG_FORMAT", "json"),
		AdminUsername:             envString("WIREDRAFT_ADMIN_USER", "admin"),
		AdminPassword:             envString("WIREDRAFT_ADMIN_PASSWORD", ""),
		AdminTOTPSecret:           envString("WIREDRAFT_ADMIN_TOTP_SECRET", ""),
		GuestEnabled:              guestEnabled,
		CookieSecure:              cookieSecure,
		TrustedProxies:            trustedProxies,
		MaxGuestSessions:          maxGuestSessions,
		MaxGuestSessionsPerClient: maxGuestSessionsPerClient,
		SecretKeyFile:             strings.TrimSpace(os.Getenv("WIREDRAFT_AUTH_SECRET_KEY_FILE")),
		PreviousSecretKeyFile:     strings.TrimSpace(os.Getenv("WIREDRAFT_AUTH_PREVIOUS_SECRET_KEY_FILE")),
		EntraEnabled:              false,
		EntraTenantID:             strings.TrimSpace(os.Getenv("WIREDRAFT_ENTRA_TENANT_ID")),
		EntraClientID:             strings.TrimSpace(os.Getenv("WIREDRAFT_ENTRA_CLIENT_ID")),
		EntraSecretFile:           strings.TrimSpace(os.Getenv("WIREDRAFT_ENTRA_CLIENT_SECRET_FILE")),
		EntraRedirectURL:          strings.TrimSpace(os.Getenv("WIREDRAFT_ENTRA_REDIRECT_URL")),
		HealthcheckURL:            envString("HEALTHCHECK_URL", "http://127.0.0.1:8080/api/v1/health"),
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

// parseTrustedProxies reads a comma-separated list of IP addresses and CIDR
// networks whose X-Forwarded-For headers are trusted.
func parseTrustedProxies(value string) ([]netip.Prefix, error) {
	var prefixes []netip.Prefix
	for _, entry := range strings.Split(value, ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		if strings.Contains(entry, "/") {
			prefix, err := netip.ParsePrefix(entry)
			if err != nil {
				return nil, fmt.Errorf("WIREDRAFT_TRUSTED_PROXIES contains an invalid network %q: %w", entry, err)
			}
			prefixes = append(prefixes, prefix.Masked())
			continue
		}
		address, err := netip.ParseAddr(entry)
		if err != nil {
			return nil, fmt.Errorf("WIREDRAFT_TRUSTED_PROXIES contains an invalid address %q: %w", entry, err)
		}
		address = address.Unmap()
		prefixes = append(prefixes, netip.PrefixFrom(address, address.BitLen()))
	}
	return prefixes, nil
}

// envPositiveInt reads an optional positive integer; empty selects the
// built-in default, reported as zero.
func envPositiveInt(name string) (int, error) {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return 0, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < 1 {
		return 0, fmt.Errorf("%s must be a positive integer", name)
	}
	return parsed, nil
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
