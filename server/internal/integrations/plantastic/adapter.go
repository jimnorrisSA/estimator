// Plantastic integration adapter — built against a stub until the live API is available.
// See spec §7.3 for entity mapping.
package plantastic

import (
	"errors"

	"github.com/soulassembly/estimator/internal/models"
)

type Config struct {
	BaseURL string
	APIKey  string
}

func Push(_ *models.Project, _ Config) error {
	return errors.New("plantastic adapter not yet implemented")
}

func Pull(_ string, _ Config) (*models.Project, error) {
	return nil, errors.New("plantastic adapter not yet implemented")
}
