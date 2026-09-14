package handler

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"wiredraft/internal/model"
	"wiredraft/internal/store"
)

// duplicateTopology copies a saved snapshot inside its existing organization.
// Child IDs are map-scoped; retaining them preserves all internal references.
func (s *Server) duplicateTopology(w http.ResponseWriter, request *http.Request) {
	var input struct {
		Name string `json:"name"`
	}
	if err := decodeJSON(w, request, &input); err != nil || strings.TrimSpace(input.Name) == "" {
		writeError(w, http.StatusBadRequest, "a copy name is required")
		return
	}
	expected, err := parseExpectedRevision(request.Header.Get("If-Match"))
	if err != nil || expected == 0 {
		writeError(w, http.StatusBadRequest, "the source revision is required")
		return
	}
	s.directoryMu.Lock()
	defer s.directoryMu.Unlock()
	source, err := s.getAuthorizedTopology(request, request.PathValue("id"))
	if err != nil {
		s.fail(w, err)
		return
	}
	if s.auth != nil {
		session, ok := s.sessionFromRequest(request)
		if !ok || !s.auth.CanCreateInOrganization(session.Principal, source.OrganizationID) {
			writeError(w, http.StatusForbidden, "organization access denied")
			return
		}
	}
	if source.Revision != expected {
		s.fail(w, &store.RevisionConflictError{Expected: expected, Actual: source.Revision})
		return
	}
	duplicate, err := source.Clone()
	if err != nil {
		s.fail(w, err)
		return
	}
	duplicate.ID, err = model.NewID()
	if err != nil {
		s.fail(w, err)
		return
	}
	duplicate.Name = strings.TrimSpace(input.Name)
	duplicate.Revision = 1
	duplicate.CreatedAt = time.Now().UTC()
	duplicate.UpdatedAt = duplicate.CreatedAt
	duplicate.ShareGrants = []model.ShareGrant{}
	for index := range duplicate.Photos {
		if duplicate.Photos[index].TargetKind == model.PhotoTargetTopology {
			duplicate.Photos[index].TargetID = duplicate.ID
		}
	}
	for index := range duplicate.DocumentationLinks {
		if duplicate.DocumentationLinks[index].TargetKind == model.DocumentationTargetTopology {
			duplicate.DocumentationLinks[index].TargetID = duplicate.ID
		}
	}
	if err := duplicate.Validate(); err != nil {
		s.fail(w, fmt.Errorf("%w: %w", store.ErrInvalid, err))
		return
	}
	if len(duplicate.Photos) > 0 && s.media == nil {
		writeError(w, http.StatusServiceUnavailable, "photo storage is unavailable")
		return
	}
	committed := false
	defer func() {
		if !committed && s.media != nil {
			if err := s.media.RemoveTopology(duplicate.ID); err != nil {
				s.logger.Error("removing incomplete map copy media", "topology_id", duplicate.ID, "error", err)
			}
		}
	}()
	for _, photo := range duplicate.Photos {
		if err := s.copyPhoto(source.ID, duplicate.ID, photo); err != nil {
			s.fail(w, err)
			return
		}
	}
	created, err := s.store.Create(request.Context(), duplicate)
	if err != nil {
		s.fail(w, err)
		return
	}
	committed = true
	writeJSON(w, http.StatusCreated, created)
}

func (s *Server) copyPhoto(sourceID, destinationID string, photo model.Photo) error {
	file, err := s.media.OpenPhoto(sourceID, photo.ID, photo.MediaType)
	if err != nil {
		return err
	}
	_, saveErr := s.media.Save(destinationID, photo.ID, file)
	closeErr := file.Close()
	if saveErr != nil {
		return saveErr
	}
	return closeErr
}
