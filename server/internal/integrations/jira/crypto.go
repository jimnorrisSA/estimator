package jira

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
)

// EncryptToken encrypts plaintext using AES-256-GCM.
// key must be exactly 32 bytes.
// Returns hex(nonce) + hex(ciphertext) — the first 24 hex chars are always the nonce.
func EncryptToken(plaintext string, key []byte) (string, error) {
	if len(key) != 32 {
		return "", fmt.Errorf("encryption key must be 32 bytes, got %d", len(key))
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize()) // 12 bytes for GCM
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}

	ciphertext := gcm.Seal(nil, nonce, []byte(plaintext), nil)

	return hex.EncodeToString(nonce) + hex.EncodeToString(ciphertext), nil
}

// DecryptToken reverses EncryptToken.
// ciphertext must be hex(nonce) + hex(ciphertext) as produced by EncryptToken.
func DecryptToken(encoded string, key []byte) (string, error) {
	if len(key) != 32 {
		return "", fmt.Errorf("encryption key must be 32 bytes, got %d", len(key))
	}

	// Nonce is 12 bytes → 24 hex chars.
	const nonceHexLen = 24
	if len(encoded) < nonceHexLen {
		return "", errors.New("encoded token too short")
	}

	nonce, err := hex.DecodeString(encoded[:nonceHexLen])
	if err != nil {
		return "", fmt.Errorf("decode nonce: %w", err)
	}

	ciphertextBytes, err := hex.DecodeString(encoded[nonceHexLen:])
	if err != nil {
		return "", fmt.Errorf("decode ciphertext: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create GCM: %w", err)
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertextBytes, nil)
	if err != nil {
		return "", fmt.Errorf("decrypt: %w", err)
	}

	return string(plaintext), nil
}
