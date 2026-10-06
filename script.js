// ---------- Storage (saved in the browser; swap for a real backend later) ----------
const KEY_LISTINGS = "dm_listings";
const KEY_REQUESTS = "dm_requests";

const load = (key) => {
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
};
const save = (key, data) => localStorage.setItem(key, JSON.stringify(data));

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);
const money = (n) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const validPhone = (p) => /^[0-9]{10}$/.test(p.trim());

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

// ---------- Navigation ----------
function showView(role) {
  ["home", "producer", "consumer"].forEach((v) => ($("view-" + v).hidden = v !== role));
  $("switchRole").hidden = role === "home";
  localStorage.setItem("dm_role", role);
  if (role === "producer") renderProducer();
  if (role === "consumer") renderConsumer();
  window.scrollTo(0, 0);
}

document.querySelectorAll(".role").forEach((btn) =>
  btn.addEventListener("click", () => showView(btn.dataset.role))
);
$("switchRole").addEventListener("click", () => showView("home"));
$("logo").addEventListener("click", (e) => { e.preventDefault(); showView("home"); });

// ---------- Producer ----------
const pForm = $("producerForm");

function updatePreview() {
  const q = parseFloat(pForm.quantity.value) || 0;
  const p = parseFloat(pForm.price.value) || 0;
  $("producerPreview").textContent = "Total value: " + money(q * p);
}
pForm.quantity.addEventListener("input", updatePreview);
pForm.price.addEventListener("input", updatePreview);

pForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = pForm;
  const err = $("producerError");
  const data = {
    id: Date.now(),
    name: f.name.value.trim(),
    phone: f.phone.value.trim(),
    product: f.product.value.trim(),
    quantity: parseFloat(f.quantity.value),
    unit: f.unit.value,
    price: parseFloat(f.price.value),
    location: f.location.value.trim(),
  };
  if (!data.name || !data.product || !data.location) return (err.textContent = "Fill in all the fields.");
  if (!validPhone(data.phone)) return (err.textContent = "Enter a 10-digit phone number.");
  if (!(data.quantity > 0) || !(data.price > 0)) return (err.textContent = "Quantity and price must be more than 0.");

  err.textContent = "";
  const listings = load(KEY_LISTINGS);
  listings.unshift(data);
  save(KEY_LISTINGS, listings);
  f.reset();
  updatePreview();
  renderProducer();
  toast("Listing published");
});

function renderProducer() {
  const listings = load(KEY_LISTINGS);
  const box = $("producerListings");
  if (!listings.length) {
    box.innerHTML = '<p class="empty">No listings yet. Fill in the form to publish your first one.</p>';
    return;
  }
  box.innerHTML = listings.map((l) => `
    <article class="item">
      <h4>${esc(l.product)}</h4>
      <span class="badge">${l.quantity > 0 ? "Available" : "Sold out"}</span>
      <div>${l.quantity} ${esc(l.unit)} left at <span class="price">${money(l.price)} / ${esc(l.unit)}</span></div>
      <div class="meta">${esc(l.name)} · ${esc(l.location)} · ${esc(l.phone)}</div>
      <div class="actions"><button class="ghost" data-del="${l.id}">Remove</button></div>
    </article>`).join("");
}

$("producerListings").addEventListener("click", (e) => {
  const id = e.target.dataset.del;
  if (!id) return;
  save(KEY_LISTINGS, load(KEY_LISTINGS).filter((l) => String(l.id) !== id));
  renderProducer();
  toast("Listing removed");
});

// ---------- Consumer ----------
const cForm = $("consumerForm");
let activeSearch = null; // { product, maxPrice }

cForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = cForm;
  const err = $("consumerError");
  const req = {
    id: Date.now(),
    name: f.name.value.trim(),
    phone: f.phone.value.trim(),
    product: f.product.value.trim(),
    quantity: parseFloat(f.quantity.value),
    maxPrice: parseFloat(f.maxPrice.value),
  };
  if (!req.name || !req.product) return (err.textContent = "Fill in all the fields.");
  if (!validPhone(req.phone)) return (err.textContent = "Enter a 10-digit phone number.");
  if (!(req.quantity > 0) || !(req.maxPrice > 0)) return (err.textContent = "Quantity and price must be more than 0.");

  err.textContent = "";
  const reqs = load(KEY_REQUESTS);
  reqs.unshift(req);
  save(KEY_REQUESTS, reqs);
  activeSearch = req;
  renderConsumer();
  toast("Request saved. Showing matches");
});

function renderConsumer() {
  const box = $("consumerListings");
  let listings = load(KEY_LISTINGS).filter((l) => l.quantity > 0);
  if (activeSearch) {
    const q = activeSearch.product.toLowerCase();
    listings = listings.filter((l) => l.product.toLowerCase().includes(q));
    $("resultsTitle").textContent = `Matches for "${activeSearch.product}"`;
  } else {
    $("resultsTitle").textContent = "Available from producers";
  }
  listings.sort((a, b) => a.price - b.price);

  if (!listings.length) {
    box.innerHTML = '<p class="empty">No producers have listed this yet. Your request is saved, so check back soon.</p>';
    return;
  }
  box.innerHTML = listings.map((l) => {
    const within = activeSearch && l.price <= activeSearch.maxPrice;
    const want = activeSearch ? Math.min(activeSearch.quantity, l.quantity) : 1;
    return `
    <article class="item">
      <h4>${esc(l.product)}</h4>
      ${within ? '<span class="badge">Within your budget</span>' : ""}
      <div><span class="price">${money(l.price)} / ${esc(l.unit)}</span> · ${l.quantity} ${esc(l.unit)} available</div>
      <div class="meta">${esc(l.name)} · ${esc(l.location)} · Call ${esc(l.phone)}</div>
      <div class="actions">
        <input type="number" min="0.01" max="${l.quantity}" step="any" value="${want}" id="buy-${l.id}" aria-label="Quantity to buy">
        <button class="primary" data-buy="${l.id}">Reserve</button>
      </div>
    </article>`;
  }).join("");
}

$("consumerListings").addEventListener("click", (e) => {
  const id = e.target.dataset.buy;
  if (!id) return;
  const listings = load(KEY_LISTINGS);
  const l = listings.find((x) => String(x.id) === id);
  const qty = parseFloat($("buy-" + id).value);
  if (!l || !(qty > 0) || qty > l.quantity) return toast("Enter a quantity up to " + (l ? l.quantity : 0));
  l.quantity = +(l.quantity - qty).toFixed(3);
  save(KEY_LISTINGS, listings);
  renderConsumer();
  toast(`Reserved ${qty} ${l.unit}. Total ${money(qty * l.price)}. Call ${l.phone} to finish`);
});

// ---------- Start ----------
showView("home");
