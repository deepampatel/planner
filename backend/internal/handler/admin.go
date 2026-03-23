package handler

import (
	"database/sql"
	"net/http"
	"strconv"
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
		return false
	}
	auth := r.Header.Get("Authorization")
	return strings.TrimPrefix(auth, "Bearer ") == h.adminToken
}

// --- Stats endpoint ---

type AdminStats struct {
	TotalPlans             int     `json:"totalPlans"`
	ActivePlans            int     `json:"activePlans"`
	LockedPlans            int     `json:"lockedPlans"`
	ExpiredPlans           int     `json:"expiredPlans"`
	PlansToday             int     `json:"plansToday"`
	PlansThisWeek          int     `json:"plansThisWeek"`
	TotalParticipants      int     `json:"totalParticipants"`
	AvgParticipantsPerPlan float64 `json:"avgParticipantsPerPlan"`
	ResponseRate           float64 `json:"responseRate"`
	TotalUsers             int     `json:"totalUsers"`
	TotalAvailabilityMarks int     `json:"totalAvailabilityMarks"`
	CompletionRate         float64 `json:"completionRate"`
	DailyPlans             []DayCount `json:"dailyPlans"`
	DailyParticipants      []DayCount `json:"dailyParticipants"`
}

type DayCount struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

func (h *AdminHandler) Stats(w http.ResponseWriter, r *http.Request) {
	if !h.authenticate(r) {
		respondError(w, http.StatusUnauthorized, "invalid admin token")
		return
	}

	var stats AdminStats

	h.db.QueryRow("SELECT COUNT(*) FROM plans").Scan(&stats.TotalPlans)
	h.db.QueryRow("SELECT COUNT(*) FROM plans WHERE status = 'active'").Scan(&stats.ActivePlans)
	h.db.QueryRow("SELECT COUNT(*) FROM plans WHERE status = 'locked'").Scan(&stats.LockedPlans)
	h.db.QueryRow("SELECT COUNT(*) FROM plans WHERE status = 'expired'").Scan(&stats.ExpiredPlans)
	h.db.QueryRow("SELECT COUNT(*) FROM plans WHERE created_at >= datetime('now', '-1 day')").Scan(&stats.PlansToday)
	h.db.QueryRow("SELECT COUNT(*) FROM plans WHERE created_at >= datetime('now', '-7 days')").Scan(&stats.PlansThisWeek)
	h.db.QueryRow("SELECT COUNT(*) FROM participants").Scan(&stats.TotalParticipants)
	h.db.QueryRow("SELECT COUNT(*) FROM users").Scan(&stats.TotalUsers)
	h.db.QueryRow("SELECT COUNT(*) FROM availability").Scan(&stats.TotalAvailabilityMarks)

	if stats.TotalPlans > 0 {
		stats.AvgParticipantsPerPlan = float64(stats.TotalParticipants) / float64(stats.TotalPlans)
	}

	var responded int
	h.db.QueryRow("SELECT COUNT(*) FROM participants WHERE has_responded = 1").Scan(&responded)
	if stats.TotalParticipants > 0 {
		stats.ResponseRate = float64(responded) / float64(stats.TotalParticipants)
	}
	if stats.LockedPlans+stats.ExpiredPlans > 0 {
		stats.CompletionRate = float64(stats.LockedPlans) / float64(stats.LockedPlans+stats.ExpiredPlans)
	}

	// Daily plans for last 30 days
	stats.DailyPlans = h.dailyCounts("SELECT date(created_at) as d, COUNT(*) FROM plans WHERE created_at >= datetime('now', '-30 days') GROUP BY d ORDER BY d")
	stats.DailyParticipants = h.dailyCounts("SELECT date(created_at) as d, COUNT(*) FROM participants WHERE created_at >= datetime('now', '-30 days') GROUP BY d ORDER BY d")

	respondJSON(w, http.StatusOK, stats)
}

