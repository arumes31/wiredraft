package auth

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

const (
	entraFlowLifetime    = 5 * time.Minute
	entraExchangeTimeout = 10 * time.Second
	maxEntraFlows        = 512
	// maxEntraFlowsPerHost keeps one client from occupying the shared table.
	maxEntraFlowsPerHost = 10
)

// EntraConfig contains the single-tenant Microsoft identity settings.
type EntraConfig struct {
	TenantID     string
	ClientID     string
	ClientSecret string
	RedirectURL  string
	// RequireAccountTypeClaim rejects ID tokens without the optional acct
	// claim. Enable it once the app registration emits acct so that guest
	// rejection no longer depends on Entra including idp for every guest type.
	RequireAccountTypeClaim bool
}

// EntraStart contains the browser redirect and its short-lived binding token.
type EntraStart struct {
	AuthorizationURL string
	FlowToken        string
	ExpiresAt        time.Time
}

type pendingEntraFlow struct {
	CookieHash   [sha256.Size]byte
	Nonce        string
	PKCEVerifier string
	Host         string
	ExpiresAt    time.Time
}

type oidcRuntime struct {
	oauthConfig oauth2.Config
	verifier    *oidc.IDTokenVerifier
}

// EntraProvider performs a single-tenant OIDC authorization-code flow.
// Discovery and signing keys are fetched only when an Entra login is used,
// so an unavailable identity provider never disables local authentication.
type EntraProvider struct {
	config    EntraConfig
	issuerURL string

	mu          sync.Mutex
	discoveryMu sync.Mutex
	runtime     *oidcRuntime
	flows       map[string]pendingEntraFlow
	now         func() time.Time
}

// NewEntraProvider validates configuration without making a network request.
func NewEntraProvider(config EntraConfig) (*EntraProvider, error) {
	config.TenantID = strings.TrimSpace(config.TenantID)
	config.ClientID = strings.TrimSpace(config.ClientID)
	config.ClientSecret = strings.TrimSpace(config.ClientSecret)
	config.RedirectURL = strings.TrimSpace(config.RedirectURL)
	if config.TenantID == "" || config.ClientID == "" || config.ClientSecret == "" || config.RedirectURL == "" {
		return nil, errors.New("auth: incomplete Entra configuration")
	}
	return &EntraProvider{
		config:    config,
		issuerURL: "https://login.microsoftonline.com/" + config.TenantID + "/v2.0",
		flows:     make(map[string]pendingEntraFlow),
		now:       func() time.Time { return time.Now().UTC() },
	}, nil
}

// Begin creates a browser-bound, single-use OIDC request. Pending requests are
// bounded globally and per client address.
func (p *EntraProvider) Begin(ctx context.Context, remote string) (EntraStart, error) {
	runtime, err := p.oidcRuntime(ctx)
	if err != nil {
		return EntraStart{}, err
	}
	state, err := randomToken(32)
	if err != nil {
		return EntraStart{}, err
	}
	nonce, err := randomToken(32)
	if err != nil {
		return EntraStart{}, err
	}
	flowToken, err := randomToken(32)
	if err != nil {
		return EntraStart{}, err
	}
	verifier, err := randomToken(48)
	if err != nil {
		return EntraStart{}, err
	}
	now := p.now()
	p.mu.Lock()
	p.pruneFlowsLocked(now)
	host := remoteHost(remote)
	hostFlows := 0
	for _, flow := range p.flows {
		if flow.Host == host {
			hostFlows++
		}
	}
	if len(p.flows) >= maxEntraFlows || hostFlows >= maxEntraFlowsPerHost {
		p.mu.Unlock()
		return EntraStart{}, ErrRateLimited
	}
	expiresAt := now.Add(entraFlowLifetime)
	p.flows[state] = pendingEntraFlow{
		CookieHash: sha256.Sum256([]byte(flowToken)), Nonce: nonce,
		PKCEVerifier: verifier, Host: host, ExpiresAt: expiresAt,
	}
	p.mu.Unlock()
	authorizationURL := runtime.oauthConfig.AuthCodeURL(
		state,
		oidc.Nonce(nonce),
		oauth2.S256ChallengeOption(verifier),
	)
	return EntraStart{AuthorizationURL: authorizationURL, FlowToken: flowToken, ExpiresAt: expiresAt}, nil
}

