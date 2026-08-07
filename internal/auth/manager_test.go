package auth

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"slices"
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
	if err := manager.RemoveGuestTopology(t.Context(), "new-map"); err != nil {
		t.Fatal(err)
	}
	if manager.CanAccessTopology(guest, "new-map", "Guest") {
		t.Fatal("removed guest map remains accessible")
	}
	if err := manager.RemoveGuestTopology(t.Context(), "missing-map"); err != nil {
		t.Fatalf("removing an absent guest map: %v", err)
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

func TestManagerAccountAndSessionLifecycle(t *testing.T) {
	t.Parallel()
	manager, err := New(t.TempDir(), Config{
		AdminUsername: "admin", AdminPassword: testPassword, GuestEnabled: true, CookieSecure: true,
	}, []string{"legacy", "legacy", " "})
	if err != nil {
		t.Fatal(err)
	}
	if !manager.GuestEnabled() || !manager.CookieSecure() {
		t.Fatalf("manager flags = guest %v, secure %v", manager.GuestEnabled(), manager.CookieSecure())
	}
	if users := manager.Users(); len(users) != 1 || users[0].Username != "admin" {
		t.Fatalf("bootstrap users = %#v", users)
	}
	user, err := manager.CreateUser(t.Context(), "  Vienna.User  ", "another sufficiently long password", []string{"Vienna", "vienna", " Berlin "})
	if err != nil {
		t.Fatal(err)
	}
	if user.Username != "Vienna.User" || !slices.Equal(user.Organizations, []string{"Berlin", "Vienna"}) {
		t.Fatalf("created user = %#v", user)
	}
	if _, err := manager.CreateUser(t.Context(), "vienna.user", "another sufficiently long password", []string{"Vienna"}); !errors.Is(err, ErrConflict) {
		t.Fatalf("duplicate username error = %v, want ErrConflict", err)
	}
	if !manager.CanCreateInOrganization(Principal{Role: RoleAdmin}, "Anywhere") ||
		!manager.CanCreateInOrganization(Principal{Role: RoleGuest}, "Guest") ||
		!manager.CanCreateInOrganization(Principal{Role: RoleUser, Organizations: []string{"Vienna"}}, " vienna ") ||
		manager.CanCreateInOrganization(Principal{Role: RoleUser, Organizations: []string{"Vienna"}}, "Berlin") {
		t.Fatal("organization creation authorization is inconsistent")
	}

	guest, err := manager.NewGuestSession()
	if err != nil {
		t.Fatal(err)
	}
	if resolved, ok := manager.Session(guest.Token); !ok || !resolved.Principal.IsGuest() {
		t.Fatalf("guest session = %#v, exists = %v", resolved, ok)
	}
	manager.Logout(guest.Token)
	if _, ok := manager.Session(guest.Token); ok {
		t.Fatal("logged-out session still resolves")
	}

	manager.mu.Lock()
	userSession, err := manager.newPrincipalSessionLocked(Principal{
		UserID: user.ID, Username: user.Username, Role: RoleUser, Organizations: user.Organizations,
	}, manager.now())
	manager.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	updated, err := manager.UpdateUser(t.Context(), user.ID, []string{"Graz"}, false)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(updated.Organizations, []string{"Graz"}) {
		t.Fatalf("updated organizations = %#v", updated.Organizations)
	}
	if session, ok := manager.Session(userSession.Token); !ok || !slices.Equal(session.Principal.Organizations, []string{"Graz"}) {
		t.Fatalf("live session organizations = %#v, exists = %v", session.Principal.Organizations, ok)
	}
	if _, err := manager.UpdateUser(t.Context(), bootstrapAdminID, []string{"Admin"}, true); !errors.Is(err, ErrForbidden) {
		t.Fatalf("bootstrap update error = %v, want ErrForbidden", err)
	}
	if _, err := manager.UpdateUser(t.Context(), "missing", []string{"Admin"}, true); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing update error = %v, want ErrNotFound", err)
	}
	if _, err := manager.UpdateUser(t.Context(), user.ID, nil, false); err == nil {
		t.Fatal("empty organization update was accepted")
	}
	if _, err := manager.UpdateUser(t.Context(), user.ID, []string{"Graz"}, true); err != nil {
		t.Fatal(err)
	}
	if _, ok := manager.Session(userSession.Token); ok {
		t.Fatal("disabling an account did not revoke its sessions")
	}
	if err := manager.AddGuestTopology(t.Context(), " "); err == nil {
		t.Fatal("empty guest topology id was accepted")
	}
	if err := manager.AddGuestTopology(t.Context(), "legacy"); err != nil {
		t.Fatal(err)
	}
}

