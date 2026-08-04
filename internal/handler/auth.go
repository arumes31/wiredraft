package handler

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"netdiagram/internal/auth"
)

const sessionCookieName = "netdiagram_session"

type principalContextKey struct{}

type authStatusResponse struct {
	auth.SessionView
	AvailableOrganizations []string `json:"availableOrganizations,omitempty"`
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type challengeCodeRequest struct {
	Challenge string `json:"challenge"`
	Code      string `json:"code"`
}

type createUserRequest struct {
	Username      string   `json:"username"`
	Password      string   `json:"password"`
	Organizations []string `json:"organizations"`
}

type updateUserRequest struct {
	Organizations []string `json:"organizations"`
	Disabled      bool     `json:"disabled"`
}

func (s *Server) authStatus(w http.ResponseWriter, request *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	session, authenticated := s.sessionFromRequest(request)
	response := authStatusResponse{SessionView: auth.SessionView{
		Authenticated: authenticated,
		GuestEnabled:  s.auth.GuestEnabled(),
	}}
	if authenticated {
		response.CSRFToken = session.CSRFToken
		response.ExpiresAt = session.ExpiresAt
		response.Principal = session.Principal
		if session.Principal.IsAdmin() {
			organizations, err := s.availableOrganizations(request.Context())
			if err != nil {
				s.fail(w, err)
				return
			}
			response.AvailableOrganizations = organizations
		}
	}
	writeJSON(w, http.StatusOK, response)
}

func (s *Server) login(w http.ResponseWriter, request *http.Request) {
	var input loginRequest
	if err := decodeJSON(w, request, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid login request")
		return
	}
	challenge, err := s.auth.StartLogin(input.Username, input.Password, request.RemoteAddr)
	if err != nil {
		s.authFailure(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, challenge)
}

func (s *Server) verifyTOTP(w http.ResponseWriter, request *http.Request) {
	var input challengeCodeRequest
	if err := decodeJSON(w, request, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid verification request")
		return
	}
	session, err := s.auth.CompleteTOTP(request.Context(), input.Challenge, input.Code)
	if err != nil {
		s.authFailure(w, err)
		return
	}
	s.setSessionCookie(w, session)
	s.logger.Info("authentication succeeded", "user_id", session.Principal.UserID, "role", session.Principal.Role, "factor", "totp")
	s.writeSession(w, session, nil)
}

func (s *Server) completeTOTPSetup(w http.ResponseWriter, request *http.Request) {
	var input challengeCodeRequest
	if err := decodeJSON(w, request, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid setup request")
		return
	}
	session, recoveryCodes, err := s.auth.CompleteSetup(request.Context(), input.Challenge, input.Code)
	if err != nil {
		s.authFailure(w, err)
		return
	}
	s.setSessionCookie(w, session)
	s.logger.Info("totp enrollment completed", "user_id", session.Principal.UserID, "role", session.Principal.Role)
	s.writeSession(w, session, recoveryCodes)
}

func (s *Server) verifyRecoveryCode(w http.ResponseWriter, request *http.Request) {
	var input challengeCodeRequest
	if err := decodeJSON(w, request, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid recovery request")
		return
	}
	session, err := s.auth.CompleteRecovery(request.Context(), input.Challenge, input.Code)
	if err != nil {
		s.authFailure(w, err)
		return
	}
	s.setSessionCookie(w, session)
	s.logger.Warn("recovery code used", "user_id", session.Principal.UserID, "role", session.Principal.Role)
	s.writeSession(w, session, nil)
}

func (s *Server) guestLogin(w http.ResponseWriter, _ *http.Request) {
	session, err := s.auth.NewGuestSession()
	if err != nil {
		s.authFailure(w, err)
		return
	}
	s.setSessionCookie(w, session)
	s.writeSession(w, session, nil)
}

func (s *Server) logout(w http.ResponseWriter, request *http.Request) {
	if cookie, err := request.Cookie(sessionCookieName); err == nil {
		s.auth.Logout(cookie.Value)
	}
	// Secure is environment-controlled so local HTTP remains usable; production
	// TLS deployments must enable WIREDRAFT_COOKIE_SECURE. HttpOnly and strict
	// same-site protections are unconditional.
	http.SetCookie(w, &http.Cookie{ // #nosec G124 -- Secure is explicitly configured for the deployment transport.
		Name: sessionCookieName, Value: "", Path: "/", MaxAge: -1,
		Expires: time.Unix(1, 0), HttpOnly: true, Secure: s.auth.CookieSecure(), SameSite: http.SameSiteStrictMode,
	})
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listUsers(w http.ResponseWriter, request *http.Request) {
	organizations, err := s.availableOrganizations(request.Context())
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"users": s.auth.Users(), "organizations": organizations,
	})
}

func (s *Server) createUser(w http.ResponseWriter, request *http.Request) {
	var input createUserRequest
	if err := decodeJSON(w, request, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid account request")
		return
	}
	organizations, valid, err := s.canonicalOrganizations(request.Context(), input.Organizations)
	if err != nil {
		s.fail(w, err)
		return
	}
	if !valid {
		writeError(w, http.StatusBadRequest, "select one or more existing organizations")
		return
	}
	user, err := s.auth.CreateUser(request.Context(), input.Username, input.Password, organizations)
	if err != nil {
		s.authFailure(w, err)
		return
	}
	s.logger.Info("account created",
		"administrator_id", principalFromRequest(request).UserID,
		"user_id", user.ID,
		"organization_count", len(user.Organizations),
	)
	writeJSON(w, http.StatusCreated, user)
}

func (s *Server) updateUser(w http.ResponseWriter, request *http.Request) {
	var input updateUserRequest
	if err := decodeJSON(w, request, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid account update")
		return
	}
	organizations, valid, err := s.canonicalOrganizations(request.Context(), input.Organizations)
	if err != nil {
		s.fail(w, err)
		return
	}
	if !valid {
		writeError(w, http.StatusBadRequest, "select one or more existing organizations")
		return
	}
	user, err := s.auth.UpdateUser(request.Context(), request.PathValue("userId"), organizations, input.Disabled)
	if err != nil {
		s.authFailure(w, err)
		return
	}
	s.logger.Info("account updated",
		"administrator_id", principalFromRequest(request).UserID,
	)
	writeJSON(w, http.StatusOK, user)
}

func (s *Server) protected(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, request *http.Request) {
		session, authenticated := s.sessionFromRequest(request)
		if !authenticated {
			writeError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		if isUnsafeMethod(request.Method) && !s.validBrowserMutation(request, session.CSRFToken) {
			writeError(w, http.StatusForbidden, "request origin or csrf token is invalid")
			return
		}
		request = request.WithContext(context.WithValue(request.Context(), principalContextKey{}, session.Principal))
		if topologyID := request.PathValue("id"); topologyID != "" {
			topology, err := s.store.Get(request.Context(), topologyID)
			if err != nil {
				s.fail(w, err)
				return
			}
			if !s.auth.CanAccessTopology(session.Principal, topology.ID, topology.Organization) {
				writeError(w, http.StatusNotFound, "resource not found")
				return
			}
		}
		next(w, request)
	}
}

func (s *Server) adminOnly(next http.HandlerFunc) http.HandlerFunc {
	return s.protected(func(w http.ResponseWriter, request *http.Request) {
		if !principalFromRequest(request).IsAdmin() {
			writeError(w, http.StatusForbidden, "administrator access required")
			return
		}
		next(w, request)
	})
}

func (s *Server) sameOrigin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, request *http.Request) {
		if !isSameOrigin(request) {
			writeError(w, http.StatusForbidden, "request origin is invalid")
			return
		}
		next(w, request)
	}
}

