// End-to-end check of the running web app:  npm run test:smoke
// Start the app first (npm run dev) in another terminal. Needs Node 18+ (built-in fetch).
const BASE = process.env.BASE_URL || 'http://localhost:3000';

class Session {
  cookie = '';
  async call(method, url, body) {
    const res = await fetch(BASE + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.getSetCookie?.() || [];
    for (const c of set) {
      const pair = c.split(';')[0];
      if (pair.startsWith('session=')) this.cookie = pair.endsWith('=') ? '' : pair;
    }
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    return { status: res.status, data };
  }
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '   -> ' + detail}`);
}

async function main() {
  console.log(`\nSmoke test against ${BASE}\n` + '-'.repeat(70));

  const guest = new Session();
  let r = await guest.call('GET', '/api/books');
  if (r.status === 503) {
    console.log('[ERROR] ' + (r.data && r.data.error));
    process.exit(1);
  }
  check('S1  guest can list books', r.status === 200 && r.data.books.length > 0, JSON.stringify(r.data));
  r = await guest.call('GET', '/api/books?q=machine+learning');
  check('S2  full-text search finds machine-learning books', r.status === 200 && r.data.total > 0);
  r = await guest.call('GET', '/api/books?q=universe+and+stars&mode=semantic');
  check('S3  semantic (vector) search works', r.status === 200 && r.data.books.length > 0);
  r = await guest.call('GET', '/api/my');
  check('S4  protected route rejects guests (401)', r.status === 401);
  r = await guest.call('POST', '/api/assistant', { message: 'something like Dune' });
  check('S5  AI assistant answers a guest', r.status === 200 && Array.isArray(r.data.books) && r.data.books.length > 0);

  const student = new Session();
  r = await student.call('POST', '/api/auth/login', { email: 'student@library.com', password: 'wrong' });
  check('S6  wrong password is rejected (401)', r.status === 401);
  r = await student.call('POST', '/api/auth/login', { email: 'student@library.com', password: 'Student@123' });
  check('S7  student can log in', r.status === 200 && r.data.user.role === 'student', JSON.stringify(r.data));

  r = await student.call('GET', '/api/admin/stats');
  check('S8  student is blocked from the admin dashboard (403)', r.status === 403);
  r = await student.call('GET', '/api/recommendations');
  check('S9  personalised recommendations returned', r.status === 200 && r.data.mode === 'personalized' && r.data.personalized.length > 0, JSON.stringify(r.data).slice(0, 200));

  r = await student.call('GET', '/api/books?available=true&limit=50');
  const pick = (r.data.books || []).find((b) => !/Pragmatic Programmer/.test(b.title));
  check('S10 found an available book to borrow', !!pick);
  if (pick) {
    r = await student.call('POST', '/api/borrow', { bookId: pick.book_id });
    check('S11 student borrows a book', r.status === 201 && r.data.borrowing_id, JSON.stringify(r.data));
    const loanId = r.data && r.data.borrowing_id;
    r = await student.call('POST', '/api/borrow', { bookId: pick.book_id });
    check('S12 borrowing the same book twice is blocked', r.status >= 400, JSON.stringify(r.data));
    r = await student.call('GET', '/api/my');
    check('S13 My Library lists the new loan', r.status === 200 && r.data.active.some((l) => l.borrowing_id === loanId));
    if (loanId) {
      r = await student.call('POST', '/api/return', { borrowingId: loanId });
      check('S14 student returns the book (no fine)', r.status === 200 && r.data.fine === 0, JSON.stringify(r.data));
    }
  }

  const lib = new Session();
  r = await lib.call('POST', '/api/auth/login', { email: 'librarian@library.com', password: 'Admin@123' });
  check('S15 librarian can log in', r.status === 200 && r.data.user.role === 'librarian');
  r = await lib.call('GET', '/api/admin/stats');
  check('S16 admin dashboard statistics load', r.status === 200 && r.data.totals.titles > 0);

  const code = 'SMOKE-' + Date.now().toString().slice(-8);
  r = await lib.call('POST', '/api/books', {
    book_code: code, title: 'Smoke Test Book', authors: 'Test Author', category: 'Testing',
    total_copies: 2, publication_year: 2024, description: 'temporary book created by the smoke test',
  });
  check('S17 librarian adds a book', r.status === 201 && r.data.book_id, JSON.stringify(r.data));
  const newId = r.data && r.data.book_id;
  r = await lib.call('POST', '/api/books', { book_code: code, title: 'X', authors: 'Y', category: 'Testing', total_copies: 1 });
  check('S18 duplicate book code is rejected (409)', r.status === 409, JSON.stringify(r.data));
  r = await lib.call('POST', '/api/books', { book_code: 'BAD-1', title: 'Bad', authors: 'Y', category: 'Testing', total_copies: -5 });
  check('S19 negative copies rejected (400)', r.status === 400, JSON.stringify(r.data));
  if (newId) {
    r = await lib.call('DELETE', `/api/books/${newId}`);
    check('S20 librarian deletes the test book', r.status === 200, JSON.stringify(r.data));
  }

  const failed = results.filter((x) => !x.ok).length;
  console.log('-'.repeat(70));
  console.log(`${results.length - failed} passed, ${failed} failed, ${results.length} total\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('\n[ERROR] Could not reach the app at ' + BASE + ' - is "npm run dev" running?\n' + e.message);
  process.exit(1);
});
