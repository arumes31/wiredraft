package auth

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/pquerna/otp/totp"
)

const testPassword = "this is a long test password"

const (
	testDefaultOrganizationID = "org-default"
	testGuestOrganizationID   = "org-guest"
	testViennaOrganizationID  = "org-vienna"
	testBerlinOrganizationID  = "org-berlin"
	testGrazOrganizationID    = "org-graz"
	testLondonOrganizationID  = "org-london"
)

var testOrganizationRefs = []OrganizationRef{
	{ID: testDefaultOrganizationID, Name: "Default"},
	{ID: testGuestOrganizationID, Name: GuestOrganizationName},
	{ID: testViennaOrganizationID, Name: "Vienna"},
	{ID: testBerlinOrganizationID, Name: "Berlin"},
	{ID: testGrazOrganizationID, Name: "Graz"},
	{ID: testLondonOrganizationID, Name: "London"},
}

func scopedAccess(ids ...string) Access {
	return Access{Role: RoleUser, OrganizationIDs: ids}
}

func TestManagerFirstLoginEnrollmentAndRecovery(t *testing.T) {
	t.Parallel()
	manager, err := New(t.TempDir(), Config{
		AdminUsername: "admin", AdminPassword: testPassword, GuestEnabled: true,
	}, testOrganizationRefs)
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
	}, testOrganizationRefs)
	if err != nil {
		t.Fatal(err)
	}
	user, err := manager.CreateUser(
		t.Context(),
		"vienna.operator",
		"another long test password",
		scopedAccess(testViennaOrganizationID, testBerlinOrganizationID, testViennaOrganizationID),
	)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(user.OrganizationIDs, []string{testBerlinOrganizationID, testViennaOrganizationID}) {
		t.Fatalf("organization ids = %#v, want two unique values", user.OrganizationIDs)
	}
	principal := Principal{
		UserID: user.ID, Username: user.Username, Role: RoleUser,
		OrganizationIDs: user.OrganizationIDs,
	}
	if !manager.CanAccessTopology(principal, "map-a", testViennaOrganizationID) {
		t.Fatal("assigned organization was denied")
	}
	if manager.CanAccessTopology(principal, "map-b", testLondonOrganizationID) {
		t.Fatal("unassigned organization was allowed")
	}
	guestSession, err := manager.NewGuestSession()
	if err != nil {
		t.Fatal(err)
	}
	guest := guestSession.Principal
	if !manager.CanAccessTopology(guest, "existing-map", testGuestOrganizationID) {
		t.Fatal("Guest-owned map was denied")
	}
	if !manager.CanAccessTopology(guest, "new-map", testGuestOrganizationID) {
		t.Fatal("new Guest-owned map was denied")
	}
	if manager.CanAccessTopology(guest, "existing-map", testViennaOrganizationID) ||
		manager.CanAccessTopology(guest, "existing-map", "") {
		t.Fatal("Guest access widened outside the stable Guest organization")
	}
}

func TestManagerBootstrapTOTPFromEnvironment(t *testing.T) {
	t.Parallel()
	const secret = "JBSWY3DPEHPK3PXP" // #nosec G101 -- public RFC-compatible test fixture.
	manager, err := New(t.TempDir(), Config{
		AdminUsername: "root-admin", AdminPassword: testPassword,
		AdminTOTPSecret: secret, GuestEnabled: false,
	}, testOrganizationRefs)
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
	disabledGuest := Principal{UserID: RoleGuest, Username: "Guest", Role: RoleGuest}
	if manager.CanAccessTopology(disabledGuest, "map", testGuestOrganizationID) ||
		manager.CanCreateInOrganization(disabledGuest, testGuestOrganizationID) {
		t.Fatal("disabled Guest access was authorized by a synthetic principal")
	}
}