func (s *Server) sessionFromRequest(request *http.Request) (auth.Session, bool) {
	if s.auth == nil {
		return auth.Session{}, false
	}
	cookie, err := request.Cookie(sessionCookieName)
	if err != nil || cookie.Value == "" {
		return auth.Session{}, false
	}
	return s.auth.Session(cookie.Value)
}

func (s *Server) setSessionCookie(w http.ResponseWriter, session auth.Session) {
	// Secure is environment-controlled so local HTTP remains usable; production
	// TLS deployments must enable WIREDRAFT_COOKIE_SECURE. HttpOnly and strict
	// same-site protections are unconditional.
	http.SetCookie(w, &http.Cookie{ // #nosec G124 -- Secure is explicitly configured for the deployment transport.
		Name: sessionCookieName, Value: session.Token, Path: "/",
		MaxAge: int(time.Until(session.ExpiresAt).Seconds()), HttpOnly: true,
		Secure: s.auth.CookieSecure(), SameSite: http.SameSiteStrictMode,
	})
}

func (s *Server) writeSession(w http.ResponseWriter, session auth.Session, recoveryCodes []string) {
	w.Header().Set("Cache-Control", "no-store")
	response := map[string]any{
		"session": auth.SessionView{
			Authenticated: true, GuestEnabled: s.auth.GuestEnabled(), CSRFToken: session.CSRFToken,
			ExpiresAt: session.ExpiresAt, Principal: session.Principal,
		},
	}
	if recoveryCodes != nil {
		response["recoveryCodes"] = recoveryCodes
	}
	writeJSON(w, http.StatusOK, response)
}

