FROM golang:alpine AS builder

ENV GOTOOLCHAIN=auto
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o talentro ./cmd/app

FROM alpine:3.20
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/talentro /app/talentro

EXPOSE 8080
ENTRYPOINT ["/app/talentro"]
