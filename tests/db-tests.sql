-- =====================================================================
--  Database test suite for the Smart Library
--  Run with:  npm run test:db        (works on the real database, changes nothing:
--  everything runs inside a transaction that is rolled back at the end)
-- =====================================================================
\set ON_ERROR_STOP on
\pset format aligned
\pset border 2
BEGIN;

CREATE TEMP TABLE test_results (id SERIAL, test TEXT, passed BOOLEAN, detail TEXT);

-- helper: run a statement that MUST fail with a message containing `expected`
CREATE FUNCTION pg_temp.expect_error(label TEXT, stmt TEXT, expected TEXT) RETURNS VOID AS $$
BEGIN
    BEGIN
        EXECUTE stmt;
        INSERT INTO test_results (test, passed, detail) VALUES (label, FALSE, 'statement succeeded but should have failed');
    EXCEPTION WHEN OTHERS THEN
        IF position(lower(expected) IN lower(SQLERRM)) > 0 THEN
            INSERT INTO test_results (test, passed, detail) VALUES (label, TRUE, SQLERRM);
        ELSE
            INSERT INTO test_results (test, passed, detail) VALUES (label, FALSE, 'wrong error: ' || SQLERRM);
        END IF;
    END;
END $$ LANGUAGE plpgsql;

-- helper: assert a boolean condition
CREATE FUNCTION pg_temp.expect(label TEXT, ok BOOLEAN, detail TEXT DEFAULT '') RETURNS VOID AS $$
BEGIN
    INSERT INTO test_results (test, passed, detail) VALUES (label, COALESCE(ok, FALSE), detail);
END $$ LANGUAGE plpgsql;

\o /dev/null
-- ---------- fixtures (rolled back at the end) --------------------------
INSERT INTO categories (name) VALUES ('ZZ Test Category');
INSERT INTO users (name, email, password_hash, role) VALUES
    ('Test Student A', 'zz.a@test.com', 'x', 'student'),
    ('Test Student B', 'zz.b@test.com', 'x', 'student'),
    ('Test Librarian', 'zz.l@test.com', 'x', 'librarian');
INSERT INTO books (book_code, title, description, category_id, total_copies, available_copies)
SELECT code, title, 'zebra migration patterns in savannah ecosystems', c.category_id, copies, copies
FROM categories c, (VALUES ('ZZ-001', 'Test Book One', 1), ('ZZ-002', 'Test Book Two', 2),
                           ('ZZ-003', 'Test Book Three', 2), ('ZZ-004', 'Test Book Four', 2)) AS t(code, title, copies)
WHERE c.name = 'ZZ Test Category';

-- ======================= 1. CHECK / NOT NULL / UNIQUE ===================
SELECT pg_temp.expect_error('C1  invalid email rejected',
  $$INSERT INTO users (name,email,password_hash) VALUES ('Bad Mail','not-an-email','x')$$, 'users_email_check');
SELECT pg_temp.expect_error('C2  duplicate email rejected',
  $$INSERT INTO users (name,email,password_hash) VALUES ('Dup','zz.a@test.com','x')$$, 'users_email_key');
SELECT pg_temp.expect_error('C3  unknown role rejected',
  $$INSERT INTO users (name,email,password_hash,role) VALUES ('Role Test','zz.r@test.com','x','admin')$$, 'users_role_check');
SELECT pg_temp.expect_error('C4  name too short rejected',
  $$INSERT INTO users (name,email,password_hash) VALUES ('A','zz.n@test.com','x')$$, 'users_name_check');
SELECT pg_temp.expect_error('C5  password_hash is mandatory',
  $$INSERT INTO users (name,email) VALUES ('No Pass','zz.p@test.com')$$, 'password_hash');
SELECT pg_temp.expect_error('C6  negative total copies rejected',
  $$INSERT INTO books (book_code,title,category_id,total_copies,available_copies)
    SELECT 'ZZ-NEG','Neg',category_id,-1,0 FROM categories WHERE name='ZZ Test Category'$$, 'books_total_copies_check');
SELECT pg_temp.expect_error('C7  available > total rejected',
  $$INSERT INTO books (book_code,title,category_id,total_copies,available_copies)
    SELECT 'ZZ-OVR','Over',category_id,1,5 FROM categories WHERE name='ZZ Test Category'$$, 'chk_available_range');
SELECT pg_temp.expect_error('C8  publication year range',
  $$INSERT INTO books (book_code,title,category_id,publication_year)
    SELECT 'ZZ-YR','Year',category_id,1200 FROM categories WHERE name='ZZ Test Category'$$, 'publication_year');
SELECT pg_temp.expect_error('C9  duplicate book code rejected',
  $$INSERT INTO books (book_code,title,category_id)
    SELECT 'ZZ-001','Dup',category_id FROM categories WHERE name='ZZ Test Category'$$, 'books_book_code_key');
