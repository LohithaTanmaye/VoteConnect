
require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const supabase = require("./supabaseClient");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// ==========================================
// CANDIDATE DATA
// Used to initialize the candidates table
// if it is empty.
// ==========================================

const defaultCandidates = [
    {
        name: "Arjun Kumar",
        party: "Progressive Alliance",
        symbol: "🌳",
        description:
            "Focused on education, employment and youth development."
    },
    {
        name: "Priya Sharma",
        party: "People's Front",
        symbol: "🌸",
        description:
            "Focused on women's empowerment, healthcare and social welfare."
    },
    {
        name: "Rahul Mehta",
        party: "National Development Party",
        symbol: "⭐",
        description:
            "Focused on infrastructure, technology and economic development."
    },
    {
        name: "Sneha Rao",
        party: "United Citizens Party",
        symbol: "🕊️",
        description:
            "Focused on environmental protection, equality and transparency."
    }
];

// ==========================================
// ADMIN TOKEN HELPERS
// ==========================================

function createAdminToken(username) {
    const payload = Buffer.from(
        JSON.stringify({
            username,
            expiresAt: Date.now() + 2 * 60 * 60 * 1000
        })
    ).toString("base64url");

    const signature = crypto
        .createHmac("sha256", process.env.ADMIN_SESSION_SECRET)
        .update(payload)
        .digest("base64url");

    return `${payload}.${signature}`;
}

function requireAdmin(req, res, next) {
    const authorization = req.headers.authorization || "";
    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({
            message: "Admin authentication required."
        });
    }

    const parts = token.split(".");

    if (parts.length !== 2) {
        return res.status(401).json({
            message: "Invalid admin session."
        });
    }

    const [payload, suppliedSignature] = parts;

    const expectedSignature = crypto
        .createHmac("sha256", process.env.ADMIN_SESSION_SECRET)
        .update(payload)
        .digest();

    let actualSignature;

    try {
        actualSignature = Buffer.from(
            suppliedSignature,
            "base64url"
        );
    } catch {
        return res.status(401).json({
            message: "Invalid admin session."
        });
    }

    if (
        actualSignature.length !== expectedSignature.length ||
        !crypto.timingSafeEqual(actualSignature, expectedSignature)
    ) {
        return res.status(401).json({
            message: "Invalid admin session."
        });
    }

    try {
        const session = JSON.parse(
            Buffer.from(payload, "base64url").toString("utf8")
        );

        if (
            session.username !== process.env.ADMIN_USERNAME ||
            typeof session.expiresAt !== "number" ||
            session.expiresAt <= Date.now()
        ) {
            return res.status(401).json({
                message: "Admin session expired. Please log in again."
            });
        }

        req.admin = { username: session.username };
        next();
    } catch {
        return res.status(401).json({
            message: "Invalid admin session."
        });
    }
}

// ==========================================
// GET CANDIDATES
// ==========================================

app.get("/api/candidates", async (req, res) => {
    try {
        let { data, error } = await supabase
            .from("candidates")
            .select("id, name, party, symbol, description")
            .order("id", { ascending: true });

        if (error) throw error;

        // Populate the table if it is currently empty.
        if (data.length === 0) {
            const result = await supabase
                .from("candidates")
                .insert(defaultCandidates)
                .select("id, name, party, symbol, description");

            if (result.error) throw result.error;
            data = result.data;
        }

        res.json(data);
    } catch (error) {
        console.error("Get candidates error:", error.message);
        res.status(500).json({
            message: "Unable to load candidates."
        });
    }
});

// ==========================================
// REGISTER VOTER
// ==========================================

