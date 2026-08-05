package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"
)

const (
	sessionLifetime    = 8 * time.Hour
	challengeLifetime  = 5 * time.Minute
	loginAttemptWindow = 5 * time.Minute
	maxLoginAttempts   = 5
	maxChallengeTries  = 5
	bootstrapAdminID   = "bootstrap-admin"
)

type loginAttempt struct {
	StartedAt time.Time
	Failures  int
}

type pendingChallenge struct {
	Token        string
	UserID       string
	SetupSecret  string
	Enrollment   *Enrollment
	ExpiresAt    time.Time
	FailedChecks int
}

// Manager owns persistent accounts and ephemeral authentication state.
type Manager struct {
	mu                sync.Mutex
	state             persistentState
	saveState         func(context.Context, persistentState) error
	encryptionKey     []byte
	guestEnabled      bool
	cookieSecure      bool
	dummyPasswordHash string
	sessions          map[string]Session
	challenges        map[string]pendingChallenge
	loginAttempts     map[string]loginAttempt
	now               func() time.Time
}

// New opens the auth database, captures legacy maps for the Guest workspace,
// and synchronizes the environment-controlled bootstrap administrator.
func New(dataDir string, config Config, existingTopologyIDs []string) (*Manager, error) {
	config.AdminUsername = strings.TrimSpace(config.AdminUsername)
	if config.AdminUsername == "" {
		return nil, errors.New("auth: bootstrap administrator username is required")
	}
	if err := validatePassword(config.AdminPassword); err != nil {
		return nil, fmt.Errorf("bootstrap administrator password: %w", err)
	}
	authDirectory := filepath.Join(dataDir, "auth")
	if err := os.MkdirAll(authDirectory, 0o700); err != nil {
		return nil, fmt.Errorf("creating authentication directory: %w", err)
	}
	// Directories require their owner execute bit for traversal; 0700 is the
	// directory equivalent of a private 0600 data file.
	if err := os.Chmod(authDirectory, 0o700); err != nil { // #nosec G302 -- private directory, not a regular file.
		return nil, fmt.Errorf("setting authentication directory permissions: %w", err)
	}
	encryptionKey, err := loadOrCreateEncryptionKey(authDirectory)
	if err != nil {
		return nil, err
	}
	statePath := filepath.Join(authDirectory, "accounts.json")
	state, _, err := loadPersistentState(statePath)
	if err != nil {
		return nil, err
	}
	if err := validatePersistentState(state, encryptionKey); err != nil {
		return nil, err
	}
	manager := newManager(state, encryptionKey, config, func(_ context.Context, next persistentState) error {
		return savePersistentState(statePath, next)
	})
	if err := manager.preparePasswordComparison(); err != nil {
		return nil, err
	}
	if err := manager.bootstrap(context.Background(), config, existingTopologyIDs); err != nil {
		return nil, err
	}
	return manager, nil
}

func newManager(
	state persistentState,
	encryptionKey []byte,
	config Config,
	saveState func(context.Context, persistentState) error,
) *Manager {
	return &Manager{
		state:         state,
		saveState:     saveState,
		encryptionKey: encryptionKey,
		guestEnabled:  config.GuestEnabled,
		cookieSecure:  config.CookieSecure,
		sessions:      make(map[string]Session),
		challenges:    make(map[string]pendingChallenge),
		loginAttempts: make(map[string]loginAttempt),
		now:           func() time.Time { return time.Now().UTC() },
	}
}

func (m *Manager) preparePasswordComparison() error {
	dummyPassword, err := randomToken(24)
	if err != nil {
		return err
	}
	dummyHash, err := hashPassword(dummyPassword)
	if err != nil {
		return fmt.Errorf("preparing password comparison: %w", err)
	}
	m.dummyPasswordHash = dummyHash
	return nil
}

