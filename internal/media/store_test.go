package media

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"io"
	"os"
	"path/filepath"
	"testing"
)

const testTopologyID = "10000000-0000-4000-8000-000000000001"
const testPhotoID = "20000000-0000-4000-8000-000000000002"

func TestStoreSaveOpenAndRemove(t *testing.T) {
	t.Parallel()
	mediaStore, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = mediaStore.Close() })
	data := validPNG(t)
	stored, err := mediaStore.Save(testTopologyID, testPhotoID, bytes.NewReader(data))
	if err != nil {
		t.Fatalf("Save() error = %v", err)
	}
	if stored.MediaType != "image/png" || stored.SizeBytes != int64(len(data)) {
		t.Fatalf("stored photo = %#v", stored)
	}
	file, err := mediaStore.OpenPhoto(testTopologyID, testPhotoID, stored.MediaType)
	if err != nil {
		t.Fatalf("OpenPhoto() error = %v", err)
	}
	opened, err := io.ReadAll(file)
	closeErr := file.Close()
	if err != nil || closeErr != nil || !bytes.Equal(opened, data) {
		t.Fatalf("opened photo differs: read=%v close=%v", err, closeErr)
	}
	if err := mediaStore.Remove(testTopologyID, testPhotoID, stored.MediaType); err != nil {
		t.Fatalf("Remove() error = %v", err)
	}
	if _, err := mediaStore.OpenPhoto(testTopologyID, testPhotoID, stored.MediaType); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("OpenPhoto() after remove error = %v, want os.ErrNotExist", err)
	}
	jpegID := "30000000-0000-4000-8000-000000000003"
	jpegData := validJPEG(t)
	jpegPhoto, err := mediaStore.Save(testTopologyID, jpegID, bytes.NewReader(jpegData))
	if err != nil || jpegPhoto.MediaType != "image/jpeg" {
		t.Fatalf("Save(JPEG) = %#v, %v", jpegPhoto, err)
	}
	if err := mediaStore.RemoveTopology(testTopologyID); err != nil {
		t.Fatalf("RemoveTopology() error = %v", err)
	}
	if _, err := mediaStore.OpenPhoto(testTopologyID, jpegID, jpegPhoto.MediaType); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("OpenPhoto() after topology removal error = %v, want os.ErrNotExist", err)
	}
}

func TestStoreRejectsInvalidAndEscapingFiles(t *testing.T) {
	t.Parallel()
	mediaStore, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = mediaStore.Close() })
	if _, err := mediaStore.Save(testTopologyID, testPhotoID, bytes.NewBufferString("not a photo")); !errors.Is(err, ErrInvalidPhoto) {
		t.Fatalf("Save(invalid) error = %v, want ErrInvalidPhoto", err)
	}
	if _, err := mediaStore.Save("../outside", testPhotoID, bytes.NewReader(validPNG(t))); err == nil {
		t.Fatal("Save() accepted an escaping topology directory")
	}
	if err := mediaStore.Remove(testTopologyID, testPhotoID, "image/gif"); !errors.Is(err, ErrInvalidPhoto) {
		t.Fatalf("Remove(unsupported) error = %v, want ErrInvalidPhoto", err)
	}
	oversized := append(validPNG(t), make([]byte, MaxPhotoSize)...)
	if _, err := mediaStore.Save(testTopologyID, testPhotoID, bytes.NewReader(oversized)); !errors.Is(err, ErrInvalidPhoto) {
		t.Fatalf("Save(oversized) error = %v, want ErrInvalidPhoto", err)
	}
}

func validPNG(t *testing.T) []byte {
	t.Helper()
	var output bytes.Buffer
	picture := image.NewRGBA(image.Rect(0, 0, 3, 2))
	picture.Set(1, 1, color.RGBA{R: 102, G: 237, B: 221, A: 255})
	if err := png.Encode(&output, picture); err != nil {
		t.Fatal(err)
	}
	return output.Bytes()
}

func validJPEG(t *testing.T) []byte {
	t.Helper()
	var output bytes.Buffer
	picture := image.NewRGBA(image.Rect(0, 0, 3, 2))
	picture.Set(1, 1, color.RGBA{R: 102, G: 237, B: 221, A: 255})
	if err := jpeg.Encode(&output, picture, nil); err != nil {
		t.Fatal(err)
	}
	return output.Bytes()
}

func TestSweepRemovesOnlyUnreferencedTopologyMedia(t *testing.T) {
	t.Parallel()
	directory := t.TempDir()
	store, err := Open(directory)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = store.Close() })
	const kept = "11111111-1111-4111-8111-111111111111"
	const orphanTopology = "22222222-2222-4222-8222-222222222222"
	files := map[string]string{
		kept + "/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png":           "keep",
		kept + "/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png":           "orphan photo",
		orphanTopology + "/cccccccc-cccc-4ccc-8ccc-cccccccccccc.jpg": "orphan topology",
		"lost+found/unrelated":                                       "not media",
	}
	for name, content := range files {
		path := filepath.Join(directory, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	removed, err := store.Sweep([]Reference{{TopologyID: kept, PhotoID: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", MediaType: "image/png"}})
	if err != nil {
		t.Fatal(err)
	}
	if removed != 2 {
		t.Fatalf("removed = %d, want 2", removed)
	}
	for name, wantExists := range map[string]bool{
		kept + "/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png": true,
		kept + "/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png": false,
		orphanTopology:         false,
		"lost+found/unrelated": true,
	} {
		_, statErr := os.Stat(filepath.Join(directory, filepath.FromSlash(name)))
		if exists := statErr == nil; exists != wantExists {
			t.Errorf("%s exists = %t, want %t", name, exists, wantExists)
		}
	}
}
