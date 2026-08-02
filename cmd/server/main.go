// Command server runs the netdiagram HTTP application.
package main

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"netdiagram/internal/config"
	"netdiagram/internal/handler"
	"netdiagram/internal/logger"
	"netdiagram/internal/sse"
	"netdiagram/internal/store"
	webassets "netdiagram/web"
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
	topologyStore, err := store.NewJSONStore(cfg.DataDir)
	if err != nil {
		return fmt.Errorf("opening topology store: %w", err)
	}
	static, err := fs.Sub(webassets.Static, "static")
	if err != nil {
		return fmt.Errorf("opening embedded assets: %w", err)
	}
	broker := sse.NewBroker()
	defer broker.Close()
	server := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.Port),
		Handler:           handler.New(topologyStore, broker, appLogger, static),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	shutdownSignal, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	serveErrors := make(chan error, 1)
	go func() {
		appLogger.Info("server listening", "address", server.Addr, "data_dir", cfg.DataDir)
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

func probeHealth(url string) error {
	client := &http.Client{Timeout: 3 * time.Second}
	response, err := client.Get(url)
	if err != nil {
		return fmt.Errorf("healthcheck request: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("healthcheck returned status %d", response.StatusCode)
	}
	return nil
}
