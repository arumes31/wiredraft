// Command server runs the WireDraft HTTP application.
package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"wiredraft/internal/auth"
	"wiredraft/internal/config"
	"wiredraft/internal/handler"
	"wiredraft/internal/logger"
	"wiredraft/internal/media"
	"wiredraft/internal/sse"
	"wiredraft/internal/store"
	webassets "wiredraft/web"
)

const shutdownTimeout = 10 * time.Second

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string) error {
	cfg, err := config.Parse(args)
	if err != nil {
		return err
	}
	if cfg.Healthcheck {
		return probeHealth(cfg.HealthcheckURL)
	}
	appLogger, err := logger.New(os.Stdout, cfg.LogLevel, cfg.LogFormat)
	if err != nil {
		return err
	}
	databasePool, err := store.OpenDatabase(context.Background(), cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer databasePool.Close()
	if err := store.MigrateDatabase(databasePool); err != nil {
		return fmt.Errorf("migrating database: %w", err)
	}
	topologyStore := store.NewPostgresStore(databasePool)
	authPreflight, err := auth.ReadPostgresPreflight(context.Background(), databasePool)
	if err != nil {
		return fmt.Errorf("reading authentication preflight: %w", err)
	}
	organizationNames, err := startupOrganizationNames(
		context.Background(), topologyStore, authPreflight, cfg.GuestEnabled,
	)
	if err != nil {
		return err
	}
	if err := topologyStore.EnsureOrganizations(context.Background(), organizationNames); err != nil {
		return fmt.Errorf("initializing organization registry: %w", err)
	}
	if err := topologyStore.EnsureDemo(context.Background()); err != nil {
		return fmt.Errorf("initializing topology store: %w", err)
	}
	mediaStore, err := media.Open(cfg.MediaDir)
	if err != nil {
		return fmt.Errorf("opening photo storage: %w", err)
	}
	defer func() {
		if err := mediaStore.Close(); err != nil {
			appLogger.Error("closing photo storage", "error", err)
		}
	}()
	organizations, err := topologyStore.ListOrganizations(context.Background())
	if err != nil {
		return fmt.Errorf("listing organizations: %w", err)
	}
	authOrganizations := make([]auth.OrganizationRef, len(organizations))
	for index, organization := range organizations {
		authOrganizations[index] = auth.OrganizationRef{ID: organization.ID, Name: organization.Name}
	}
	authManager, err := auth.NewPostgres(context.Background(), databasePool, auth.Config{
		AdminUsername: cfg.AdminUsername, AdminPassword: cfg.AdminPassword,
		AdminTOTPSecret: cfg.AdminTOTPSecret, GuestEnabled: cfg.GuestEnabled,
		CookieSecure: cfg.CookieSecure,
	}, authOrganizations)
	if err != nil {
		return fmt.Errorf("opening authentication service: %w", err)
	}
	var entraProvider *auth.EntraProvider
	if cfg.EntraEnabled {
		clientSecret, err := readSecretFile(cfg.EntraSecretFile)
		if err != nil {
			return fmt.Errorf("reading Entra client secret: %w", err)
		}
		entraProvider, err = auth.NewEntraProvider(auth.EntraConfig{
			TenantID: cfg.EntraTenantID, ClientID: cfg.EntraClientID,
			ClientSecret: clientSecret, RedirectURL: cfg.EntraRedirectURL,
		})
		if err != nil {
			return fmt.Errorf("configuring Entra login: %w", err)
		}
	}
	static, err := fs.Sub(webassets.Static, "static")
	if err != nil {
		return fmt.Errorf("opening embedded assets: %w", err)
	}
	broker := sse.NewBroker()
	defer broker.Close()
	server := &http.Server{
		Addr: fmt.Sprintf(":%d", cfg.Port),
		Handler: handler.NewWithAuthMediaAndEntra(
			topologyStore, broker, appLogger, static, authManager, mediaStore, entraProvider,
		),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	shutdownSignal, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	serveErrors := make(chan error, 1)
	go func() {
		appLogger.Info("server listening", "address", server.Addr)
		serveErrors <- server.ListenAndServe()
	}()

	select {
	case err := <-serveErrors:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return fmt.Errorf("serving http: %w", err)
	case <-shutdownSignal.Done():
		appLogger.Info("shutdown requested")
	}

	shutdownContext, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := server.Shutdown(shutdownContext); err != nil {
		return fmt.Errorf("shutting down http server: %w", err)
	}
	appLogger.Info("server stopped")
	return nil
}

type organizationGetter interface {
	GetOrganization(context.Context, string) (store.Organization, error)
}

func startupOrganizationNames(
	ctx context.Context,
	organizations organizationGetter,
	preflight auth.Preflight,
	guestEnabled bool,
) ([]string, error) {
	names := append([]string(nil), preflight.LegacyOrganizationNames...)
	guestRequired := guestEnabled || len(preflight.LegacyGuestTopologyIDs) != 0
	if !guestRequired {
		return names, nil
	}
	guestOrganizationID := strings.TrimSpace(preflight.GuestOrganizationID)
	if guestOrganizationID == "" {
		return append(names, auth.GuestOrganizationName), nil
	}
	_, err := organizations.GetOrganization(ctx, guestOrganizationID)
	if err == nil {
		return names, nil
	}
	if errors.Is(err, store.ErrNotFound) || errors.Is(err, store.ErrInvalid) {
		return append(names, auth.GuestOrganizationName), nil
	}
	return nil, fmt.Errorf("looking up bound Guest organization: %w", err)
}

func readSecretFile(path string) (returnValue string, returnErr error) {
	// The path is process configuration supplied by the operator, never HTTP input.
	file, err := os.Open(path) // #nosec G304 -- operator-controlled secret path.
	if err != nil {
		return "", err
	}
	defer func() {
		if closeErr := file.Close(); closeErr != nil && returnErr == nil {
			returnErr = fmt.Errorf("closing secret file: %w", closeErr)
		}
	}()
	data, err := io.ReadAll(io.LimitReader(file, (16<<10)+1))
	if err != nil {
		return "", err
	}
	if len(data) > 16<<10 {
		return "", errors.New("secret file exceeds 16 KiB")
	}
	value := strings.TrimSpace(string(data))
	if value == "" {
		return "", errors.New("secret file is empty")
	}
	return value, nil
}

func probeHealth(url string) (returnErr error) {
	client := &http.Client{Timeout: 3 * time.Second}
	request, err := http.NewRequestWithContext(context.Background(), http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("creating healthcheck request: %w", err)
	}
	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("healthcheck request: %w", err)
	}
	defer func() {
		if closeErr := response.Body.Close(); closeErr != nil && returnErr == nil {
			returnErr = fmt.Errorf("closing healthcheck response: %w", closeErr)
		}
	}()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("healthcheck returned status %d", response.StatusCode)
	}
	return nil
}
