package auth

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"image/png"
	"strings"
	"time"

	"github.com/pquerna/otp/totp"
)

const (
	totpPeriod        = int64(30)
	recoveryCodeCount = 10
)

func newEnrollment(username string) (string, Enrollment, error) {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "WireDraft",
		AccountName: username,
		Period:      uint(totpPeriod),
		SecretSize:  20,
	})
	if err != nil {
		return "", Enrollment{}, fmt.Errorf("generating totp enrollment: %w", err)
	}
	image, err := key.Image(256, 256)
	if err != nil {
		return "", Enrollment{}, fmt.Errorf("rendering totp qr code: %w", err)
	}
	var buffer bytes.Buffer
	if err := png.Encode(&buffer, image); err != nil {
		return "", Enrollment{}, fmt.Errorf("encoding totp qr code: %w", err)
	}
	secret := normalizeTOTPSecret(key.Secret())
	return secret, Enrollment{
		QRCodeDataURL: "data:image/png;base64," + base64.StdEncoding.EncodeToString(buffer.Bytes()),
		ManualCode:    secret,
		ProvisionURI:  key.URL(),
	}, nil
}

func normalizeTOTPSecret(value string) string {
	return strings.ToUpper(strings.NewReplacer(" ", "", "-", "").Replace(strings.TrimSpace(value)))
}

func validateTOTPSecret(value string) (string, error) {
	secret := normalizeTOTPSecret(value)
	decoded, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(secret)
	if err != nil || len(decoded) < 10 {
		return "", errors.New("auth: totp secret must be valid base32 with at least 80 bits")
	}
	return secret, nil
}

func verifyTOTP(secret, code string, now time.Time, lastStep uint64) (uint64, bool, error) {
	code = strings.TrimSpace(code)
	if len(code) != 6 {
		return 0, false, nil
	}
	for _, character := range code {
		if character < '0' || character > '9' {
			return 0, false, nil
		}
	}
	current := now.Unix() / totpPeriod
	for _, offset := range []int64{-1, 0, 1} {
		step := current + offset
		if step < 0 || uint64(step) <= lastStep {
			continue
		}
		generated, err := totp.GenerateCode(secret, time.Unix(step*totpPeriod, 0))
		if err != nil {
			return 0, false, fmt.Errorf("generating totp verification code: %w", err)
		}
		if subtle.ConstantTimeCompare([]byte(generated), []byte(code)) == 1 {
			return uint64(step), true, nil
		}
	}
	return 0, false, nil
}

func newRecoveryCodes() ([]string, []string, error) {
	codes := make([]string, recoveryCodeCount)
	hashes := make([]string, recoveryCodeCount)
	for index := range codes {
		random := make([]byte, 10)
		if _, err := rand.Read(random); err != nil {
			return nil, nil, fmt.Errorf("generating recovery code: %w", err)
		}
		raw := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(random)
		codes[index] = strings.Join([]string{raw[:4], raw[4:8], raw[8:12], raw[12:]}, "-")
		digest := sha256.Sum256([]byte(raw))
		hashes[index] = hex.EncodeToString(digest[:])
	}
	return codes, hashes, nil
}

func recoveryCodeIndex(hashes []string, code string) int {
	raw := strings.ToUpper(strings.NewReplacer(" ", "", "-", "").Replace(strings.TrimSpace(code)))
	if len(raw) != 16 {
		return -1
	}
	digest := sha256.Sum256([]byte(raw))
	for index, encoded := range hashes {
		expected, err := hex.DecodeString(encoded)
		if err == nil && len(expected) == len(digest) && subtle.ConstantTimeCompare(expected, digest[:]) == 1 {
			return index
		}
	}
	return -1
}
