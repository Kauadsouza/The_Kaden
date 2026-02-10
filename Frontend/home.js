const API = "http://localhost:3001";

async function loadMe() {
  const token = localStorage.getItem("thekaden_token");
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  const r = await fetch(`${API}/api/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await r.json();

  if (!r.ok) {
    localStorage.removeItem("thekaden_token");
    window.location.href = "index.html";
    return;
  }

  const u = data.user;

  document.getElementById("u_name").textContent = u.full_name || u.username;
  document.getElementById("u_email").textContent = u.email;
  document.getElementById("u_company").textContent = u.company_name || "—";
}

document.getElementById("btnLogout").addEventListener("click", () => {
  localStorage.removeItem("thekaden_token");
  window.location.href = "index.html";
});

loadMe();
