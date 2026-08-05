package services

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/genai"
)

type GeminiService struct {
	pool *pgxpool.Pool
}

func NewGeminiService(pool *pgxpool.Pool) *GeminiService {
	return &GeminiService{pool: pool}
}

func (s *GeminiService) GenerateReport(ctx context.Context) (string, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("GEMINI_API_KEY is not set")
	}

	// 1. Gather database stats
	var totalForms, totalQuizzes, totalResponses, totalSessions int
	s.pool.QueryRow(ctx, "SELECT count(*) FROM forms").Scan(&totalForms)
	s.pool.QueryRow(ctx, "SELECT count(*) FROM quizzes").Scan(&totalQuizzes)
	s.pool.QueryRow(ctx, "SELECT count(*) FROM responses").Scan(&totalResponses)
	s.pool.QueryRow(ctx, "SELECT count(*) FROM quiz_sessions").Scan(&totalSessions)

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

	client, err := genai.NewClient(ctx, &genai.ClientConfig{APIKey: apiKey})
	if err != nil {
		return "", fmt.Errorf("failed to create gemini client: %w", err)
	}

	resp, err := client.Models.GenerateContent(ctx, "gemini-2.5-flash", genai.Text(prompt), nil)
	if err != nil {
		return "", fmt.Errorf("failed to generate content: %w", err)
	}

	if len(resp.Candidates) > 0 && len(resp.Candidates[0].Content.Parts) > 0 {
		part := resp.Candidates[0].Content.Parts[0]
		if part.Text != "" {
			return part.Text, nil
		}
	}

	return "", fmt.Errorf("no content returned from gemini")
}
