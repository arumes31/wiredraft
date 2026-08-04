package auth

import "testing"

func TestHashPasswordRoundTrip(t *testing.T) {
	t.Parallel()
	encoded, err := hashPassword("correct horse battery staple")
	if err != nil {
		t.Fatal(err)
	}
	matched, err := comparePassword(encoded, "correct horse battery staple")
	if err != nil {
		t.Fatal(err)
	}
	if !matched {
		t.Fatal("matching password was rejected")
	}
	matched, err = comparePassword(encoded, "incorrect password")
	if err != nil {
		t.Fatal(err)
	}
	if matched {
		t.Fatal("incorrect password was accepted")
	}
}

func TestParsePasswordHashRejectsUnboundedParameters(t *testing.T) {
	t.Parallel()
	encoded := "$argon2id$v=19$m=4294967295,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2g"
	if _, _, _, err := parsePasswordHash(encoded); err == nil {
		t.Fatal("unbounded memory parameter was accepted")
	}
}
