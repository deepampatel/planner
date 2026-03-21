package model

type AvailabilityStatus string

const (
	AvailabilityFree  AvailabilityStatus = "free"
	AvailabilityMaybe AvailabilityStatus = "maybe"
)

type Participant struct {
	ID           int64              `json:"id"`
	PlanID       int64              `json:"planId"`
	DisplayName  string             `json:"displayName"`
	Email        string             `json:"email,omitempty"`
	Timezone     string             `json:"timezone"`
	HasResponded bool               `json:"hasResponded"`
	Availability []AvailabilitySlot `json:"availability"`
	CreatedAt    string             `json:"createdAt"`
}

type AvailabilitySlot struct {
	SlotStart string `json:"slotStart"`
	SlotEnd   string `json:"slotEnd"`
	Status    string `json:"status"`
}

type AvailabilityUpdate struct {
	SlotStart string `json:"slotStart"`
	SlotEnd   string `json:"slotEnd"`
	Status    string `json:"status"` // "free", "maybe", or "clear" (clear = delete)
}

type JoinPlanInput struct {
	DisplayName string `json:"displayName"`
	Email       string `json:"email"`
	Timezone    string `json:"timezone"`
}

type JoinPlanResult struct {
	Participant Participant `json:"participant"`
	EditToken   string      `json:"editToken"`
}