app.post("/api/voters", async (req, res) => {
    try {
        const {
            name,
            email,
            mobile,
            voterId,
            age,
            gender
        } = req.body;

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof mobile !== "string" ||
            typeof voterId !== "string" ||
            typeof gender !== "string" ||
            !name.trim() ||
            !email.trim() ||
            !mobile.trim() ||
            !voterId.trim() ||
            !gender.trim() ||
            age === undefined ||
            age === null ||
            age === ""
        ) {
            return res.status(400).json({
                message: "Please fill in all required fields."
            });
        }

        const numericAge = Number(age);

        if (!Number.isInteger(numericAge) || numericAge < 18) {
            return res.status(400).json({
                message: "Voter must be 18 years or older."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const { data, error } = await supabase
            .from("voters")
            .insert({
                name: name.trim(),
                email: cleanEmail,
                mobile: mobile.trim(),
                voter_id: voterId.trim(),
                age: numericAge,
                gender: gender.trim(),
                status: "Pending"
            })
            .select(
                "id, name, email, mobile, voter_id, age, gender, status"
            )
            .single();

        if (error) {
            if (error.code === "23505") {
                return res.status(409).json({
                    message:
                        "This email or voter ID is already registered."
                });
            }

            throw error;
        }

        res.status(201).json({
            message: "Registration successful.",
            voter: {
                id: data.id,
                name: data.name,
                email: data.email,
                mobile: data.mobile,
                voterId: data.voter_id,
                age: data.age,
                gender: data.gender,
                status: data.status
            }
        });
    } catch (error) {
        console.error("Register voter error:", error.message);
        res.status(500).json({
            message: "Unable to register voter."
        });
    }
});

// ==========================================
// CHECK VOTER STATUS
// ==========================================

app.get("/api/voters/status", async (req, res) => {
    try {
        const email = req.query.email;

        if (typeof email !== "string" || !email.trim()) {
            return res.status(400).json({
                message: "Email is required."
            });
        }

        const { data, error } = await supabase
            .from("voters")
            .select("name, voter_id, status")
            .eq("email", email.trim().toLowerCase())
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                message:
                    "No voter registration found with this email."
            });
        }

        res.json({
            name: data.name,
            voter_id: data.voter_id,
            status: data.status
        });
    } catch (error) {
        console.error("Voter status error:", error.message);
        res.status(500).json({
            message: "Unable to check voter status."
        });
    }
});

// ==========================================
// ADMIN LOGIN
// ==========================================

app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;

    if (
        !process.env.ADMIN_USERNAME ||
        !process.env.ADMIN_PASSWORD ||
        !process.env.ADMIN_SESSION_SECRET
    ) {
        return res.status(500).json({
            success: false,
            message: "Admin credentials are not configured."
        });
    }

    const validUsername =
        typeof username === "string" &&
        username === process.env.ADMIN_USERNAME;

    const validPassword =
        typeof password === "string" &&
        password === process.env.ADMIN_PASSWORD;

    if (!validUsername || !validPassword) {
        return res.status(401).json({
            success: false,
            message: "Invalid username or password."
        });
    }

    res.json({
        success: true,
        message: "Admin login successful.",
        token: createAdminToken(username)
    });
});

// ==========================================
// GET ALL VOTERS (ADMIN ONLY)
// ==========================================

app.get("/api/admin/voters", requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("voters")
            .select(
                "id, name, email, mobile, voter_id, age, gender, status, created_at"
            )
            .order("created_at", { ascending: false });

        if (error) throw error;

        // Preserve voterId for existing frontend code.
        res.json(
            data.map(voter => ({
                ...voter,
                voterId: voter.voter_id
            }))
        );
    } catch (error) {
        console.error("Get voters error:", error.message);
        res.status(500).json({
            message: "Unable to load voters."
        });
    }
});

// ==========================================
// VERIFY VOTER (ADMIN ONLY)
// ==========================================

app.put(
    "/api/admin/voters/:id/verify",
    requireAdmin,
    async (req, res) => {
        try {
            const id = Number(req.params.id);

            if (!Number.isSafeInteger(id) || id <= 0) {
                return res.status(400).json({
                    message: "Invalid voter ID."
                });
            }

            const { data, error } = await supabase
                .from("voters")
                .update({ status: "Verified" })
                .eq("id", id)
                .select(
                    "id, name, email, mobile, voter_id, age, gender, status"
                )
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                return res.status(404).json({
                    message: "Voter not found."
                });
            }

            res.json({
                message: "Voter verified successfully.",
                voter: { ...data, voterId: data.voter_id }
            });
        } catch (error) {
            console.error("Verify voter error:", error.message);
            res.status(500).json({
                message: "Unable to verify voter."
            });
        }
    }
);

// ==========================================
// REJECT VOTER (ADMIN ONLY)
// ==========================================

app.put(
    "/api/admin/voters/:id/reject",
    requireAdmin,
    async (req, res) => {
        try {
            const id = Number(req.params.id);

            if (!Number.isSafeInteger(id) || id <= 0) {
                return res.status(400).json({
                    message: "Invalid voter ID."
                });
            }

            const { data, error } = await supabase
                .from("voters")
                .update({ status: "Rejected" })
                .eq("id", id)
                .select(
                    "id, name, email, mobile, voter_id, age, gender, status"
                )
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                return res.status(404).json({
                    message: "Voter not found."
                });
            }

            res.json({
                message: "Voter rejected successfully.",
                voter: { ...data, voterId: data.voter_id }
            });
        } catch (error) {
            console.error("Reject voter error:", error.message);
            res.status(500).json({
                message: "Unable to reject voter."
            });
        }
    }
);

// ==========================================
// START SERVER
// ==========================================

if (require.main === module) {
    app.listen(PORT, () => {
        console.log("====================================");
        console.log("       VOTECONNECT SERVER");
        console.log(`   Running at http://localhost:${PORT}`);
        console.log("====================================");
    });
}

module.exports = app;