func TestManagerEntraAccountLinkingAndReset(t *testing.T) {
	manager, err := New(t.TempDir(), Config{AdminUsername: "admin", AdminPassword: testPassword}, nil)
	if err != nil {
		t.Fatal(err)
	}
	user, err := manager.CreateEntraUser(t.Context(), "Vienna Microsoft", "operator@example.com", []string{"Vienna"})
	if err != nil {
		t.Fatal(err)
	}
	if user.AuthSource != AuthSourceEntra || user.ExternalLinked || user.TOTPConfigured {
		t.Fatalf("new Entra user = %#v", user)
	}
	if _, err := manager.StartLogin(user.Username, testPassword, "127.0.0.1"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("local login for Entra account error = %v", err)
	}
	session, err := manager.CompleteEntraLogin(t.Context(), ExternalIdentity{
		TenantID: "tenant-a", ObjectID: "object-a", PreferredUsername: "OPERATOR@example.com",
	})
	if err != nil {
		t.Fatal(err)
	}
	if session.Principal.UserID != user.ID || !slices.Equal(session.Principal.Organizations, []string{"Vienna"}) {
		t.Fatalf("Entra session = %#v", session)
	}
	linked := manager.Users()[slices.IndexFunc(manager.Users(), func(candidate UserView) bool { return candidate.ID == user.ID })]
	if !linked.ExternalLinked {
		t.Fatal("Entra identity was not bound")
	}
	if _, err := manager.CompleteEntraLogin(t.Context(), ExternalIdentity{
		TenantID: "tenant-a", ObjectID: "different-object", PreferredUsername: "operator@example.com",
	}); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("identity substitution error = %v", err)
	}
	reset, err := manager.ResetEntraBinding(t.Context(), user.ID)
	if err != nil || reset.ExternalLinked {
		t.Fatalf("reset user = %#v, error = %v", reset, err)
	}
	if _, ok := manager.Session(session.Token); ok {
		t.Fatal("reset identity retained an active session")
	}
}

