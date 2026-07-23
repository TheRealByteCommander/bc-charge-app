# Community Backend Database Schema Design

## Overview
The community backend supports user interactions, social features (reviews, ratings, photos), and user profile management for the BC Charge ecosystem.

## Tables

### 1. `users`
Core user identity and preferences.
- `id`: UUID (PK)
- `username`: VARCHAR(50) (Unique)
- `email`: VARCHAR(255) (Unique)
- `password_hash`: TEXT
- `full_name`: VARCHAR(100)
- `avatar_url`: TEXT
- `bio`: TEXT
- `created_at`: TIMESTAMP (Default: now())
- `updated_at`: TIMESTAMP
- `last_login`: TIMESTAMP

### 2. `user_roles`
Permissions management.
- `id`: UUID (PK)
- `role_name`: VARCHAR(20) (e.g., 'User', 'PowerUser', 'Moderator', 'Admin')
- `description`: TEXT

### 3. `user_role_mapping`
Many-to-many link between users and roles.
- `user_id`: UUID (FK -> users.id)
- `role_id`: UUID (FK -> user_roles.id)
- PRIMARY KEY (`user_id`, `role_id`)

### 4. `charging_stations` (Reference Table)
Assuming a reference to the actual infrastructure.
- `station_id`: UUID (PK)
- `name`: VARCHAR(100)
- `location_lat`: DECIMAL(9,6)
- `location_lon`: DECIMAL(9,6)
- `address`: TEXT

### 5. `reviews`
User-generated content for charging stations.
- `id`: UUID (PK)
- `user_id`: UUID (FK -> users.id)
- `station_id`: UUID (FK -> charging_stations.station_id)
- `rating`: INTEGER (1-5)
- `comment`: TEXT
- `created_at`: TIMESTAMP (Default: now())
- `updated_at`: TIMESTAMP
- `is_verified_session`: BOOLEAN (True if user actually charged here)

### 6. `review_votes`
Upvotes/downvotes for review quality.
- `review_id`: UUID (FK -> reviews.id)
- `user_id`: UUID (FK -> users.id)
- `vote_value`: INTEGER (1 or -1)
- PRIMARY KEY (`review_id`, `user_id`)

### 7. `station_photos`
User-uploaded images of charging locations.
- `id`: UUID (PK)
- `user_id`: UUID (FK -> users.id)
- `station_id`: UUID (FK -> charging_stations.station_id)
- `image_url`: TEXT
- `caption`: TEXT
- `created_at`: TIMESTAMP (Default: now())

### 8. `community_posts`
Forum-like discussions or tips.
- `id`: UUID (PK)
- `user_id`: UUID (FK -> users.id)
- `title`: VARCHAR(255)
- `content`: TEXT
- `category`: VARCHAR(50) (e.g., 'Hardware', 'Pricing', 'General')
- `created_at`: TIMESTAMP (Default: now())
- `updated_at`: TIMESTAMP

### 9. `post_comments`
Replies to community posts.
- `id`: UUID (PK)
- `post_id`: UUID (FK -> community_posts.id)
- `user_id`: UUID (FK -> users.id)
- `content`: TEXT
- `parent_comment_id`: UUID (FK -> post_comments.id) (For threading)
- `created_at`: TIMESTAMP (Default: now())

## Relationships Summary
- Users -> Reviews (1:N)
- Users -> Photos (1:N)
- Users -> Posts (1:N)
- Reviews -> Votes (1:N)
- Posts -> Comments (1:N)
- Stations -> Reviews/Photos (1:N)
