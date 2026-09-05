package handler

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"wiredraft/internal/auth"
	"wiredraft/internal/store"
)

const (
	sessionCookieName   = "wiredraft_session"
	entraFlowCookieName = "wiredraft_entra_flow"
)

type principalContextKey struct{}

type authStatusResponse struct {
	auth.SessionView
	AvailableOrganizations []store.Organization `json:"availableOrganizations,omitempty"`
	EntraEnabled           bool                 `json:"entraEnabled"`
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
	auth.Access
	Username      string `json:"username"`
	Password      string `json:"password"`
	AuthSource    string `json:"authSource"`
	ExternalLogin string `json:"externalLogin"`
}

type updateUserRequest struct {
	auth.UserUpdate
	ResetExternalIdentity bool `json:"resetExternalIdentity"`
}

func (s *Server) authStatus(w http.ResponseWriter, request *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	session, authenticated := s.sessionFromRequest(request)
	response := authStatusResponse{SessionView: auth.SessionView{
		Authenticated: authenticated,
		GuestEnabled:  s.auth.GuestEnabled(),
	}, EntraEnabled: s.entra != nil}
	if authenticated {
		response.CSRFToken = session.CSRFToken
		response.ExpiresAt = session.ExpiresAt
		response.Principal = session.Principal
		organizations, err := s.availableOrganizations(request.Context(), session.Principal)
		if err != nil {
			s.fail(w, err)
			return
		}
		response.AvailableOrganizations = organizations
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
	if challenge.Next == "setup" {
		s.logger.Warn("totp enrollment required", "user_id", challenge.UserID)
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

func (s *Server) entraStart(w http.ResponseWriter, request *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	start, err := s.entra.Begin(request.Context())
	if err != nil {
		s.logger.Error("starting Entra authentication", "error", err)
		http.Redirect(w, request, "/login?entra_error=unavailable", http.StatusSeeOther)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name: entraFlowCookieName, Value: start.FlowToken, Path: "/api/v1/auth/entra/",
		Expires: start.ExpiresAt, MaxAge: int(time.Until(start.ExpiresAt).Seconds()),
		HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, request, start.AuthorizationURL, http.StatusSeeOther)
}

func (s *Server) entraCallback(w http.ResponseWriter, request *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	flowCookie, err := request.Cookie(entraFlowCookieName)
	if err != nil || request.URL.Query().Get("error") != "" {
		s.entraCallbackFailure(w, request, auth.ErrInvalidExternalIdentity)
		return
	}
	identity, err := s.entra.Complete(
		request.Context(), request.URL.Query().Get("state"), flowCookie.Value, request.URL.Query().Get("code"),
	)
	if err != nil {
		s.entraCallbackFailure(w, request, err)
		return
	}
	session, err := s.auth.CompleteEntraLogin(request.Context(), identity)
	if err != nil {
		s.entraCallbackFailure(w, request, err)
		return
	}
	s.clearEntraFlowCookie(w)
	s.setSessionCookie(w, session)
	s.logger.Info("authentication succeeded", "user_id", session.Principal.UserID, "role", session.Principal.Role, "provider", "entra")
	http.Redirect(w, request, "/", http.StatusSeeOther)
}

func (s *Server) entraCallbackFailure(w http.ResponseWriter, request *http.Request, err error) {
	s.clearEntraFlowCookie(w)
	if errors.Is(err, auth.ErrExternalUnavailable) {
		s.logger.Error("Entra authentication unavailable", "error", err)
		http.Redirect(w, request, "/login?entra_error=unavailable", http.StatusSeeOther)
		return
	}
	s.logger.Warn("Entra authentication rejected")
	http.Redirect(w, request, "/login?entra_error=rejected", http.StatusSeeOther)
}

func (s *Server) clearEntraFlowCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name: entraFlowCookieName, Value: "", Path: "/api/v1/auth/entra/",
		MaxAge: -1, Expires: time.Unix(1, 0), HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode,
	})
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
	organizations, err := s.store.ListOrganizations(request.Context())
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"users": s.auth.Users(), "organizations": organizations,
	})
}

func (s *Server) createUser(w http.ResponseWriter, request *http.Request) {
	s.directoryMu.Lock()
	defer s.directoryMu.Unlock()
	administrator, authorized := s.currentAdministrator(w, request)
	if !authorized {
		return
	}

	var input createUserRequest
	if err := decodeJSON(w, request, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid account request")
		return
	}
	access, err := s.canonicalAccess(request.Context(), input.Access)
	if err != nil {
		s.authFailure(w, err)
		return
	}
	var user auth.UserView
	switch input.AuthSource {
	case "", auth.AuthSourceLocal:
		user, err = s.auth.CreateUser(request.Context(), input.Username, input.Password, access)
	case auth.AuthSourceEntra:
		if s.entra == nil {
			writeError(w, http.StatusBadRequest, "Microsoft Entra login is not enabled")
			return
		}
		if strings.TrimSpace(input.Password) != "" {
			writeError(w, http.StatusBadRequest, "Microsoft Entra accounts cannot have a local password")
			return
		}
		user, err = s.auth.CreateEntraUser(request.Context(), input.Username, input.ExternalLogin, access)
	default:
		writeError(w, http.StatusBadRequest, "authentication source is invalid")
		return
	}
	if err != nil {
		s.authFailure(w, err)
		return
	}
	s.logger.Info("account created",
		"administrator_id", administrator.UserID,
		"user_id", user.ID,
		"organization_count", len(user.OrganizationIDs),
	)
	writeJSON(w, http.StatusCreated, user)
}

