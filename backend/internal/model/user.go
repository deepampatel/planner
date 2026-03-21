package model

type User struct {
	ID          int64  `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"displayName"`
	AvatarURL   string `json:"avatarUrl"`
	Provider    string `json:"provider"`
	ProviderID  string `json:"-"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

type AuthResponse struct {
	User      User   `json:"user"`
	EditToken string `json:"editToken,omitempty"`
}