SELECT pg_temp.expect_error('C10 book needs an existing category (FK)',
  $$INSERT INTO books (book_code,title,category_id) VALUES ('ZZ-FK','FK',999999)$$, 'foreign key');
SELECT pg_temp.expect_error('C11 category with books cannot be deleted (RESTRICT)',
  $$DELETE FROM categories WHERE name='ZZ Test Category'$$, 'foreign key');
SELECT pg_temp.expect_error('C12 search log needs a query text',
  $$INSERT INTO activity_log (user_id, action) SELECT user_id,'search' FROM users WHERE email='zz.a@test.com'$$, 'chk_activity_target');

-- ======================= 2. BORROWING (trigger + function) ==============
SELECT fn_borrow_book(u.user_id, b.book_id) FROM users u, books b WHERE u.email='zz.a@test.com' AND b.book_code='ZZ-001';
SELECT pg_temp.expect('B1  borrowing reduces available copies',
  (SELECT available_copies FROM books WHERE book_code='ZZ-001') = 0,
  'ZZ-001 available = ' || (SELECT available_copies FROM books WHERE book_code='ZZ-001'));
SELECT pg_temp.expect('B2  due date is 14 days after borrowing',
  (SELECT due_date::date - borrowed_at::date FROM borrowings br JOIN books b USING (book_id) WHERE b.book_code='ZZ-001') = 14);
SELECT pg_temp.expect('B3  borrow is written to the activity log',
  EXISTS (SELECT 1 FROM activity_log al JOIN books b USING (book_id) WHERE b.book_code='ZZ-001' AND al.action='borrow'));
SELECT pg_temp.expect_error('B4  no copy left -> borrow fails',
  $$SELECT fn_borrow_book(u.user_id, b.book_id) FROM users u, books b WHERE u.email='zz.b@test.com' AND b.book_code='ZZ-001'$$, 'No copies');
-- borrow ZZ-002 once, then try again
SELECT fn_borrow_book(u.user_id, b.book_id) FROM users u, books b WHERE u.email='zz.a@test.com' AND b.book_code='ZZ-002';
SELECT pg_temp.expect_error('B5  same book twice by same user is blocked',
  $$SELECT fn_borrow_book(u.user_id, b.book_id) FROM users u, books b WHERE u.email='zz.a@test.com' AND b.book_code='ZZ-002'$$, 'uq_active_borrow');
SELECT fn_borrow_book(u.user_id, b.book_id) FROM users u, books b WHERE u.email='zz.a@test.com' AND b.book_code='ZZ-003';
SELECT pg_temp.expect_error('B6  limit of 3 books at a time',
  $$SELECT fn_borrow_book(u.user_id, b.book_id) FROM users u, books b WHERE u.email='zz.a@test.com' AND b.book_code='ZZ-004'$$, 'Borrow limit');
SELECT pg_temp.expect('B7  failed borrow left availability unchanged',
  (SELECT available_copies FROM books WHERE book_code='ZZ-004') = 2);

-- ======================= 3. RETURN, FINE, RESERVATION QUEUE =============
-- B reserves the unavailable ZZ-001
INSERT INTO reservations (user_id, book_id) SELECT u.user_id, b.book_id FROM users u, books b WHERE u.email='zz.b@test.com' AND b.book_code='ZZ-001';
SELECT pg_temp.expect_error('R1  cannot reserve a book that is available',
  $$INSERT INTO reservations (user_id, book_id) SELECT u.user_id, b.book_id FROM users u, books b WHERE u.email='zz.b@test.com' AND b.book_code='ZZ-004'$$, 'available');
SELECT pg_temp.expect_error('R2  cannot reserve the same book twice',
  $$INSERT INTO reservations (user_id, book_id) SELECT u.user_id, b.book_id FROM users u, books b WHERE u.email='zz.b@test.com' AND b.book_code='ZZ-001'$$, 'uq_active_reservation');
SELECT pg_temp.expect_error('R3  cannot reserve a book you already hold',
  $$INSERT INTO reservations (user_id, book_id) SELECT u.user_id, b.book_id FROM users u, books b WHERE u.email='zz.a@test.com' AND b.book_code='ZZ-001'$$, 'already have');

-- make A's ZZ-001 loan 3 days late, then return it
UPDATE borrowings SET borrowed_at = now() - interval '17 days', due_date = now() - interval '3 days'
 WHERE book_id = (SELECT book_id FROM books WHERE book_code='ZZ-001');
SELECT pg_temp.expect('F1  overdue view lists the late loan',
  EXISTS (SELECT 1 FROM v_overdue_loans WHERE title='Test Book One' AND days_overdue = 3));
-- A returns ZZ-003 first, so the 3-book limit is not what blocks the next borrow
SELECT fn_return_book(borrowing_id) FROM borrowings WHERE book_id=(SELECT book_id FROM books WHERE book_code='ZZ-003') AND returned_at IS NULL;
SELECT pg_temp.expect_error('F2  overdue user cannot borrow more',
  $$SELECT fn_borrow_book(u.user_id, b.book_id) FROM users u, books b WHERE u.email='zz.a@test.com' AND b.book_code='ZZ-004'$$, 'overdue');

