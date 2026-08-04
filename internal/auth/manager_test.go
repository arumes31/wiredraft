package auth

import (
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/pquerna/otp/totp"
)

const testPassword = "this is a long test password"

func TestManagerFirstLoginEnrollmentAndRecovery(t *testing.T) {
	t.Parallel()
	manager, err := New(t.TempDir(), Config{
		AdminUsername: "admin", AdminPassword: testPassword, GuestEnabled: true,
	}, []string{"topology-b", "topology-a"})
	if err != nil {
		t.Fatal(err)
	}
	fixedNow := time.Date(2026, 8, 4, 12, 0, 15, 0, time.UTC)
	manager.now = func() time.Time { return fixedNow }

	challenge, err := manager.StartLogin("ADMIN", testPassword, "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	if challenge.Next != "setup" || challenge.Enrollment == nil || challenge.Enrollment.QRCodeDataURL == "" {
		t.Fatalf("challenge = %#v, want setup with qr code", challenge)
	}
	if !strings.Contains(challenge.Enrollment.ProvisionURI, "issuer=WireDraft") {
		t.Fatalf("provisioning URI = %q, want WireDraft issuer", challenge.Enrollment.ProvisionURI)
	}
	code, err := totp.GenerateCode(challenge.Enrollment.ManualCode, fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	session, recoveryCodes, err := manager.CompleteSetup(t.Context(), challenge.Challenge, code)
	if err != nil {
		t.Fatal(err)
	}
	if len(recoveryCodes) != recoveryCodeCount {
		t.Fatalf("recovery codes = %d, want %d", len(recoveryCodes), recoveryCodeCount)
	}
	resolved, exists := manager.Session(session.Token)
	if !exists || !resolved.Principal.IsAdmin() || resolved.CSRFToken == "" {
		t.Fatalf("resolved session = %#v, exists = %v", resolved, exists)
	}

	recoveryChallenge, err := manager.StartLogin("admin", testPassword, "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	if recoveryChallenge.Next != "totp" {
		t.Fatalf("next = %q, want totp", recoveryChallenge.Next)
	}
	if _, err := manager.CompleteRecovery(t.Context(), recoveryChallenge.Challenge, recoveryCodes[0]); err != nil {
		t.Fatal(err)
	}
	reusedChallenge, err := manager.StartLogin("admin", testPassword, "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := manager.CompleteRecovery(t.Context(), reusedChallenge.Challenge, recoveryCodes[0]); !errors.Is(err, ErrInvalidCode) {
		t.Fatalf("reused recovery code error = %v, want ErrInvalidCode", err)
	}
}

func TestManagerOrganizationAndGuestAuthorization(t *testing.T) {
	t.Parallel()
	manager, err := New(t.TempDir(), Config{
		AdminUsername: "admin", AdminPassword: testPassword, GuestEnabled: true,
	}, []string{"legacy-map"})
	if err != nil {
		t.Fatal(err)
	}
	user, err := manager.CreateUser(t.Context(), "vienna.operator", "another long test password", []string{"Vienna", "Berlin", "vienna"})
	if err != nil {
		t.Fatal(err)
	}
	if len(user.Organizations) != 2 {
		t.Fatalf("organizations = %#v, want two unique values", user.Organizations)
	}
	principal := Principal{UserID: user.ID, Username: user.Username, Role: RoleUser, Organizations: user.Organizations}
	if !manager.CanAccessTopology(principal, "map-a", "Vienna") {
		t.Fatal("assigned organization was denied")
	}
	if manager.CanAccessTopology(principal, "map-b", "London") {
		t.Fatal("unassigned organization was allowed")
	}
	guest := Principal{UserID: RoleGuest, Username: "Guest", Role: RoleGuest}
	if !manager.CanAccessTopology(guest, "legacy-map", "Private Org") {
		t.Fatal("legacy map was not captured by the guest workspace")
	}
	if manager.CanAccessTopology(guest, "new-map", "Guest") {
		t.Fatal("unregistered map was exposed to guest")
	}
	if err := manager.AddGuestTopology(t.Context(), "new-map"); err != nil {
		t.Fatal(err)
	}
	if !manager.CanAccessTopology(guest, "new-map", "Guest") {
		t.Fatal("new guest map was not persisted in the guest workspace")
	}
}

func TestManagerBootstrapTOTPFromEnvironment(t *testing.T) {
	t.Parallel()
	const secret = "JBSWY3DPEHPK3PXP" // #nosec G101 -- public RFC-compatible test fixture.
	manager, err := New(t.TempDir(), Config{
		AdminUsername: "root-admin", AdminPassword: testPassword,
		AdminTOTPSecret: secret, GuestEnabled: false,
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	challenge, err := manager.StartLogin("root-admin", testPassword, "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	if challenge.Next != "totp" || challenge.Enrollment != nil {
		t.Fatalf("challenge = %#v, want configured totp", challenge)
	}
	code, err := totp.GenerateCode(secret, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := manager.CompleteTOTP(t.Context(), challenge.Challenge, code); err != nil {
		t.Fatal(err)
	}
	if _, err := manager.NewGuestSession(); !errors.Is(err, ErrForbidden) {
		t.Fatalf("guest session error = %v, want ErrForbidden", err)
	}
}

func TestLoginRateLimitCannotBeBypassedWithSourcePorts(t *testing.T) {
	t.Parallel()
	manager, err := New(t.TempDir(), Config{
		AdminUsername: "admin", AdminPassword: testPassword,
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	for attempt := range maxLoginAttempts {
		_, err := manager.StartLogin("admin", "incorrect password", fmt.Sprintf("192.0.2.10:%d", 41000+attempt))
		if !errors.Is(err, ErrInvalidCredentials) {
			t.Fatalf("attempt %d error = %v, want invalid credentials", attempt+1, err)
		}
	}
	if _, err := manager.StartLogin("admin", testPassword, "192.0.2.10:52000"); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("post-limit error = %v, want rate limited", err)
	}
}

func TestSecretEncryptionRoundTrip(t *testing.T) {
	t.Parallel()
	key := make([]byte, 32)
	for index := range key {
		key[index] = byte(index + 1)
	}
	sealed, err := sealSecret(key, "JBSWY3DPEHPK3PXP")
	if err != nil {
		t.Fatal(err)
	}
	opened, err := openSecret(key, sealed)
	if err != nil {
		t.Fatal(err)
	}
	if opened != "JBSWY3DPEHPK3PXP" {
		t.Fatalf("opened = %q", opened)
	}
	sealedBytes, err := base64.RawStdEncoding.DecodeString(sealed)
	if err != nil {
		t.Fatal(err)
	}
	sealedBytes[len(sealedBytes)-1] ^= 1
	tampered := base64.RawStdEncoding.EncodeToString(sealedBytes)
	if _, err := openSecret(key, tampered); err == nil {
		t.Fatal("tampered ciphertext was accepted")
	}
}
