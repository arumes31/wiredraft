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
		rawIDToken, signErr := jwt.Signed(signer).Claims(jwt.Claims{
			Issuer: issuer, Subject: "subject", Audience: jwt.Audience{"client-id"},
			Expiry: jwt.NewNumericDate(now.Add(time.Hour)), IssuedAt: jwt.NewNumericDate(now),
		}).Claims(map[string]any{
			"nonce": expectedNonce, "tid": "tenant-id", "oid": "object-id",
			"preferred_username": "operator@example.com", "name": "Operator",
		}).Serialize()
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
	start, err := provider.Begin(t.Context())
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

	fixedNow := time.Now().UTC()
	provider.now = func() time.Time { return fixedNow }
	for index := range maxEntraFlows {
		provider.flows[string(rune(index+1))] = pendingEntraFlow{ExpiresAt: fixedNow.Add(time.Minute)}
	}
	if _, err := provider.Begin(t.Context()); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("full pending-flow store error = %v", err)
	}
	fixedNow = fixedNow.Add(entraFlowLifetime + time.Second)
	expiringStart, err := provider.Begin(t.Context())
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
