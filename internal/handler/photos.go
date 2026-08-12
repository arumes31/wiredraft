package handler

import (
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path"
	"slices"
	"strings"
	"time"
	"unicode"

	"wiredraft/internal/media"
	"wiredraft/internal/model"
	"wiredraft/internal/store"
)

const (
	maxPhotosPerUpload  = 12
	maxPhotoRequestSize = maxPhotosPerUpload*(media.MaxPhotoSize+1024) + 1<<20
)

func (s *Server) uploadPhotos(w http.ResponseWriter, request *http.Request) {
	if s.media == nil {
		writeError(w, http.StatusServiceUnavailable, "photo storage is unavailable")
		return
	}
	request.Body = http.MaxBytesReader(w, request.Body, maxPhotoRequestSize)
	reader, err := request.MultipartReader()
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid photo upload")
		return
	}
	topologyID := request.PathValue("id")
	var targetKind model.PhotoTargetKind
	var targetID string
	photos := make([]model.Photo, 0, maxPhotosPerUpload)
	removeSaved := func() {
		for _, photo := range photos {
			if err := s.media.Remove(topologyID, photo.ID, photo.MediaType); err != nil {
				s.logger.Error("rolling back photo upload", "topology_id", topologyID, "photo_id", photo.ID, "error", err)
			}
		}
	}
	for {
		part, partErr := reader.NextPart()
		if errors.Is(partErr, io.EOF) {
			break
		}
		if partErr != nil {
			removeSaved()
			var tooLarge *http.MaxBytesError
			if errors.As(partErr, &tooLarge) {
				writeError(w, http.StatusRequestEntityTooLarge, "photo upload is too large")
				return
			}
			writeError(w, http.StatusBadRequest, "invalid photo upload")
			return
		}
		if part.FileName() == "" {
			value, readErr := io.ReadAll(io.LimitReader(part, 1025))
			_ = part.Close()
			if readErr != nil || len(value) > 1024 {
				removeSaved()
				writeError(w, http.StatusBadRequest, "invalid photo upload field")
				return
			}
			switch part.FormName() {
			case "targetKind":
				targetKind = model.PhotoTargetKind(strings.TrimSpace(string(value)))
			case "targetId":
				targetID = strings.TrimSpace(string(value))
			}
			continue
		}
		if part.FormName() != "photos" {
			_ = part.Close()
			continue
		}
		if len(photos) >= maxPhotosPerUpload {
			_ = part.Close()
			removeSaved()
			writeError(w, http.StatusBadRequest, "select between 1 and 12 photos")
			return
		}
		originalName, err := safePhotoName(part.FileName())
		if err != nil {
			_ = part.Close()
			removeSaved()
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		id, err := model.NewID()
		if err != nil {
			_ = part.Close()
			removeSaved()
			s.fail(w, err)
			return
		}
		stored, saveErr := s.media.Save(topologyID, id, part)
		closeErr := part.Close()
		if saveErr != nil {
			removeSaved()
			if errors.Is(saveErr, media.ErrInvalidPhoto) {
				writeError(w, http.StatusBadRequest, strings.TrimPrefix(saveErr.Error(), "media: invalid photo: "))
				return
			}
			s.fail(w, saveErr)
			return
		}
		if closeErr != nil {
			_ = s.media.Remove(topologyID, id, stored.MediaType)
			removeSaved()
			s.fail(w, fmt.Errorf("closing uploaded photo: %w", closeErr))
			return
		}
		photos = append(photos, model.Photo{
			ID: id, OriginalName: originalName,
			MediaType: stored.MediaType, SizeBytes: stored.SizeBytes, CreatedAt: time.Now().UTC(),
		})
	}
	if len(photos) == 0 {
		writeError(w, http.StatusBadRequest, "select between 1 and 12 photos")
		return
	}
	if targetKind == model.PhotoTargetTopology {
		targetID = topologyID
	}
	for index := range photos {
		photos[index].TargetKind = targetKind
		photos[index].TargetID = targetID
	}

	updated, err := s.mutate(request, topologyID, func(topology *model.Topology) error {
		if !photoTargetExists(*topology, targetKind, targetID) {
			return fmt.Errorf("%w: photo target does not exist", store.ErrInvalid)
		}
		topology.Photos = append(topology.Photos, photos...)
		return nil
	})
	if err != nil {
		removeSaved()
		s.fail(w, err)
		return
	}
	s.publish(topologyID, "photos_uploaded", updated)
	writeJSON(w, http.StatusCreated, updated)
}

