
/* ==========================================
   VOTECONNECT - MAIN SCRIPT
   ========================================== */


/* ==========================================
   LOAD CANDIDATES
   ========================================== */

async function loadCandidates() {
    const container = document.getElementById("candidateContainer");

    if (!container) {
        return;
    }

    try {
        const response = await fetch("/api/candidates");

        if (!response.ok) {
            throw new Error("Failed to load candidates.");
        }

        const candidates = await response.json();

        container.innerHTML = "";

        if (!Array.isArray(candidates) || candidates.length === 0) {
            container.textContent = "No candidates available.";
            return;
        }

        candidates.forEach(candidate => {
            const card = document.createElement("div");
            card.className = "candidate-card";

            const symbol = document.createElement("div");
            symbol.className = "candidate-symbol";
            symbol.textContent = candidate.symbol || "";

            const name = document.createElement("h2");
            name.textContent = candidate.name || "";

            const party = document.createElement("p");
            party.className = "candidate-party";
            party.textContent = candidate.party || "";

            const description = document.createElement("p");
            description.textContent = candidate.description || "";

            card.append(symbol, name, party, description);
            container.appendChild(card);
        });

    } catch (error) {
        console.error("Candidate loading error:", error);
        container.textContent = "Unable to load candidates.";
    }
}


/* ==========================================
   VOTER REGISTRATION
   ========================================== */

const voterForm = document.getElementById("voterForm");

if (voterForm) {
    voterForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const mobile = document.getElementById("mobile").value.trim();
        const voterId = document.getElementById("voterId").value.trim();
        const age = Number(document.getElementById("age").value);
        const gender = document.getElementById("gender").value;
        const message = document.getElementById("formMessage");

        if (!message) {
            return;
        }

        if (!name || !email || !mobile || !voterId || !gender) {
            message.textContent = "Please fill in all required fields.";
            message.style.color = "#C982A0";
            return;
        }

        if (!Number.isInteger(age) || age < 18) {
            message.textContent = "Voter must be 18 years or older.";
            message.style.color = "#C982A0";
            return;
        }

        try {
            const response = await fetch("/api/voters", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    email,
                    mobile,
                    voterId,
                    age,
                    gender
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Registration failed.");
            }

            message.textContent =
                "Registration successful! Your application is pending admin verification.";
            message.style.color = "#8064B5";

            voterForm.reset();

        } catch (error) {
            message.textContent = error.message;
            message.style.color = "#C982A0";
        }
    });
}


/* ==========================================
   CHECK VOTER STATUS
   ========================================== */

const statusForm = document.getElementById("statusForm");

if (statusForm) {
    statusForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("statusEmail").value.trim();
        const result = document.getElementById("statusResult");

        if (!result) {
            return;
        }

        try {
            const response = await fetch(
                `/api/voters/status?email=${encodeURIComponent(email)}`
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Unable to check status.");
            }

            result.replaceChildren();

            const wrapper = document.createElement("div");
            wrapper.className = "status-result";

            const details = [
                ["Name:", data.name],
                ["Voter ID:", data.voter_id || data.voterId],
                ["Status:", data.status]
            ];

            details.forEach(([label, value]) => {
                const paragraph = document.createElement("p");
                const strong = document.createElement("strong");

                strong.textContent = `${label} `;
                paragraph.append(strong, document.createTextNode(value ?? ""));
                wrapper.appendChild(paragraph);
            });

            result.appendChild(wrapper);

        } catch (error) {
            result.textContent = error.message;
        }
    });
}


/* ==========================================
   ADMIN LOGIN
   ========================================== */

const adminLoginForm = document.getElementById("adminLoginForm");

if (adminLoginForm) {
    adminLoginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const username =
            document.getElementById("adminUsername").value.trim();

        const password =
            document.getElementById("adminPassword").value;

        const message = document.getElementById("loginMessage");

        if (message) {
            message.textContent = "";
        }

        try {
            const response = await fetch("/api/admin/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username,
                    password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Login failed.");
            }

            if (!data.token) {
                throw new Error(
                    "The server did not return an authentication token."
                );
            }

            sessionStorage.setItem("adminToken", data.token);

            window.location.href = "admin.html";

        } catch (error) {
            if (message) {
                message.textContent = error.message;
                message.style.color = "#C982A0";
            }
        }
    });
}


/* ==========================================
   ADMIN AUTHENTICATION HELPER
   ========================================== */