func TestManagerRetiresLegacyGuestIDsOnlyAfterCatalogBindingSucceeds(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	authDir := filepath.Join(dataDir, "auth")
	if err := os.MkdirAll(authDir, 0o700); err != nil {
		t.Fatal(err)
	}
	statePath := filepath.Join(authDir, "accounts.json")
	legacy := []byte(`{
  "version": 3,
  "guestWorkspaceInitialized": true,
  "guestTopologyIds": ["default-demo", "actual-guest-map"],
  "users": []
}`)
	if err := os.WriteFile(statePath, legacy, 0o600); err != nil {
		t.Fatal(err)
	}
	config := Config{AdminUsername: "admin", AdminPassword: testPassword, GuestEnabled: true}
	withoutGuest := slices.DeleteFunc(slices.Clone(testOrganizationRefs), func(ref OrganizationRef) bool {
		return ref.ID == testGuestOrganizationID
	})
	if _, err := New(dataDir, config, withoutGuest); err == nil {
		t.Fatal("startup without the required Guest organization succeeded")
	}
	failedData, err := os.ReadFile(statePath) // #nosec G304 -- statePath is a test-owned temporary fixture.
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Contains(failedData, []byte("guestTopologyIds")) {
		t.Fatal("failed startup retired Guest migration hints")
	}
	manager, err := New(dataDir, config, testOrganizationRefs)
	if err != nil {
		t.Fatal(err)
	}
	if manager.GuestOrganizationID() != testGuestOrganizationID {
		t.Fatalf("Guest organization = %q", manager.GuestOrganizationID())
	}
	migratedData, err := os.ReadFile(statePath) // #nosec G304 -- statePath is a test-owned temporary fixture.
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(migratedData, []byte("guestTopologyIds")) ||
		bytes.Contains(migratedData, []byte("guestWorkspaceInitialized")) {
		t.Fatalf("successful startup retained Guest migration hints: %s", migratedData)
	}
}

func TestLoginRateLimitCannotBeBypassedWithSourcePorts(t *testing.T) {
	t.Parallel()
	manager, err := New(t.TempDir(), Config{
		AdminUsername: "admin", AdminPassword: testPassword,
	}, testOrganizationRefs)
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

func TestLoginRateLimitCannotBeBypassedWithDistinctUsernames(t *testing.T) {
	t.Parallel()
	manager, err := New(t.TempDir(), Config{
		AdminUsername: "admin", AdminPassword: testPassword,
	}, testOrganizationRefs)
	if err != nil {
		t.Fatal(err)
	}
	for attempt := range maxLoginAttempts {
		_, err := manager.StartLogin(
			fmt.Sprintf("spray-target-%d", attempt),
			"incorrect password",
			"192.0.2.10:443",
		)
		if !errors.Is(err, ErrInvalidCredentials) {
			t.Fatalf("attempt %d error = %v, want invalid credentials", attempt+1, err)
		}
	}
	if _, err := manager.StartLogin("admin", testPassword, "192.0.2.10:443"); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("post-spray error = %v, want rate limited", err)
	}
}

