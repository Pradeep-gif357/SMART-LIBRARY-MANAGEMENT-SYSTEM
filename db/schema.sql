-- =====================================================================
--  Smart Library Management & Book Recommendation System
--  PostgreSQL 16 + pgvector  (SQL + Vector database in ONE engine)
--  Running this file RESETS the database (drops and recreates objects).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------- DROP (clean re-run) --------------------------------------
DROP VIEW  IF EXISTS v_category_stats, v_popular_books, v_overdue_loans, v_book_catalog CASCADE;
DROP TABLE IF EXISTS activity_log, reservations, borrowings, book_authors, books, authors, categories, users CASCADE;
DROP FUNCTION IF EXISTS fn_borrow_book(INT, INT), fn_return_book(INT), fn_calc_fine(TIMESTAMPTZ, TIMESTAMPTZ) CASCADE;

-- ---------- CREATE TABLES --------------------------------------------
CREATE TABLE users (
    user_id        SERIAL PRIMARY KEY,
    name           VARCHAR(100) NOT NULL CHECK (length(trim(name)) >= 2),
    email          VARCHAR(150) NOT NULL UNIQUE
                   CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    password_hash  TEXT         NOT NULL,                       -- bcrypt hash, never plain text
    role           VARCHAR(20)  NOT NULL DEFAULT 'student'
                   CHECK (role IN ('student', 'librarian')),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE categories (
    category_id    SERIAL PRIMARY KEY,
    name           VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE authors (
    author_id      SERIAL PRIMARY KEY,
    name           VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE books (
    book_id          SERIAL PRIMARY KEY,
    book_code        VARCHAR(30)  NOT NULL UNIQUE,              -- ISBN or library accession code
    title            VARCHAR(255) NOT NULL CHECK (length(trim(title)) > 0),
    description      TEXT         NOT NULL DEFAULT '',
    publisher        VARCHAR(120),
    publication_year INT          CHECK (publication_year BETWEEN 1400 AND 2100),
    category_id      INT          NOT NULL REFERENCES categories(category_id) ON DELETE RESTRICT,
    total_copies     INT          NOT NULL DEFAULT 1 CHECK (total_copies >= 0),
    available_copies INT          NOT NULL DEFAULT 1,
    embedding        vector(256),                               -- semantic vector of the book (pgvector)
    search_tsv       tsvector GENERATED ALWAYS AS (
                         to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
                     ) STORED,                                  -- full-text search column
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_available_range CHECK (available_copies >= 0 AND available_copies <= total_copies)
);

CREATE TABLE book_authors (                                     -- M:N books <-> authors
    book_id    INT NOT NULL REFERENCES books(book_id)     ON DELETE CASCADE,
    author_id  INT NOT NULL REFERENCES authors(author_id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, author_id)
);

CREATE TABLE borrowings (
    borrowing_id SERIAL PRIMARY KEY,
    user_id      INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    book_id      INT NOT NULL REFERENCES books(book_id) ON DELETE RESTRICT,
    borrowed_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    due_date     TIMESTAMPTZ  NOT NULL DEFAULT (now() + interval '14 days'),
    returned_at  TIMESTAMPTZ,
    fine_amount  NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (fine_amount >= 0),
    status       VARCHAR(10)  NOT NULL DEFAULT 'borrowed' CHECK (status IN ('borrowed', 'returned'))
);

CREATE TABLE reservations (
    reservation_id SERIAL PRIMARY KEY,
    user_id        INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    book_id        INT NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
    reserved_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    status         VARCHAR(10) NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'ready', 'fulfilled', 'cancelled'))
);

-- every search / view / borrow / reserve event: the raw material for recommendations
CREATE TABLE activity_log (
    activity_id  BIGSERIAL PRIMARY KEY,
    user_id      INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    book_id      INT REFERENCES books(book_id) ON DELETE CASCADE,
    action       VARCHAR(10) NOT NULL CHECK (action IN ('search', 'view', 'borrow', 'reserve')),
    search_query VARCHAR(200),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_activity_target CHECK (
        (action = 'search' AND search_query IS NOT NULL) OR (action <> 'search' AND book_id IS NOT NULL)
    )
);

-- ---------- ALTER (extra integrity rules added after table creation) --
ALTER TABLE books      ADD CONSTRAINT chk_book_code_len     CHECK (length(trim(book_code)) >= 3);
ALTER TABLE borrowings ADD CONSTRAINT chk_due_after_borrow  CHECK (due_date > borrowed_at);
ALTER TABLE borrowings ADD CONSTRAINT chk_return_after_borrow CHECK (returned_at IS NULL OR returned_at >= borrowed_at);
ALTER TABLE borrowings ADD CONSTRAINT chk_status_matches    CHECK ((status = 'returned') = (returned_at IS NOT NULL));

-- ---------- INDEXES ---------------------------------------------------
CREATE INDEX idx_books_category      ON books (category_id);
CREATE INDEX idx_books_tsv           ON books USING GIN (search_tsv);                   -- full-text search
CREATE INDEX idx_books_embedding     ON books USING hnsw (embedding vector_cosine_ops); -- vector similarity search
CREATE INDEX idx_book_authors_author ON book_authors (author_id);
CREATE INDEX idx_borrowings_user     ON borrowings (user_id);
CREATE INDEX idx_borrowings_book     ON borrowings (book_id);
CREATE INDEX idx_borrowings_open_due ON borrowings (due_date) WHERE returned_at IS NULL;
CREATE UNIQUE INDEX uq_active_borrow      ON borrowings (user_id, book_id) WHERE returned_at IS NULL;
CREATE UNIQUE INDEX uq_active_reservation ON reservations (user_id, book_id) WHERE status IN ('active', 'ready');
CREATE INDEX idx_reservations_book   ON reservations (book_id, status);
CREATE INDEX idx_activity_user_time  ON activity_log (user_id, created_at DESC);
CREATE INDEX idx_activity_book       ON activity_log (book_id);

-- ---------- FUNCTIONS -------------------------------------------------
-- Fine: Rs. 2 per started day after the due date
CREATE OR REPLACE FUNCTION fn_calc_fine(p_due TIMESTAMPTZ, p_returned TIMESTAMPTZ)
RETURNS NUMERIC AS $$
    SELECT CASE WHEN p_returned <= p_due THEN 0::numeric
                ELSE (CEIL(EXTRACT(EPOCH FROM (p_returned - p_due)) / 86400) * 2)::numeric(8,2)
           END;
$$ LANGUAGE sql IMMUTABLE;

-- Stored function: borrow a book (all rules are enforced by the triggers below)
CREATE OR REPLACE FUNCTION fn_borrow_book(p_user_id INT, p_book_id INT)
RETURNS INT AS $$
DECLARE
    v_id INT;
BEGIN
    INSERT INTO borrowings (user_id, book_id) VALUES (p_user_id, p_book_id)
    RETURNING borrowing_id INTO v_id;

    INSERT INTO activity_log (user_id, book_id, action) VALUES (p_user_id, p_book_id, 'borrow');
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Stored function: return a book, returns the fine that was charged
CREATE OR REPLACE FUNCTION fn_return_book(p_borrowing_id INT)
RETURNS NUMERIC AS $$
DECLARE
    v_fine NUMERIC;
BEGIN
    UPDATE borrowings SET returned_at = now()
    WHERE borrowing_id = p_borrowing_id AND returned_at IS NULL
    RETURNING fine_amount INTO v_fine;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Borrowing not found or already returned';
    END IF;
    RETURN v_fine;
END;
$$ LANGUAGE plpgsql;

-- ---------- TRIGGER FUNCTIONS ----------------------------------------
-- BEFORE INSERT on borrowings: lock the book row, check rules, take one copy
CREATE OR REPLACE FUNCTION fn_borrowing_before_insert() RETURNS trigger AS $$
DECLARE
    v_avail  INT;
    v_active INT;
BEGIN
    IF NEW.returned_at IS NOT NULL THEN          -- historical row, nothing to enforce
        RETURN NEW;
    END IF;

    SELECT available_copies INTO v_avail FROM books WHERE book_id = NEW.book_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Book not found';
    END IF;
    IF v_avail <= 0 THEN
        RAISE EXCEPTION 'No copies of this book are available right now';
    END IF;

    SELECT count(*) INTO v_active FROM borrowings WHERE user_id = NEW.user_id AND returned_at IS NULL;
    IF v_active >= 3 THEN
        RAISE EXCEPTION 'Borrow limit reached (maximum 3 books at a time)';
    END IF;

    IF EXISTS (SELECT 1 FROM borrowings
               WHERE user_id = NEW.user_id AND returned_at IS NULL AND due_date < now()) THEN
        RAISE EXCEPTION 'Please return your overdue books before borrowing more';
    END IF;

    UPDATE books SET available_copies = available_copies - 1 WHERE book_id = NEW.book_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- AFTER INSERT on borrowings: the user's own waiting reservation becomes fulfilled
CREATE OR REPLACE FUNCTION fn_borrowing_after_insert() RETURNS trigger AS $$
BEGIN
    IF NEW.returned_at IS NULL THEN
        UPDATE reservations SET status = 'fulfilled'
        WHERE user_id = NEW.user_id AND book_id = NEW.book_id AND status IN ('active', 'ready');
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- BEFORE UPDATE on borrowings: on return compute the fine and the status
CREATE OR REPLACE FUNCTION fn_borrowing_before_update() RETURNS trigger AS $$
BEGIN
    IF OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN
        NEW.fine_amount := fn_calc_fine(NEW.due_date, NEW.returned_at);
        NEW.status := 'returned';
    ELSIF OLD.returned_at IS NOT NULL AND NEW.returned_at IS NULL THEN
        RAISE EXCEPTION 'A returned borrowing cannot be re-opened';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- AFTER UPDATE on borrowings: give the copy back and notify the first person waiting
CREATE OR REPLACE FUNCTION fn_borrowing_after_update() RETURNS trigger AS $$
BEGIN
    IF OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN
        UPDATE books SET available_copies = available_copies + 1 WHERE book_id = NEW.book_id;

        UPDATE reservations SET status = 'ready'
        WHERE reservation_id = (
            SELECT reservation_id FROM reservations
            WHERE book_id = NEW.book_id AND status = 'active'
            ORDER BY reserved_at LIMIT 1
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- BEFORE INSERT on reservations: only unavailable books can be reserved
CREATE OR REPLACE FUNCTION fn_reservation_before_insert() RETURNS trigger AS $$
DECLARE
    v_avail INT;
BEGIN
    SELECT available_copies INTO v_avail FROM books WHERE book_id = NEW.book_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Book not found';
    END IF;
    IF v_avail > 0 THEN
        RAISE EXCEPTION 'This book is available - borrow it instead of reserving';
    END IF;
    IF EXISTS (SELECT 1 FROM borrowings
               WHERE user_id = NEW.user_id AND book_id = NEW.book_id AND returned_at IS NULL) THEN
        RAISE EXCEPTION 'You already have this book borrowed';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------- TRIGGERS --------------------------------------------------
CREATE TRIGGER trg_borrowing_before_insert BEFORE INSERT ON borrowings
    FOR EACH ROW EXECUTE FUNCTION fn_borrowing_before_insert();
CREATE TRIGGER trg_borrowing_after_insert  AFTER  INSERT ON borrowings
    FOR EACH ROW EXECUTE FUNCTION fn_borrowing_after_insert();
CREATE TRIGGER trg_borrowing_before_update BEFORE UPDATE ON borrowings
    FOR EACH ROW EXECUTE FUNCTION fn_borrowing_before_update();
CREATE TRIGGER trg_borrowing_after_update  AFTER  UPDATE ON borrowings
    FOR EACH ROW EXECUTE FUNCTION fn_borrowing_after_update();
CREATE TRIGGER trg_reservation_before_insert BEFORE INSERT ON reservations
    FOR EACH ROW EXECUTE FUNCTION fn_reservation_before_insert();

-- ---------- VIEWS -----------------------------------------------------
CREATE VIEW v_book_catalog AS
SELECT b.book_id, b.book_code, b.title, b.description, b.publisher, b.publication_year,
       b.category_id, c.name AS category,
       b.total_copies, b.available_copies,
       COALESCE(string_agg(DISTINCT a.name, ', '), '') AS authors,
       (SELECT count(*)::int FROM borrowings br WHERE br.book_id = b.book_id) AS times_borrowed,
       b.search_tsv, b.created_at
FROM books b
JOIN categories c        ON c.category_id = b.category_id
LEFT JOIN book_authors ba ON ba.book_id = b.book_id
LEFT JOIN authors a       ON a.author_id = ba.author_id
GROUP BY b.book_id, c.name;

CREATE VIEW v_overdue_loans AS
SELECT br.borrowing_id, u.user_id, u.name AS user_name, u.email,
       b.book_id, b.title, br.borrowed_at, br.due_date,
       CEIL(EXTRACT(EPOCH FROM (now() - br.due_date)) / 86400)::int AS days_overdue,
       fn_calc_fine(br.due_date, now()) AS estimated_fine
FROM borrowings br
JOIN users u ON u.user_id = br.user_id
JOIN books b ON b.book_id = br.book_id
WHERE br.returned_at IS NULL AND br.due_date < now();

CREATE VIEW v_popular_books AS
SELECT b.book_id, b.title, c.name AS category,
       COUNT(DISTINCT br.borrowing_id)::int AS borrow_count,
       COUNT(DISTINCT CASE WHEN al.action = 'view' THEN al.activity_id END)::int AS view_count
FROM books b
JOIN categories c           ON c.category_id = b.category_id
LEFT JOIN borrowings br     ON br.book_id = b.book_id
LEFT JOIN activity_log al   ON al.book_id = b.book_id
GROUP BY b.book_id, b.title, c.name;

CREATE VIEW v_category_stats AS
SELECT c.category_id, c.name AS category,
       COUNT(DISTINCT b.book_id)::int AS titles,
       COUNT(br.borrowing_id)::int    AS total_loans
FROM categories c
LEFT JOIN books b       ON b.category_id = c.category_id
LEFT JOIN borrowings br ON br.book_id = b.book_id
GROUP BY c.category_id, c.name;
