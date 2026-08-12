package handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"wiredraft/internal/auth"
	"wiredraft/internal/store"
)

type organizationMutationRequest struct {
	Name string `json:"name"`
}

type organizationView struct {
	store.Organization
	MapCount  int  `json:"mapCount"`
	UserCount int  `json:"userCount"`
	Protected bool `json:"protected"`
}

func (s *Server) listOrganizations(w http.ResponseWriter, request *http.Request) {
	organizations, err := s.organizationViews(request.Context())
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"organizations": organizations})
}

func (s *Server) createOrganization(w http.ResponseWriter, request *http.Request) {
	s.directoryMu.Lock()
	defer s.directoryMu.Unlock()
	administrator, authorized := s.currentAdministrator(w, request)
	if !authorized {
		return
	}

	var input organizationMutationRequest
	if err := decodeJSON(w, request, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid organization request")
		return
	}
	organization, err := s.store.CreateOrganization(request.Context(), input.Name)
	if err != nil {
		s.organizationFailure(w, err)
		return
	}
	if err := s.auth.RegisterOrganization(auth.OrganizationRef{ID: organization.ID, Name: organization.Name}); err != nil {
		s.fail(w, err)
		return
	}
	s.logger.Info(
		"organization created",
		"administrator_id", administrator.UserID,
		"organization_id", organization.ID,
	)
	view, err := s.organizationView(request.Context(), organization)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, view)
}

func (s *Server) updateOrganization(w http.ResponseWriter, request *http.Request) {
	s.directoryMu.Lock()
	defer s.directoryMu.Unlock()
	administrator, authorized := s.currentAdministrator(w, request)
	if !authorized {
		return
	}

	if s.auth.GuestEnabled() && request.PathValue("organizationId") == s.auth.GuestOrganizationID() {
		writeError(w, http.StatusForbidden, "disable Guest access before renaming its organization")
		return
	}
	var input organizationMutationRequest
	if err := decodeJSON(w, request, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid organization request")
		return
	}
	organization, err := s.store.RenameOrganization(
		request.Context(), request.PathValue("organizationId"), input.Name,
	)
	if err != nil {
		s.organizationFailure(w, err)
		return
	}
	if err := s.auth.RegisterOrganization(auth.OrganizationRef{ID: organization.ID, Name: organization.Name}); err != nil {
		s.fail(w, err)
		return
	}
	s.logger.Info(
		"organization renamed",
		"administrator_id", administrator.UserID,
		"organization_id", organization.ID,
	)
	view, err := s.organizationView(request.Context(), organization)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, view)
}

func (s *Server) deleteOrganization(w http.ResponseWriter, request *http.Request) {
	s.directoryMu.Lock()
	defer s.directoryMu.Unlock()
	administrator, authorized := s.currentAdministrator(w, request)
	if !authorized {
		return
	}

	organizationID := request.PathValue("organizationId")
	if s.auth.GuestEnabled() && organizationID == s.auth.GuestOrganizationID() {
		writeError(w, http.StatusConflict, "disable Guest access before deleting its organization")
		return
	}
	err := s.store.DeleteOrganization(request.Context(), organizationID)
	if err != nil {
		// A previous attempt may have deleted the registry row before auth-state
		// persistence failed. Retrying still removes the now-stale grants.
		if errors.Is(err, store.ErrNotFound) {
			if cleanupErr := s.auth.RemoveOrganizationAssignments(request.Context(), organizationID); cleanupErr != nil {
				s.fail(w, cleanupErr)
				return
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}
		s.organizationFailure(w, err)
		return
	}
	if err := s.auth.RemoveOrganizationAssignments(request.Context(), organizationID); err != nil {
		s.fail(w, err)
		return
	}
	s.logger.Info(
		"organization deleted",
		"administrator_id", administrator.UserID,
		"organization_id", organizationID,
	)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) organizationViews(ctx context.Context) ([]organizationView, error) {
	organizations, err := s.store.ListOrganizations(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]organizationView, 0, len(organizations))
	for _, organization := range organizations {
		view, err := s.organizationView(ctx, organization)
		if err != nil {
			return nil, err
		}
		views = append(views, view)
	}
	return views, nil
}

func (s *Server) organizationView(ctx context.Context, organization store.Organization) (organizationView, error) {
	view := organizationView{
		Organization: organization,
		Protected:    organization.IsDefault || s.auth.GuestEnabled() && organization.ID == s.auth.GuestOrganizationID(),
	}
	summaries, err := s.store.List(ctx)
	if err != nil {
		return organizationView{}, err
	}
	for _, summary := range summaries {
		if summary.OrganizationID == organization.ID {
			view.MapCount++
		}
	}
	for _, user := range s.auth.Users() {
		if user.Role == auth.RoleAdmin || user.AllOrganizations || slices.Contains(user.OrganizationIDs, organization.ID) {
			view.UserCount++
		}
	}
	return view, nil
}

func (s *Server) organizationFailure(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrProtectedOrganization):
		writeError(w, http.StatusForbidden, "the Default organization cannot be changed")
	case errors.Is(err, store.ErrOrganizationInUse):
		writeError(w, http.StatusConflict, "organization still contains maps")
	default:
		s.fail(w, err)
	}
}

func (s *Server) resolveOrganization(
	ctx context.Context,
	organizationID string,
	organizationName string,
	useDefault bool,
) (store.Organization, error) {
	organizationID = strings.TrimSpace(organizationID)
	organizationName = strings.TrimSpace(organizationName)
	if organizationID == "" && organizationName == "" && useDefault {
		organizationName = "Default"
	}
	var (
		organization store.Organization
		err          error
	)
	switch {
	case organizationID != "":
		organization, err = s.store.GetOrganization(ctx, organizationID)
	case organizationName != "":
		organization, err = s.store.FindOrganizationByName(ctx, organizationName)
	default:
		return store.Organization{}, fmt.Errorf("%w: organization is required", store.ErrInvalid)
	}
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return store.Organization{}, fmt.Errorf("%w: organization does not exist", store.ErrInvalid)
		}
		return store.Organization{}, err
	}
	return organization, nil
}
