# Workshop registration

Visitors register for an upcoming workshop with a **name and an email** so the organisers know
who is coming. The form is on the workshop page (`/workshops/:id`, anchor `#register`), and the
list of registrants is in **Admin → Workshops → Registrants**.

## What a visitor sees

| Workshop state | Page shows |
|---|---|
| Open | The form, with "N spots left" when a seat limit is set |
| Full | "This workshop is full" and a pointer to the contact form |
| Registration switched off | "Registration is closed" |
| Date has passed | Nothing (the page already says *Completed*) |

After registering they see a confirmation with the workshop's date, time and place. There is no
confirmation email: this deployment has no mail service, so the organiser contacts people from the
registrants list. A workshop can still carry an **external registration link** (for a different
sign-up system); it is shown as a secondary option.

## What the admin controls

In the workshop editor, **Registration**:

- *Accept registrations on the website* — the on/off switch (default on).
- *Seat limit* — optional; registration closes by itself when it is reached.

In **Registrants**: search, copy all emails, export a CSV (opens in Excel/Sheets; Arabic names
survive), and remove a person.

## Rules the server enforces

`POST /api/v1/workshops/:id/register` with `{name, email, website}`:

- name 1–120 characters, no control characters; email must look like an email (≤ 254), stored
  lower-cased; the same email cannot register twice for one workshop (case-insensitive);
- only workshops whose date has not passed, with registration open and a seat free. The workshop
  row is locked while checking, so two people cannot take the last seat together
  (`TestRegisterCapacityHoldsUnderConcurrency`);
- `website` is a **honeypot** — an input hidden from people; a request that fills it is
  acknowledged and discarded;
- at most 60 attempts per 10 minutes per IP (HTTP 429 with `Retry-After`) — sized so a whole class
  registering from one school network is not blocked; the per-email uniqueness and the honeypot do
  the real work against abuse. For IPv6 the limit applies per /64, not per address.

Errors carry a `code` (`name_required`, `email_invalid`, `workshop_full`, `already_registered`,
`registration_closed`, `workshop_ended`, …) which the page turns into text in the visitor's own
language.

Admin endpoints (admin token): `GET /api/v1/admin/workshops/:id/registrations`,
`GET …/registrations.csv`, `DELETE …/registrations/:rid`. The CSV neutralises cells that begin with
`= + - @`, so a name typed as a spreadsheet formula cannot run when an organiser opens the export.

## Data

Migration `0009`: `workshops.registration_open` (default true), `workshops.capacity` (NULL =
unlimited) and `workshop_registrations(id, workshop_id → workshops ON DELETE CASCADE, name, email,
created_at)` with a unique index on `(workshop_id, lower(email))`. Deleting a workshop deletes its
registrations. The data is personal information: it is shown only to admins, and only the count and
seats left are public.
