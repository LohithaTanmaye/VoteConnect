
const express = require("express");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// SUPABASE CONFIGURATION
// ========================================

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
    supabaseUrl && supabaseKey
        ? createClient(supabaseUrl, supabaseKey)
        : null;

// ========================================
// MIDDLEWARE
// ========================================

app.use(express.json({ limit: "20kb" }));

// ========================================
// STATIC FILES
// ========================================

// Serve frontend files from the project directory.
// Do not expose server-side configuration files.
app.use((req, res, next) => {
    const blockedFiles = new Set([
        "/server.js",
        "/supabaseClient.js",
        "/supabase.sql",
        "/package.json",
        "/package-lock.json",
        "/.env"
    ]);

    if (blockedFiles.has(req.path)) {
        return res.sendStatus(404);
    }

    next();
});

app.use(express.static(path.join(__dirname, "public"), {
    dotfiles: "deny",
    index: false
}));

// ========================================
// FRONTEND ROUTES
// ========================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// ========================================
// ADMIN AUTHENTICATION
// ========================================

const adminSessions = new Map();

function createAdminToken(username) {
    const expiresAt = Date.now() + 60 * 60 * 1000;
    const payload = `${username}:${expiresAt}`;

    const signature = crypto
        .createHmac(
            "sha256",
            process.env.ADMIN_SESSION_SECRET || ""
        )
        .update(payload)
        .digest("hex");

    return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

function verifyAdminToken(token) {
    if (!token) return false;

    const parts = token.split(".");
    if (parts.length !== 2) return false;

    try {
        const payload = Buffer.from(parts[0], "base64url").toString();
        const separator = payload.lastIndexOf(":");

        if (separator === -1) return false;

        const username = payload.slice(0, separator);
        const expiresAt = Number(payload.slice(separator + 1));

        if (!username || !Number.isFinite(expiresAt)) return false;
        if (Date.now() > expiresAt) return false;

        const expected = crypto
            .createHmac(
                "sha256",
                process.env.ADMIN_SESSION_SECRET || ""
            )
            .update(payload)
            .digest();

        const supplied = Buffer.from(parts[1], "hex");

        return supplied.length === expected.length &&
            crypto.timingSafeEqual(supplied, expected);
    } catch {
        return false;
    }
}

function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : "";

    if (!verifyAdminToken(token)) {
        return res.status(401).json({
            error: "Unauthorized. Please log in again."
        });
    }

    next();
}

// ========================================
// ADMIN LOGIN
// ========================================

app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body || {};

    const configuredUsername = process.env.ADMIN_USERNAME;
    const configuredPassword = process.env.ADMIN_PASSWORD;
    const sessionSecret = process.env.ADMIN_SESSION_SECRET;

    if (!configuredUsername || !configuredPassword || !sessionSecret) {
        return res.status(500).json({
            error: "Admin login is not configured."
        });
    }

    const usernameBuffer = Buffer.from(String(username || ""));
    const expectedUsernameBuffer = Buffer.from(configuredUsername);
    const passwordBuffer = Buffer.from(String(password || ""));
    const expectedPasswordBuffer = Buffer.from(configuredPassword);

    const usernameMatches =
        usernameBuffer.length === expectedUsernameBuffer.length &&
        crypto.timingSafeEqual(usernameBuffer, expectedUsernameBuffer);

    const passwordMatches =
        passwordBuffer.length === expectedPasswordBuffer.length &&
        crypto.timingSafeEqual(passwordBuffer, expectedPasswordBuffer);

    if (!usernameMatches || !passwordMatches) {
        return res.status(401).json({
            error: "Invalid username or password."
        });
    }

    const token = createAdminToken(configuredUsername);

    return res.json({
        success: true,
        token,
        expiresIn: 3600
    });
});

// ========================================
// SUPABASE CHECK
// ========================================

function requireSupabase(req, res, next) {
    if (!supabase) {
        return res.status(500).json({
            error: "Database is not configured on the server."
        });
    }

    next();
}

// ========================================
// GET CANDIDATES
// ========================================

app.get("/api/candidates", requireSupabase, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("candidates")
            .select("*");

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error("Get candidates failed:", error.message);
        res.status(500).json({
            error: "Unable to load candidates."
        });
    }
});

// ========================================
// REGISTER VOTER
// ========================================

