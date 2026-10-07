package enums

// ModelName represents the AI embedding model used for generating embeddings
type ModelName string

const (
	// ModelTextEmbedding3Large: high-accuracy, professional embedding for smart search
	ModelTextEmbedding3Large ModelName = "text-embedding-3-large"

	// ModelTextEmbedding3Small: cheaper and faster, suitable for initial testing
	ModelTextEmbedding3Small ModelName = "text-embedding-3-small"

	// PlaceholderModel: can be defined later according to project needs
	PlaceholderModel ModelName = "placeholder"
)

// IsValid returns true if the ModelName is one of the allowed enum values
func (m ModelName) IsValid() bool {
	switch m {
	case ModelTextEmbedding3Large, ModelTextEmbedding3Small, PlaceholderModel, "":
		return true
	default:
		return false
	}
}