function getAdminToken() {
    return sessionStorage.getItem("adminToken");
}

function redirectToAdminLogin() {
    sessionStorage.removeItem("adminToken");
    window.location.href = "adminlogin.html";
}


/* ==========================================
   LOAD ADMIN VOTERS
   ========================================== */

async function loadVoters() {
    const tableBody = document.getElementById("voterTableBody");

    if (!tableBody) {
        return;
    }

    const token = getAdminToken();

    if (!token) {
        redirectToAdminLogin();
        return;
    }

    try {
        const response = await fetch("/api/admin/voters", {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.status === 401 || response.status === 403) {
            redirectToAdminLogin();
            return;
        }

        const voters = await response.json();

        if (!response.ok) {
            throw new Error(
                voters.message || "Failed to load voter registrations."
            );
        }

        tableBody.innerHTML = "";

        if (!Array.isArray(voters) || voters.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 9;
            cell.className = "loading";
            cell.textContent = "No voter registrations found.";

            row.appendChild(cell);
            tableBody.appendChild(row);
            return;
        }

        voters.forEach(voter => {
            const row = document.createElement("tr");

            const values = [
                voter.id,
                voter.name,
                voter.email,
                voter.mobile,
                voter.voter_id ?? voter.voterId,
                voter.age,
                voter.gender,
                voter.status
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value ?? "";
                row.appendChild(cell);
            });

            const actionsCell = document.createElement("td");

            const verifyButton = document.createElement("button");
            verifyButton.type = "button";
            verifyButton.className = "btn btn-primary";
            verifyButton.textContent = "Verify";
            verifyButton.disabled = voter.status === "Verified";
            verifyButton.addEventListener("click", () => {
                verifyVoter(voter.id);
            });

            const rejectButton = document.createElement("button");
            rejectButton.type = "button";
            rejectButton.className = "btn btn-secondary";
            rejectButton.textContent = "Reject";
            rejectButton.disabled = voter.status === "Rejected";
            rejectButton.addEventListener("click", () => {
                rejectVoter(voter.id);
            });

            actionsCell.append(verifyButton, rejectButton);
            row.appendChild(actionsCell);

            tableBody.appendChild(row);
        });

    } catch (error) {
        console.error("Loading voters error:", error);

        tableBody.innerHTML = "";

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 9;
        cell.className = "loading";
        cell.textContent = error.message;

        row.appendChild(cell);
        tableBody.appendChild(row);
    }
}


/* ==========================================
   VERIFY VOTER
   ========================================== */

async function verifyVoter(id) {
    const token = getAdminToken();

    if (!token) {
        redirectToAdminLogin();
        return;
    }

    const message = document.getElementById("adminMessage");

    try {
        const response = await fetch(
            `/api/admin/voters/${encodeURIComponent(id)}/verify`,
            {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (response.status === 401 || response.status === 403) {
            redirectToAdminLogin();
            return;
        }

        if (!response.ok) {
            throw new Error(data.message || "Verification failed.");
        }

        if (message) {
            message.textContent = "Voter verified successfully.";
            message.style.color = "#8064B5";
        }

        await loadVoters();

    } catch (error) {
        if (message) {
            message.textContent = error.message;
            message.style.color = "#C982A0";
        }
    }
}


/* ==========================================
   REJECT VOTER
   ========================================== */

async function rejectVoter(id) {
    const token = getAdminToken();

    if (!token) {
        redirectToAdminLogin();
        return;
    }

    const message = document.getElementById("adminMessage");

    try {
        const response = await fetch(
            `/api/admin/voters/${encodeURIComponent(id)}/reject`,
            {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (response.status === 401 || response.status === 403) {
            redirectToAdminLogin();
            return;
        }

        if (!response.ok) {
            throw new Error(data.message || "Rejection failed.");
        }

        if (message) {
            message.textContent = "Voter rejected successfully.";
            message.style.color = "#8064B5";
        }

        await loadVoters();

    } catch (error) {
        if (message) {
            message.textContent = error.message;
            message.style.color = "#C982A0";
        }
    }
}


/* ==========================================
   ADMIN LOGOUT
   ========================================== */

function adminLogout() {
    sessionStorage.removeItem("adminToken");
    window.location.href = "adminlogin.html";
}


/* ==========================================
   PAGE LOAD
   ========================================== */

document.addEventListener("DOMContentLoaded", function () {
    loadCandidates();
    loadVoters();
});