func (m *Manager) bootstrap(ctx context.Context, config Config, existingTopologyIDs []string) error {
	if err := validateUsername(config.AdminUsername); err != nil {
		return fmt.Errorf("bootstrap administrator username: %w", err)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	next := clonePersistentState(m.state)
	changed := false
	if !next.GuestWorkspaceInitialized {
		next.GuestTopologyIDs = normalizeIDs(existingTopologyIDs)
		next.GuestWorkspaceInitialized = true
		changed = true
	}
	usernameKey := normalizeUsername(config.AdminUsername)
	for _, user := range next.Users {
		if user.UsernameKey == usernameKey && user.ID != bootstrapAdminID {
			return errors.New("auth: bootstrap administrator username conflicts with another account")
		}
	}
	adminIndex := slices.IndexFunc(next.Users, func(user persistedUser) bool {
		return user.ID == bootstrapAdminID || user.IsBootstrapAdministrator
	})
	now := m.now()
	if adminIndex < 0 {
		passwordHash, err := hashPassword(config.AdminPassword)
		if err != nil {
			return fmt.Errorf("hashing bootstrap administrator password: %w", err)
		}
		admin := persistedUser{
			ID: bootstrapAdminID, Username: config.AdminUsername, UsernameKey: usernameKey,
			Role: RoleAdmin, PasswordHash: passwordHash, IsBootstrapAdministrator: true,
			CreatedAt: now, UpdatedAt: now,
		}
		next.Users = append(next.Users, admin)
		adminIndex = len(next.Users) - 1
		changed = true
	} else {
		admin := &next.Users[adminIndex]
		matches, err := comparePassword(admin.PasswordHash, config.AdminPassword)
		if err != nil {
			return fmt.Errorf("validating bootstrap administrator password: %w", err)
		}
		if !matches {
			admin.PasswordHash, err = hashPassword(config.AdminPassword)
			if err != nil {
				return fmt.Errorf("hashing bootstrap administrator password: %w", err)
			}
			changed = true
		}
		if admin.Username != config.AdminUsername || admin.UsernameKey != usernameKey || admin.Role != RoleAdmin || admin.Disabled {
			admin.Username = config.AdminUsername
			admin.UsernameKey = usernameKey
			admin.Role = RoleAdmin
			admin.Disabled = false
			changed = true
		}
		admin.IsBootstrapAdministrator = true
		if changed {
			admin.UpdatedAt = now
		}
	}
	if strings.TrimSpace(config.AdminTOTPSecret) != "" {
		secret, err := validateTOTPSecret(config.AdminTOTPSecret)
		if err != nil {
			return fmt.Errorf("bootstrap administrator totp secret: %w", err)
		}
		admin := &next.Users[adminIndex]
		current := ""
		if admin.EncryptedTOTPSecret != "" {
			current, err = openSecret(m.encryptionKey, admin.EncryptedTOTPSecret)
			if err != nil {
				return fmt.Errorf("opening bootstrap administrator totp secret: %w", err)
			}
		}
		if current != secret {
			admin.EncryptedTOTPSecret, err = sealSecret(m.encryptionKey, secret)
			if err != nil {
				return err
			}
			admin.RecoveryCodeHashes = nil
			admin.LastTOTPStep = 0
			admin.UpdatedAt = now
			changed = true
		}
	}
	if !changed {
		return nil
	}
	return m.commitLocked(ctx, next)
}

// GuestEnabled reports whether the unauthenticated guest entry option is available.
func (m *Manager) GuestEnabled() bool { return m.guestEnabled }

// CookieSecure reports whether the session cookie must be HTTPS-only.
func (m *Manager) CookieSecure() bool { return m.cookieSecure }

// StartLogin validates the primary credential and issues a bounded second-factor challenge.
func (m *Manager) StartLogin(username, password, remote string) (LoginChallenge, error) {
	usernameKey := normalizeUsername(username)
	attemptKey := usernameKey + "|" + remoteHost(remote)
	now := m.now()
	m.mu.Lock()
	m.pruneLocked(now)
	if attempt := m.loginAttempts[attemptKey]; attempt.Failures >= maxLoginAttempts && now.Sub(attempt.StartedAt) < loginAttemptWindow {
		m.mu.Unlock()
		return LoginChallenge{}, ErrRateLimited
	}
	user, found := m.userByUsernameKeyLocked(usernameKey)
	passwordHash := m.dummyPasswordHash
	credentialShapeValid := len(password) > 0 && len(password) <= 1024
	if found && credentialShapeValid {
		passwordHash = user.PasswordHash
	}
	m.mu.Unlock()

	matches, err := comparePassword(passwordHash, password)
	if err != nil {
		return LoginChallenge{}, fmt.Errorf("comparing password: %w", err)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if !found || !credentialShapeValid || !matches || user.Disabled {
		m.recordLoginFailureLocked(attemptKey, now)
		return LoginChallenge{}, ErrInvalidCredentials
	}
	current, stillExists := m.userByIDLocked(user.ID)
	if !stillExists || current.Disabled || current.PasswordHash != user.PasswordHash {
		m.recordLoginFailureLocked(attemptKey, now)
		return LoginChallenge{}, ErrInvalidCredentials
	}
	delete(m.loginAttempts, attemptKey)
	token, err := randomToken(32)
	if err != nil {
		return LoginChallenge{}, err
	}
	challenge := pendingChallenge{Token: token, UserID: user.ID, ExpiresAt: now.Add(challengeLifetime)}
	response := LoginChallenge{Challenge: token, Next: "totp"}
	if current.EncryptedTOTPSecret == "" {
		secret, enrollment, err := newEnrollment(current.Username)
		if err != nil {
			return LoginChallenge{}, err
		}
		challenge.SetupSecret = secret
		challenge.Enrollment = &enrollment
		response.Next = "setup"
		response.Enrollment = &enrollment
	}
	m.challenges[token] = challenge
	return response, nil
}

// CompleteTOTP validates an enrolled authenticator code and creates a session.
func (m *Manager) CompleteTOTP(ctx context.Context, challengeToken, code string) (Session, error) {
	return m.completeAuthenticator(ctx, challengeToken, code)
}

// CompleteSetup verifies first-login enrollment, persists it, and returns recovery codes once.
func (m *Manager) CompleteSetup(ctx context.Context, challengeToken, code string) (Session, []string, error) {
	now := m.now()
	m.mu.Lock()
	challenge, user, err := m.challengeUserLocked(challengeToken, now)
	if err != nil {
		m.mu.Unlock()
		return Session{}, nil, err
	}
	if challenge.SetupSecret == "" || user.EncryptedTOTPSecret != "" {
		m.mu.Unlock()
		return Session{}, nil, ErrInvalidChallenge
	}
	secret := challenge.SetupSecret
	m.mu.Unlock()
	step, valid, err := verifyTOTP(secret, code, now, 0)
	if err != nil {
		return Session{}, nil, err
	}
	if !valid {
		m.failChallenge(challengeToken)
		return Session{}, nil, ErrInvalidCode
	}
	codes, hashes, err := newRecoveryCodes()
	if err != nil {
		return Session{}, nil, err
	}
	encryptedSecret, err := sealSecret(m.encryptionKey, secret)
	if err != nil {
		return Session{}, nil, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	challenge, user, err = m.challengeUserLocked(challengeToken, now)
	if err != nil || challenge.SetupSecret != secret || user.EncryptedTOTPSecret != "" {
		return Session{}, nil, ErrInvalidChallenge
	}
	next := clonePersistentState(m.state)
	index := slices.IndexFunc(next.Users, func(candidate persistedUser) bool { return candidate.ID == user.ID })
	next.Users[index].EncryptedTOTPSecret = encryptedSecret
	next.Users[index].RecoveryCodeHashes = hashes
	next.Users[index].LastTOTPStep = step
	next.Users[index].UpdatedAt = now
	if err := m.commitLocked(ctx, next); err != nil {
		return Session{}, nil, err
	}
	delete(m.challenges, challengeToken)
	session, err := m.newSessionLocked(next.Users[index], now)
	return session, codes, err
}

// CompleteRecovery consumes one recovery code and creates a session.
func (m *Manager) CompleteRecovery(ctx context.Context, challengeToken, code string) (Session, error) {
	now := m.now()
	m.mu.Lock()
	defer m.mu.Unlock()
	challenge, user, err := m.challengeUserLocked(challengeToken, now)
	if err != nil || challenge.SetupSecret != "" || user.EncryptedTOTPSecret == "" {
		return Session{}, ErrInvalidChallenge
	}
	index := recoveryCodeIndex(user.RecoveryCodeHashes, code)
	if index < 0 {
		m.failChallengeLocked(challengeToken)
		return Session{}, ErrInvalidCode
	}
	next := clonePersistentState(m.state)
	userIndex := slices.IndexFunc(next.Users, func(candidate persistedUser) bool { return candidate.ID == user.ID })
	next.Users[userIndex].RecoveryCodeHashes = slices.Delete(next.Users[userIndex].RecoveryCodeHashes, index, index+1)
	next.Users[userIndex].UpdatedAt = now
	if err := m.commitLocked(ctx, next); err != nil {
		return Session{}, err
	}
	delete(m.challenges, challengeToken)
	return m.newSessionLocked(next.Users[userIndex], now)
}

func (m *Manager) completeAuthenticator(ctx context.Context, challengeToken, code string) (Session, error) {
	now := m.now()
	m.mu.Lock()
	challenge, user, err := m.challengeUserLocked(challengeToken, now)
	if err != nil {
		m.mu.Unlock()
		return Session{}, err
	}
	if challenge.SetupSecret != "" || user.EncryptedTOTPSecret == "" {
		m.mu.Unlock()
		return Session{}, ErrInvalidChallenge
	}
	secret, err := openSecret(m.encryptionKey, user.EncryptedTOTPSecret)
	lastStep := user.LastTOTPStep
	m.mu.Unlock()
	if err != nil {
		return Session{}, fmt.Errorf("opening totp secret: %w", err)
	}
	step, valid, err := verifyTOTP(secret, code, now, lastStep)
	if err != nil {
		return Session{}, err
	}
	if !valid {
		m.failChallenge(challengeToken)
		return Session{}, ErrInvalidCode
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	challenge, user, err = m.challengeUserLocked(challengeToken, now)
	if err != nil || challenge.SetupSecret != "" || user.LastTOTPStep >= step {
		return Session{}, ErrInvalidChallenge
	}
	next := clonePersistentState(m.state)
	index := slices.IndexFunc(next.Users, func(candidate persistedUser) bool { return candidate.ID == user.ID })
	next.Users[index].LastTOTPStep = step
	next.Users[index].UpdatedAt = now
	if err := m.commitLocked(ctx, next); err != nil {
		return Session{}, err
	}
	delete(m.challenges, challengeToken)
	return m.newSessionLocked(next.Users[index], now)
}

// NewGuestSession creates a session for the persistent Guest workspace.
func (m *Manager) NewGuestSession() (Session, error) {
	if !m.guestEnabled {
		return Session{}, ErrForbidden
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.newPrincipalSessionLocked(Principal{UserID: RoleGuest, Username: "Guest", Role: RoleGuest}, m.now())
}

// Session resolves an opaque cookie token and refreshes no state.
func (m *Manager) Session(token string) (Session, bool) {
	now := m.now()
	m.mu.Lock()
	defer m.mu.Unlock()
	m.pruneLocked(now)
	session, exists := m.sessions[token]
	if !exists {
		return Session{}, false
	}
	session.Principal = clonePrincipal(session.Principal)
	return session, true
}

// Logout invalidates a session token.
func (m *Manager) Logout(token string) {
	m.mu.Lock()
	delete(m.sessions, token)
	m.mu.Unlock()
}

// Users returns secret-free account records.
func (m *Manager) Users() []UserView {
	m.mu.Lock()
	defer m.mu.Unlock()
	views := make([]UserView, 0, len(m.state.Users))
	for _, user := range m.state.Users {
		views = append(views, userView(user))
	}
	slices.SortFunc(views, func(left, right UserView) int { return strings.Compare(left.Username, right.Username) })
	return views
}

// CreateUser creates an organization-scoped local account that must enroll TOTP.
func (m *Manager) CreateUser(ctx context.Context, username, password string, organizations []string) (UserView, error) {
	username = strings.TrimSpace(username)
	if err := validateUsername(username); err != nil {
		return UserView{}, err
	}
	organizations, err := normalizeOrganizations(organizations)
	if err != nil {
		return UserView{}, err
	}
	passwordHash, err := hashPassword(password)
	if err != nil {
		return UserView{}, err
	}
	id, err := randomToken(16)
	if err != nil {
		return UserView{}, err
	}
	now := m.now()
	m.mu.Lock()
	defer m.mu.Unlock()
	usernameKey := normalizeUsername(username)
	if _, exists := m.userByUsernameKeyLocked(usernameKey); exists {
		return UserView{}, ErrConflict
	}
	user := persistedUser{
		ID: id, Username: username, UsernameKey: usernameKey, Role: RoleUser,
		PasswordHash: passwordHash, Organizations: organizations, CreatedAt: now, UpdatedAt: now,
	}
	next := clonePersistentState(m.state)
	next.Users = append(next.Users, user)
	if err := m.commitLocked(ctx, next); err != nil {
		return UserView{}, err
	}
	return userView(user), nil
}

// UpdateUser changes organization membership and disabled state.
func (m *Manager) UpdateUser(ctx context.Context, id string, organizations []string, disabled bool) (UserView, error) {
	organizations, err := normalizeOrganizations(organizations)
	if err != nil {
		return UserView{}, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	next := clonePersistentState(m.state)
	index := slices.IndexFunc(next.Users, func(user persistedUser) bool { return user.ID == id })
	if index < 0 {
		return UserView{}, ErrNotFound
	}
	if next.Users[index].IsBootstrapAdministrator {
		return UserView{}, ErrForbidden
	}
	next.Users[index].Organizations = organizations
	next.Users[index].Disabled = disabled
	next.Users[index].UpdatedAt = m.now()
	if err := m.commitLocked(ctx, next); err != nil {
		return UserView{}, err
	}
	if disabled {
		for token, session := range m.sessions {
			if session.Principal.UserID == id {
				delete(m.sessions, token)
			}
		}
	} else {
		for token, session := range m.sessions {
			if session.Principal.UserID != id {
				continue
			}
			session.Principal.Organizations = slices.Clone(organizations)
			m.sessions[token] = session
		}
	}
	return userView(next.Users[index]), nil
}

// CanAccessTopology checks administrator, Guest workspace, or organization membership.
func (m *Manager) CanAccessTopology(principal Principal, topologyID, organization string) bool {
	if principal.IsAdmin() {
		return true
	}
	if principal.IsGuest() {
		m.mu.Lock()
		defer m.mu.Unlock()
		return slices.Contains(m.state.GuestTopologyIDs, topologyID)
	}
	for _, allowed := range principal.Organizations {
		if strings.EqualFold(strings.TrimSpace(allowed), strings.TrimSpace(organization)) {
			return true
		}
	}
	return false
}

// CanCreateInOrganization checks the organization requested for a new topology.
func (m *Manager) CanCreateInOrganization(principal Principal, organization string) bool {
	if principal.IsAdmin() || principal.IsGuest() {
		return true
	}
	for _, allowed := range principal.Organizations {
		if strings.EqualFold(strings.TrimSpace(allowed), strings.TrimSpace(organization)) {
			return true
		}
	}
	return false
}

// AddGuestTopology persists a topology in the Guest workspace.
func (m *Manager) AddGuestTopology(ctx context.Context, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return errors.New("auth: guest topology id is required")
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if slices.Contains(m.state.GuestTopologyIDs, id) {
		return nil
	}
	next := clonePersistentState(m.state)
	next.GuestTopologyIDs = append(next.GuestTopologyIDs, id)
	slices.Sort(next.GuestTopologyIDs)
	return m.commitLocked(ctx, next)
}

// RemoveGuestTopology removes a deleted topology from the Guest workspace index.
func (m *Manager) RemoveGuestTopology(ctx context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	index := slices.Index(m.state.GuestTopologyIDs, strings.TrimSpace(id))
	if index < 0 {
		return nil
	}
	next := clonePersistentState(m.state)
	next.GuestTopologyIDs = slices.Delete(next.GuestTopologyIDs, index, index+1)
	return m.commitLocked(ctx, next)
}

func (m *Manager) challengeUserLocked(token string, now time.Time) (pendingChallenge, persistedUser, error) {
	challenge, exists := m.challenges[token]
	if !exists || !challenge.ExpiresAt.After(now) || challenge.FailedChecks >= maxChallengeTries {
		delete(m.challenges, token)
		return pendingChallenge{}, persistedUser{}, ErrInvalidChallenge
	}
	user, exists := m.userByIDLocked(challenge.UserID)
	if !exists || user.Disabled {
		delete(m.challenges, token)
		return pendingChallenge{}, persistedUser{}, ErrInvalidChallenge
	}
	return challenge, user, nil
}

func (m *Manager) failChallenge(token string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.failChallengeLocked(token)
}

func (m *Manager) failChallengeLocked(token string) {
	challenge, exists := m.challenges[token]
	if !exists {
		return
	}
	challenge.FailedChecks++
	if challenge.FailedChecks >= maxChallengeTries {
		delete(m.challenges, token)
		return
	}
	m.challenges[token] = challenge
}

func (m *Manager) newSessionLocked(user persistedUser, now time.Time) (Session, error) {
	return m.newPrincipalSessionLocked(Principal{
		UserID: user.ID, Username: user.Username, Role: user.Role, Organizations: slices.Clone(user.Organizations),
	}, now)
}

func (m *Manager) newPrincipalSessionLocked(principal Principal, now time.Time) (Session, error) {
	token, err := randomToken(32)
	if err != nil {
		return Session{}, err
	}
	csrfToken, err := randomToken(24)
	if err != nil {
		return Session{}, err
	}
	session := Session{Token: token, CSRFToken: csrfToken, Principal: clonePrincipal(principal), ExpiresAt: now.Add(sessionLifetime)}
	m.sessions[token] = session
	return session, nil
}

func (m *Manager) userByUsernameKeyLocked(usernameKey string) (persistedUser, bool) {
	index := slices.IndexFunc(m.state.Users, func(user persistedUser) bool { return user.UsernameKey == usernameKey })
	if index < 0 {
		return persistedUser{}, false
	}
	user := m.state.Users[index]
	user.Organizations = slices.Clone(user.Organizations)
	user.RecoveryCodeHashes = slices.Clone(user.RecoveryCodeHashes)
	return user, true
}

func (m *Manager) userByIDLocked(id string) (persistedUser, bool) {
	index := slices.IndexFunc(m.state.Users, func(user persistedUser) bool { return user.ID == id })
	if index < 0 {
		return persistedUser{}, false
	}
	user := m.state.Users[index]
	user.Organizations = slices.Clone(user.Organizations)
	user.RecoveryCodeHashes = slices.Clone(user.RecoveryCodeHashes)
	return user, true
}

func (m *Manager) recordLoginFailureLocked(key string, now time.Time) {
	attempt := m.loginAttempts[key]
	if attempt.StartedAt.IsZero() || now.Sub(attempt.StartedAt) >= loginAttemptWindow {
		attempt = loginAttempt{StartedAt: now}
	}
	attempt.Failures++
	m.loginAttempts[key] = attempt
}

func (m *Manager) pruneLocked(now time.Time) {
	for token, session := range m.sessions {
		if !session.ExpiresAt.After(now) {
			delete(m.sessions, token)
		}
	}
	for token, challenge := range m.challenges {
		if !challenge.ExpiresAt.After(now) {
			delete(m.challenges, token)
		}
	}
	for key, attempt := range m.loginAttempts {
		if now.Sub(attempt.StartedAt) >= loginAttemptWindow {
			delete(m.loginAttempts, key)
		}
	}
}

func (m *Manager) commitLocked(ctx context.Context, next persistentState) error {
	if err := m.saveState(ctx, next); err != nil {
		return err
	}
	m.state = next
	return nil
}

func userView(user persistedUser) UserView {
	return UserView{
		ID: user.ID, Username: user.Username, Role: user.Role,
		Organizations: slices.Clone(user.Organizations), TOTPConfigured: user.EncryptedTOTPSecret != "",
		Disabled: user.Disabled, CreatedAt: user.CreatedAt, UpdatedAt: user.UpdatedAt,
	}
}

func normalizeUsername(value string) string { return strings.ToLower(strings.TrimSpace(value)) }

func remoteHost(value string) string {
	value = strings.TrimSpace(value)
	host, _, err := net.SplitHostPort(value)
	if err == nil {
		return strings.ToLower(host)
	}
	return strings.ToLower(value)
}

func validateUsername(value string) error {
	value = strings.TrimSpace(value)
	if len(value) < 3 || len(value) > 80 {
		return errors.New("auth: username must contain between 3 and 80 characters")
	}
	for _, character := range value {
		if character < 0x20 || character == 0x7f {
			return errors.New("auth: username contains control characters")
		}
	}
	return nil
}

func normalizeOrganizations(values []string) ([]string, error) {
	organizations := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if len(value) > 120 {
			return nil, errors.New("auth: organization name is too long")
		}
		key := strings.ToLower(value)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		organizations = append(organizations, value)
	}
	if len(organizations) == 0 {
		return nil, errors.New("auth: at least one organization is required")
	}
	if len(organizations) > 64 {
		return nil, errors.New("auth: too many organization assignments")
	}
	slices.SortFunc(organizations, func(left, right string) int { return strings.Compare(strings.ToLower(left), strings.ToLower(right)) })
	return organizations, nil
}

func normalizeIDs(values []string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	slices.Sort(result)
	return result
}

func validatePersistentState(state persistentState, encryptionKey []byte) error {
	userIDs := make(map[string]struct{}, len(state.Users))
	usernames := make(map[string]struct{}, len(state.Users))
	for _, user := range state.Users {
		if user.ID == "" || user.UsernameKey == "" || normalizeUsername(user.Username) != user.UsernameKey {
			return errors.New("auth: account state contains an invalid identity")
		}
		if _, exists := userIDs[user.ID]; exists {
			return errors.New("auth: account state contains duplicate ids")
		}
		if _, exists := usernames[user.UsernameKey]; exists {
			return errors.New("auth: account state contains duplicate usernames")
		}
		userIDs[user.ID] = struct{}{}
		usernames[user.UsernameKey] = struct{}{}
		if user.Role != RoleAdmin && user.Role != RoleUser {
			return errors.New("auth: account state contains an invalid role")
		}
		if _, _, _, err := parsePasswordHash(user.PasswordHash); err != nil {
			return err
		}
		if user.EncryptedTOTPSecret != "" {
			secret, err := openSecret(encryptionKey, user.EncryptedTOTPSecret)
			if err != nil {
				return err
			}
			if _, err := validateTOTPSecret(secret); err != nil {
				return err
			}
		}
	}
	return nil
}

func randomToken(size int) (string, error) {
	value := make([]byte, size)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("generating authentication token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}
