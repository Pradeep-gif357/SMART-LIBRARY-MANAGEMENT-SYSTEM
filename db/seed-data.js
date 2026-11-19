// Sample catalogue. Descriptions are short original summaries written for this project.
// [code, title, [authors], category, year, copies, description]
export const BOOKS = [
  // ---- Programming ----
  ['SL-0001', 'Clean Code', ['Robert C. Martin'], 'Programming', 2008, 3,
    'A practical guide to writing readable, maintainable software. Covers naming, functions, refactoring and the craftsmanship habits of a professional developer.'],
  ['SL-0002', 'The Pragmatic Programmer', ['Andrew Hunt', 'David Thomas'], 'Programming', 1999, 2,
    'Tips and philosophy for software developers: debugging, automation, testing and growing as an engineer who writes flexible code.'],
  ['SL-0003', 'Python Crash Course', ['Eric Matthes'], 'Programming', 2015, 4,
    'A hands-on introduction to Python programming. Learn coding basics, then build games, data visualizations and a small web application.'],
  ['SL-0004', 'Eloquent JavaScript', ['Marijn Haverbeke'], 'Programming', 2011, 2,
    'A modern introduction to JavaScript programming covering code structure, algorithms, browsers and building software for the web.'],

  // ---- Computer Science ----
  ['SL-0005', 'Introduction to Algorithms', ['Thomas H. Cormen', 'Charles E. Leiserson', 'Ronald L. Rivest', 'Clifford Stein'], 'Computer Science', 1990, 2,
    'The standard university text on algorithms and data structures: sorting, graphs, dynamic programming, analysis and proofs.'],
  ['SL-0006', 'Database System Concepts', ['Abraham Silberschatz', 'Henry F. Korth', 'S. Sudarshan'], 'Computer Science', 1986, 3,
    'A complete course on database systems: the relational model, SQL, query processing, transactions, indexing and storage design.'],
  ['SL-0007', 'Designing Data-Intensive Applications', ['Martin Kleppmann'], 'Computer Science', 2017, 2,
    'Explains how modern data systems work: database storage, replication, distributed systems, transactions, scalability and reliability.'],
  ['SL-0008', 'Operating System Concepts', ['Abraham Silberschatz', 'Peter B. Galvin', 'Greg Gagne'], 'Computer Science', 1983, 2,
    'Core ideas of operating systems: processes, threads, scheduling, memory management, file systems and the kernel of a computer.'],
  ['SL-0009', 'Computer Networking: A Top-Down Approach', ['James F. Kurose', 'Keith W. Ross'], 'Computer Science', 2000, 2,
    'Teaches computer networking from applications down to the wire: the internet, protocols, TCP, routing and network security.'],

  // ---- Artificial Intelligence ----
  ['SL-0010', 'Artificial Intelligence: A Modern Approach', ['Stuart Russell', 'Peter Norvig'], 'Artificial Intelligence', 1995, 2,
    'A broad textbook on artificial intelligence: search, logic, probabilistic reasoning, machine learning, neural networks and intelligent agents.'],
  ['SL-0011', 'Deep Learning', ['Ian Goodfellow', 'Yoshua Bengio', 'Aaron Courville'], 'Artificial Intelligence', 2016, 2,
    'The foundations of deep learning: neural networks, optimization, convolutional models and machine learning theory for researchers and students.'],
  ['SL-0012', 'Mathematics for Machine Learning', ['Marc Peter Deisenroth', 'A. Aldo Faisal', 'Cheng Soon Ong'], 'Artificial Intelligence', 2020, 2,
    'Linear algebra, calculus, probability and statistics presented for machine learning and data science learners.'],

  // ---- Mathematics ----
  ['SL-0013', 'Introduction to Linear Algebra', ['Gilbert Strang'], 'Mathematics', 1993, 2,
    'A friendly course in linear algebra: vectors, matrices, eigenvalues and applications used in engineering and data science.'],
  ['SL-0014', 'The Man Who Knew Infinity', ['Robert Kanigel'], 'Biography', 1991, 1,
    'The life story of the Indian mathematician Srinivasa Ramanujan and his remarkable partnership with a Cambridge professor.'],

  // ---- Science ----
  ['SL-0015', 'A Brief History of Time', ['Stephen Hawking'], 'Science', 1988, 3,
    'An accessible tour of the universe: black holes, the big bang, space, time, quantum physics and relativity.'],
  ['SL-0016', 'Cosmos', ['Carl Sagan'], 'Science', 1980, 2,
    'A journey through the universe and the history of astronomy, from ancient stargazers to modern space exploration and physics.'],
  ['SL-0017', 'Astrophysics for People in a Hurry', ['Neil deGrasse Tyson'], 'Science', 2017, 3,
    'Short, lively chapters on the universe: stars, galaxies, dark matter, planets and the physics behind them.'],
  ['SL-0018', 'The Selfish Gene', ['Richard Dawkins'], 'Science', 1976, 2,
    'A classic on evolution and genetics, arguing that genes are the units that drive natural selection among species.'],
  ['SL-0019', 'The Gene: An Intimate History', ['Siddhartha Mukherjee'], 'Science', 2016, 2,
    'The story of the gene and heredity, from early experiments to modern genetics, DNA research and medicine.'],

  // ---- Fiction ----
  ['SL-0020', 'Nineteen Eighty-Four', ['George Orwell'], 'Fiction', 1949, 3,
    'A dystopian novel about a totalitarian government, constant surveillance, propaganda and one man resisting its power.'],
  ['SL-0021', 'To Kill a Mockingbird', ['Harper Lee'], 'Fiction', 1960, 2,
    'A classic novel of justice, childhood and prejudice in a small American town, told through a young girl.'],
  ['SL-0022', 'The Great Gatsby', ['F. Scott Fitzgerald'], 'Fiction', 1925, 2,
    'A classic novel of wealth, love and illusion in 1920s America, centred on the mysterious Jay Gatsby.'],
  ['SL-0023', 'Pride and Prejudice', ['Jane Austen'], 'Fiction', 1813, 3,
    'A classic romance novel about love, marriage, manners and social class, following Elizabeth Bennet and Mr Darcy.'],
  ['SL-0024', 'The Alchemist', ['Paulo Coelho'], 'Fiction', 1988, 4,
    'A short adventure novel about a shepherd who travels in search of treasure and learns to follow his dreams.'],
  ['SL-0025', 'The God of Small Things', ['Arundhati Roy'], 'Fiction', 1997, 2,
    'A novel set in Kerala, India about twins, family secrets, love and the rigid social rules of caste and class.'],
  ['SL-0026', "Midnight's Children", ['Salman Rushdie'], 'Fiction', 1981, 2,
    'A novel of India\'s independence and partition, narrated by a boy born at the very moment the nation was born.'],

  // ---- Fantasy & Sci-Fi ----
  ["SL-0027", "Harry Potter and the Philosopher's Stone", ['J. K. Rowling'], 'Fantasy & Sci-Fi', 1997, 4,
    'A young boy discovers he is a wizard and starts his magic education at Hogwarts, where adventure and mystery await.'],
  ['SL-0028', 'The Hobbit', ['J. R. R. Tolkien'], 'Fantasy & Sci-Fi', 1937, 3,
    'A fantasy adventure: a quiet hobbit joins wizard and dwarves on a quest to a dragon-guarded treasure in a far kingdom.'],
  ['SL-0029', 'Dune', ['Frank Herbert'], 'Fantasy & Sci-Fi', 1965, 1,
    'A science fiction epic of politics, power and survival on a desert planet that holds the most valuable resource in the galactic empire.'],
  ['SL-0030', 'Foundation', ['Isaac Asimov'], 'Fantasy & Sci-Fi', 1951, 2,
    'A science fiction classic about a mathematician who predicts the fall of a galactic empire and plans to preserve knowledge for the future.'],

  // ---- Self-Help ----
  ['SL-0031', 'Atomic Habits', ['James Clear'], 'Self-Help', 2018, 4,
    'A practical system for building good habits and breaking bad ones through small changes that improve productivity and personal growth.'],
  ['SL-0032', 'Deep Work', ['Cal Newport'], 'Self-Help', 2016, 2,
    'Rules for focused success in a distracted world: build discipline and focus to produce valuable work and improve productivity.'],
  ['SL-0033', 'Thinking, Fast and Slow', ['Daniel Kahneman'], 'Self-Help', 2011, 2,
    'A psychology classic on how the mind makes decisions, with two systems of thinking and the biases that shape human behavior.'],

  // ---- Business ----
  ['SL-0034', 'The Lean Startup', ['Eric Ries'], 'Business', 2011, 2,
    'How entrepreneurs build a startup business through rapid experiments, learning from customers and continuous innovation.'],
  ['SL-0035', 'Zero to One', ['Peter Thiel', 'Blake Masters'], 'Business', 2014, 2,
    'Notes on startups and innovation: how to build a company that creates something new and valuable for the future.'],
  ['SL-0036', 'Rich Dad Poor Dad', ['Robert T. Kiyosaki'], 'Business', 1997, 3,
    'Personal finance lessons about money, investing and building wealth, told through two contrasting father figures.'],

  // ---- History ----
  ['SL-0037', 'Sapiens: A Brief History of Humankind', ['Yuval Noah Harari'], 'History', 2011, 3,
    'A sweeping history of the human species, from ancient hunters to modern civilization, society and culture.'],
  ['SL-0038', 'Guns, Germs, and Steel', ['Jared Diamond'], 'History', 1997, 2,
    'Explains why some civilizations and empires came to dominate others, tracing history through geography, disease and technology.'],
  ['SL-0039', 'India After Gandhi', ['Ramachandra Guha'], 'History', 2007, 2,
    'A history of independent India: the nation, its democracy, politics, culture and struggles since independence.'],
  ['SL-0040', 'The Discovery of India', ['Jawaharlal Nehru'], 'History', 1946, 2,
    'Nehru reflects on Indian history, philosophy and culture, from ancient civilization to the freedom movement.'],

  // ---- Biography ----
  ['SL-0041', 'Wings of Fire', ['A. P. J. Abdul Kalam', 'Arun Tiwari'], 'Biography', 1999, 4,
    'The inspiring autobiography of India\'s missile scientist and president Kalam, from a small town to space and defence research.'],
  ['SL-0042', 'My Experiments with Truth', ['M. K. Gandhi'], 'Biography', 1927, 2,
    'Gandhi\'s autobiography: his life story, moral experiments and the early development of his ideas on truth and freedom in India.'],
  ['SL-0043', 'Steve Jobs', ['Walter Isaacson'], 'Biography', 2011, 2,
    'A biography of the Apple co-founder: his innovation, demanding personality and the products that changed computers and business.'],

  // ---- Poetry ----
  ['SL-0044', 'Gitanjali', ['Rabindranath Tagore'], 'Poetry', 1910, 2,
    'A collection of spiritual poems and songs by the Indian poet Tagore, offering devotion, verse and reflections on life.'],
];
