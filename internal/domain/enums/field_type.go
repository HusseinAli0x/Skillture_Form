package enums

import (
	"encoding/json"
	"fmt"
	"strings"
)

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

// fieldTypeNames maps FieldType values to their string representations.
var fieldTypeNames = map[FieldType]string{
	FieldTypeText:     "text",
	FieldTypeTextarea: "textarea",
	FieldTypeNumber:   "number",
	FieldTypeEmail:    "email",
	FieldTypeSelect:   "select",
	FieldTypeRadio:    "radio",
	FieldTypeCheckbox: "checkbox",
	FieldTypeDate:     "date",
}

// fieldTypeValues maps string names back to FieldType values.
var fieldTypeValues = map[string]FieldType{
	"text":     FieldTypeText,
	"textarea": FieldTypeTextarea,
	"number":   FieldTypeNumber,
	"email":    FieldTypeEmail,
	"select":   FieldTypeSelect,
	"radio":    FieldTypeRadio,
	"checkbox": FieldTypeCheckbox,
	"date":     FieldTypeDate,
}

// String returns the string representation of a FieldType.
func (f FieldType) String() string {
	if name, ok := fieldTypeNames[f]; ok {
		return name
	}
	return fmt.Sprintf("unknown(%d)", f)
}

// MarshalJSON serializes FieldType as a JSON string (e.g., "text").
func (f FieldType) MarshalJSON() ([]byte, error) {
	if name, ok := fieldTypeNames[f]; ok {
		return json.Marshal(name)
	}
	return nil, fmt.Errorf("invalid FieldType: %d", f)
}

// UnmarshalJSON deserializes a JSON string (e.g., "text") into a FieldType.
func (f *FieldType) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	if ft, ok := fieldTypeValues[strings.ToLower(s)]; ok {
		*f = ft
		return nil
	}
	return fmt.Errorf("invalid FieldType string: %q", s)
}

// IsValid checks if the FieldType is allowed
func (f FieldType) IsValid() bool {
	_, ok := fieldTypeNames[f]
	return ok
}

// ParseFieldType converts a string like "text" to the corresponding FieldType.
// Returns 0 (invalid) if the string is not recognized.
func ParseFieldType(s string) FieldType {
	if ft, ok := fieldTypeValues[strings.ToLower(s)]; ok {
		return ft
	}
	return 0
}
