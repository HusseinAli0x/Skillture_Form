package enums

// FieldType represents the type of a form field
type FieldType int16

const (
	FieldTypeText FieldType = iota + 1
	FieldTypeTextarea
	FieldTypeNumber
	FieldTypeEmail
	FieldTypeSelect
	FieldTypeRadio
	FieldTypeCheckbox
	FieldTypeDate
)

// IsValid checks if the FieldType is allowed
func (f FieldType) IsValid() bool {
	switch f {
	case FieldTypeText,
		FieldTypeTextarea,
		FieldTypeNumber,
		FieldTypeEmail,
		FieldTypeSelect,
		FieldTypeRadio,
		FieldTypeCheckbox,
		FieldTypeDate:
		return true
	default:
		return false
	}
}