async function registerVoter(req, res) {
    try {
        const {
            name,
            email,
            mobile,
            voterId,
            age,
            gender
        } = req.body || {};

        if (!name || !email || !mobile || !voterId || !gender) {
            return res.status(400).json({
                error: "Name, email, mobile, voter ID and gender are required."
            });
        }

        const parsedAge = Number(age);

        if (!Number.isInteger(parsedAge) || parsedAge < 18) {
            return res.status(400).json({
                error: "Voter must be 18 years or older."
            });
        }

        const { data, error } = await supabase
            .from("voters")
            .insert([{
                name,
                email,
                mobile,
                voter_id: voterId,
                age: parsedAge,
                gender,
                status: "Pending"
            }])
            .select();

        if (error) {
            if (error.code === "23505") {
                return res.status(409).json({
                    error: "A voter with this email or voter ID already exists."
                });
            }
            throw error;
        }

        res.status(201).json({
            success: true,
            voter: data[0]
        });
    } catch (error) {
        console.error("Voter registration failed:", error.message);
        res.status(500).json({
            error: "Unable to register voter."
        });
    }
}

app.post("/api/register", requireSupabase, registerVoter);
app.post("/api/voters", requireSupabase, registerVoter);

// ========================================
// CHECK VOTER STATUS
// ========================================

app.get("/api/voters/status", requireSupabase, async (req, res) => {
    try {
        const email = String(req.query.email || "").trim();

        if (!email) {
            return res.status(400).json({
                error: "Email is required."
            });
        }

        const { data, error } = await supabase
            .from("voters")
            .select("status")
            .eq("email", email)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                error: "No registration found for this email."
            });
        }

        res.json({ status: data.status });
    } catch (error) {
        console.error("Get voter status failed:", error.message);
        res.status(500).json({
            error: "Unable to check registration status."
        });
    }
});

// ========================================
// ADMIN: VIEW VOTERS
// ========================================

app.get(
    "/api/admin/voters",
    requireAdmin,
    requireSupabase,
    async (req, res) => {
        try {
            const { data, error } = await supabase
                .from("voters")
                .select("*");

            if (error) throw error;

            res.json(data);
        } catch (error) {
            console.error("Get voters failed:", error.message);
            res.status(500).json({
                error: "Unable to load voters."
            });
        }
    }
);

// ========================================
// ADMIN: VERIFY/REJECT VOTER
// ========================================

async function updateVoterStatus(req, res, status) {
    try {
        const { data, error } = await supabase
            .from("voters")
            .update({ status })
            .eq("id", req.params.id)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({
                error: "Voter registration not found."
            });
        }

        res.json({
            success: true,
            voter: data[0]
        });
    } catch (error) {
        console.error(`Update voter status failed (${status}):`, error.message);
        res.status(500).json({
            error: `Unable to ${status.toLowerCase()} voter.`
        });
    }
}

app.put(
    "/api/admin/voters/:id/verify",
    requireAdmin,
    requireSupabase,
    async (req, res) => {
        await updateVoterStatus(req, res, "Verified");
    }
);

app.put(
    "/api/admin/voters/:id/reject",
    requireAdmin,
    requireSupabase,
    async (req, res) => {
        await updateVoterStatus(req, res, "Rejected");
    }
);

// ========================================
// ADMIN: ADD CANDIDATE
// ========================================

app.post(
    "/api/admin/candidates",
    requireAdmin,
    requireSupabase,
    async (req, res) => {
        try {
            const { name, party, description } = req.body || {};

            if (!name) {
                return res.status(400).json({
                    error: "Candidate name is required."
                });
            }

            const { data, error } = await supabase
                .from("candidates")
                .insert([{
                    name,
                    party: party || null,
                    description: description || null
                }])
                .select();

            if (error) throw error;

            res.status(201).json({
                success: true,
                candidate: data[0]
            });
        } catch (error) {
            console.error("Add candidate failed:", error.message);
            res.status(500).json({
                error: "Unable to add candidate."
            });
        }
    }
);

// ========================================
// ADMIN: DELETE CANDIDATE
// ========================================

app.delete(
    "/api/admin/candidates/:id",
    requireAdmin,
    requireSupabase,
    async (req, res) => {
        try {
            const { error } = await supabase
                .from("candidates")
                .delete()
                .eq("id", req.params.id);

            if (error) throw error;

            res.json({ success: true });
        } catch (error) {
            console.error("Delete candidate failed:", error.message);
            res.status(500).json({
                error: "Unable to delete candidate."
            });
        }
    }
);

// ========================================
// NOT FOUND
// ========================================

app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: "Not found" });
    }

    res.status(404).send("Not found");
});

// ========================================
// ERROR HANDLER
// ========================================

app.use((error, req, res, next) => {
    console.error("Server error:", error.message);

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).json({
        error: "Internal server error."
    });
});

// ========================================
// START SERVER
// ========================================

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`VoteConnect running at http://localhost:${PORT}`);
    });
}

module.exports = app;