func (s *Server) updateUser(w http.ResponseWriter, request *http.Request) {
	s.directoryMu.Lock()
	defer s.directoryMu.Unlock()
	administrator, authorized := s.currentAdministrator(w, request)
	if !authorized {
		return
	}

	var input updateUserRequest
	if err := decodeJSON(w, request, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid account update")
		return
	}
	access, err := s.canonicalUpdatedAccess(
		request.Context(), request.PathValue("userId"), input.Access,
		input.Disabled, input.ResetExternalIdentity,
	)
	if err != nil {
		s.authFailure(w, err)
		return
	}
	user, err := s.auth.UpdateUser(request.Context(), request.PathValue("userId"), auth.UserUpdate{
		Access: access, Disabled: input.Disabled, ResetExternalIdentity: input.ResetExternalIdentity,
	})
	if err != nil {
		s.authFailure(w, err)
		return
	}
	s.logger.Info("account updated",
		"administrator_id", administrator.UserID,
	)
	writeJSON(w, http.StatusOK, user)
}

func (s *Server) canonicalUpdatedAccess(
	ctx context.Context,
	userID string,
	requested auth.Access,
	disabled bool,
	resetExternalIdentity bool,
) (auth.Access, error) {
	requestedRole := strings.TrimSpace(requested.Role)
	if (requestedRole == "" || requestedRole == auth.RoleUser) &&
		!requested.AllOrganizations && len(requested.OrganizationIDs) == 0 {
		users := s.auth.Users()
		index := slices.IndexFunc(users, func(user auth.UserView) bool { return user.ID == userID })
		if index < 0 {
			return auth.Access{}, auth.ErrNotFound
		}
		current := users[index]
		if current.Role == auth.RoleUser && !current.AllOrganizations && len(current.OrganizationIDs) == 0 &&
			(current.Disabled != disabled || resetExternalIdentity) {
			return auth.Access{Role: auth.RoleUser, OrganizationIDs: []string{}}, nil
		}
	}
	return s.canonicalAccess(ctx, requested)
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
			_, err := s.getAuthorizedTopology(request, topologyID)
			if err != nil {
				s.fail(w, err)
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

func (s *Server) currentAdministrator(w http.ResponseWriter, request *http.Request) (auth.Principal, bool) {
	session, authenticated := s.sessionFromRequest(request)
	if !authenticated {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return auth.Principal{}, false
	}
	if !session.Principal.IsAdmin() {
		writeError(w, http.StatusForbidden, "administrator access required")
		return auth.Principal{}, false
	}
	return session.Principal, true
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

func (s *Server) availableOrganizations(ctx context.Context, principal auth.Principal) ([]store.Organization, error) {
	organizations, err := s.store.ListOrganizations(ctx)
	if err != nil {
		return nil, err
	}
	if principal.IsAdmin() || principal.AllOrganizations {
		return organizations, nil
	}
	allowed := principal.OrganizationIDs
	if principal.IsGuest() {
		allowed = []string{s.auth.GuestOrganizationID()}
	}
	organizations = slices.DeleteFunc(organizations, func(organization store.Organization) bool {
		return !slices.Contains(allowed, organization.ID)
	})
	return organizations, nil
}

func (s *Server) canonicalAccess(ctx context.Context, requested auth.Access) (auth.Access, error) {
	if requested.Role == "" {
		requested.Role = auth.RoleUser
	}
	if requested.Role != auth.RoleAdmin && requested.Role != auth.RoleUser {
		return auth.Access{}, errors.New("auth: application role is invalid")
	}
	if requested.Role == auth.RoleAdmin {
		if !requested.AllOrganizations || len(requested.OrganizationIDs) != 0 {
			return auth.Access{}, errors.New("auth: administrators must use all-organization access without explicit grants")
		}
		return auth.Access{Role: auth.RoleAdmin, AllOrganizations: true, OrganizationIDs: []string{}}, nil
	}
	if requested.AllOrganizations {
		if len(requested.OrganizationIDs) != 0 {
			return auth.Access{}, errors.New("auth: all-organization access cannot include explicit grants")
		}
		return auth.Access{Role: auth.RoleUser, AllOrganizations: true, OrganizationIDs: []string{}}, nil
	}
	if len(requested.OrganizationIDs) == 0 {
		return auth.Access{}, errors.New("auth: select one or more existing organizations")
	}
	available, err := s.store.ListOrganizations(ctx)
	if err != nil {
		return auth.Access{}, err
	}
	canonical := make([]string, 0, len(requested.OrganizationIDs))
	seen := map[string]struct{}{}
	for _, organizationID := range requested.OrganizationIDs {
		organizationID = strings.TrimSpace(organizationID)
		index := slices.IndexFunc(available, func(candidate store.Organization) bool { return candidate.ID == organizationID })
		if index < 0 {
			return auth.Access{}, errors.New("auth: select one or more existing organizations")
		}
		if _, exists := seen[organizationID]; exists {
			continue
		}
		seen[organizationID] = struct{}{}
		canonical = append(canonical, organizationID)
	}
	slices.Sort(canonical)
	return auth.Access{Role: auth.RoleUser, OrganizationIDs: canonical}, nil
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
