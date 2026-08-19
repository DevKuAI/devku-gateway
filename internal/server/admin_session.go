package server

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v5"

	"github.com/enterpilot/gomodel/config"
	"github.com/enterpilot/gomodel/ext"
	"github.com/enterpilot/gomodel/internal/auditlog"
)

const (
	adminSessionCookieName = "gomodel_admin_session"
	adminSessionLifetime   = 24 * time.Hour
)

type adminSessionAuth struct {
	passwordDigest [sha256.Size]byte
	signingKey     [sha256.Size]byte
	cookiePath     string
	now            func() time.Time
}

type adminLoginRequest struct {
	Password string `json:"password"`
}

func newAdminSessionAuth(password, basePath string) *adminSessionAuth {
	if password == "" {
		return nil
	}
	return &adminSessionAuth{
		passwordDigest: sha256.Sum256([]byte(password)),
		signingKey:     sha256.Sum256([]byte("gomodel-admin-session\x00" + password)),
		cookiePath:     config.JoinBasePath(basePath, "/admin"),
		now:            time.Now,
	}
}

func (a *adminSessionAuth) Login(c *echo.Context) error {
	var request adminLoginRequest
	if err := c.Bind(&request); err != nil || !a.matchesPassword(request.Password) {
		return writeGatewayError(c, authenticationError(c, "invalid admin password"))
	}

	expires := a.now().Add(adminSessionLifetime)
	c.SetCookie(a.cookie(a.sign(expires), expires, int(adminSessionLifetime/time.Second), requestUsesHTTPS(c.Request())))
	return c.JSON(http.StatusOK, map[string]bool{"authenticated": true})
}

func (a *adminSessionAuth) Logout(c *echo.Context) error {
	expires := time.Unix(1, 0)
	cookie := a.cookie("", expires, -1, requestUsesHTTPS(c.Request()))
	c.SetCookie(cookie)
	return c.JSON(http.StatusOK, map[string]bool{"authenticated": false})
}

func (a *adminSessionAuth) Status(c *echo.Context) error {
	return c.JSON(http.StatusOK, map[string]bool{
		"authenticated": a.authenticated(c.Request()),
	})
}

func (a *adminSessionAuth) matchesPassword(password string) bool {
	digest := sha256.Sum256([]byte(password))
	return subtle.ConstantTimeCompare(digest[:], a.passwordDigest[:]) == 1
}

func (a *adminSessionAuth) authenticated(request *http.Request) bool {
	cookie, err := request.Cookie(adminSessionCookieName)
	if err != nil {
		return false
	}
	return a.verify(cookie.Value)
}

func (a *adminSessionAuth) Name() string {
	return auditlog.AuthMethodAdminSession
}

func (a *adminSessionAuth) AuthenticateRequest(_ context.Context, request *http.Request) (*ext.Authentication, error) {
	if request == nil || !strings.HasPrefix(request.URL.Path, "/admin/") || !a.authenticated(request) {
		return nil, nil
	}
	return &ext.Authentication{
		PrincipalID:     "admin",
		DashboardAccess: true,
		Method:          auditlog.AuthMethodAdminSession,
	}, nil
}

func (a *adminSessionAuth) sign(expires time.Time) string {
	payload := "v1:" + strconv.FormatInt(expires.Unix(), 10)
	mac := hmac.New(sha256.New, a.signingKey[:])
	_, _ = mac.Write([]byte(payload))
	return payload + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func (a *adminSessionAuth) verify(token string) bool {
	payload, signature, found := strings.Cut(token, ".")
	if !found || payload == "" || signature == "" {
		return false
	}
	provided, err := base64.RawURLEncoding.DecodeString(signature)
	if err != nil {
		return false
	}
	mac := hmac.New(sha256.New, a.signingKey[:])
	_, _ = mac.Write([]byte(payload))
	if !hmac.Equal(provided, mac.Sum(nil)) {
		return false
	}
	expiresRaw, found := strings.CutPrefix(payload, "v1:")
	if !found {
		return false
	}
	expires, err := strconv.ParseInt(expiresRaw, 10, 64)
	return err == nil && a.now().Unix() < expires
}

func (a *adminSessionAuth) cookie(value string, expires time.Time, maxAge int, secure bool) *http.Cookie {
	return &http.Cookie{
		Name:     adminSessionCookieName,
		Value:    value,
		Path:     a.cookiePath,
		Expires:  expires,
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteStrictMode,
	}
}

func requestUsesHTTPS(request *http.Request) bool {
	return request.TLS != nil || strings.EqualFold(request.Header.Get("X-Forwarded-Proto"), "https")
}
