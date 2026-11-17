package handlers

import (
	"net/http/httptest"
	"testing"
)

func TestClientIPTrustBoundary(t *testing.T) {
	h := &AuthHandler{}
	h.ConfigureTrustedProxies([]string{"127.0.0.1/32", "10.1.0.2/32", "::1/128"})
	for _, tc := range []struct{ name, remote, xff, real, want string }{
		{"direct spoof", "203.0.113.8:1234", "198.51.100.1", "198.51.100.2", "203.0.113.8"},
		{"trusted proxy", "127.0.0.1:1234", "203.0.113.8", "", "203.0.113.8"},
		{"spoof prepended", "127.0.0.1:1234", "198.51.100.1, 203.0.113.8", "", "203.0.113.8"},
		{"proxy chain", "127.0.0.1:1234", "203.0.113.8, 10.1.0.2", "", "203.0.113.8"},
		{"malformed chain", "127.0.0.1:1234", "bad", "198.51.100.1", "127.0.0.1"},
		{"ipv6", "[::1]:1234", "2001:db8::3", "", "2001:db8::3"},
		{"real ip", "127.0.0.1:1234", "", "203.0.113.8", "203.0.113.8"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/", nil)
			r.RemoteAddr = tc.remote
			r.Header.Set("X-Forwarded-For", tc.xff)
			r.Header.Set("X-Real-IP", tc.real)
			if got := h.clientIP(r); got != tc.want {
				t.Fatalf("got %q, want %q", got, tc.want)
			}
		})
	}
	h.ConfigureTrustedProxies(nil)
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "127.0.0.1:1234"
	r.Header.Set("X-Forwarded-For", "198.51.100.1")
	if got := h.clientIP(r); got != "127.0.0.1" {
		t.Fatalf("empty trust list accepted spoof: %q", got)
	}
}
