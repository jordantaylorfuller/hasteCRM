# API Changelog

All notable changes to the hasteCRM API will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-15

### Added
- Initial GraphQL API with full schema
- REST API v1 endpoints
- WebSocket support for real-time updates
- JWT-based authentication with refresh tokens
- OAuth 2.0 integration for Google, Microsoft, LinkedIn
- File upload endpoints
- Export functionality for contacts and data
- Webhook system for event notifications
- Rate limiting with sliding window
- Comprehensive error handling

### API Endpoints
- GraphQL endpoint at `/graphql`
- REST API base path `/v1`
- WebSocket endpoint at `/ws`
- Server-sent events at `/v1/events/stream`

### Security
- RS256 JWT tokens
- 15-minute access token expiry
- 7-day refresh token expiry
- Token rotation in production
- Encrypted token storage

### Rate Limits
- GraphQL: 1000 req/min (authenticated), 100 req/min (unauthenticated)
- REST: 500 req/min (authenticated), 50 req/min (unauthenticated)
- WebSocket: 100 msg/min
- File uploads: 10 req/min

## [Upcoming]

### Planned Features
- GraphQL schema stitching for microservices
- API versioning for GraphQL
- Batch operations support
- Enhanced webhook retry logic
- API key management UI
- Usage analytics dashboard

### Deprecations
- None planned

---

For questions or issues, contact api-support@haste.nyc