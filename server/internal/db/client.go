package db

import (
	"context"
	"reflect"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/bsontype"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Connect opens a MongoDB client. We configure the BSON registry to decode
// embedded documents into bson.M (map) rather than bson.D (ordered slice), so
// that interface{} fields round-trip correctly through encoding/json.
func Connect(ctx context.Context, uri string) (*mongo.Client, error) {
	reg := bson.NewRegistryBuilder().
		RegisterTypeMapEntry(bsontype.EmbeddedDocument, reflect.TypeOf(bson.M{})).
		RegisterTypeMapEntry(bsontype.Array, reflect.TypeOf(bson.A{})).
		Build()

	opts := options.Client().
		ApplyURI(uri).
		SetRegistry(reg)

	client, err := mongo.Connect(ctx, opts)
	if err != nil {
		return nil, err
	}
	if err := client.Ping(ctx, nil); err != nil {
		return nil, err
	}
	return client, nil
}

