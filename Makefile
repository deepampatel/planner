.PHONY: dev dev-backend dev-frontend build test

# Run both services
dev:
	@echo "Starting backend on :8080 and frontend on :3000..."
	@make -j2 dev-backend dev-frontend

dev-backend:
	cd backend && go run ./cmd/server

dev-frontend:
	cd frontend && pnpm dev

build-backend:
	cd backend && CGO_ENABLED=0 go build -o bin/server ./cmd/server

build-frontend:
	cd frontend && pnpm build

test-backend:
	cd backend && go test ./...

lint-backend:
	cd backend && go vet ./...