SELECT fn_return_book(borrowing_id) FROM borrowings WHERE book_id=(SELECT book_id FROM books WHERE book_code='ZZ-001') AND returned_at IS NULL;
SELECT pg_temp.expect('F3  fine = Rs. 2 x 3 started days = 6.00',
  (SELECT fine_amount FROM borrowings WHERE book_id=(SELECT book_id FROM books WHERE book_code='ZZ-001')) = 6.00,
  'fine = ' || (SELECT fine_amount FROM borrowings WHERE book_id=(SELECT book_id FROM books WHERE book_code='ZZ-001')));
SELECT pg_temp.expect('F4  return sets status = returned',
  (SELECT status FROM borrowings WHERE book_id=(SELECT book_id FROM books WHERE book_code='ZZ-001')) = 'returned');
SELECT pg_temp.expect('F5  return gives the copy back',
  (SELECT available_copies FROM books WHERE book_code='ZZ-001') = 1);
SELECT pg_temp.expect('R4  first waiting reservation becomes READY after the return',
  (SELECT r.status FROM reservations r JOIN books b USING (book_id) WHERE b.book_code='ZZ-001') = 'ready');
SELECT pg_temp.expect_error('F6  returning twice fails',
  $$SELECT fn_return_book(borrowing_id) FROM borrowings WHERE book_id=(SELECT book_id FROM books WHERE book_code='ZZ-001')$$, 'already returned');
SELECT pg_temp.expect_error('F7  a returned loan cannot be re-opened',
  $$UPDATE borrowings SET returned_at = NULL, status='borrowed' WHERE book_id=(SELECT book_id FROM books WHERE book_code='ZZ-001')$$, 'cannot be re-opened');

-- B now borrows the book he reserved -> reservation is fulfilled automatically
SELECT fn_borrow_book(u.user_id, b.book_id) FROM users u, books b WHERE u.email='zz.b@test.com' AND b.book_code='ZZ-001';
SELECT pg_temp.expect('R5  reservation is FULFILLED when the user borrows the book',
  (SELECT r.status FROM reservations r JOIN books b USING (book_id) WHERE b.book_code='ZZ-001') = 'fulfilled');

-- ======================= 4. VIEWS / SEARCH / AGGREGATES =================
SELECT pg_temp.expect('V1  catalog view shows category and loan count',
  EXISTS (SELECT 1 FROM v_book_catalog WHERE book_code='ZZ-001' AND category='ZZ Test Category' AND times_borrowed = 2));
SELECT pg_temp.expect('V2  full-text search finds books by description words (stemming: zebras -> zebra)',
  (SELECT count(*) FROM books WHERE search_tsv @@ websearch_to_tsquery('english', 'zebras migrating')) = 4);
SELECT pg_temp.expect('V3  category statistics view aggregates loans',
  (SELECT total_loans FROM v_category_stats WHERE category='ZZ Test Category') = 4);
SELECT pg_temp.expect('V4  GROUP BY + HAVING (readers with >= 2 loans)',
  (SELECT count(*) FROM (SELECT user_id FROM borrowings GROUP BY user_id HAVING count(*) >= 2) x) >= 1);

-- ======================= 5. TRANSACTION ATOMICITY =======================
DO $$
DECLARE before_n INT; after_n INT;
BEGIN
    SELECT count(*) INTO before_n FROM activity_log WHERE action='borrow';
    BEGIN   -- sub-transaction: fn_borrow_book inserts a loan + a log row, then a later failure undoes both
        PERFORM fn_borrow_book((SELECT user_id FROM users WHERE email='zz.b@test.com'), (SELECT book_id FROM books WHERE book_code='ZZ-004'));
        RAISE EXCEPTION 'simulated crash after borrowing';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    SELECT count(*) INTO after_n FROM activity_log WHERE action='borrow';
    INSERT INTO test_results (test, passed, detail)
    VALUES ('T1  rolled-back transaction leaves no loan, no log row, no stock change',
            before_n = after_n AND (SELECT available_copies FROM books WHERE book_code='ZZ-004') = 2,
            'borrow log rows before=' || before_n || ' after=' || after_n);
END $$;

\o
-- ======================= RESULT ========================================
SELECT id, CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS result, test FROM test_results ORDER BY id;
SELECT count(*) FILTER (WHERE passed) AS passed, count(*) FILTER (WHERE NOT passed) AS failed, count(*) AS total FROM test_results;
SELECT id, test, detail FROM test_results WHERE NOT passed ORDER BY id;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM test_results WHERE NOT passed) THEN
        RAISE EXCEPTION 'DATABASE TESTS FAILED (see FAIL rows above)';
    END IF;
END $$;

ROLLBACK;
