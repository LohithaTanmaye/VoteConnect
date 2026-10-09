-- ==========================================
-- VOTECONNECT DATABASE
-- ==========================================

CREATE TABLE voters (

    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(100) NOT NULL,

    email VARCHAR(150) UNIQUE NOT NULL,

    mobile VARCHAR(15) NOT NULL,

    voter_id VARCHAR(50) UNIQUE NOT NULL,

    age INTEGER NOT NULL CHECK (age >= 18),

    gender VARCHAR(20) NOT NULL,

    status VARCHAR(20)
        DEFAULT 'Pending'
        CHECK (
            status IN (
                'Pending',
                'Verified',
                'Rejected'
            )
        ),

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP

);


-- ==========================================
-- SAMPLE CANDIDATES TABLE
-- ==========================================

CREATE TABLE candidates (

    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(100) NOT NULL,

    party VARCHAR(100) NOT NULL,

    symbol VARCHAR(20),

    description TEXT

);