func TestLoginRateLimitReservesConcurrentAttempts(t *testing.T) {
	t.Parallel()
	manager, err := New(t.TempDir(), Config{
		AdminUsername: "admin", AdminPassword: testPassword,
	}, testOrganizationRefs)
	if err != nil {
		t.Fatal(err)
	}

	const attempts = maxLoginAttempts + 3
	ready := make(chan struct{}, attempts)
	start := make(chan struct{})
	results := make(chan error, attempts)
	for attempt := range attempts {
		go func() {
			ready <- struct{}{}
			<-start
			_, err := manager.StartLogin(
				fmt.Sprintf("concurrent-target-%d", attempt),
				"incorrect password",
				"192.0.2.20:443",
			)
			results <- err
		}()
	}
	for range attempts {
		<-ready
	}
	close(start)

	invalidCredentials := 0
	rateLimited := 0
	for range attempts {
		switch err := <-results; {
		case errors.Is(err, ErrInvalidCredentials):
			invalidCredentials++
		case errors.Is(err, ErrRateLimited):
			rateLimited++
		default:
			t.Fatalf("concurrent login error = %v", err)
		}
	}
	if invalidCredentials != maxLoginAttempts || rateLimited != attempts-maxLoginAttempts {
		t.Fatalf(
			"concurrent results = %d invalid credentials, %d rate limited; want %d and %d",
			invalidCredentials, rateLimited, maxLoginAttempts, attempts-maxLoginAttempts,
		)
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
	}, testOrganizationRefs)
	if err != nil {
		t.Fatal(err)
	}
	if !manager.GuestEnabled() || !manager.CookieSecure() {
		t.Fatalf("manager flags = guest %v, secure %v", manager.GuestEnabled(), manager.CookieSecure())
	}
	if users := manager.Users(); len(users) != 1 || users[0].Username != "admin" {
		t.Fatalf("bootstrap users = %#v", users)
	}
	user, err := manager.CreateUser(
		t.Context(),
		"  Vienna.User  ",
		"another sufficiently long password",
		scopedAccess(testViennaOrganizationID, testViennaOrganizationID, testBerlinOrganizationID),
	)
	if err != nil {
		t.Fatal(err)
	}
	if user.Username != "Vienna.User" ||
		!slices.Equal(user.OrganizationIDs, []string{testBerlinOrganizationID, testViennaOrganizationID}) {
		t.Fatalf("created user = %#v", user)
	}
	if _, err := manager.CreateUser(
		t.Context(),
		"vienna.user",
		"another sufficiently long password",
		scopedAccess(testViennaOrganizationID),
	); !errors.Is(err, ErrConflict) {
		t.Fatalf("duplicate username error = %v, want ErrConflict", err)
	}
	if !manager.CanCreateInOrganization(Principal{Role: RoleAdmin}, testViennaOrganizationID) ||
		!manager.CanCreateInOrganization(Principal{Role: RoleGuest}, testGuestOrganizationID) ||
		!manager.CanCreateInOrganization(Principal{
			Role: RoleUser, OrganizationIDs: []string{testViennaOrganizationID},
		}, testViennaOrganizationID) ||
		manager.CanCreateInOrganization(Principal{
			Role: RoleUser, OrganizationIDs: []string{testViennaOrganizationID},
		}, testBerlinOrganizationID) {
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
		UserID: user.ID, Username: user.Username, Role: RoleUser,
		OrganizationIDs: user.OrganizationIDs,
	}, manager.now())
	manager.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	updated, err := manager.UpdateUser(t.Context(), user.ID, UserUpdate{
		Access: scopedAccess(testGrazOrganizationID),
	})
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(updated.OrganizationIDs, []string{testGrazOrganizationID}) {
		t.Fatalf("updated organization ids = %#v", updated.OrganizationIDs)
	}
	if _, ok := manager.Session(userSession.Token); ok {
		t.Fatal("grant change did not revoke the active session")
	}
	if _, err := manager.UpdateUser(t.Context(), bootstrapAdminID, UserUpdate{
		Access:   Access{Role: RoleAdmin, AllOrganizations: true},
		Disabled: true,
	}); !errors.Is(err, ErrForbidden) {
		t.Fatalf("bootstrap update error = %v, want ErrForbidden", err)
	}
	if _, err := manager.UpdateUser(t.Context(), "missing", UserUpdate{
		Access: scopedAccess(testGrazOrganizationID),
	}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing update error = %v, want ErrNotFound", err)
	}
	if _, err := manager.UpdateUser(t.Context(), user.ID, UserUpdate{Access: Access{Role: RoleUser}}); err == nil {
		t.Fatal("empty organization update was accepted")
	}
	manager.mu.Lock()
	userSession, err = manager.newSessionLocked(manager.state.Users[slices.IndexFunc(
		manager.state.Users,
		func(candidate persistedUser) bool { return candidate.ID == user.ID },
	)], manager.now())
	manager.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := manager.UpdateUser(t.Context(), user.ID, UserUpdate{
		Access: scopedAccess(testGrazOrganizationID), Disabled: true,
	}); err != nil {
		t.Fatal(err)
	}
	if _, ok := manager.Session(userSession.Token); ok {
		t.Fatal("disabling an account did not revoke its sessions")
	}
}

