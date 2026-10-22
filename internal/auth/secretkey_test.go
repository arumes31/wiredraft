package auth

import (
	"bytes"
	"encoding/base64"
	"encoding/hex"
	"testing"
)

func TestParseSecretKey(t *testing.T) {
	t.Parallel()
	key := bytes.Repeat([]byte{0x5a}, 32)
	for _, encoded := range []string{
		base64.StdEncoding.EncodeToString(key) + "\n",
		base64.RawURLEncoding.EncodeToString(key),
		hex.EncodeToString(key),
	} {
		parsed, err := ParseSecretKey(encoded)
		if err != nil || !bytes.Equal(parsed, key) {
			t.Fatalf("ParseSecretKey(%q) = %x, %v", encoded, parsed, err)
		}
	}
	for _, invalid := range []string{"", "short", base64.StdEncoding.EncodeToString(key[:16])} {
		if _, err := ParseSecretKey(invalid); err == nil {
			t.Fatalf("ParseSecretKey(%q) succeeded", invalid)
		}
	}
}

func TestApplyExternalSecretKeyMigratesAndRotates(t *testing.T) {
	t.Parallel()
	storedKey := bytes.Repeat([]byte{1}, 32)
	externalKey := bytes.Repeat([]byte{2}, 32)
	rotatedKey := bytes.Repeat([]byte{3}, 32)
	const secret = "JBSWY3DPEHPK3PXP" // #nosec G101 -- public RFC-compatible test fixture.
	sealed, err := sealSecret(storedKey, secret)
	if err != nil {
		t.Fatal(err)
	}
	state := persistentState{Users: []persistedUser{{ID: "user", EncryptedTOTPSecret: sealed}, {ID: "no-totp"}}}

	// Without an external key the database-stored key remains in use.
	key, changed, err := applyExternalSecretKey(&state, storedKey, nil, nil)
	if err != nil || changed || !bytes.Equal(key, storedKey) {
		t.Fatalf("no external key = %x, %v, %v", key, changed, err)
	}

	key, changed, err = applyExternalSecretKey(&state, storedKey, externalKey, nil)
	if err != nil || !changed || !bytes.Equal(key, externalKey) || !state.ExternalSecretKey {
		t.Fatalf("migration = %x, %v, %v", key, changed, err)
	}
	if opened, err := openSecret(externalKey, state.Users[0].EncryptedTOTPSecret); err != nil || opened != secret {
		t.Fatalf("migrated secret = %q, %v", opened, err)
	}
	if _, err := openSecret(storedKey, state.Users[0].EncryptedTOTPSecret); err == nil {
		t.Fatal("migrated secret still opens with the database-stored key")
	}

	// A filler column value must not be needed once the state is external.
	filler := bytes.Repeat([]byte{9}, 32)
	if _, changed, err := applyExternalSecretKey(&state, filler, externalKey, nil); err != nil || changed {
		t.Fatalf("stable external key = %v, %v", changed, err)
	}
	if _, _, err := applyExternalSecretKey(&state, filler, nil, nil); err == nil {
		t.Fatal("external state opened without the external key")
	}
	if _, _, err := applyExternalSecretKey(&state, filler, rotatedKey, nil); err == nil {
		t.Fatal("rotation without the previous key succeeded")
	}
	key, changed, err = applyExternalSecretKey(&state, filler, rotatedKey, [][]byte{externalKey})
	if err != nil || !changed || !bytes.Equal(key, rotatedKey) {
		t.Fatalf("rotation = %x, %v, %v", key, changed, err)
	}
	if opened, err := openSecret(rotatedKey, state.Users[0].EncryptedTOTPSecret); err != nil || opened != secret {
		t.Fatalf("rotated secret = %q, %v", opened, err)
	}
}
