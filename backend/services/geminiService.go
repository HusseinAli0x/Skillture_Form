package services

import (
	"context"
	"fmt"

	"skillture/backend/internal/config"

	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/genai"
)

type GeminiService struct {
	pool *pgxpool.Pool
	cfg  config.GeminiConfig
}

func NewGeminiService(pool *pgxpool.Pool, cfg config.GeminiConfig) *GeminiService {
	return &GeminiService{pool: pool, cfg: cfg}
}

func (s *GeminiService) GenerateReport(ctx context.Context) (string, error) {
	if !s.cfg.Enabled() {
		return "", fmt.Errorf("GEMINI_API_KEY is not set")
	}

	// 1. Gather database stats.
	// These errors were previously discarded, so a missing table or a failed
	// query silently produced zeroes and the model was handed — and the admin
	// was shown — fabricated statistics.
	var totalForms, totalQuizzes, totalResponses, totalSessions int
	stats := []struct {
		query string
		dest  *int
	}{
		{"SELECT count(*) FROM forms", &totalForms},
		{"SELECT count(*) FROM quizzes", &totalQuizzes},
		{"SELECT count(*) FROM responses", &totalResponses},
		{"SELECT count(*) FROM quiz_sessions", &totalSessions},
	}
	for _, stat := range stats {
		if err := s.pool.QueryRow(ctx, stat.query).Scan(stat.dest); err != nil {
			return "", fmt.Errorf("gather stats (%s): %w", stat.query, err)
		}
	}

	// Build the prompt
	prompt := fmt.Sprintf(`You are the AI Database Analyst for the Skillture platform.
Here are the current database statistics:
- Total Forms: %d
- Total Form Responses: %d
- Total Quizzes: %d
- Total Quiz Sessions: %d

Based on these numbers, provide a short, engaging, markdown-formatted report for the Admin Dashboard.
Include insights, trends (you can simulate trends based on these raw numbers if they are low or high), and recommendations for how they can improve engagement. Keep it concise, professional but energetic, and maximum 3-4 paragraphs. Use bullet points for recommendations.`,
		totalForms, totalResponses, totalQuizzes, totalSessions)

	client, err := genai.NewClient(ctx, &genai.ClientConfig{APIKey: s.cfg.APIKey})
	if err != nil {
		return "", fmt.Errorf("failed to create gemini client: %w", err)
	}

	resp, err := client.Models.GenerateContent(ctx, s.cfg.Model, genai.Text(prompt), nil)
	if err != nil {
		return "", fmt.Errorf("failed to generate content: %w", err)
	}

	// A candidate blocked by a safety filter or truncated at MAX_TOKENS has a
	// nil Content, so this must be checked before reaching for Parts.
	for _, candidate := range resp.Candidates {
		if candidate == nil || candidate.Content == nil {
			continue
		}
		for _, part := range candidate.Content.Parts {
			if part != nil && part.Text != "" {
				return part.Text, nil
			}
		}
	}

	return "", fmt.Errorf("no content returned from gemini")
}
