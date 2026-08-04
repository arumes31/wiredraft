package store

import (
	"errors"
	"testing"
)

func TestRevisionConflictError(t *testing.T) {
	t.Parallel()
	err := &RevisionConflictError{Expected: 4, Actual: 6}
	if err.Error() != "store: topology revision conflict" {
		t.Fatalf("Error() = %q", err.Error())
	}
	if !errors.Is(err, ErrConflict) {
		t.Fatal("RevisionConflictError must unwrap to ErrConflict")
	}
}
