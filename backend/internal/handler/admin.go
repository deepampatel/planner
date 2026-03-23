package handler

import (
	"database/sql"
	"net/http"
	"strings"
)

type AdminHandler struct {
	db         *sql.DB
	adminToken string
}

func NewAdminHandler(db *sql.DB, adminToken string) *AdminHandler {
	return &AdminHandler{db: db, adminToken: adminToken}
}

func (h *AdminHandler) authenticate(r *http.Request) bool {
	if h.adminToken == "" {
		return false // No token configured = admin disabled
	}
	auth := r.Header.Get("Authorization")
	return strings.TrimPrefix(auth, "Bearer ") == h.adminToken
}

type AdminStats struct {
	// Plans
	TotalPlans   int `json:"totalPlans"`
	ActivePlans  int `json:"activePlans"`
	LockedPlans  int `json:"lockedPlans"`
	ExpiredPlans int `json:"expiredPlans"`
	PlansToday   int `json:"plansToday"`
	PlansThisWeek int `json:"plansThisWeek"`

	// Participants
	TotalParticipants      int     `json:"totalParticipants"`
	AvgParticipantsPerPlan float64 `json:"avgParticipantsPerPlan"`
	ResponseRate           float64 `json:"responseRate"` // hasResponded / total

	// Users (signed in)
	TotalUsers int `json:"totalUsers"`

	// Engagement
	TotalAvailabilityMarks int     `json:"totalAvailabilityMarks"`
	CompletionRate         float64 `json:"completionRate"` // locked / (locked + expired)

	// Recent plans (last 10)
	RecentPlans []RecentPlan `json:"recentPlans"`
}

type RecentPlan struct {
	Slug             string `json:"slug"`
	Title            string `json:"title"`
	Status           string `json:"status"`
	ParticipantCount int    `json:"participantCount"`
	CreatedAt        string `json:"createdAt"`
}

func (h *AdminHandler) Stats(w http.ResponseWriter, r *http.Request) {
	if !h.authenticate(r) {
		respondError(w, http.StatusUnauthorized, "invalid admin token")
		return
	}

	var stats AdminStats

	// Plan counts by status
	h.db.QueryRow("SELECT COUNT(*) FROM plans").Scan(&stats.TotalPlans)
	h.db.QueryRow("SELECT COUNT(*) FROM plans WHERE status = 'active'").Scan(&stats.ActivePlans)
	h.db.QueryRow("SELECT COUNT(*) FROM plans WHERE status = 'locked'").Scan(&stats.LockedPlans)
	h.db.QueryRow("SELECT COUNT(*) FROM plans WHERE status = 'expired'").Scan(&stats.ExpiredPlans)

	// Time-based
	h.db.QueryRow("SELECT COUNT(*) FROM plans WHERE created_at >= datetime('now', '-1 day')").Scan(&stats.PlansToday)
	h.db.QueryRow("SELECT COUNT(*) FROM plans WHERE created_at >= datetime('now', '-7 days')").Scan(&stats.PlansThisWeek)

	// Participants
	h.db.QueryRow("SELECT COUNT(*) FROM participants").Scan(&stats.TotalParticipants)
	if stats.TotalPlans > 0 {
		stats.AvgParticipantsPerPlan = float64(stats.TotalParticipants) / float64(stats.TotalPlans)
	}

	// Response rate
	var responded int
	h.db.QueryRow("SELECT COUNT(*) FROM participants WHERE has_responded = 1").Scan(&responded)
	if stats.TotalParticipants > 0 {
		stats.ResponseRate = float64(responded) / float64(stats.TotalParticipants)
	}

	// Users
	h.db.QueryRow("SELECT COUNT(*) FROM users").Scan(&stats.TotalUsers)

	// Availability marks
	h.db.QueryRow("SELECT COUNT(*) FROM availability").Scan(&stats.TotalAvailabilityMarks)

	// Completion rate
	if stats.LockedPlans+stats.ExpiredPlans > 0 {
		stats.CompletionRate = float64(stats.LockedPlans) / float64(stats.LockedPlans+stats.ExpiredPlans)
	}

	// Recent plans
	rows, err := h.db.Query(`
		SELECT p.slug, p.title, p.status, COUNT(pt.id) as participant_count, p.created_at
		FROM plans p
		LEFT JOIN participants pt ON pt.plan_id = p.id
		GROUP BY p.id
		ORDER BY p.created_at DESC
		LIMIT 20
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var rp RecentPlan
			rows.Scan(&rp.Slug, &rp.Title, &rp.Status, &rp.ParticipantCount, &rp.CreatedAt)
			stats.RecentPlans = append(stats.RecentPlans, rp)
		}
	}
	if stats.RecentPlans == nil {
		stats.RecentPlans = []RecentPlan{}
	}

	respondJSON(w, http.StatusOK, stats)
}