func TestManagerValidationAndExpiryEdges(t *testing.T) {
	t.Parallel()
	if remoteHost("EXAMPLE.COM:443") != "example.com" || remoteHost(" HostOnly ") != "hostonly" {
		t.Fatal("remote host normalization failed")
	}
	for _, username := range []string{"ab", strings.Repeat("a", 81), "bad\x00name"} {
		if err := validateUsername(username); err == nil {
			t.Fatalf("validateUsername(%q) succeeded", username)
		}
	}
	if err := validateUsername("valid.user"); err != nil {
		t.Fatal(err)
	}
	if _, err := normalizeOrganizations(nil); err == nil {
		t.Fatal("empty organizations were accepted")
	}
	if _, err := normalizeOrganizations([]string{strings.Repeat("x", 121)}); err == nil {
		t.Fatal("oversized organization was accepted")
	}
	many := make([]string, 65)
	for index := range many {
		many[index] = fmt.Sprintf("org-%02d", index)
	}
	if _, err := normalizeOrganizations(many); err == nil {
		t.Fatal("too many organizations were accepted")
	}
	if got := normalizeIDs([]string{" b ", "a", "b", ""}); !slices.Equal(got, []string{"a", "b"}) {
		t.Fatalf("normalizeIDs() = %#v", got)
	}

	passwordHash, err := hashPassword(testPassword)
	if err != nil {
		t.Fatal(err)
	}
	validUser := persistedUser{ID: "user", Username: "User", UsernameKey: "user", Role: RoleUser, PasswordHash: passwordHash, AuthSource: AuthSourceLocal}
	validEntraUser := persistedUser{
		ID: "entra-user", Username: "Entra User", UsernameKey: "entra user", Role: RoleUser,
		AuthSource: AuthSourceEntra, ExternalLogin: "entra@example.com",
	}
	now := time.Date(2026, 8, 4, 12, 0, 0, 0, time.UTC)
	tests := []struct {
		name  string
		state persistentState
	}{
		{name: "invalid identity", state: persistentState{Users: []persistedUser{{ID: "", Username: "User", UsernameKey: "user", Role: RoleUser, PasswordHash: passwordHash}}}},
		{name: "duplicate id", state: persistentState{Users: []persistedUser{validUser, {ID: "user", Username: "Other", UsernameKey: "other", Role: RoleUser, PasswordHash: passwordHash}}}},
		{name: "duplicate username", state: persistentState{Users: []persistedUser{validUser, {ID: "other", Username: "USER", UsernameKey: "user", Role: RoleUser, PasswordHash: passwordHash}}}},
		{name: "invalid role", state: persistentState{Users: []persistedUser{{ID: "other", Username: "Other", UsernameKey: "other", Role: RoleGuest, PasswordHash: passwordHash}}}},
		{name: "invalid password hash", state: persistentState{Users: []persistedUser{{ID: "other", Username: "Other", UsernameKey: "other", Role: RoleUser, PasswordHash: "invalid"}}}},
		{name: "invalid auth source", state: persistentState{Users: []persistedUser{{ID: "other", Username: "Other", UsernameKey: "other", Role: RoleUser, AuthSource: "unknown"}}}},
		{name: "local external identity", state: persistentState{Users: []persistedUser{{ID: "other", Username: "Other", UsernameKey: "other", Role: RoleUser, PasswordHash: passwordHash, AuthSource: AuthSourceLocal, ExternalLogin: "other@example.com"}}}},
		{name: "Entra local secret", state: persistentState{Users: []persistedUser{{ID: "other", Username: "Other", UsernameKey: "other", Role: RoleUser, PasswordHash: passwordHash, AuthSource: AuthSourceEntra, ExternalLogin: "other@example.com"}}}},
		{name: "duplicate external login", state: persistentState{Users: []persistedUser{
			validEntraUser,
			{ID: "entra-other", Username: "Entra Other", UsernameKey: "entra other", Role: RoleUser, AuthSource: AuthSourceEntra, ExternalLogin: "ENTRA@example.com"},
		}}},
		{name: "incomplete external identity", state: persistentState{Users: []persistedUser{{ID: "other", Username: "Other", UsernameKey: "other", Role: RoleUser, AuthSource: AuthSourceEntra, ExternalLogin: "other@example.com", ExternalTenantID: "tenant"}}}},
		{name: "inconsistent link timestamp", state: persistentState{Users: []persistedUser{{ID: "other", Username: "Other", UsernameKey: "other", Role: RoleUser, AuthSource: AuthSourceEntra, ExternalLogin: "other@example.com", ExternalTenantID: "tenant", ExternalObjectID: "object"}}}},
		{name: "duplicate external identity", state: persistentState{Users: []persistedUser{
			{ID: "entra-one", Username: "Entra One", UsernameKey: "entra one", Role: RoleUser, AuthSource: AuthSourceEntra, ExternalLogin: "one@example.com", ExternalTenantID: "tenant", ExternalObjectID: "object", ExternalLinkedAt: now},
			{ID: "entra-two", Username: "Entra Two", UsernameKey: "entra two", Role: RoleUser, AuthSource: AuthSourceEntra, ExternalLogin: "two@example.com", ExternalTenantID: "TENANT", ExternalObjectID: "OBJECT", ExternalLinkedAt: now},
		}}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if err := validatePersistentState(test.state, make([]byte, 32)); err == nil {
				t.Fatal("validatePersistentState() succeeded")
			}
		})
	}

	manager := newManager(persistentState{Users: []persistedUser{validUser}}, make([]byte, 32), Config{}, func(context.Context, persistentState) error { return nil })
	manager.now = func() time.Time { return now }
	manager.sessions["expired"] = Session{Token: "expired", ExpiresAt: now}
	manager.challenges["expired"] = pendingChallenge{Token: "expired", UserID: validUser.ID, ExpiresAt: now}
	manager.loginAttempts["expired"] = loginAttempt{StartedAt: now.Add(-loginAttemptWindow)}
	if _, ok := manager.Session("expired"); ok {
		t.Fatal("expired session resolves")
	}
	if len(manager.challenges) != 0 || len(manager.loginAttempts) != 0 {
		t.Fatalf("expired transient state was not pruned: challenges=%d attempts=%d", len(manager.challenges), len(manager.loginAttempts))
	}
	manager.challenges["limited"] = pendingChallenge{Token: "limited", UserID: validUser.ID, ExpiresAt: now.Add(time.Minute)}
	for range maxChallengeTries {
		manager.failChallenge("limited")
	}
	if _, exists := manager.challenges["limited"]; exists {
		t.Fatal("exhausted challenge was not removed")
	}
	manager.failChallenge("missing")
}
