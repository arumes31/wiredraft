package auth

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/pquerna/otp/totp"
)

const limitsTestSecret = "JBSWY3DPEHPK3PXP" // #nosec G101 -- public RFC-compatible test fixture.

func newLimitsTestManager(t *testing.T) (*Manager, *time.Time) {
	t.Helper()
	manager, err := New(t.TempDir(), Config{
		AdminUsername: "admin", AdminPassword: testPassword,
		AdminTOTPSecret: limitsTestSecret, GuestEnabled: true,
	}, testOrganizationRefs)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 4, 12, 0, 15, 0, time.UTC)
	manager.now = func() time.Time { return now }
	return manager, &now
}

func limitsTestCodes(t *testing.T, now time.Time) (string, string) {
	t.Helper()
	valid, err := totp.GenerateCode(limitsTestSecret, now)
	if err != nil {
		t.Fatal(err)
	}
	invalid := valid[:5] + string('0'+(valid[5]-'0'+5)%10)
	for _, offset := range []time.Duration{-time.Duration(totpPeriod) * time.Second, time.Duration(totpPeriod) * time.Second} {
		neighbor, err := totp.GenerateCode(limitsTestSecret, now.Add(offset))
		if err != nil {
			t.Fatal(err)
		}
		if neighbor == invalid {
			invalid = valid[:5] + string('0'+(valid[5]-'0'+3)%10)
		}
	}
	return valid, invalid
}

func TestSecondFactorFailuresLockAccountAcrossChallenges(t *testing.T) {
	t.Parallel()
	manager, now := newLimitsTestManager(t)
	failChallenges := func(count int) {
		t.Helper()
		for attempt := range count {
			challenge, err := manager.StartLogin("admin", testPassword, "192.0.2.30:443")
			if err != nil {
				t.Fatal(err)
			}
			_, invalid := limitsTestCodes(t, *now)
			if _, err := manager.CompleteTOTP(t.Context(), challenge.Challenge, invalid); !errors.Is(err, ErrInvalidCode) {
				t.Fatalf("failure %d error = %v, want invalid code", attempt+1, err)
			}
		}
	}
	login := func() error {
		t.Helper()
		challenge, err := manager.StartLogin("admin", testPassword, "192.0.2.30:443")
		if err != nil {
			t.Fatal(err)
		}
		valid, _ := limitsTestCodes(t, *now)
		_, err = manager.CompleteTOTP(t.Context(), challenge.Challenge, valid)
		return err
	}

	// A correct password issues fresh challenges, but the account-level
	// counter still locks the second factor after maxChallengeTries failures.
	failChallenges(maxChallengeTries)
	if err := login(); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("locked second factor error = %v, want rate limited", err)
	}
	*now = now.Add(secondFactorLockout)
	failChallenges(maxChallengeTries)
	*now = now.Add(secondFactorLockout)
	if err := login(); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("second lockout did not back off exponentially: %v", err)
	}
	*now = now.Add(secondFactorLockout)
	if err := login(); err != nil {
		t.Fatalf("login after lockout expiry error = %v", err)
	}
	if _, exists := manager.secondFactor[bootstrapAdminID]; exists {
		t.Fatal("successful verification did not clear the failure record")
	}
}

func TestSecondFactorRecoveryCodesShareAccountLimit(t *testing.T) {
	t.Parallel()
	manager, now := newLimitsTestManager(t)
	for attempt := range maxChallengeTries {
		challenge, err := manager.StartLogin("admin", testPassword, "192.0.2.31:443")
		if err != nil {
			t.Fatal(err)
		}
		if _, err := manager.CompleteRecovery(t.Context(), challenge.Challenge, "invalid-recovery-code"); !errors.Is(err, ErrInvalidCode) {
			t.Fatalf("recovery failure %d error = %v", attempt+1, err)
		}
	}
	challenge, err := manager.StartLogin("admin", testPassword, "192.0.2.31:443")
	if err != nil {
		t.Fatal(err)
	}
	valid, _ := limitsTestCodes(t, *now)
	if _, err := manager.CompleteTOTP(t.Context(), challenge.Challenge, valid); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("TOTP after recovery failures error = %v, want rate limited", err)
	}
}

func TestSecondFactorReservesConcurrentAttempts(t *testing.T) {
	t.Parallel()
	manager, now := newLimitsTestManager(t)
	challenge, err := manager.StartLogin("admin", testPassword, "192.0.2.32:443")
	if err != nil {
		t.Fatal(err)
	}
	_, invalid := limitsTestCodes(t, *now)

	const attempts = maxChallengeTries * 4
	start := make(chan struct{})
	results := make(chan error, attempts)
	for range attempts {
		go func() {
			<-start
			_, err := manager.CompleteTOTP(context.Background(), challenge.Challenge, invalid)
			results <- err
		}()
	}
	close(start)
	invalidCodes := 0
	for range attempts {
		switch err := <-results; {
		case errors.Is(err, ErrInvalidCode):
			invalidCodes++
		case errors.Is(err, ErrInvalidChallenge), errors.Is(err, ErrRateLimited):
		default:
			t.Fatalf("concurrent verification error = %v", err)
		}
	}
	if invalidCodes != maxChallengeTries {
		t.Fatalf("checked %d codes concurrently, want at most %d", invalidCodes, maxChallengeTries)
	}
}

