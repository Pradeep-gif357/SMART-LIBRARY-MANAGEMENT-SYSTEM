# Smart Library Management and Book Recommendation System

DBMS Experiential Learning – Level 3 project.
**Next.js** web app + **PostgreSQL 16 with pgvector** (relational data *and* vector search in one database).

Students search, borrow, reserve and return books; the system recommends books from each student's searches, views and
loans; an AI assistant answers "recommend me something like Dune" in plain English; librarians get an admin dashboard.

---

## Run it on your laptop (about 5 minutes)

### You need
1. **Node.js 18.17 or newer** – <https://nodejs.org> (LTS). Check with `node -v`.
2. **Docker Desktop** – <https://www.docker.com/products/docker-desktop> (open it and wait until it says *running*).
   Docker gives you PostgreSQL **with pgvector already installed**, so nothing else has to be installed or configured.

### Steps (same on Windows, macOS, Linux – run in a terminal inside this folder)

```bash
npm install          # 1. install the packages
npm run db:up        # 2. start PostgreSQL + pgvector in Docker (first time downloads the image, ~1 min)
npm run setup        # 3. create .env, tables, triggers, views and 44 sample books + demo users
npm run dev          # 4. start the website
```

Open **http://localhost:3000**

| Role | Email | Password |
|---|---|---|
| Librarian (admin) | `librarian@library.com` | `Admin@123` |
| Student | `student@library.com` | `Student@123` |

Next time you only need `npm run db:up` (if Docker was restarted) and `npm run dev`.
Run `npm run setup` again any time to **reset** the database to the sample data.

### Optional: check everything works

```bash
npm run test:db       # 36 database tests (constraints, triggers, fines, reservations, rollback) – changes no data
npm run test:smoke    # 20 end-to-end checks of the running website (start `npm run dev` in another terminal first)
```

### Optional: make the AI assistant use Claude
The assistant works fully offline. To let Claude phrase its answers, put your key in `.env`:
`ANTHROPIC_API_KEY=sk-ant-...` and restart `npm run dev`. Claude can only talk about books the database returned.

---

## If something goes wrong

| Message / symptom | Fix |
|---|---|
| `Could not connect to the database` | Open Docker Desktop, run `npm run db:up`, wait 10 s, run `npm run setup` again. |
| `port is already allocated` (5433) | Something else uses port 5433. Change `POSTGRES_PORT` **and** the port inside `DATABASE_URL` in `.env`, then `npm run db:down` and `npm run db:up`. |
| `Port 3000 is in use` | Next.js picks the next free port and prints it (for example 3001) – open that address. Or run `npx next dev -p 3001`. |
| `Database tables are missing` | Run `npm run setup`. |
| `JWT_SECRET is missing` | Run `npm run setup` (it creates `.env`), then restart `npm run dev`. |
| `does not have the pgvector extension` | You pointed `DATABASE_URL` at a normal PostgreSQL. Use the Docker one (`npm run db:up`) or install pgvector. |
| Want a clean slate | `docker compose down -v` (deletes the database volume), then `npm run db:up` and `npm run setup`. |

Using your own PostgreSQL instead of Docker: install PostgreSQL 15+ and the pgvector extension, create a database, and put its
address in `DATABASE_URL` in `.env`.

---

## What is inside

```
app/                 Next.js pages (catalogue, book detail, My Library, AI assistant, admin) and /api route handlers
components/ lib/     shared UI, database pool, auth, embedding model, recommender, assistant
db/schema.sql        all DDL: tables, constraints, indexes, views, functions, triggers
db/seed-data.js      44 sample books (original short summaries)
scripts/             setup.js (one-command DB setup), test-db.js, smoke-test.js
tests/db-tests.sql   the database test suite
docs/                PROJECT_DOCUMENTATION.md, ER diagram, architecture diagram
```

## Features
- **Library basics:** catalogue with keyword (full-text) and semantic search, filters, borrow / return / reserve, due dates, fines (Rs. 2 per late day), 3-book limit, reservation queue.
- **Recommendations:** hybrid – vector similarity to your interest profile + "readers like you also borrowed". New users see popular books.
- **AI assistant:** natural-language questions → embedding → pgvector nearest books ("something like Dune", "available books on space").
- **Admin dashboard (librarian):** KPIs, overdue loans, popular books, category stats, trending searches, book/user/loan management.
- **Security:** bcrypt password hashes, signed httpOnly cookie sessions, role checks on every protected API, parameterised SQL, secrets only in `.env`.

Full write-up for submission: [`docs/PROJECT_DOCUMENTATION.md`](docs/PROJECT_DOCUMENTATION.md).
