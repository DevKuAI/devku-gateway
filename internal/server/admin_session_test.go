package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/enterpilot/gomodel/internal/admin"
)

func newAdminSessionServer(password string) *Server {
	return New(&mockProvider{}, &Config{
		AdminPassword:         password,
		AdminEndpointsEnabled: true,
		AdminHandler:          admin.NewHandler(nil, nil),
	})
}

func loginAdmin(t *testing.T, srv *Server, password string) (*http.Cookie, *httptest.ResponseRecorder) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/admin/auth/login", strings.NewReader(`{"password":"`+password+`"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if len(rec.Result().Cookies()) == 0 {
		return nil, rec
	}
	return rec.Result().Cookies()[0], rec
}

func TestAdminSession_LoginProtectsAdminAPI(t *testing.T) {
	srv := newAdminSessionServer("configured-password")

	unauthorized := httptest.NewRecorder()
	srv.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodGet, "/admin/models", nil))
	assert.Equal(t, http.StatusUnauthorized, unauthorized.Code)

	cookie, login := loginAdmin(t, srv, "configured-password")
	require.Equal(t, http.StatusOK, login.Code, login.Body.String())
	require.NotNil(t, cookie)
	assert.Equal(t, adminSessionCookieName, cookie.Name)
	assert.Equal(t, "/admin", cookie.Path)
	assert.True(t, cookie.HttpOnly)
	assert.Equal(t, http.SameSiteStrictMode, cookie.SameSite)
	assert.False(t, cookie.Secure)
	assert.Greater(t, cookie.MaxAge, 0)

	authorizedReq := httptest.NewRequest(http.MethodGet, "/admin/models", nil)
	authorizedReq.AddCookie(cookie)
	authorized := httptest.NewRecorder()
	srv.ServeHTTP(authorized, authorizedReq)
	assert.Equal(t, http.StatusOK, authorized.Code, authorized.Body.String())
}

func TestAdminSession_RejectsWrongPasswordAndChangedPassword(t *testing.T) {
	srv := newAdminSessionServer("configured-password")

	cookie, wrong := loginAdmin(t, srv, "password")
	assert.Nil(t, cookie)
	assert.Equal(t, http.StatusUnauthorized, wrong.Code)
	assert.NotContains(t, wrong.Body.String(), "configured-password")

	cookie, login := loginAdmin(t, srv, "configured-password")
	require.Equal(t, http.StatusOK, login.Code)
	require.NotNil(t, cookie)

	changed := newAdminSessionServer("new-password")
	req := httptest.NewRequest(http.MethodGet, "/admin/models", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	changed.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestAdminSession_StatusAndLogout(t *testing.T) {
	srv := newAdminSessionServer("configured-password")
	cookie, login := loginAdmin(t, srv, "configured-password")
	require.Equal(t, http.StatusOK, login.Code)

	statusReq := httptest.NewRequest(http.MethodGet, "/admin/auth/session", nil)
	statusReq.AddCookie(cookie)
	statusRec := httptest.NewRecorder()
	srv.ServeHTTP(statusRec, statusReq)
	require.Equal(t, http.StatusOK, statusRec.Code)
	assert.JSONEq(t, `{"authenticated":true}`, statusRec.Body.String())

	logoutReq := httptest.NewRequest(http.MethodPost, "/admin/auth/logout", nil)
	logoutReq.AddCookie(cookie)
	logoutRec := httptest.NewRecorder()
	srv.ServeHTTP(logoutRec, logoutReq)
	require.Equal(t, http.StatusOK, logoutRec.Code)
	require.NotEmpty(t, logoutRec.Result().Cookies())
	assert.Less(t, logoutRec.Result().Cookies()[0].MaxAge, 0)
}

func TestAdminSession_ExpiresAndUsesConfiguredBasePath(t *testing.T) {
	auth := newAdminSessionAuth("configured-password", "/gateway")
	now := time.Unix(1_700_000_000, 0)
	auth.now = func() time.Time { return now }
	token := auth.sign(now.Add(time.Minute))
	assert.True(t, auth.verify(token))

	auth.now = func() time.Time { return now.Add(time.Minute) }
	assert.False(t, auth.verify(token))
	assert.Equal(t, "/gateway/admin", auth.cookiePath)
}

func TestAdminSession_LoginUsesSecureCookieForHTTPS(t *testing.T) {
	srv := newAdminSessionServer("configured-password")
	req := httptest.NewRequest(http.MethodPost, "/admin/auth/login", strings.NewReader(`{"password":"configured-password"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Forwarded-Proto", "https")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.NotEmpty(t, rec.Result().Cookies())
	assert.True(t, rec.Result().Cookies()[0].Secure)
}

func TestAdminSession_ExplicitBearerTakesPrecedence(t *testing.T) {
	srv := New(&mockProvider{}, &Config{
		MasterKey:             "master-key",
		AdminPassword:         "configured-password",
		AdminEndpointsEnabled: true,
		AdminHandler:          admin.NewHandler(nil, nil),
	})
	cookie, login := loginAdmin(t, srv, "configured-password")
	require.Equal(t, http.StatusOK, login.Code)

	invalidReq := httptest.NewRequest(http.MethodGet, "/admin/models", nil)
	invalidReq.AddCookie(cookie)
	invalidReq.Header.Set("Authorization", "Bearer wrong-key")
	invalidRec := httptest.NewRecorder()
	srv.ServeHTTP(invalidRec, invalidReq)
	assert.Equal(t, http.StatusUnauthorized, invalidRec.Code)

	validReq := httptest.NewRequest(http.MethodGet, "/admin/models", nil)
	validReq.Header.Set("Authorization", "Bearer master-key")
	validRec := httptest.NewRecorder()
	srv.ServeHTTP(validRec, validReq)
	assert.Equal(t, http.StatusOK, validRec.Code, validRec.Body.String())
}

func TestAdminSession_RejectsBearerWhenNoBearerAuthenticationIsConfigured(t *testing.T) {
	srv := newAdminSessionServer("configured-password")
	req := httptest.NewRequest(http.MethodGet, "/admin/models", nil)
	req.Header.Set("Authorization", "Bearer arbitrary-token")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestAdminSession_ProtectsExtensionAdminRoutes(t *testing.T) {
	srv := New(&mockProvider{}, &Config{
		AdminPassword:         "configured-password",
		AdminEndpointsEnabled: true,
		AdminHandler:          admin.NewHandler(nil, nil),
		ExtraRoutes: []func(*echo.Echo){
			func(e *echo.Echo) {
				e.GET("/admin/extension", func(c *echo.Context) error {
					return c.NoContent(http.StatusNoContent)
				})
			},
		},
	})

	unauthorized := httptest.NewRecorder()
	srv.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodGet, "/admin/extension", nil))
	assert.Equal(t, http.StatusUnauthorized, unauthorized.Code)

	cookie, login := loginAdmin(t, srv, "configured-password")
	require.Equal(t, http.StatusOK, login.Code)
	require.NotNil(t, cookie)

	authorizedReq := httptest.NewRequest(http.MethodGet, "/admin/extension", nil)
	authorizedReq.AddCookie(cookie)
	authorized := httptest.NewRecorder()
	srv.ServeHTTP(authorized, authorizedReq)
	assert.Equal(t, http.StatusNoContent, authorized.Code)
}

func TestAdminSession_StatusDoesNotExposePassword(t *testing.T) {
	srv := newAdminSessionServer("configured-password")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/admin/auth/session", nil))
	require.Equal(t, http.StatusOK, rec.Code)

	var body map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, false, body["authenticated"])
	assert.NotContains(t, rec.Body.String(), "configured-password")
}
