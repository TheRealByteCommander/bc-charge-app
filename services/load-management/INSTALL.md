# INSTALLATION GUIDE - BC CHARGE BACKEND

1. Navigate to the backend folder:
   cd /home/matthias/.openclaw/workspace/bc-charge/backend/

2. Start the infrastructure:
   docker-compose up -d

3. Verify the services:
   - CitrineOS API: http://192.168.178.109:3000
   - Directus Admin: http://192.168.178.109:8055

4. Setup OCPP:
   Connect your charging stations to the WebSocket port 8080.
