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
	organizations     organizationCatalog
	guestOrganization string
	guestEnabled      bool
	cookieSecure      bool
	dummyPasswordHash string
	sessions          map[string]Session
	challenges        map[string]pendingChallenge
	loginAttempts     map[string]loginAttempt
	now               func() time.Time
}

// New opens the auth database, migrates legacy organization-name grants to the
// supplied stable catalog, and synchronizes the environment-controlled
// bootstrap administrator.
func New(
	dataDir string,
	config Config,
	organizations []OrganizationRef,
) (*Manager, error) {
	config.AdminUsername = strings.TrimSpace(config.AdminUsername)
	if config.AdminUsername == "" {
		return nil, errors.New("auth: bootstrap administrator username is required")
	}
	if err := validatePassword(config.AdminPassword); err != nil {
		return nil, fmt.Errorf("bootstrap administrator password: %w", err)
	}
	catalog, err := newOrganizationCatalog(organizations)
	if err != nil {
		return nil, err
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
	state, _, migrated, err := loadPersistentState(statePath)
	if err != nil {
		return nil, err
	}
	organizationMigrated, err := migrateOrganizationAssignments(&state, catalog)
	if err != nil {
		return nil, err
	}
	guestMigrated, err := migrateGuestOrganization(&state, catalog, config.GuestEnabled)
	if err != nil {
		return nil, err
	}
	guestAllowlistRetired := retireLegacyGuestTopologyIDs(&state)
	if err := validatePersistentState(state, encryptionKey, catalog); err != nil {
		return nil, err
	}
	if migrated || organizationMigrated || guestMigrated || guestAllowlistRetired {
		if err := savePersistentState(statePath, state); err != nil {
			return nil, fmt.Errorf("persisting migrated authentication state: %w", err)
		}
	}
	manager := newManager(state, encryptionKey, config, catalog, func(_ context.Context, next persistentState) error {
		return savePersistentState(statePath, next)
	})
	if err := manager.preparePasswordComparison(); err != nil {
		return nil, err
	}
	if err := manager.bootstrap(context.Background(), config); err != nil {
		return nil, err
	}
	return manager, nil
}

// ReadPreflight reads organization state required before New can migrate to a
// stable catalog. Missing auth state is reported as empty and no files or keys
// are created.
func ReadPreflight(dataDir string) (Preflight, error) {
	statePath := filepath.Join(dataDir, "auth", "accounts.json")
	state, exists, _, err := loadPersistentState(statePath)
	if err != nil {
		return Preflight{}, err
	}
	if !exists {
		return Preflight{LegacyOrganizationNames: []string{}}, nil
	}
	return preflight(state), nil
}

func newManager(
	state persistentState,
	encryptionKey []byte,
	config Config,
	organizations organizationCatalog,
	saveState func(context.Context, persistentState) error,
) *Manager {
	return &Manager{
		state:             state,
		saveState:         saveState,
		encryptionKey:     encryptionKey,
		organizations:     organizations,
		guestOrganization: state.GuestOrganizationID,
		guestEnabled:      config.GuestEnabled,
		cookieSecure:      config.CookieSecure,
		sessions:          make(map[string]Session),
		challenges:        make(map[string]pendingChallenge),
		loginAttempts:     make(map[string]loginAttempt),
		now:               func() time.Time { return time.Now().UTC() },
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

func (m *Manager) bootstrap(ctx context.Context, config Config) error {
	if err := validateUsername(config.AdminUsername); err != nil {
		return fmt.Errorf("bootstrap administrator username: %w", err)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	next := clonePersistentState(m.state)
	changed := false
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
			Role: RoleAdmin, AllOrganizations: true, PasswordHash: passwordHash,
			AuthSource: AuthSourceLocal, IsBootstrapAdministrator: true,
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
		if admin.Username != config.AdminUsername || admin.UsernameKey != usernameKey || admin.Role != RoleAdmin ||
			!admin.AllOrganizations || len(admin.OrganizationIDs) != 0 || admin.Disabled {
			admin.Username = config.AdminUsername
			admin.UsernameKey = usernameKey
			admin.Role = RoleAdmin
			admin.AllOrganizations = true
			admin.OrganizationIDs = nil
			admin.Disabled = false
			changed = true
		}
		if !admin.IsBootstrapAdministrator || admin.AuthSource != AuthSourceLocal {
			admin.IsBootstrapAdministrator = true
			admin.AuthSource = AuthSourceLocal
			changed = true
		}
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

// GuestOrganizationID returns the stable organization used for newly created
// Guest workspace topologies. It is empty when Guest access is disabled.
func (m *Manager) GuestOrganizationID() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !m.guestEnabled {
		return ""
	}
	return m.guestOrganization
}

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
	if found && user.AuthSource == AuthSourceLocal && credentialShapeValid {
		passwordHash = user.PasswordHash
	}
	m.mu.Unlock()

	matches, err := comparePassword(passwordHash, password)
	if err != nil {
		return LoginChallenge{}, fmt.Errorf("comparing password: %w", err)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if !found || user.AuthSource != AuthSourceLocal || !credentialShapeValid || !matches || user.Disabled {
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
	if m.guestOrganization == "" {
		return Session{}, ErrForbidden
	}
	return m.newPrincipalSessionLocked(Principal{
		UserID: RoleGuest, Username: "Guest", Role: RoleGuest,
		OrganizationIDs: []string{m.guestOrganization},
	}, m.now())
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

func (m *Manager) revokeUserSessionsLocked(userID string) {
	for token, session := range m.sessions {
		if session.Principal.UserID == userID {
			delete(m.sessions, token)
		}
	}
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

// CreateUser creates a local account that must enroll TOTP.
func (m *Manager) CreateUser(
	ctx context.Context,
	username string,
	password string,
	access Access,
) (UserView, error) {
	username = strings.TrimSpace(username)
	if err := validateUsername(username); err != nil {
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
	access, err = m.normalizeAccessLocked(access, false)
	if err != nil {
		return UserView{}, err
	}
	usernameKey := normalizeUsername(username)
	if _, exists := m.userByUsernameKeyLocked(usernameKey); exists {
		return UserView{}, ErrConflict
	}
	user := persistedUser{
		ID: id, Username: username, UsernameKey: usernameKey, Role: access.Role,
		AllOrganizations: access.AllOrganizations, OrganizationIDs: access.OrganizationIDs,
		PasswordHash: passwordHash, AuthSource: AuthSourceLocal,
		CreatedAt: now, UpdatedAt: now,
	}
	next := clonePersistentState(m.state)
	next.Users = append(next.Users, user)
	if err := m.commitLocked(ctx, next); err != nil {
		return UserView{}, err
	}
	return userView(user), nil
}

// CreateEntraUser creates a passwordless account that must link a pre-approved
// Microsoft Entra login before it can open a session.
func (m *Manager) CreateEntraUser(
	ctx context.Context,
	username string,
	externalLogin string,
	access Access,
) (UserView, error) {
	username = strings.TrimSpace(username)
	if err := validateUsername(username); err != nil {
		return UserView{}, err
	}
	externalLogin = strings.TrimSpace(externalLogin)
	if err := validateExternalLogin(externalLogin); err != nil {
		return UserView{}, err
	}
	id, err := randomToken(16)
	if err != nil {
		return UserView{}, err
	}
	now := m.now()
	m.mu.Lock()
	defer m.mu.Unlock()
	access, err = m.normalizeAccessLocked(access, false)
	if err != nil {
		return UserView{}, err
	}
	usernameKey := normalizeUsername(username)
	if _, exists := m.userByUsernameKeyLocked(usernameKey); exists || m.externalLoginExistsLocked(externalLogin, "") {
		return UserView{}, ErrConflict
	}
	user := persistedUser{
		ID: id, Username: username, UsernameKey: usernameKey, Role: access.Role,
		AllOrganizations: access.AllOrganizations, OrganizationIDs: access.OrganizationIDs,
		AuthSource: AuthSourceEntra, ExternalLogin: externalLogin,
		CreatedAt: now, UpdatedAt: now,
	}
	next := clonePersistentState(m.state)
	next.Users = append(next.Users, user)
	if err := m.commitLocked(ctx, next); err != nil {
		return UserView{}, err
	}
	return userView(user), nil
}

// CompleteEntraLogin binds or resolves a verified Entra identity and creates
// the same server-side session used by local authentication.
func (m *Manager) CompleteEntraLogin(ctx context.Context, identity ExternalIdentity) (Session, error) {
	identity.TenantID = strings.TrimSpace(identity.TenantID)
	identity.ObjectID = strings.TrimSpace(identity.ObjectID)
	identity.PreferredUsername = strings.TrimSpace(identity.PreferredUsername)
	if identity.TenantID == "" || identity.ObjectID == "" || validateExternalLogin(identity.PreferredUsername) != nil {
		return Session{}, ErrInvalidExternalIdentity
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	now := m.now()
	index := slices.IndexFunc(m.state.Users, func(user persistedUser) bool {
		return user.AuthSource == AuthSourceEntra &&
			strings.EqualFold(user.ExternalTenantID, identity.TenantID) &&
			strings.EqualFold(user.ExternalObjectID, identity.ObjectID)
	})
	if index < 0 {
		index = slices.IndexFunc(m.state.Users, func(user persistedUser) bool {
			return user.AuthSource == AuthSourceEntra && user.ExternalObjectID == "" &&
				normalizeUsername(user.ExternalLogin) == normalizeUsername(identity.PreferredUsername)
		})
		if index < 0 {
			return Session{}, ErrInvalidCredentials
		}
		if m.state.Users[index].Disabled {
			return Session{}, ErrInvalidCredentials
		}
		next := clonePersistentState(m.state)
		next.Users[index].ExternalTenantID = identity.TenantID
		next.Users[index].ExternalObjectID = identity.ObjectID
		next.Users[index].ExternalLinkedAt = now
		next.Users[index].UpdatedAt = now
		if err := m.commitLocked(ctx, next); err != nil {
			return Session{}, err
		}
	}
	user := m.state.Users[index]
	if user.Disabled || user.AuthSource != AuthSourceEntra {
		return Session{}, ErrInvalidCredentials
	}
	return m.newSessionLocked(user, now)
}

// ResetEntraBinding removes the immutable Entra object binding so the
// pre-approved login can link again on its next successful sign-in.
func (m *Manager) ResetEntraBinding(ctx context.Context, id string) (UserView, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	next := clonePersistentState(m.state)
	index := slices.IndexFunc(next.Users, func(user persistedUser) bool { return user.ID == id })
	if index < 0 {
		return UserView{}, ErrNotFound
	}
	if next.Users[index].AuthSource != AuthSourceEntra {
		return UserView{}, ErrForbidden
	}
	next.Users[index].ExternalTenantID = ""
	next.Users[index].ExternalObjectID = ""
	next.Users[index].ExternalLinkedAt = time.Time{}
	next.Users[index].UpdatedAt = m.now()
	if err := m.commitLocked(ctx, next); err != nil {
		return UserView{}, err
	}
	for token, session := range m.sessions {
		if session.Principal.UserID == id {
			delete(m.sessions, token)
		}
	}
	return userView(next.Users[index]), nil
}

// UpdateUser changes role, organization access, and disabled state. Any
// effective authorization change revokes the account's active sessions.
func (m *Manager) UpdateUser(ctx context.Context, id string, update UserUpdate) (UserView, error) {
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
	if update.ResetExternalIdentity && next.Users[index].AuthSource != AuthSourceEntra {
		return UserView{}, ErrForbidden
	}
	current := next.Users[index]
	requestedRole := strings.TrimSpace(update.Role)
	allowEmpty := current.Role == RoleUser && !current.AllOrganizations && len(current.OrganizationIDs) == 0 &&
		(requestedRole == "" || requestedRole == RoleUser) && !update.AllOrganizations &&
		len(update.OrganizationIDs) == 0 && (current.Disabled != update.Disabled || update.ResetExternalIdentity)
	access, err := m.normalizeAccessLocked(update.Access, allowEmpty)
	if err != nil {
		return UserView{}, err
	}
	user := &next.Users[index]
	changed := user.Role != access.Role || user.AllOrganizations != access.AllOrganizations ||
		!slices.Equal(user.OrganizationIDs, access.OrganizationIDs) || user.Disabled != update.Disabled
	resetIdentity := update.ResetExternalIdentity && user.ExternalObjectID != ""
	changed = changed || resetIdentity
	if !changed {
		return userView(*user), nil
	}
	user.Role = access.Role
	user.AllOrganizations = access.AllOrganizations
	user.OrganizationIDs = access.OrganizationIDs
	user.Disabled = update.Disabled
	if update.ResetExternalIdentity {
		user.ExternalTenantID = ""
		user.ExternalObjectID = ""
		user.ExternalLinkedAt = time.Time{}
	}
	next.Users[index].UpdatedAt = m.now()
	if err := m.commitLocked(ctx, next); err != nil {
		return UserView{}, err
	}
	m.revokeUserSessionsLocked(id)
	return userView(next.Users[index]), nil
}

// RegisterOrganization updates the in-memory catalog after organization
// creation or rename.
func (m *Manager) RegisterOrganization(ref OrganizationRef) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	nextCatalog := m.organizations.clone()
	if err := nextCatalog.register(ref); err != nil {
		return err
	}
	m.organizations = nextCatalog
	return nil
}

// RemoveOrganizationAssignments removes a deleted organization from every
// account without widening access and revokes affected sessions. A scoped user
// may intentionally retain zero grants until an administrator reassigns it.
func (m *Manager) RemoveOrganizationAssignments(ctx context.Context, organizationID string) error {
	organizationID = strings.TrimSpace(organizationID)
	if organizationID == "" {
		return errors.New("auth: organization id is required")
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	next := clonePersistentState(m.state)
	affected := make(map[string]struct{})
	changed := false
	for index := range next.Users {
		user := &next.Users[index]
		grantIndex := slices.Index(user.OrganizationIDs, organizationID)
		if grantIndex < 0 {
			continue
		}
		user.OrganizationIDs = slices.Delete(user.OrganizationIDs, grantIndex, grantIndex+1)
		user.UpdatedAt = m.now()
		affected[user.ID] = struct{}{}
		changed = true
	}
	if next.GuestOrganizationID == organizationID {
		next.GuestOrganizationID = ""
		changed = true
	}
	if changed {
		if err := m.commitLocked(ctx, next); err != nil {
			return err
		}
	}
	m.organizations.remove(organizationID)
	if m.guestOrganization == organizationID {
		m.guestOrganization = ""
	}
	for id := range affected {
		m.revokeUserSessionsLocked(id)
	}
	return nil
}

// CanAccessTopology checks administrator, global, Guest workspace, or stable
// organization-ID membership.
func (m *Manager) CanAccessTopology(principal Principal, _ string, organizationID string) bool {
	if principal.IsGuest() {
		organizationID = strings.TrimSpace(organizationID)
		m.mu.Lock()
		defer m.mu.Unlock()
		return m.guestEnabled && organizationID != "" && organizationID == m.guestOrganization
	}
	organizationID = strings.TrimSpace(organizationID)
	if organizationID == "" {
		return false
	}
	m.mu.Lock()
	registered := m.organizations.contains(organizationID)
	m.mu.Unlock()
	if !registered {
		return false
	}
	return principal.IsAdmin() || principal.AllOrganizations || slices.Contains(principal.OrganizationIDs, organizationID)
}

// CanCreateInOrganization checks the stable organization requested for a new topology.
func (m *Manager) CanCreateInOrganization(principal Principal, organizationID string) bool {
	organizationID = strings.TrimSpace(organizationID)
	if organizationID == "" {
		return false
	}
	m.mu.Lock()
	registered := m.organizations.contains(organizationID)
	guestOrganization := m.guestOrganization
	m.mu.Unlock()
	if !registered {
		return false
	}
	if principal.IsGuest() {
		return m.guestEnabled && organizationID == guestOrganization
	}
	return principal.IsAdmin() || principal.AllOrganizations || slices.Contains(principal.OrganizationIDs, organizationID)
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
		UserID: user.ID, Username: user.Username, Role: user.Role,
		AllOrganizations: user.Role == RoleAdmin || user.AllOrganizations,
		OrganizationIDs:  slices.Clone(user.OrganizationIDs),
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
	session.Principal = clonePrincipal(session.Principal)
	return session, nil
}

func (m *Manager) userByUsernameKeyLocked(usernameKey string) (persistedUser, bool) {
	index := slices.IndexFunc(m.state.Users, func(user persistedUser) bool { return user.UsernameKey == usernameKey })
	if index < 0 {
		return persistedUser{}, false
	}
	user := m.state.Users[index]
	user.OrganizationIDs = slices.Clone(user.OrganizationIDs)
	user.RecoveryCodeHashes = slices.Clone(user.RecoveryCodeHashes)
	return user, true
}

func (m *Manager) userByIDLocked(id string) (persistedUser, bool) {
	index := slices.IndexFunc(m.state.Users, func(user persistedUser) bool { return user.ID == id })
	if index < 0 {
		return persistedUser{}, false
	}
	user := m.state.Users[index]
	user.OrganizationIDs = slices.Clone(user.OrganizationIDs)
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
		AllOrganizations: user.Role == RoleAdmin || user.AllOrganizations,
		OrganizationIDs:  slices.Clone(user.OrganizationIDs), TOTPConfigured: user.EncryptedTOTPSecret != "",
		AuthSource: user.AuthSource, ExternalLogin: user.ExternalLogin, ExternalLinked: user.ExternalObjectID != "",
		Disabled: user.Disabled, Protected: user.IsBootstrapAdministrator,
		CreatedAt: user.CreatedAt, UpdatedAt: user.UpdatedAt,
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

func validateExternalLogin(value string) error {
	value = strings.TrimSpace(value)
	if len(value) < 3 || len(value) > 254 || !strings.Contains(value, "@") {
		return errors.New("auth: Microsoft account login must be a valid user principal name")
	}
	for _, character := range value {
		if character <= 0x20 || character == 0x7f {
			return errors.New("auth: Microsoft account login contains invalid characters")
		}
	}
	return nil
}

func (m *Manager) externalLoginExistsLocked(externalLogin, exceptID string) bool {
	key := normalizeUsername(externalLogin)
	return slices.ContainsFunc(m.state.Users, func(user persistedUser) bool {
		return user.ID != exceptID && user.AuthSource == AuthSourceEntra && normalizeUsername(user.ExternalLogin) == key
	})
}

func (m *Manager) normalizeAccessLocked(access Access, allowEmpty bool) (Access, error) {
	access.Role = strings.TrimSpace(access.Role)
	if access.Role == "" {
		access.Role = RoleUser
	}
	if access.Role != RoleAdmin && access.Role != RoleUser {
		return Access{}, errors.New("auth: account role is invalid")
	}
	organizationIDs := normalizeIDs(access.OrganizationIDs)
	if len(organizationIDs) > 64 {
		return Access{}, errors.New("auth: too many organization assignments")
	}
	for _, id := range organizationIDs {
		if !m.organizations.contains(id) {
			return Access{}, errors.New("auth: organization assignment is not registered")
		}
	}
	if access.Role == RoleAdmin {
		if len(organizationIDs) != 0 {
			return Access{}, errors.New("auth: administrator cannot have scoped organization assignments")
		}
		return Access{Role: RoleAdmin, AllOrganizations: true, OrganizationIDs: []string{}}, nil
	}
	if access.AllOrganizations && len(organizationIDs) != 0 {
		return Access{}, errors.New("auth: global access cannot include scoped organization assignments")
	}
	if !access.AllOrganizations && len(organizationIDs) == 0 && !allowEmpty {
		return Access{}, errors.New("auth: at least one organization is required")
	}
	return Access{
		Role:             RoleUser,
		AllOrganizations: access.AllOrganizations,
		OrganizationIDs:  organizationIDs,
	}, nil
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

func validatePersistentState(
	state persistentState,
	encryptionKey []byte,
	organizations organizationCatalog,
) error {
	if state.Version != authStateVersion {
		return fmt.Errorf("auth: unsupported state version %d", state.Version)
	}
	if state.GuestOrganizationID != "" && !organizations.contains(state.GuestOrganizationID) {
		return errors.New("auth: guest organization assignment is not registered")
	}
	userIDs := make(map[string]struct{}, len(state.Users))
	usernames := make(map[string]struct{}, len(state.Users))
	externalLogins := make(map[string]struct{}, len(state.Users))
	externalObjects := make(map[string]struct{}, len(state.Users))
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
		if len(user.LegacyOrganizations) != 0 {
			return errors.New("auth: account state contains legacy organization names")
		}
		if len(user.OrganizationIDs) > 64 || !slices.Equal(user.OrganizationIDs, normalizeIDs(user.OrganizationIDs)) {
			return errors.New("auth: account state contains invalid organization assignments")
		}
		for _, organizationID := range user.OrganizationIDs {
			if !organizations.contains(organizationID) {
				return errors.New("auth: account state contains an unregistered organization assignment")
			}
		}
		if user.Role == RoleAdmin {
			if !user.AllOrganizations || len(user.OrganizationIDs) != 0 {
				return errors.New("auth: administrator account contains scoped organization access")
			}
		} else if user.AllOrganizations && len(user.OrganizationIDs) != 0 {
			return errors.New("auth: global account contains scoped organization access")
		}
		if user.IsBootstrapAdministrator {
			validBootstrap := user.ID == bootstrapAdminID && user.Role == RoleAdmin &&
				user.AllOrganizations && !user.Disabled && user.AuthSource == AuthSourceLocal
			if !validBootstrap {
				return errors.New("auth: bootstrap administrator protections are invalid")
			}
		}
		switch user.AuthSource {
		case AuthSourceLocal:
			if user.ExternalLogin != "" || user.ExternalTenantID != "" || user.ExternalObjectID != "" || !user.ExternalLinkedAt.IsZero() {
				return errors.New("auth: local account contains an external identity")
			}
			if _, _, _, err := parsePasswordHash(user.PasswordHash); err != nil {
				return err
			}
		case AuthSourceEntra:
			if user.PasswordHash != "" || user.EncryptedTOTPSecret != "" ||
				len(user.RecoveryCodeHashes) != 0 || user.LastTOTPStep != 0 || user.IsBootstrapAdministrator {
				return errors.New("auth: Entra account contains local authentication secrets")
			}
			if err := validateExternalLogin(user.ExternalLogin); err != nil {
				return err
			}
			loginKey := normalizeUsername(user.ExternalLogin)
			if _, exists := externalLogins[loginKey]; exists {
				return errors.New("auth: account state contains duplicate external logins")
			}
			externalLogins[loginKey] = struct{}{}
			if (user.ExternalTenantID == "") != (user.ExternalObjectID == "") {
				return errors.New("auth: account state contains an incomplete external identity")
			}
			if (user.ExternalObjectID == "") != user.ExternalLinkedAt.IsZero() {
				return errors.New("auth: account state contains an inconsistent external link timestamp")
			}
			if user.ExternalObjectID != "" {
				objectKey := strings.ToLower(user.ExternalTenantID + "|" + user.ExternalObjectID)
				if _, exists := externalObjects[objectKey]; exists {
					return errors.New("auth: account state contains duplicate external identities")
				}
				externalObjects[objectKey] = struct{}{}
			}
		default:
			return errors.New("auth: account state contains an invalid authentication source")
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