// Complete consumes an OIDC flow, validates the ID token, and returns only
// the claims needed to bind an internal WireDraft account.
func (p *EntraProvider) Complete(
	ctx context.Context,
	state string,
	flowToken string,
	code string,
) (ExternalIdentity, error) {
	exchangeContext, cancel := context.WithTimeout(ctx, entraExchangeTimeout)
	defer cancel()
	now := p.now()
	p.mu.Lock()
	p.pruneFlowsLocked(now)
	flow, exists := p.flows[state]
	providedHash := sha256.Sum256([]byte(flowToken))
	matches := exists && state != "" && flowToken != "" &&
		subtle.ConstantTimeCompare(flow.CookieHash[:], providedHash[:]) == 1
	// Only the browser holding the flow cookie may consume the flow, so a
	// party that merely learns the state value cannot cancel the login.
	if matches {
		delete(p.flows, state)
	}
	p.mu.Unlock()
	if !matches || code == "" {
		return ExternalIdentity{}, ErrInvalidExternalIdentity
	}
	runtime, err := p.oidcRuntime(exchangeContext)
	if err != nil {
		return ExternalIdentity{}, err
	}
	token, err := runtime.oauthConfig.Exchange(exchangeContext, code, oauth2.VerifierOption(flow.PKCEVerifier))
	if err != nil {
		return ExternalIdentity{}, ErrInvalidExternalIdentity
	}
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok || rawIDToken == "" {
		return ExternalIdentity{}, ErrInvalidExternalIdentity
	}
	idToken, err := runtime.verifier.Verify(exchangeContext, rawIDToken)
	if err != nil {
		return ExternalIdentity{}, ErrInvalidExternalIdentity
	}
	if subtle.ConstantTimeCompare([]byte(idToken.Nonce), []byte(flow.Nonce)) != 1 {
		return ExternalIdentity{}, ErrInvalidExternalIdentity
	}
	var claims struct {
		TenantID          string `json:"tid"`
		ObjectID          string `json:"oid"`
		PreferredUsername string `json:"preferred_username"`
		Name              string `json:"name"`
		IdentityProvider  string `json:"idp"`
		AccountType       any    `json:"acct"`
	}
	if err := idToken.Claims(&claims); err != nil {
		return ExternalIdentity{}, ErrInvalidExternalIdentity
	}
	if !strings.EqualFold(strings.TrimSpace(claims.TenantID), p.config.TenantID) ||
		strings.TrimSpace(claims.ObjectID) == "" || validateExternalLogin(claims.PreferredUsername) != nil {
		return ExternalIdentity{}, ErrInvalidExternalIdentity
	}
	// preferred_username is mutable and, for B2B guests, controlled by their
	// home tenant. Only member accounts homed in the configured tenant may sign
	// in, so a guest whose username matches a pre-approved login cannot claim it.
	if !p.homeTenantMember(claims.IdentityProvider, claims.AccountType) {
		return ExternalIdentity{}, ErrInvalidExternalIdentity
	}

	return ExternalIdentity{
		TenantID: claims.TenantID, ObjectID: claims.ObjectID,
		PreferredUsername: claims.PreferredUsername, DisplayName: claims.Name,
	}, nil
}

func (p *EntraProvider) oidcRuntime(ctx context.Context) (*oidcRuntime, error) {
	p.mu.Lock()
	runtime := p.runtime
	p.mu.Unlock()
	if runtime != nil {
		return runtime, nil
	}

	p.discoveryMu.Lock()
	defer p.discoveryMu.Unlock()
	p.mu.Lock()
	runtime = p.runtime
	p.mu.Unlock()
	if runtime != nil {
		return runtime, nil
	}
	discoveryContext, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	provider, err := oidc.NewProvider(discoveryContext, p.issuerURL)
	if err != nil {
		return nil, fmt.Errorf("discovering Entra identity provider: %w", ErrExternalUnavailable)
	}
	runtime = &oidcRuntime{
		oauthConfig: oauth2.Config{
			ClientID: p.config.ClientID, ClientSecret: p.config.ClientSecret,
			Endpoint: provider.Endpoint(), RedirectURL: p.config.RedirectURL,
			Scopes: []string{oidc.ScopeOpenID, oidc.ScopeProfile, "email"},
		},
		verifier: provider.Verifier(&oidc.Config{ClientID: p.config.ClientID}),
	}
	p.mu.Lock()
	p.runtime = runtime
	p.mu.Unlock()
	return runtime, nil
}

func (p *EntraProvider) pruneFlowsLocked(now time.Time) {
	for state, flow := range p.flows {
		if !flow.ExpiresAt.After(now) {
			delete(p.flows, state)
		}
	}
}

// homeTenantMember rejects tokens whose idp claim names another identity
// provider (B2B guests and external accounts) and tokens whose optional acct
// claim marks a guest account. Home-tenant members carry neither idp nor acct
// unless acct is configured, so a token without acct is accepted only while
// RequireAccountTypeClaim is off.
func (p *EntraProvider) homeTenantMember(identityProvider string, accountType any) bool {
	identityProvider = strings.TrimSpace(identityProvider)
	if identityProvider != "" && !strings.Contains(strings.ToLower(identityProvider), strings.ToLower(p.config.TenantID)) {
		return false
	}
	switch value := accountType.(type) {
	case nil:
		return !p.config.RequireAccountTypeClaim
	case float64:
		return value == 0
	case string:
		return strings.TrimSpace(value) == "0"
	default:
		return false
	}
}
