CREATE TABLE IF NOT EXISTS "public"."active_reservation_view"
(
    confirmation_code TEXT PRIMARY KEY,
    email             TEXT,
    "start"           TIMESTAMP,
    "end"             TIMESTAMP,
    number_of_people  INTEGER,
    status            TEXT,
    created_at        TIMESTAMP DEFAULT NOW()
);
