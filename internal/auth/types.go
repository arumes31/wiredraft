// Package auth provides local account authentication, TOTP enrollment, sessions,
// and organization-scoped topology authorization.
package auth

import (
	"errors"
	"slices"
	"time"
)

const (
	// AuthSourceLocal authenticates a password stored by WireDraft.
	AuthSourceLocal = "local"
	// AuthSourceEntra authenticates through a linked Microsoft Entra identity.
	AuthSourceEntra = "entra"

	// RoleAdmin grants access to every organization and administrator endpoint.
	RoleAdmin = "admin"
	// RoleUser grants access to explicitly assigned organizations.
	RoleUser = "user"
	// RoleGuest grants access to the persistent Guest workspace.
	RoleGuest = "guest"
)

var (
	// ErrInvalidCredentials indicates a failed primary credential check.
	ErrInvalidCredentials = errors.New("auth: invalid credentials")
	// ErrInvalidChallenge indicates a missing, expired, or exhausted login challenge.
	ErrInvalidChallenge = errors.New("auth: invalid or expired challenge")
	// ErrInvalidCode indicates an invalid TOTP or recovery code.
	ErrInvalidCode = errors.New("auth: invalid verification code")
	// ErrRateLimited indicates too many recent authentication failures.
	ErrRateLimited = errors.New("auth: too many attempts")
	// ErrConflict indicates an account with the same normalized username exists.
	ErrConflict = errors.New("auth: account already exists")
	// ErrNotFound indicates that an account does not exist.
	ErrNotFound = errors.New("auth: account not found")
	// ErrForbidden indicates that the principal cannot perform an operation.
	ErrForbidden = errors.New("auth: forbidden")
	// ErrExternalUnavailable indicates that an external identity provider could not be reached.
	ErrExternalUnavailable = errors.New("auth: external identity provider unavailable")
	// ErrInvalidExternalIdentity indicates an invalid or unapproved external identity.
	ErrInvalidExternalIdentity = errors.New("auth: invalid external identity")
)

// Config contains authentication values sourced from the process environment.
type Config struct {
	AdminUsername   string
	AdminPassword   string
	AdminTOTPSecret string
	GuestEnabled    bool
	CookieSecure    bool
}

// Principal is the immutable authorization identity attached to a request.
type Principal struct {
	UserID        string   `json:"userId"`
	Username      string   `json:"username"`
	Role          string   `json:"role"`
	Organizations []string `json:"organizations"`
}

// IsAdmin reports whether the principal has the administrator role.
func (p Principal) IsAdmin() bool { return p.Role == RoleAdmin }

// IsGuest reports whether the principal represents the Guest workspace.
func (p Principal) IsGuest() bool { return p.Role == RoleGuest }

// Session is returned after successful authentication. Token remains server-only
// except while being installed into the HttpOnly cookie by the HTTP layer.
type Session struct {
	Token     string
	CSRFToken string
	Principal Principal
	ExpiresAt time.Time
}

// SessionView is safe to return to the browser.
type SessionView struct {
	Authenticated bool      `json:"authenticated"`
	GuestEnabled  bool      `json:"guestEnabled"`
	CSRFToken     string    `json:"csrfToken,omitempty"`
	ExpiresAt     time.Time `json:"expiresAt,omitempty"`
	Principal
}

// Enrollment contains the first-login authenticator setup material.
type Enrollment struct {
	QRCodeDataURL string `json:"qrCodeDataUrl"`
	ManualCode    string `json:"manualCode"`
	ProvisionURI  string `json:"provisionUri"`
}

// LoginChallenge describes the required second authentication step.
type LoginChallenge struct {
	Challenge  string      `json:"challenge"`
	Next       string      `json:"next"`
	Enrollment *Enrollment `json:"enrollment,omitempty"`
}

// UserView is the secret-free account representation used by administrators.
type UserView struct {
	ID             string    `json:"id"`
	Username       string    `json:"username"`
	Role           string    `json:"role"`
	Organizations  []string  `json:"organizations"`
	TOTPConfigured bool      `json:"totpConfigured"`
	AuthSource     string    `json:"authSource"`
	ExternalLogin  string    `json:"externalLogin,omitempty"`
	ExternalLinked bool      `json:"externalLinked"`
	Disabled       bool      `json:"disabled"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// ExternalIdentity is a verified identity returned by an OIDC provider.
type ExternalIdentity struct {
	TenantID          string
	ObjectID          string
	PreferredUsername string
	DisplayName       string
}

func clonePrincipal(principal Principal) Principal {
	principal.Organizations = slices.Clone(principal.Organizations)
	return principal
}
