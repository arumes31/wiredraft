package model

import (
	"errors"
	"math"
	"strings"
)

// Validate checks a room's identity, labels and canvas bounds.
func (r Room) Validate() error {
	if !idPattern.MatchString(r.ID) {
		return errors.New("room id must be a version 4 uuid")
	}
	if strings.TrimSpace(r.Name) == "" || len(r.Name) > 120 || len(r.Building) > 120 || len(r.Floor) > 120 {
		return errors.New("room labels must not exceed 120 characters and name is required")
	}
	if !colorPattern.MatchString(r.Color) {
		return errors.New("room color must be a six-digit hex color")
	}
	for _, value := range []float64{r.PositionX, r.PositionY, r.Width, r.Height} {
		if math.IsNaN(value) || math.IsInf(value, 0) || math.Abs(value) > 1e7 {
			return errors.New("room geometry must be finite and within canvas limits")
		}
	}
	if r.Width < 600 || r.Height < 300 {
		return errors.New("room must be at least 600 by 300 canvas units")
	}
	return nil
}
