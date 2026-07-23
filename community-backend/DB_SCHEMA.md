# Community Backend DB Schema Design

This document defines the database schema for the BC Charge Community Backend. The backend is designed to manage users, charging locations, charging stations, and community-driven features (reviews, photos, reporting).

## 1. Entity Relationship Diagram (Conceptual)
- **User** (1:N) -> **Review**
- **User** (1:N) -> **Photo**
- **User** (1:N) -> **Report**
- **Location** (1:N) -> **Station**
- **Station** (1:N) -> **Review**
- **Station** (1:N) -> **Photo**
- **Station** (1:N) -> **Report**

## 2. Data Model (PostgreSQL)

### User Management
`users` table:
- `id`: UUID (PK)
- `email`: VARCHAR(255) (Unique, Indexed)
- `password_hash`: VARCHAR(255)
- `full_name`: VARCHAR(255)
- `created_at`: TIMESTAMP (UTC)
- `updated_at`: TIMESTAMP (UTC)
- `last_login`: TIMESTAMP (UTC)
- `is_verified`: BOOLEAN (Default: false)

### Locations (Points of Interest)
`locations` table:
- `id`: UUID (PK)
- `name`: VARCHAR(255) (e.g., "Supermarket Müller")
- `address`: TEXT
- `city`: VARCHAR(100)
- `postal_code`: VARCHAR(20)
- `country_code`: CHAR(2)
- `latitude`: DECIMAL(9,6)
- `longitude`: DECIMAL(9,6)
- `description`: TEXT
- `created_at`: TIMESTAMP (UTC)
- `updated_at`: TIMESTAMP (UTC)

### Charging Stations
`stations` table:
- `id`: UUID (PK)
- `location_id`: UUID (FK -> locations.id, Indexed)
- `external_id`: VARCHAR(100) (OCPP/OCPI ID, Unique)
- `operator_name`: VARCHAR(255)
- `status`: VARCHAR(50) (Available, Occupied, Faulted, etc.)
- `connector_count`: INTEGER
- `max_power_kw`: DECIMAL(5,2)
- `pricing_info`: JSONB (Flexible structure for tariffs)
- `is_public`: BOOLEAN (Default: true)
- `created_at`: TIMESTAMP (UTC)
- `updated_at`: TIMESTAMP (UTC)

`station_connectors` table:
- `id`: UUID (PK)
- `station_id`: UUID (FK -> stations.id, Indexed)
- `type`: VARCHAR(50) (Type 2, CCS, CHAdeMO)
- `max_power_kw`: DECIMAL(5,2)
- `status`: VARCHAR(50)

### Community Features
`reviews` table:
- `id`: UUID (PK)
- `user_id`: UUID (FK -> users.id, Indexed)
- `station_id`: UUID (FK -> stations.id, Indexed)
- `rating`: INTEGER (1-5)
- `comment`: TEXT
- `created_at`: TIMESTAMP (UTC)
- `updated_at`: TIMESTAMP (UTC)

`photos` table:
- `id`: UUID (PK)
- `user_id`: UUID (FK -> users.id, Indexed)
- `station_id`: UUID (FK -> stations.id, Indexed)
- `url`: TEXT (S3/Cloud Storage link)
- `caption`: TEXT
- `created_at`: TIMESTAMP (UTC)

`reports` table:
- `id`: UUID (PK)
- `user_id`: UUID (FK -> users.id, Indexed)
- `station_id`: UUID (FK -> stations.id, Indexed)
- `issue_type`: VARCHAR(50) (e.g., "Broken Connector", "Blocked by ICE")
- `description`: TEXT
- `status`: VARCHAR(50) (Open, Resolved, Ignored)
- `created_at`: TIMESTAMP (UTC)
- `resolved_at`: TIMESTAMP (UTC)
