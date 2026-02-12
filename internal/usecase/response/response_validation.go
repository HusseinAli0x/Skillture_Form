package response

import (
	"Skillture_Form/internal/domain/entities"
	"Skillture_Form/internal/domain/enums"
	domainErr "Skillture_Form/internal/domain/errors"
)

// validateSubmit validates high-level submit rules
func validateSubmit(
	form *entities.Form,
	fields []*entities.FormField,
	response *entities.Response,
	answers []*entities.ResponseAnswer,
) error {

	if form == nil {
		return domainErr.ErrNotFound
	}

	if form.Status != enums.FormStatusPublished {
		return domainErr.ErrFormNotPublished
	}

	if len(fields) == 0 {
		return domainErr.ErrInvalidInput
	}

	required := map[string]bool{}
	for _, f := range fields {
		if f.Required {
			required[f.ID.String()] = true
		}
	}

	for _, a := range answers {
		delete(required, a.FieldID.String())
	}

	if len(required) > 0 {
		return domainErr.ErrMissingRequiredField
	}

	return nil
}
