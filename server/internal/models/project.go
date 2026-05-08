package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Discipline string

const (
	DisciplineArt        Discipline = "Art"
	DisciplineDesign     Discipline = "Design"
	DisciplineCode       Discipline = "Code"
	DisciplineProduction Discipline = "Production"
	DisciplineCustom     Discipline = "Custom"
)

type EstimateUnit string

const (
	UnitHalfDay EstimateUnit = "half_day"
	UnitDay     EstimateUnit = "day"
	UnitWeek    EstimateUnit = "week"
	UnitMonth   EstimateUnit = "month"
)

var WorkingDays = map[EstimateUnit]float64{
	UnitHalfDay: 0.5,
	UnitDay:     1,
	UnitWeek:    5,
	UnitMonth:   20,
}

type Position struct {
	X float64 `bson:"x" json:"x"`
	Y float64 `bson:"y" json:"y"`
}

type Estimate struct {
	Value float64      `bson:"value" json:"value"`
	Unit  EstimateUnit `bson:"unit"  json:"unit"`
}

type PostIt struct {
	ID                primitive.ObjectID `bson:"_id"                          json:"id"`
	FeatureID         primitive.ObjectID `bson:"feature_id"                   json:"featureId"`
	Discipline        Discipline         `bson:"discipline"                   json:"discipline"`
	Color             string             `bson:"color"                        json:"color"`
	Position          Position           `bson:"position"                     json:"position"`
	Width             float64            `bson:"width"                        json:"width"`
	Height            float64            `bson:"height"                       json:"height"`
	TaskLabel         string             `bson:"task_label"                   json:"taskLabel"`
	Estimate          Estimate           `bson:"estimate"                     json:"estimate"`
	PlantasticIssueID string             `bson:"plantastic_issue_id,omitempty" json:"plantasticIssueId,omitempty"`
	UpdatedAt         time.Time          `bson:"updated_at"                   json:"updatedAt"`
	UpdatedBy         string             `bson:"updated_by"                   json:"updatedBy"`
}

type Feature struct {
	ID               primitive.ObjectID `bson:"_id"                          json:"id"`
	ProjectID        primitive.ObjectID `bson:"project_id"                   json:"projectId"`
	Name             string             `bson:"name"                         json:"name"`
	Position         Position           `bson:"position"                     json:"position"`
	Width            float64            `bson:"width"                        json:"width"`
	Height           float64            `bson:"height"                       json:"height"`
	Color            string             `bson:"color"                        json:"color"`
	PostIts          []PostIt           `bson:"postits"                      json:"postits"`
	PlantasticEpicID string             `bson:"plantastic_epic_id,omitempty" json:"plantasticEpicId,omitempty"`
	UpdatedAt        time.Time          `bson:"updated_at"                   json:"updatedAt"`
}

type CalendarMode string

const (
	CalendarActual   CalendarMode = "actual"
	CalendarFourWeek CalendarMode = "four-week"
)

type MilestoneType string

const (
	MilestoneFeatureDerived MilestoneType = "feature-derived"
	MilestoneManual         MilestoneType = "manual"
)

type Milestone struct {
	ID              primitive.ObjectID  `bson:"_id"                            json:"id"`
	ProjectID       primitive.ObjectID  `bson:"project_id"                     json:"projectId"`
	Label           string              `bson:"label"                          json:"label"`
	Type            MilestoneType       `bson:"type"                           json:"type"`
	FeatureID       *primitive.ObjectID `bson:"feature_id,omitempty"           json:"featureId,omitempty"`
	Date            *time.Time          `bson:"date,omitempty"                 json:"date,omitempty"`
	AnchorFeatureID *primitive.ObjectID `bson:"anchor_feature_id,omitempty"    json:"anchorFeatureId,omitempty"`
	UpdatedAt       time.Time           `bson:"updated_at"                     json:"updatedAt"`
}

type Resource struct {
	ID               primitive.ObjectID `bson:"_id"                             json:"id"`
	ProjectID        primitive.ObjectID `bson:"project_id"                      json:"projectId"`
	Name             string             `bson:"name"                            json:"name"`
	Role             Discipline         `bson:"role"                            json:"role"`
	RollOnDate       time.Time          `bson:"roll_on_date"                    json:"rollOnDate"`
	RollOffDate      time.Time          `bson:"roll_off_date"                   json:"rollOffDate"`
	AllocationPct    float64            `bson:"allocation_pct"                  json:"allocationPct"`
	DailyRate        float64            `bson:"daily_rate"                      json:"dailyRate"`
	Currency         string             `bson:"currency"                        json:"currency"`
	Notes            string             `bson:"notes"                           json:"notes"`
	PlantasticUserID string             `bson:"plantastic_user_id,omitempty"    json:"plantasticUserId,omitempty"`
	UpdatedAt        time.Time          `bson:"updated_at"                      json:"updatedAt"`
}

type Project struct {
	ID                  primitive.ObjectID `bson:"_id"                              json:"id"`
	Name                string             `bson:"name"                             json:"name"`
	Owner               string             `bson:"owner"                            json:"owner"` // Google email
	ContingencyPct      float64            `bson:"contingency_pct"                  json:"contingencyPct"`
	CalendarMode        CalendarMode       `bson:"calendar_mode"                    json:"calendarMode"`
	Features            []Feature          `bson:"features"                         json:"features"`
	Resources           []Resource         `bson:"resources"                        json:"resources"`
	Milestones          []Milestone        `bson:"milestones"                       json:"milestones"`
	PlantasticProjectID string             `bson:"plantastic_project_id,omitempty"  json:"plantasticProjectId,omitempty"`
	CreatedAt           time.Time          `bson:"created_at"                       json:"createdAt"`
	UpdatedAt           time.Time          `bson:"updated_at"                       json:"updatedAt"`
}