func (h *AdminHandler) dailyCounts(query string) []DayCount {
	rows, err := h.db.Query(query)
	if err != nil {
		return []DayCount{}
	}
	defer rows.Close()
	var counts []DayCount
	for rows.Next() {
		var dc DayCount
		rows.Scan(&dc.Date, &dc.Count)
		counts = append(counts, dc)
	}
	if counts == nil {
		counts = []DayCount{}
	}
	return counts
}

// --- Plans browser ---

type AdminPlan struct {
	Slug             string `json:"slug"`
	Title            string `json:"title"`
	Status           string `json:"status"`
	Granularity      string `json:"granularity"`
	Location         string `json:"location"`
	ParticipantCount int    `json:"participantCount"`
	RespondedCount   int    `json:"respondedCount"`
	CreatedAt        string `json:"createdAt"`
}

func (h *AdminHandler) Plans(w http.ResponseWriter, r *http.Request) {
	if !h.authenticate(r) {
		respondError(w, http.StatusUnauthorized, "invalid admin token")
		return
	}

	status := r.URL.Query().Get("status")
	search := r.URL.Query().Get("q")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit := 25
	offset := (page - 1) * limit

	query := `
		SELECT p.slug, p.title, p.status, p.granularity, p.location,
			COUNT(pt.id) as participant_count,
			SUM(CASE WHEN pt.has_responded = 1 THEN 1 ELSE 0 END) as responded_count,
			p.created_at
		FROM plans p
		LEFT JOIN participants pt ON pt.plan_id = p.id
		WHERE 1=1
	`
	args := []interface{}{}

	if status != "" {
		query += " AND p.status = ?"
		args = append(args, status)
	}
	if search != "" {
		query += " AND p.title LIKE ?"
		args = append(args, "%"+search+"%")
	}

	query += " GROUP BY p.id ORDER BY p.created_at DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := h.db.Query(query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var plans []AdminPlan
	for rows.Next() {
		var p AdminPlan
		rows.Scan(&p.Slug, &p.Title, &p.Status, &p.Granularity, &p.Location,
			&p.ParticipantCount, &p.RespondedCount, &p.CreatedAt)
		plans = append(plans, p)
	}
	if plans == nil {
		plans = []AdminPlan{}
	}

	// Total count for pagination
	countQuery := "SELECT COUNT(*) FROM plans WHERE 1=1"
	countArgs := []interface{}{}
	if status != "" {
		countQuery += " AND status = ?"
		countArgs = append(countArgs, status)
	}
	if search != "" {
		countQuery += " AND title LIKE ?"
		countArgs = append(countArgs, "%"+search+"%")
	}
	var total int
	h.db.QueryRow(countQuery, countArgs...).Scan(&total)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"plans": plans,
		"total": total,
		"page":  page,
		"pages": (total + limit - 1) / limit,
	})
}

// --- Global activity feed ---

func (h *AdminHandler) Activity(w http.ResponseWriter, r *http.Request) {
	if !h.authenticate(r) {
		respondError(w, http.StatusUnauthorized, "invalid admin token")
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 50
	}

	rows, err := h.db.Query(`
		SELECT a.id, a.actor_name, a.action, a.details, a.created_at, p.title, p.slug
		FROM audit_logs a
		JOIN plans p ON p.id = a.plan_id
		ORDER BY a.created_at DESC
		LIMIT ?
	`, limit)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	type ActivityEntry struct {
		ID        int    `json:"id"`
		Actor     string `json:"actor"`
		Action    string `json:"action"`
		Details   string `json:"details"`
		CreatedAt string `json:"createdAt"`
		PlanTitle string `json:"planTitle"`
		PlanSlug  string `json:"planSlug"`
	}

	var entries []ActivityEntry
	for rows.Next() {
		var e ActivityEntry
		rows.Scan(&e.ID, &e.Actor, &e.Action, &e.Details, &e.CreatedAt, &e.PlanTitle, &e.PlanSlug)
		entries = append(entries, e)
	}
	if entries == nil {
		entries = []ActivityEntry{}
	}

	respondJSON(w, http.StatusOK, entries)
}
