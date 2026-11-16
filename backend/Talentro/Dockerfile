FROM golang:alpine AS build

ENV GOTOOLCHAIN=auto
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .

ARG VERSION=dev
ENV CGO_ENABLED=0
RUN go build -trimpath \
    -ldflags "-s -w -X talentro/internal/buildinfo.Version=${VERSION}" \
    -o /out/talentro ./cmd/app

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata \
 && addgroup -g 10001 -S talentro \
 && adduser -u 10001 -S talentro -G talentro
WORKDIR /app
COPY --from=build /out/talentro /app/talentro
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:${PORT:-8080}/ready" || exit 1
ENTRYPOINT ["/app/talentro"]
