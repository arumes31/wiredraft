package model

import (
	"errors"
	"math"
	"strings"
)

// Validate checks a room's identity, labels, canvas bounds and optional spacing.
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
	if !validCanvasCoordinates(r.PositionX, r.PositionY, r.Width, r.Height) {
		return errors.New("room geometry must be finite and within canvas limits")
	}
	if r.Width < 600 || r.Height < 300 {
		return errors.New("room must be at least 600 by 300 canvas units")
	}
	for _, value := range []float64{r.Padding, r.EquipmentGap} {
		invalid := math.IsNaN(value) || math.IsInf(value, 0)
		outOfRange := value != 0 && (value < 10 || value > 2000)
		if invalid || outOfRange {
			return errors.New("room spacing must be zero for defaults or between 10 and 2000 canvas units")
		}
	}
	if r.EquipmentGap != 0 && r.EquipmentGap < 90 {
		return errors.New("room equipment gap must be at least 90 canvas units")
	}
	return nil
}
