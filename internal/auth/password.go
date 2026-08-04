package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/crypto/argon2"
)

const (
	argonTime    = uint32(2)
	argonMemory  = uint32(19 * 1024)
	argonThreads = uint8(1)
	argonKeyLen  = uint32(32)
	argonSaltLen = 16
)

func hashPassword(password string) (string, error) {
	if err := validatePassword(password); err != nil {
		return "", err
	}
	salt := make([]byte, argonSaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generating password salt: %w", err)
	}
	hash := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	return fmt.Sprintf(
		"$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version,
		argonMemory,
		argonTime,
		argonThreads,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(hash),
	), nil
}

func comparePassword(encoded, password string) (bool, error) {
	parameters, salt, expected, err := parsePasswordHash(encoded)
	if err != nil {
		return false, err
	}
	// parsePasswordHash caps decoded hashes at 64 bytes before this conversion.
	keyLength := uint32(len(expected)) // #nosec G115 -- len(expected) is validated in the range 16..64.
	actual := argon2.IDKey(
		[]byte(password), salt, parameters.time, parameters.memory, parameters.threads, keyLength,
	)
	return subtle.ConstantTimeCompare(actual, expected) == 1, nil
}

type argonParameters struct {
	time    uint32
	memory  uint32
	threads uint8
}

func parsePasswordHash(encoded string) (argonParameters, []byte, []byte, error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return argonParameters{}, nil, nil, errors.New("auth: invalid password hash")
	}
	version, err := strconv.ParseUint(strings.TrimPrefix(parts[2], "v="), 10, 32)
	if err != nil || version != argon2.Version {
		return argonParameters{}, nil, nil, errors.New("auth: unsupported password hash version")
	}
	var parameters argonParameters
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &parameters.memory, &parameters.time, &parameters.threads); err != nil {
		return argonParameters{}, nil, nil, errors.New("auth: invalid password hash parameters")
	}
	if parameters.memory < 8*1024 || parameters.memory > 1024*1024 || parameters.time < 1 || parameters.time > 20 || parameters.threads < 1 || parameters.threads > 32 {
		return argonParameters{}, nil, nil, errors.New("auth: unsafe password hash parameters")
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil || len(salt) < 16 || len(salt) > 64 {
		return argonParameters{}, nil, nil, errors.New("auth: invalid password hash salt")
	}
	hash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil || len(hash) < 16 || len(hash) > 64 {
		return argonParameters{}, nil, nil, errors.New("auth: invalid password hash value")
	}
	return parameters, salt, hash, nil
}

func validatePassword(password string) error {
	if len(password) < 12 {
		return errors.New("auth: password must contain at least 12 characters")
	}
	if len(password) > 1024 {
		return errors.New("auth: password is too long")
	}
	return nil
}
