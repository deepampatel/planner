package model

type HeatmapCell struct {
	SlotStart         string  `json:"slotStart"`
	SlotEnd           string  `json:"slotEnd"`
	FreeCount         int     `json:"freeCount"`
	MaybeCount        int     `json:"maybeCount"`
	TotalParticipants int     `json:"totalParticipants"`
	Score             float64 `json:"score"`
}

type BestSlot struct {
	Start             string   `json:"start"`
	End               string   `json:"end"`
	Score             float64  `json:"score"`
	FreeParticipants  []string `json:"freeParticipants"`
	MaybeParticipants []string `json:"maybeParticipants"`
}

type HeatmapResponse struct {
	Cells    []HeatmapCell `json:"cells"`
	BestSlot *BestSlot     `json:"bestSlot,omitempty"`
}
