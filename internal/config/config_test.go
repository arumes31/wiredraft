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
	t.Setenv("NETDIAGRAM_GUEST_ENABLED", "")
	t.Setenv("NETDIAGRAM_COOKIE_SECURE", "")
	t.Setenv("NETDIAGRAM_ADMIN_USER", "")
	t.Setenv("NETDIAGRAM_ADMIN_PASSWORD", "bootstrap password")

	configuration, err := Parse(nil)
	if err != nil {
		t.Fatal(err)
	}
	if !configuration.GuestEnabled || configuration.CookieSecure || configuration.AdminUsername != "admin" {
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

func TestWireDraftAuthenticationEnvironmentTakesPriority(t *testing.T) {
	t.Setenv("WIREDRAFT_GUEST_ENABLED", "false")
	t.Setenv("WIREDRAFT_COOKIE_SECURE", "true")
	t.Setenv("WIREDRAFT_ADMIN_USER", "wiredraft-admin")
	t.Setenv("WIREDRAFT_ADMIN_PASSWORD", "wiredraft bootstrap password")
	t.Setenv("NETDIAGRAM_GUEST_ENABLED", "true")
	t.Setenv("NETDIAGRAM_COOKIE_SECURE", "false")
	t.Setenv("NETDIAGRAM_ADMIN_USER", "legacy-admin")
	t.Setenv("NETDIAGRAM_ADMIN_PASSWORD", "legacy bootstrap password")

	configuration, err := Parse(nil)
	if err != nil {
		t.Fatal(err)
	}
	if configuration.GuestEnabled || !configuration.CookieSecure || configuration.AdminUsername != "wiredraft-admin" || configuration.AdminPassword != "wiredraft bootstrap password" {
		t.Fatalf("WireDraft authentication environment = %#v", configuration)
	}
}

func TestAuthenticationEnvironmentBooleansAreStrict(t *testing.T) {
	t.Setenv("WIREDRAFT_GUEST_ENABLED", "fasle")
	t.Setenv("NETDIAGRAM_GUEST_ENABLED", "fasle")
	_, err := Parse(nil)
	if err == nil || !strings.Contains(err.Error(), "WIREDRAFT_GUEST_ENABLED") {
		t.Fatalf("Parse error = %v, want named invalid boolean", err)
	}
}
