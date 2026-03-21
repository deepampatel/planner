package service

import (
	"context"
	"errors"

	gonanoid "github.com/matoous/go-nanoid/v2"

	"github.com/deepampatel/planfast/internal/repository"
)

type SlugGenerator struct {
	alphabet string
	length   int
}

func NewSlugGenerator() *SlugGenerator {
	return &SlugGenerator{
		alphabet: "0123456789abcdefghijklmnopqrstuvwxyz",
		length:   8,
	}
}

func (g *SlugGenerator) Generate(ctx context.Context, repo *repository.PlanRepository) (string, error) {
	for attempt := 0; attempt < 10; attempt++ {
		slug, err := gonanoid.Generate(g.alphabet, g.length)
		if err != nil {
			return "", err
		}

		exists, err := repo.SlugExists(ctx, slug)
		if err != nil {
			return "", err
		}
		if !exists {
			return slug, nil
		}
	}
	return "", errors.New("failed to generate unique slug after 10 attempts")
}

func GenerateToken() string {
	token, _ := gonanoid.Generate("0123456789abcdefghijklmnopqrstuvwxyz", 32)
	return token
}