func photoTargetExists(topology model.Topology, kind model.PhotoTargetKind, id string) bool {
	switch kind {
	case model.PhotoTargetTopology:
		return id == topology.ID
	case model.PhotoTargetRack:
		return slices.ContainsFunc(topology.Racks, func(rack model.Rack) bool { return rack.ID == id })
	case model.PhotoTargetDevice:
		return slices.ContainsFunc(topology.Devices, func(device model.Device) bool { return device.ID == id })
	case model.PhotoTargetPort:
		return slices.ContainsFunc(topology.Devices, func(device model.Device) bool {
			return slices.ContainsFunc(device.Ports, func(port model.Port) bool { return port.ID == id })
		})
	case model.PhotoTargetLink:
		return slices.ContainsFunc(topology.Links, func(link model.Link) bool { return link.ID == id })
	case model.PhotoTargetAnnotation:
		return slices.ContainsFunc(topology.Annotations, func(annotation model.Annotation) bool { return annotation.ID == id })
	default:
		return false
	}
}

func (s *Server) getPhoto(w http.ResponseWriter, request *http.Request) {
	if s.media == nil {
		writeError(w, http.StatusServiceUnavailable, "photo storage is unavailable")
		return
	}
	topologyID := request.PathValue("id")
	topology, err := s.getAuthorizedTopology(request, topologyID)
	if err != nil {
		s.fail(w, err)
		return
	}
	photoIndex := slices.IndexFunc(topology.Photos, func(photo model.Photo) bool {
		return photo.ID == request.PathValue("photoId")
	})
	if photoIndex < 0 {
		s.fail(w, store.ErrNotFound)
		return
	}
	photo := topology.Photos[photoIndex]
	file, err := s.media.OpenPhoto(topologyID, photo.ID, photo.MediaType)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			s.fail(w, store.ErrNotFound)
			return
		}
		s.fail(w, err)
		return
	}
	defer func() {
		if closeErr := file.Close(); closeErr != nil {
			s.logger.Warn("closing served photo", "topology_id", topologyID, "photo_id", photo.ID, "error", closeErr)
		}
	}()
	info, err := file.Stat()
	if err != nil {
		s.fail(w, fmt.Errorf("reading photo metadata: %w", err))
		return
	}
	w.Header().Set("Content-Type", photo.MediaType)
	w.Header().Set("Content-Disposition", mime.FormatMediaType("inline", map[string]string{"filename": photo.OriginalName}))
	w.Header().Set("Cache-Control", "private, max-age=300")
	http.ServeContent(w, request, photo.OriginalName, info.ModTime(), file)
}

type updatePhotoRequest struct {
	OriginalName string `json:"originalName"`
	Caption      string `json:"caption"`
}

func (s *Server) updatePhoto(w http.ResponseWriter, request *http.Request) {
	var input updatePhotoRequest
	if err := decodeJSON(w, request, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid photo details")
		return
	}
	name, err := safePhotoName(input.OriginalName)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	id := request.PathValue("id")
	photoID := request.PathValue("photoId")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		index := slices.IndexFunc(topology.Photos, func(photo model.Photo) bool { return photo.ID == photoID })
		if index < 0 {
			return store.ErrNotFound
		}
		topology.Photos[index].OriginalName = name
		topology.Photos[index].Caption = strings.TrimSpace(input.Caption)
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "photo_updated", updated)
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) deletePhoto(w http.ResponseWriter, request *http.Request) {
	id := request.PathValue("id")
	photoID := request.PathValue("photoId")
	updated, err := s.mutate(request, id, func(topology *model.Topology) error {
		index := slices.IndexFunc(topology.Photos, func(photo model.Photo) bool { return photo.ID == photoID })
		if index < 0 {
			return store.ErrNotFound
		}
		topology.Photos = slices.Delete(topology.Photos, index, index+1)
		return nil
	})
	if err != nil {
		s.fail(w, err)
		return
	}
	s.publish(id, "photo_deleted", updated)
	writeJSON(w, http.StatusOK, updated)
}

func safePhotoName(value string) (string, error) {
	value = path.Base(strings.ReplaceAll(strings.TrimSpace(value), "\\", "/"))
	value = strings.Map(func(character rune) rune {
		if unicode.IsControl(character) {
			return -1
		}
		return character
	}, value)
	if value == "" || value == "." || len(value) > 255 {
		return "", errors.New("photo filename must contain 1 to 255 characters")
	}
	return value, nil
}
