package repository

import "errors"

// ---------- Errors ----------

var (
	// ErrNotFound returned when no record is found
	ErrNotFound = errors.New("repository: not found")
	// ErrConflict returned on unique constraint violations
	ErrConflict = errors.New("repository: conflict")
	// ErrInvalidInput returned when input data is invalid
	ErrInvalidInput = errors.New("repository: invalid input")
)

// ---------- Pagination ----------

// type Pagination struct {
// 	Limit  int
// 	Offset int
// }
// Normalize ensures safe defaults
// func (p *Pagination) Normalize() {
// 	if p.Limit <= 0 || p.Limit > 100 {
// 		p.Limit = 20
// 	}
// 	if p.Offset < 0 {
// 		p.Offset = 0
// 	}
// }

// ---------- List Options ----------
// ListOptions provides common options for list queries
// type ListOptions struct {
// 	Pagination *Pagination
// }

// ---------- Sorting ----------

type SortOrder string

const (
	SortAsc  SortOrder = "ASC"
	SortDesc SortOrder = "DESC"
)