func TestGuestSessionsAreBounded(t *testing.T) {
	t.Parallel()
	manager, now := newLimitsTestManager(t)
	for attempt := range defaultMaxGuestSessionsPerHost {
		if _, err := manager.NewGuestSession(fmt.Sprintf("192.0.2.40:%d", 40000+attempt)); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := manager.NewGuestSession("192.0.2.40:50000"); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("per-client guest limit error = %v, want rate limited", err)
	}
	if _, err := manager.NewGuestSession("192.0.2.41:40000"); err != nil {
		t.Fatalf("other client guest session error = %v", err)
	}
	*now = now.Add(loginAttemptWindow)
	if _, err := manager.NewGuestSession("192.0.2.40:50001"); err != nil {
		t.Fatalf("guest session after window error = %v", err)
	}

	manager.mu.Lock()
	for index := range defaultMaxGuestSessions {
		token := fmt.Sprintf("guest-%d", index)
		manager.storeSessionLocked(token, Session{
			Token: token, Principal: Principal{UserID: RoleGuest, Role: RoleGuest}, ExpiresAt: now.Add(time.Hour),
		})
	}
	manager.mu.Unlock()
	if _, err := manager.NewGuestSession("192.0.2.42:40000"); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("global guest limit error = %v, want rate limited", err)
	}
	if attempt := manager.loginAttempts["guest|192.0.2.42"]; attempt.Failures != 1 {
		t.Fatalf("rejected guest attempt failures = %d, want charged to the client budget", attempt.Failures)
	}
}

func TestGuestSessionCountTracksLifecycleAndExpiry(t *testing.T) {
	t.Parallel()
	manager, now := newLimitsTestManager(t)
	first, err := manager.NewGuestSession("192.0.2.60:40000")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := manager.NewGuestSession("192.0.2.61:40000"); err != nil {
		t.Fatal(err)
	}
	manager.Logout(first.Token)
	manager.Logout(first.Token)
	manager.mu.Lock()
	if manager.guestSessions != 1 {
		manager.mu.Unlock()
		t.Fatalf("guest session count after logout = %d, want 1", manager.guestSessions)
	}
	// Fill the cap with sessions that expire before the next scheduled sweep.
	for index := manager.guestSessions; index < manager.maxGuestSessions; index++ {
		token := fmt.Sprintf("expiring-%d", index)
		manager.storeSessionLocked(token, Session{
			Token: token, Principal: Principal{UserID: RoleGuest, Role: RoleGuest}, ExpiresAt: now.Add(time.Second),
		})
	}
	manager.lastPrune = *now
	manager.mu.Unlock()
	*now = now.Add(2 * time.Second)
	if _, err := manager.NewGuestSession("192.0.2.62:40000"); err != nil {
		t.Fatalf("guest session after expired sessions free the cap: %v", err)
	}
}

func TestSessionLookupRejectsExpiredSessionsBetweenSweeps(t *testing.T) {
	t.Parallel()
	manager, now := newLimitsTestManager(t)
	session, err := manager.NewGuestSession("192.0.2.50:40000")
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := manager.Session(session.Token); !ok {
		t.Fatal("fresh session does not resolve")
	}
	manager.mu.Lock()
	manager.lastPrune = session.ExpiresAt
	manager.mu.Unlock()
	*now = session.ExpiresAt
	if _, ok := manager.Session(session.Token); ok {
		t.Fatal("expired session resolves before the next sweep")
	}
}

func TestGuestSessionLimitsAreConfigurable(t *testing.T) {
	t.Parallel()
	manager, err := New(t.TempDir(), Config{
		AdminUsername: "admin", AdminPassword: testPassword, GuestEnabled: true,
		MaxGuestSessions: 3, MaxGuestSessionsPerClient: 2,
	}, testOrganizationRefs)
	if err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if _, err := manager.NewGuestSession("192.0.2.60:1"); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := manager.NewGuestSession("192.0.2.60:2"); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("configured per-client limit error = %v", err)
	}
	if _, err := manager.NewGuestSession("192.0.2.61:1"); err != nil {
		t.Fatal(err)
	}
	if _, err := manager.NewGuestSession("192.0.2.62:1"); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("configured total limit error = %v", err)
	}
}
