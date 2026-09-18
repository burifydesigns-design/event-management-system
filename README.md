# Event Management System

Ticketing platform with four roles: Attendee, Coordinator, Organizer, Admin.

## Stack
- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js, Express, MongoDB (Mongoose)
- Auth: JWT
- QR: generated at ticket purchase, scanned by coordinators/organizers to check attendees in

## Getting started

### Backend
```
cd backend
npm install
cp .env.example .env   # fill in your values
npm run dev
```

### Frontend
Open frontend/public/index.html in a browser, or serve the frontend/ folder with any static server (e.g. VS Code Live Server).

## Roles
- **Attendee** — signs up, browses events, buys tickets, views their own tickets/QR codes.
- **Coordinator** — account created by admin; scans attendee QR codes to confirm a ticket is valid for that event.
- **Organizer** — creates/deletes events, creates ticket types, views sales per event, scans QR codes to admit attendees.
- **Admin** — full privileges, including creating coordinator and organizer accounts.
