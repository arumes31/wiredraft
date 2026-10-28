// Package media stores uploaded topology photos in a confined filesystem root.
package media

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path"
	"regexp"
)

const (
	// MaxPhotoSize is the maximum accepted size of one uploaded photo.
	MaxPhotoSize   = 10 << 20
	maxPhotoPixels = 50_000_000
)

// ErrInvalidPhoto indicates that uploaded bytes fail photo safety validation.
var ErrInvalidPhoto = errors.New("media: invalid photo")

// StoredPhoto reports validated media details after a file is persisted.
type StoredPhoto struct {
	MediaType string
	SizeBytes int64
}

// Store confines all file operations beneath one dedicated media directory.
type Store struct {
	root *os.Root
}

// Open creates and opens a media directory with private-by-default permissions.
func Open(directory string) (*Store, error) {
	if err := os.MkdirAll(directory, 0o750); err != nil {
		return nil, fmt.Errorf("creating media directory: %w", err)
	}
	root, err := os.OpenRoot(directory)
	if err != nil {
		return nil, fmt.Errorf("opening media directory: %w", err)
	}
	return &Store{root: root}, nil
}

// Close releases the directory root.
func (s *Store) Close() error {
	return s.root.Close()
}

// Save validates and stores a JPEG or PNG under the supplied random UUID stem.
func (s *Store) Save(topologyID, id string, source io.Reader) (stored StoredPhoto, returnErr error) {
	prefix := make([]byte, 512)
	prefixBytes, err := io.ReadFull(source, prefix)
	if err != nil && !errors.Is(err, io.EOF) && !errors.Is(err, io.ErrUnexpectedEOF) {
		return StoredPhoto{}, fmt.Errorf("reading photo header: %w", err)
	}
	prefix = prefix[:prefixBytes]
	mediaType := http.DetectContentType(prefix)
	extension, ok := extensionForMediaType(mediaType)
	if !ok {
		return StoredPhoto{}, fmt.Errorf("%w: only JPEG and PNG files are accepted", ErrInvalidPhoto)
	}
	if err := s.root.MkdirAll(topologyID, 0o750); err != nil {
		return StoredPhoto{}, fmt.Errorf("creating topology media directory: %w", err)
	}
	name := topologyID + "/" + id + extension
	file, err := s.root.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return StoredPhoto{}, fmt.Errorf("creating photo: %w", err)
	}
	closed := false
	defer func() {
		if !closed {
			if closeErr := file.Close(); closeErr != nil && returnErr == nil {
				returnErr = fmt.Errorf("closing photo: %w", closeErr)
			}
		}
		if returnErr != nil {
			_ = s.root.Remove(name)
		}
	}()

	written, err := io.Copy(file, io.MultiReader(
		bytes.NewReader(prefix),
		io.LimitReader(source, MaxPhotoSize-int64(len(prefix))+1),
	))
	if err != nil {
		return StoredPhoto{}, fmt.Errorf("writing photo: %w", err)
	}
	if written > MaxPhotoSize {
		return StoredPhoto{}, fmt.Errorf("%w: photo exceeds 10 MiB", ErrInvalidPhoto)
	}
	if err := file.Sync(); err != nil {
		return StoredPhoto{}, fmt.Errorf("synchronizing photo: %w", err)
	}
	if err := file.Close(); err != nil {
		return StoredPhoto{}, fmt.Errorf("closing photo: %w", err)
	}
	closed = true

	if err := s.validateImage(name); err != nil {
		return StoredPhoto{}, err
	}
	return StoredPhoto{MediaType: mediaType, SizeBytes: written}, nil
}

// OpenPhoto opens one persisted photo after deriving its extension from trusted metadata.
func (s *Store) OpenPhoto(topologyID, id, mediaType string) (*os.File, error) {
	extension, ok := extensionForMediaType(mediaType)
	if !ok {
		return nil, fmt.Errorf("%w: unsupported stored media type", ErrInvalidPhoto)
	}
	file, err := s.root.Open(topologyID + "/" + id + extension)
	if err != nil {
		return nil, fmt.Errorf("opening photo: %w", err)
	}
	return file, nil
}

