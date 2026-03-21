package model

import "encoding/json"

type PlanStatus string

const (
	PlanStatusActive  PlanStatus = "active"
	PlanStatusLocked  PlanStatus = "locked"
	PlanStatusExpired PlanStatus = "expired"
)

type Granularity string

const (
	GranularityTime    Granularity = "time"
	GranularityDay     Granularity = "day"
	GranularityOptions Granularity = "options"
)

// CustomOption represents a single votable option in an options-mode plan.
type CustomOption struct {
	Label       string `json:"label"`
	Description string `json:"description,omitempty"`
}

type Plan struct {
	ID               int64            `json:"id"`
	Slug             string           `json:"slug"`
	CustomSlug       *string          `json:"customSlug,omitempty"`
	Title            string           `json:"title"`
	Location         string           `json:"location"`
	DateRangeStart   string           `json:"dateRangeStart"`
	DateRangeEnd     string           `json:"dateRangeEnd"`
	DurationMinutes  int              `json:"durationMinutes"`
	Granularity      string           `json:"granularity"`
	Status           PlanStatus       `json:"status"`
	Timezone         string           `json:"timezone"`
	CustomOptions    json.RawMessage  `json:"customOptions,omitempty"`
	ParticipantCount int              `json:"participantCount"`
	Participants     []Participant    `json:"participants"`
	MyParticipantID  *int64           `json:"myParticipantId,omitempty"`
	CreatedAt        string           `json:"createdAt"`
	UpdatedAt        string           `json:"updatedAt"`
	ExpiresAt        string           `json:"expiresAt"`
}

type CreatePlanInput struct {
	Title           string          `json:"title"`
	Location        string          `json:"location"`
	DateRangeStart  string          `json:"dateRangeStart"`
	DateRangeEnd    string          `json:"dateRangeEnd"`
	DurationMinutes int             `json:"durationMinutes"`
	Granularity     string          `json:"granularity"`
	Timezone        string          `json:"timezone"`
	CustomSlug      string          `json:"customSlug,omitempty"`
	HostName        string          `json:"hostName"`
	CustomOptions   json.RawMessage `json:"customOptions,omitempty"`
}

type PlanWithTokens struct {
	Plan      Plan   `json:"plan"`
	HostToken string `json:"hostToken"`
	EditToken string `json:"editToken"`
}
