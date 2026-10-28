package auth

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
)

func TestEntraProviderAuthorizationCodeFlow(t *testing.T) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	const keyID = "entra-test-key"
	var issuer string
	var expectedNonce string
	var expectedChallenge string
	var extraClaims map[string]any
	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	issuer = server.URL

	mux.HandleFunc("GET /.well-known/openid-configuration", func(w http.ResponseWriter, _ *http.Request) {
		writeTestJSON(t, w, map[string]any{
			"issuer": issuer, "authorization_endpoint": issuer + "/authorize",
			"token_endpoint": issuer + "/token", "jwks_uri": issuer + "/keys",
			"response_types_supported":              []string{"code"},
			"subject_types_supported":               []string{"public"},
			"id_token_signing_alg_values_supported": []string{"RS256"},
		})
	})
	mux.HandleFunc("GET /keys", func(w http.ResponseWriter, _ *http.Request) {
		writeTestJSON(t, w, jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{
			Key: &privateKey.PublicKey, KeyID: keyID, Algorithm: string(jose.RS256), Use: "sig",
		}}})
	})
	mux.HandleFunc("POST /token", func(w http.ResponseWriter, request *http.Request) {
		if err := request.ParseForm(); err != nil {
			t.Error(err)
			http.Error(w, "invalid form", http.StatusBadRequest)
			return
		}
		verifier := request.Form.Get("code_verifier")
		digest := sha256.Sum256([]byte(verifier))
		if base64.RawURLEncoding.EncodeToString(digest[:]) != expectedChallenge || request.Form.Get("code") != "valid-code" {
			http.Error(w, "invalid code exchange", http.StatusBadRequest)
			return
		}
		signer, signErr := jose.NewSigner(
			jose.SigningKey{Algorithm: jose.RS256, Key: privateKey},
			(&jose.SignerOptions{}).WithType("JWT").WithHeader("kid", keyID),
		)
		if signErr != nil {
			t.Error(signErr)
			http.Error(w, "signing failed", http.StatusInternalServerError)
			return
		}
		now := time.Now()
		claims := map[string]any{
			"nonce": expectedNonce, "tid": "tenant-id", "oid": "object-id",
			"preferred_username": "operator@example.com", "name": "Operator",
		}
		for name, value := range extraClaims {
			claims[name] = value
		}
		rawIDToken, signErr := jwt.Signed(signer).Claims(jwt.Claims{
			Issuer: issuer, Subject: "subject", Audience: jwt.Audience{"client-id"},
			Expiry: jwt.NewNumericDate(now.Add(time.Hour)), IssuedAt: jwt.NewNumericDate(now),
		}).Claims(claims).Serialize()
		if signErr != nil {
			t.Error(signErr)
			http.Error(w, "signing failed", http.StatusInternalServerError)
			return
		}
		writeTestJSON(t, w, map[string]any{
			"access_token": "unused", "token_type": "Bearer", "expires_in": 3600, "id_token": rawIDToken,
		})
	})

	provider, err := NewEntraProvider(EntraConfig{
		TenantID: "tenant-id", ClientID: "client-id", ClientSecret: "client-secret",
		RedirectURL: "https://wiredraft.internal/api/v1/auth/entra/callback",
	})
	if err != nil {
		t.Fatal(err)
	}
	provider.issuerURL = issuer
	start, err := provider.Begin(t.Context(), "192.0.2.10:40000")
	if err != nil {
		t.Fatal(err)
	}
	authorizationURL, err := url.Parse(start.AuthorizationURL)
	if err != nil {
		t.Fatal(err)
	}
	query := authorizationURL.Query()
	expectedNonce = query.Get("nonce")
	expectedChallenge = query.Get("code_challenge")
	if query.Get("code_challenge_method") != "S256" || expectedNonce == "" || expectedChallenge == "" {
		t.Fatalf("authorization query = %v", query)
	}
	identity, err := provider.Complete(t.Context(), query.Get("state"), start.FlowToken, "valid-code")
	if err != nil {
		t.Fatal(err)
	}
	if identity.TenantID != "tenant-id" || identity.ObjectID != "object-id" || identity.PreferredUsername != "operator@example.com" {
		t.Fatalf("identity = %#v", identity)
	}
	if _, err := provider.Complete(t.Context(), query.Get("state"), start.FlowToken, "valid-code"); err == nil {
		t.Fatal("replayed Entra flow was accepted")
	}

	for _, claims := range []map[string]any{
		{"idp": "https://sts.windows.net/other-tenant/"},
		{"idp": "live.com"},
		{"acct": 1},
	} {
		extraClaims = claims
		guestStart, err := provider.Begin(t.Context(), "192.0.2.10:40001")
		if err != nil {
			t.Fatal(err)
		}
		guestURL, err := url.Parse(guestStart.AuthorizationURL)
		if err != nil {
			t.Fatal(err)
		}
		expectedNonce = guestURL.Query().Get("nonce")
		expectedChallenge = guestURL.Query().Get("code_challenge")
		if _, err := provider.Complete(
			t.Context(), guestURL.Query().Get("state"), guestStart.FlowToken, "valid-code",
		); !errors.Is(err, ErrInvalidExternalIdentity) {
			t.Fatalf("guest or external account %v error = %v", claims, err)
		}
	}
	extraClaims = map[string]any{"idp": "https://sts.windows.net/tenant-id/", "acct": 0}
	memberStart, err := provider.Begin(t.Context(), "192.0.2.10:40002")
	if err != nil {
		t.Fatal(err)
	}
	memberURL, err := url.Parse(memberStart.AuthorizationURL)
	if err != nil {
		t.Fatal(err)
	}
	expectedNonce = memberURL.Query().Get("nonce")
	expectedChallenge = memberURL.Query().Get("code_challenge")
	if _, err := provider.Complete(
		t.Context(), memberURL.Query().Get("state"), memberStart.FlowToken, "valid-code",
	); err != nil {
		t.Fatalf("home-tenant member error = %v", err)
	}

	fixedNow := time.Now().UTC()
	provider.now = func() time.Time { return fixedNow }
	for index := range maxEntraFlows {
		provider.flows[string(rune(index+1))] = pendingEntraFlow{ExpiresAt: fixedNow.Add(time.Minute)}
	}
	if _, err := provider.Begin(t.Context(), "192.0.2.10:40000"); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("full pending-flow store error = %v", err)
	}
	fixedNow = fixedNow.Add(entraFlowLifetime + time.Second)
	for range maxEntraFlowsPerHost {
		if _, err := provider.Begin(t.Context(), "198.51.100.7:50000"); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := provider.Begin(t.Context(), "198.51.100.7:50001"); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("per-client pending-flow limit error = %v", err)
	}
	expiringStart, err := provider.Begin(t.Context(), "192.0.2.10:40000")

	if err != nil {
		t.Fatal(err)
	}
	expiringURL, err := url.Parse(expiringStart.AuthorizationURL)
	if err != nil {
		t.Fatal(err)
	}
	fixedNow = fixedNow.Add(entraFlowLifetime + time.Second)
	if _, err := provider.Complete(
		t.Context(), expiringURL.Query().Get("state"), expiringStart.FlowToken, "valid-code",
	); !errors.Is(err, ErrInvalidExternalIdentity) {
		t.Fatalf("expired Entra flow error = %v", err)
	}
}