// Remove deletes one photo. Missing files are already considered removed.
func (s *Store) Remove(topologyID, id, mediaType string) error {
	extension, ok := extensionForMediaType(mediaType)
	if !ok {
		return fmt.Errorf("%w: unsupported stored media type", ErrInvalidPhoto)
	}
	if err := s.root.Remove(topologyID + "/" + id + extension); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("removing photo: %w", err)
	}
	return nil
}

// RemoveTopology removes every media file belonging to one topology.
func (s *Store) RemoveTopology(topologyID string) error {
	if err := s.root.RemoveAll(topologyID); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("removing topology media: %w", err)
	}
	return nil
}

func (s *Store) validateImage(name string) (returnErr error) {
	file, err := s.root.Open(name)
	if err != nil {
		return fmt.Errorf("opening saved photo: %w", err)
	}
	defer func() {
		if closeErr := file.Close(); closeErr != nil && returnErr == nil {
			returnErr = fmt.Errorf("closing saved photo: %w", closeErr)
		}
	}()
	var configuration image.Config
	switch path.Ext(name) {
	case ".jpg":
		configuration, err = jpeg.DecodeConfig(file)
	case ".png":
		configuration, err = png.DecodeConfig(file)
	default:
		err = ErrInvalidPhoto
	}
	if err != nil || configuration.Width < 1 || configuration.Height < 1 {
		return fmt.Errorf("%w: image data cannot be decoded", ErrInvalidPhoto)
	}
	if configuration.Width > maxPhotoPixels/configuration.Height {
		return fmt.Errorf("%w: image dimensions exceed 50 megapixels", ErrInvalidPhoto)
	}
	return nil
}

func extensionForMediaType(mediaType string) (string, bool) {
	switch mediaType {
	case "image/jpeg":
		return ".jpg", true
	case "image/png":
		return ".png", true
	default:
		return "", false
	}
}

// Reference names one stored photo that Sweep must keep.
type Reference struct {
	TopologyID string
	PhotoID    string
	MediaType  string
}

var topologyDirectoryPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

// Sweep removes photo files and topology directories that no reference names.
// Uploads write files before the authorizing commit, so a crash in between, or
// a failed removal, leaves files no document points to. Only topology-shaped
// directories are considered; anything else in the media root is left alone.
// Call it only with the complete reference set and while no uploads run.
func (s *Store) Sweep(references []Reference) (int, error) {
	keep := make(map[string]map[string]struct{})
	for _, reference := range references {
		extension, ok := extensionForMediaType(reference.MediaType)
		if !ok {
			continue
		}
		if keep[reference.TopologyID] == nil {
			keep[reference.TopologyID] = make(map[string]struct{})
		}
		keep[reference.TopologyID][reference.PhotoID+extension] = struct{}{}
	}
	entries, err := fs.ReadDir(s.root.FS(), ".")
	if err != nil {
		return 0, fmt.Errorf("listing media directory: %w", err)
	}
	removed := 0
	for _, entry := range entries {
		name := entry.Name()
		if !entry.IsDir() || !topologyDirectoryPattern.MatchString(name) {
			continue
		}
		files, referenced := keep[name]
		if !referenced {
			if err := s.root.RemoveAll(name); err != nil {
				return removed, fmt.Errorf("removing orphaned topology media: %w", err)
			}
			removed++
			continue
		}
		children, err := fs.ReadDir(s.root.FS(), name)
		if err != nil {
			return removed, fmt.Errorf("listing topology media: %w", err)
		}
		for _, child := range children {
			if child.IsDir() {
				continue
			}
			if _, ok := files[child.Name()]; ok {
				continue
			}
			if err := s.root.Remove(name + "/" + child.Name()); err != nil && !errors.Is(err, os.ErrNotExist) {
				return removed, fmt.Errorf("removing orphaned photo: %w", err)
			}
			removed++
		}
	}
	return removed, nil
}
