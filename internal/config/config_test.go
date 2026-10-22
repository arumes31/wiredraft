package config

import (
	"strings"
	"testing"
)

func TestAuthenticationEnvironmentDefaults(t *testing.T) {
	t.Setenv("WIREDRAFT_MEDIA_DIR", "")
	t.Setenv("WIREDRAFT_GUEST_ENABLED", "")
	t.Setenv("WIREDRAFT_COOKIE_SECURE", "")
	t.Setenv("WIREDRAFT_ADMIN_USER", "")
	t.Setenv("WIREDRAFT_ADMIN_PASSWORD", "")

	configuration, err := Parse(nil)
	if err != nil {
		t.Fatal(err)
	}
	if configuration.GuestEnabled || !configuration.CookieSecure || configuration.AdminUsername != "admin" {
		t.Fatalf("authentication defaults = %#v", configuration)
	}
	if configuration.MediaDir != "data/media" {
		t.Fatalf("media directory = %q, want data/media", configuration.MediaDir)
	}
}

func TestMediaDirectoryEnvironmentAndFlag(t *testing.T) {
	t.Setenv("WIREDRAFT_MEDIA_DIR", "environment-media")
	configuration, err := Parse([]string{"-media-dir", "flag-media"})
	if err != nil {
		t.Fatal(err)
	}
	if configuration.MediaDir != "flag-media" {
		t.Fatalf("media directory = %q, want flag-media", configuration.MediaDir)
	}
}

func TestWireDraftAuthenticationEnvironment(t *testing.T) {
	t.Setenv("WIREDRAFT_GUEST_ENABLED", "false")
	t.Setenv("WIREDRAFT_COOKIE_SECURE", "true")
	t.Setenv("WIREDRAFT_ADMIN_USER", "wiredraft-admin")
	t.Setenv("WIREDRAFT_ADMIN_PASSWORD", "wiredraft bootstrap password")
	configuration, err := Parse(nil)
	if err != nil {
		t.Fatal(err)
	}
	if configuration.GuestEnabled || !configuration.CookieSecure || configuration.AdminUsername != "wiredraft-admin" || configuration.AdminPassword != "wiredraft bootstrap password" {
		t.Fatalf("WireDraft authentication environment = %#v", configuration)
	}
}

func TestLegacyAuthenticationBooleansRemainSupported(t *testing.T) {
	t.Setenv("WIREDRAFT_GUEST_ENABLED", "")
	t.Setenv("WIREDRAFT_COOKIE_SECURE", "")
	t.Setenv("NETDIAGRAM_GUEST_ENABLED", "true")
	t.Setenv("NETDIAGRAM_COOKIE_SECURE", "false")

	configuration, err := Parse(nil)
	if err != nil {
		t.Fatal(err)
	}
	if !configuration.GuestEnabled || configuration.CookieSecure {
		t.Fatalf("legacy authentication booleans = %#v", configuration)
	}
}

func TestTrustedProxiesEnvironment(t *testing.T) {
	t.Setenv("WIREDRAFT_TRUSTED_PROXIES", " 10.0.0.0/8, 192.0.2.7 ,::ffff:198.51.100.1,fd00::/64")
	configuration, err := Parse(nil)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"10.0.0.0/8", "192.0.2.7/32", "198.51.100.1/32", "fd00::/64"}
	if len(configuration.TrustedProxies) != len(want) {
		t.Fatalf("trusted proxies = %v, want %v", configuration.TrustedProxies, want)
	}
	for index, prefix := range configuration.TrustedProxies {
		if prefix.String() != want[index] {
			t.Fatalf("trusted proxies = %v, want %v", configuration.TrustedProxies, want)
		}
	}
	t.Setenv("WIREDRAFT_TRUSTED_PROXIES", "not-an-address")
	if _, err := Parse(nil); err == nil || !strings.Contains(err.Error(), "WIREDRAFT_TRUSTED_PROXIES") {
		t.Fatalf("Parse error = %v, want named invalid proxy", err)
	}
}

func TestAuthenticationEnvironmentBooleansAreStrict(t *testing.T) {
	t.Setenv("WIREDRAFT_GUEST_ENABLED", "fasle")
	_, err := Parse(nil)
	if err == nil || !strings.Contains(err.Error(), "WIREDRAFT_GUEST_ENABLED") {
		t.Fatalf("Parse error = %v, want named invalid boolean", err)
	}
}

func TestEntraConfigurationRequiresSecureCompleteSettings(t *testing.T) {
	t.Setenv("WIREDRAFT_ENTRA_ENABLED", "true")
	t.Setenv("WIREDRAFT_COOKIE_SECURE", "true")
	t.Setenv("WIREDRAFT_ENTRA_TENANT_ID", "tenant-id")
	t.Setenv("WIREDRAFT_ENTRA_CLIENT_ID", "client-id")
	t.Setenv("WIREDRAFT_ENTRA_CLIENT_SECRET_FILE", "/run/secrets/entra")
	t.Setenv("WIREDRAFT_ENTRA_REDIRECT_URL", "https://wiredraft.internal/api/v1/auth/entra/callback")

	configuration, err := Parse(nil)
	if err != nil {
		t.Fatal(err)
	}
	if !configuration.EntraEnabled || configuration.EntraTenantID != "tenant-id" {
		t.Fatalf("Entra configuration = %#v", configuration)
	}

	t.Setenv("WIREDRAFT_COOKIE_SECURE", "false")
	if _, err := Parse(nil); err == nil || !strings.Contains(err.Error(), "WIREDRAFT_COOKIE_SECURE") {
		t.Fatalf("insecure Entra configuration error = %v", err)
	}

	t.Setenv("WIREDRAFT_COOKIE_SECURE", "true")
	t.Setenv("WIREDRAFT_ENTRA_REDIRECT_URL", "http://wiredraft.internal/callback")
	if _, err := Parse(nil); err == nil || !strings.Contains(err.Error(), "HTTPS") {
		t.Fatalf("HTTP redirect configuration error = %v", err)
	}
}