func TestManagerEntraAccountLinkingAndReset(t *testing.T) {
	manager, err := New(
		t.TempDir(),
		Config{AdminUsername: "admin", AdminPassword: testPassword},
		testOrganizationRefs,
	)
	if err != nil {
		t.Fatal(err)
	}
	user, err := manager.CreateEntraUser(
		t.Context(),
		"Vienna Microsoft",
		"operator@example.com",
		scopedAccess(testViennaOrganizationID),
	)
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
	if session.Principal.UserID != user.ID ||
		!slices.Equal(session.Principal.OrganizationIDs, []string{testViennaOrganizationID}) {
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

func TestManagerRejectsExternalResetForLocalAccountAtomically(t *testing.T) {
	t.Parallel()
	manager, err := New(
		t.TempDir(),
		Config{AdminUsername: "bootstrap", AdminPassword: testPassword},
		testOrganizationRefs,
	)
	if err != nil {
		t.Fatal(err)
	}
	user, err := manager.CreateUser(
		t.Context(), "local.operator", "another sufficiently long password",
		scopedAccess(testViennaOrganizationID),
	)
	if err != nil {
		t.Fatal(err)
	}
	_, err = manager.UpdateUser(t.Context(), user.ID, UserUpdate{
		Access:                Access{Role: RoleAdmin, AllOrganizations: true},
		Disabled:              true,
		ResetExternalIdentity: true,
	})
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("resetting local identity error = %v, want ErrForbidden", err)
	}
	current := manager.Users()[slices.IndexFunc(manager.Users(), func(candidate UserView) bool {
		return candidate.ID == user.ID
	})]
	if current.Role != RoleUser || current.AllOrganizations || current.Disabled ||
		!slices.Equal(current.OrganizationIDs, []string{testViennaOrganizationID}) {
		t.Fatalf("rejected reset changed local account: %#v", current)
	}
}

func TestManagerApplicationRolesAndGlobalAccess(t *testing.T) {
	t.Parallel()
	manager, err := New(
		t.TempDir(),
		Config{AdminUsername: "bootstrap", AdminPassword: testPassword},
		testOrganizationRefs,
	)
	if err != nil {
		t.Fatal(err)
	}
	localAdmin, err := manager.CreateUser(
		t.Context(),
		"local.admin",
		"another sufficiently long password",
		Access{Role: RoleAdmin},
	)
	if err != nil {
		t.Fatal(err)
	}
	if !localAdmin.AllOrganizations || len(localAdmin.OrganizationIDs) != 0 || localAdmin.Protected {
		t.Fatalf("local administrator = %#v", localAdmin)
	}
	globalUser, err := manager.CreateUser(
		t.Context(),
		"global.user",
		"another sufficiently long password",
		Access{Role: RoleUser, AllOrganizations: true},
	)
	if err != nil {
		t.Fatal(err)
	}
	globalPrincipal := Principal{
		UserID: globalUser.ID, Username: globalUser.Username, Role: RoleUser,
		AllOrganizations: true,
	}
	if !manager.CanAccessTopology(globalPrincipal, "map", testLondonOrganizationID) ||
		!manager.CanCreateInOrganization(globalPrincipal, testBerlinOrganizationID) {
		t.Fatal("global user was denied a registered organization")
	}
	if manager.CanAccessTopology(globalPrincipal, "map", "unknown") {
		t.Fatal("global user was allowed an unregistered organization")
	}

	entraAdmin, err := manager.CreateEntraUser(
		t.Context(),
		"entra.admin",
		"entra.admin@example.com",
		Access{Role: RoleAdmin, AllOrganizations: true},
	)
	if err != nil {
		t.Fatal(err)
	}
	if entraAdmin.Role != RoleAdmin || !entraAdmin.AllOrganizations || entraAdmin.TOTPConfigured {
		t.Fatalf("Entra administrator = %#v", entraAdmin)
	}
	manager.mu.Lock()
	persisted := manager.state.Users[slices.IndexFunc(manager.state.Users, func(user persistedUser) bool {
		return user.ID == entraAdmin.ID
	})]
	manager.mu.Unlock()
	if persisted.PasswordHash != "" || persisted.EncryptedTOTPSecret != "" ||
		len(persisted.RecoveryCodeHashes) != 0 {
		t.Fatalf("Entra administrator contains local secrets: %#v", persisted)
	}
	session, err := manager.CompleteEntraLogin(t.Context(), ExternalIdentity{
		TenantID: "tenant-admin", ObjectID: "object-admin",
		PreferredUsername: "entra.admin@example.com",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !session.Principal.IsAdmin() || !session.Principal.AllOrganizations ||
		!manager.CanAccessTopology(session.Principal, "map", testGrazOrganizationID) {
		t.Fatalf("Entra administrator session = %#v", session)
	}
	updated, err := manager.UpdateUser(t.Context(), entraAdmin.ID, UserUpdate{
		Access: scopedAccess(testViennaOrganizationID),
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Role != RoleUser || updated.AllOrganizations {
		t.Fatalf("demoted account = %#v", updated)
	}
	if _, exists := manager.Session(session.Token); exists {
		t.Fatal("role change did not revoke the Entra session")
	}

	users := manager.Users()
	bootstrapIndex := slices.IndexFunc(users, func(user UserView) bool { return user.ID == bootstrapAdminID })
	if bootstrapIndex < 0 || !users[bootstrapIndex].Protected || !users[bootstrapIndex].AllOrganizations {
		t.Fatalf("bootstrap account = %#v", users)
	}
}

func TestManagerOrganizationCatalogLifecycle(t *testing.T) {
	t.Parallel()
	manager, err := New(
		t.TempDir(),
		Config{AdminUsername: "admin", AdminPassword: testPassword},
		testOrganizationRefs,
	)
	if err != nil {
		t.Fatal(err)
	}
	const newOrganizationID = "org-new"
	if err := manager.RegisterOrganization(OrganizationRef{ID: newOrganizationID, Name: "New Organization"}); err != nil {
		t.Fatal(err)
	}
	user, err := manager.CreateUser(
		t.Context(),
		"new.organization.user",
		"another sufficiently long password",
		scopedAccess(newOrganizationID),
	)
	if err != nil {
		t.Fatal(err)
	}
	manager.mu.Lock()
	session, err := manager.newSessionLocked(manager.state.Users[slices.IndexFunc(
		manager.state.Users,
		func(candidate persistedUser) bool { return candidate.ID == user.ID },
	)], manager.now())
	manager.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	if err := manager.RegisterOrganization(OrganizationRef{ID: newOrganizationID, Name: "Renamed Organization"}); err != nil {
		t.Fatal(err)
	}
	if !manager.CanAccessTopology(session.Principal, "map", newOrganizationID) {
		t.Fatal("rename invalidated a stable organization grant")
	}
	if err := manager.RemoveOrganizationAssignments(t.Context(), newOrganizationID); err != nil {
		t.Fatal(err)
	}
	if _, exists := manager.Session(session.Token); exists {
		t.Fatal("organization cleanup did not revoke an affected session")
	}
	users := manager.Users()
	index := slices.IndexFunc(users, func(candidate UserView) bool { return candidate.ID == user.ID })
	if index < 0 || len(users[index].OrganizationIDs) != 0 || users[index].AllOrganizations {
		t.Fatalf("cleaned account = %#v", users)
	}
	if manager.CanCreateInOrganization(Principal{Role: RoleAdmin}, newOrganizationID) {
		t.Fatal("deleted organization remains registered")
	}
	if _, err := manager.UpdateUser(t.Context(), user.ID, UserUpdate{
		Access: Access{Role: RoleUser},
	}); err == nil {
		t.Fatal("public update accepted an empty scoped grant")
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
	if got := normalizeIDs([]string{" b ", "a", "b", ""}); !slices.Equal(got, []string{"a", "b"}) {
		t.Fatalf("normalizeIDs() = %#v", got)
	}
	catalog, err := newOrganizationCatalog(testOrganizationRefs)
	if err != nil {
		t.Fatal(err)
	}
	accessManager := &Manager{organizations: catalog}
	if _, err := accessManager.normalizeAccessLocked(Access{Role: RoleUser}, false); err == nil {
		t.Fatal("empty scoped access was accepted")
	}
	if _, err := accessManager.normalizeAccessLocked(Access{
		Role: RoleUser, AllOrganizations: true, OrganizationIDs: []string{testViennaOrganizationID},
	}, false); err == nil {
		t.Fatal("contradictory global and scoped access was accepted")
	}
	if _, err := accessManager.normalizeAccessLocked(scopedAccess("unknown"), false); err == nil {
		t.Fatal("unknown organization id was accepted")
	}
	manyRefs := make([]OrganizationRef, 65)
	manyIDs := make([]string, 65)
	for index := range manyRefs {
		manyIDs[index] = fmt.Sprintf("organization-%02d", index)
		manyRefs[index] = OrganizationRef{ID: manyIDs[index], Name: fmt.Sprintf("Organization %02d", index)}
	}
	manyCatalog, err := newOrganizationCatalog(manyRefs)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := (&Manager{organizations: manyCatalog}).normalizeAccessLocked(scopedAccess(manyIDs...), false); err == nil {
		t.Fatal("too many organization assignments were accepted")
	}

	passwordHash, err := hashPassword(testPassword)
	if err != nil {
		t.Fatal(err)
	}
	validUser := persistedUser{
		ID: "user", Username: "User", UsernameKey: "user", Role: RoleUser,
		PasswordHash: passwordHash, AuthSource: AuthSourceLocal,
		OrganizationIDs: []string{testViennaOrganizationID},
	}
	validEntraUser := persistedUser{
		ID: "entra-user", Username: "Entra User", UsernameKey: "entra user", Role: RoleUser,
		AuthSource: AuthSourceEntra, ExternalLogin: "entra@example.com",
		OrganizationIDs: []string{testViennaOrganizationID},
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
		{name: "invalid password hash", state: persistentState{Users: []persistedUser{{ID: "other", Username: "Other", UsernameKey: "other", Role: RoleUser, PasswordHash: "invalid", AuthSource: AuthSourceLocal}}}},
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
			test.state.Version = authStateVersion
			if err := validatePersistentState(test.state, make([]byte, 32), catalog); err == nil {
				t.Fatal("validatePersistentState() succeeded")
			}
		})
	}

	manager := newManager(
		persistentState{Version: authStateVersion, Users: []persistedUser{validUser}},
		make([]byte, 32),
		Config{},
		catalog,
		func(context.Context, persistentState) error { return nil },
	)
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