func (s *Server) authFailure(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, auth.ErrInvalidCredentials), errors.Is(err, auth.ErrInvalidChallenge), errors.Is(err, auth.ErrInvalidCode):
		writeError(w, http.StatusUnauthorized, "credentials or verification code are invalid")
	case errors.Is(err, auth.ErrRateLimited):
		w.Header().Set("Retry-After", "300")
		writeError(w, http.StatusTooManyRequests, "too many authentication attempts")
	case errors.Is(err, auth.ErrConflict):
		writeError(w, http.StatusConflict, "account already exists")
	case errors.Is(err, auth.ErrNotFound):
		writeError(w, http.StatusNotFound, "account not found")
	case errors.Is(err, auth.ErrForbidden):
		writeError(w, http.StatusForbidden, "operation is not allowed")
	default:
		if strings.HasPrefix(err.Error(), "auth:") {
			writeError(w, http.StatusBadRequest, strings.TrimPrefix(err.Error(), "auth: "))
			return
		}
		s.fail(w, err)
	}
}

func (s *Server) availableOrganizations(ctx context.Context) ([]string, error) {
	organizations := []string{}
	seen := map[string]struct{}{}
	summaries, err := s.store.List(ctx)
	if err != nil {
		return nil, err
	}
	for _, summary := range summaries {
		organization := strings.TrimSpace(summary.Organization)
		if organization == "" {
			continue
		}
		key := strings.ToLower(organization)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		organizations = append(organizations, organization)
	}
	if s.auth.GuestEnabled() {
		if _, exists := seen["guest"]; !exists {
			organizations = append(organizations, "Guest")
		}
	}
	slices.SortFunc(organizations, func(left, right string) int {
		return strings.Compare(strings.ToLower(left), strings.ToLower(right))
	})
	return organizations, nil
}

func (s *Server) canonicalOrganizations(ctx context.Context, requested []string) ([]string, bool, error) {
	available, err := s.availableOrganizations(ctx)
	if err != nil {
		return nil, false, err
	}
	canonical := make([]string, 0, len(requested))
	seen := map[string]struct{}{}
	for _, organization := range requested {
		index := slices.IndexFunc(available, func(candidate string) bool { return strings.EqualFold(strings.TrimSpace(organization), candidate) })
		if index < 0 {
			return nil, false, nil
		}
		key := strings.ToLower(available[index])
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		canonical = append(canonical, available[index])
	}
	return canonical, len(canonical) > 0, nil
}

func (s *Server) loginPage(w http.ResponseWriter, request *http.Request) {
	if _, authenticated := s.sessionFromRequest(request); authenticated {
		http.Redirect(w, request, "/", http.StatusSeeOther)
		return
	}
	s.serveStaticAsset(w, request, "login.html")
}

func principalFromRequest(request *http.Request) auth.Principal {
	principal, _ := request.Context().Value(principalContextKey{}).(auth.Principal)
	return principal
}

func isUnsafeMethod(method string) bool {
	return method != http.MethodGet && method != http.MethodHead && method != http.MethodOptions
}

func (s *Server) validBrowserMutation(request *http.Request, csrfToken string) bool {
	if request.Header.Get("Origin") == "" && request.Header.Get("Sec-Fetch-Site") == "" {
		return true
	}
	return isSameOrigin(request) && csrfToken != "" && request.Header.Get("X-CSRF-Token") == csrfToken
}

func isSameOrigin(request *http.Request) bool {
	origin := strings.TrimSpace(request.Header.Get("Origin"))
	if origin == "" {
		fetchSite := strings.ToLower(strings.TrimSpace(request.Header.Get("Sec-Fetch-Site")))
		return fetchSite == "" || fetchSite == "same-origin"
	}
	parsed, err := url.Parse(origin)
	return err == nil && parsed.Host == request.Host && (parsed.Scheme == "http" || parsed.Scheme == "https")
}