func writeTestJSON(t *testing.T, w http.ResponseWriter, value any) {
	t.Helper()
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(value); err != nil {
		t.Error(err)
	}
}

func TestEntraHomeTenantMemberRequiresAccountTypeClaimWhenConfigured(t *testing.T) {
	t.Parallel()
	const tenant = "00000000-0000-4000-8000-000000000001"
	lenient := &EntraProvider{config: EntraConfig{TenantID: tenant}}
	strict := &EntraProvider{config: EntraConfig{TenantID: tenant, RequireAccountTypeClaim: true}}
	cases := []struct {
		name     string
		idp      string
		acct     any
		lenient  bool
		required bool
	}{
		{"absent claims", "", nil, true, false},
		{"member acct", "", float64(0), true, true},
		{"guest acct", "", float64(1), false, false},
		{"foreign idp", "https://sts.windows.net/other/", nil, false, false},
		{"string member acct", "", "0", true, true},
	}
	for _, testCase := range cases {
		if got := lenient.homeTenantMember(testCase.idp, testCase.acct); got != testCase.lenient {
			t.Errorf("%s: lenient homeTenantMember = %t, want %t", testCase.name, got, testCase.lenient)
		}
		if got := strict.homeTenantMember(testCase.idp, testCase.acct); got != testCase.required {
			t.Errorf("%s: strict homeTenantMember = %t, want %t", testCase.name, got, testCase.required)
		}
	}
}

func TestEntraFlowIsNotConsumedByAWrongCookie(t *testing.T) {
	t.Parallel()
	now := time.Now()
	provider := &EntraProvider{
		config: EntraConfig{TenantID: "00000000-0000-4000-8000-000000000001"},
		flows:  map[string]pendingEntraFlow{},
		now:    func() time.Time { return now },
	}
	provider.flows["state"] = pendingEntraFlow{CookieHash: sha256.Sum256([]byte("browser-cookie")), ExpiresAt: now.Add(time.Minute)}
	if _, err := provider.Complete(t.Context(), "state", "attacker-cookie", "code"); err == nil {
		t.Fatal("completion with the wrong flow cookie succeeded")
	}
	if _, exists := provider.flows["state"]; !exists {
		t.Fatal("a caller without the flow cookie cancelled the pending login")
	}
}
