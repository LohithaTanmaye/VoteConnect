
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

if (!process.env.SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
        "Missing Supabase credentials. Check your .env file."
    );
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = supabase;