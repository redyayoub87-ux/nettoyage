// ============================================================
//  APP GESTION (PC) — logique
// ============================================================
const $ = (s) => document.querySelector(s);
const URL_SB = CONFIG.SUPABASE_URL.replace(/\/$/, "");
const SEAU = "photos";

function lire(cle) { try { return localStorage.getItem(cle); } catch (e) { return null; } }
function ecrire(cle, val) { try { val == null ? localStorage.removeItem(cle) : localStorage.setItem(cle, val); } catch (e) {} }

let session = null;
try { session = JSON.parse(lire("session-gestion")); } catch (e) {}

function dossier(chambre) { return "chambre-" + chambre.replace(/[^a-zA-Z0-9_-]/g, "_"); }
function memeJour(a, b) { return a.toDateString() === b.toDateString(); }
function heure(d) { return d.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" }); }

// ---------- Connexion (Supabase Auth) ----------
async function auth(type, corps) {
  const rep = await fetch(`${URL_SB}/auth/v1/token?grant_type=${type}`, {
    method: "POST",
    headers: { apikey: CONFIG.SUPABASE_CLE, "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
  const donnees = await rep.json().catch(() => ({}));
  if (!rep.ok) throw new Error(donnees.error_description || donnees.msg || "Connexion refusée");
  session = {
    access_token: donnees.access_token,
    refresh_token: donnees.refresh_token,
    expire: Date.now() + (donnees.expires_in - 60) * 1000,
  };
  ecrire("session-gestion", JSON.stringify(session));
}

async function jetonValide() {
  if (!session) throw new Error("non connecté");
  if (Date.now() > session.expire) await auth("refresh_token", { refresh_token: session.refresh_token });
  return session.access_token;
}

async function api(chemin, options = {}) {
  const jeton = await jetonValide();
  const rep = await fetch(`${URL_SB}/storage/v1${chemin}`, {
    ...options,
    headers: { apikey: CONFIG.SUPABASE_CLE, Authorization: "Bearer " + jeton, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (rep.status === 401 || rep.status === 403) { deconnexion(); throw new Error("Session expirée"); }
  if (!rep.ok) throw new Error(await rep.text());
  return rep.json();
}

function deconnexion() {
  session = null;
  ecrire("session-gestion", null);
  clearInterval(minuterie);
  vueConnexion();
}

// ---------- Photos ----------
// Pour chaque chambre : garde la photo la plus récente, supprime les anciennes.
async function chargerChambre(chambre) {
  const fichiers = await api(`/object/list/${SEAU}`, {
    method: "POST",
    body: JSON.stringify({ prefix: dossier(chambre), limit: 100, sortBy: { column: "created_at", order: "desc" } }),
  });
  const photos = fichiers.filter((f) => f.id && f.name.endsWith(".jpg"));
  photos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const [derniere, ...anciennes] = photos;

  if (anciennes.length) {
    api(`/object/${SEAU}`, {
      method: "DELETE",
      body: JSON.stringify({ prefixes: anciennes.map((f) => `${dossier(chambre)}/${f.name}`) }),
    }).catch((e) => console.warn("Nettoyage impossible", e));
  }
  if (!derniere) return { chambre, photo: null };

  const chemin = `${dossier(chambre)}/${derniere.name}`;
  const signe = await api(`/object/sign/${SEAU}/${chemin}`, { method: "POST", body: JSON.stringify({ expiresIn: 3600 }) });
  return {
    chambre,
    chemin,
    date: new Date(derniere.created_at),
    url: `${URL_SB}/storage/v1${signe.signedURL}`,
  };
}

let resultats = [];

async function actualiser() {
  const maintenant = new Date();
  $("#date-jour").textContent = maintenant.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" });
  $("#maj").textContent = "Chargement…";
  try {
    resultats = await Promise.all(CONFIG.CHAMBRES.map((c) =>
      chargerChambre(c).catch((e) => { console.error(c, e); return { chambre: c, photo: null, erreur: true }; })
    ));
    afficherGrille();
    $("#maj").textContent = "Mis à jour à " + heure(new Date()) + " · actualisation automatique toutes les 2 minutes";
  } catch (e) {
    $("#maj").textContent = "Erreur : " + e.message;
  }
}

function afficherGrille() {
  const auj = new Date();
  const faites = resultats.filter((r) => r.date && memeJour(r.date, auj)).length;
  $("#compteur").innerHTML = `<strong>${faites} / ${resultats.length}</strong> chambres ont envoyé leur photo aujourd'hui`;

  const seulementManquantes = $("#filtre-manquantes").checked;
  const grille = $("#grille");
  grille.innerHTML = "";

  resultats.forEach((r) => {
    const ok = r.date && memeJour(r.date, auj);
    if (seulementManquantes && ok) return;

    const caseEl = document.createElement("article");
    caseEl.className = "case " + (ok ? "ok" : "manque");

    const zone = document.createElement("button");
    zone.className = "case-img";
    if (r.url) {
      const img = document.createElement("img");
      img.src = r.url;
      img.alt = "Chambre " + r.chambre;
      img.loading = "lazy";
      zone.appendChild(img);
      zone.classList.add("cliquable");
      zone.onclick = () => ouvrir(r);
    } else {
      zone.textContent = r.erreur ? "⚠️" : "📷";
      zone.disabled = true;
    }

    let texteBadge;
    if (ok) texteBadge = "✓ " + heure(r.date);
    else if (r.date) texteBadge = "Dernière : " + r.date.toLocaleDateString("fr-BE", { day: "numeric", month: "short" });
    else texteBadge = r.erreur ? "Erreur" : "Pas encore";

    const info = document.createElement("div");
    info.className = "case-info";
    info.innerHTML = `<span class="case-num"></span><span class="badge ${ok ? "ok" : "manque"}"></span>`;
    info.querySelector(".case-num").textContent = "Chambre " + r.chambre;
    info.querySelector(".badge").textContent = texteBadge;

    caseEl.append(zone, info);
    grille.appendChild(caseEl);
  });
}

// ---------- Visionneuse ----------
let photoOuverte = null;
function ouvrir(r) {
  photoOuverte = r;
  $("#visionneuse-titre").textContent = `Chambre ${r.chambre} — ${r.date.toLocaleString("fr-BE")}`;
  $("#visionneuse-img").src = r.url;
  $("#visionneuse").showModal();
}
$("#bouton-fermer").onclick = () => $("#visionneuse").close();
$("#visionneuse").addEventListener("click", (e) => { if (e.target.id === "visionneuse") e.target.close(); });
$("#bouton-supprimer").onclick = async () => {
  if (!photoOuverte) return;
  try {
    await api(`/object/${SEAU}`, { method: "DELETE", body: JSON.stringify({ prefixes: [photoOuverte.chemin] }) });
    $("#visionneuse").close();
    actualiser();
  } catch (e) {
    $("#visionneuse-titre").textContent = "Suppression impossible : " + e.message;
  }
};

// ---------- QR codes ----------
function adresseApp() {
  return new URL("index.html", location.href).href;
}
let qrFaits = false;
function afficherQR() {
  const base = adresseApp();
  $("#adresse-app").textContent = base;
  if (qrFaits) return;
  const grille = $("#grille-qr");
  grille.innerHTML = "";
  CONFIG.CHAMBRES.forEach((c) => {
    const et = document.createElement("div");
    et.className = "etiquette";
    et.innerHTML = `<div class="etiquette-sous">🧹 🛏️ 🗑️</div><div class="qr"></div><div class="etiquette-titre"></div>`;
    et.querySelector(".etiquette-titre").textContent = "Chambre " + c;
    const qr = qrcode(0, "M");
    qr.addData(`${base}?chambre=${encodeURIComponent(c)}`);
    qr.make();
    et.querySelector(".qr").innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    grille.appendChild(et);
  });
  qrFaits = true;
}

// ---------- Onglets ----------
document.querySelectorAll(".onglet").forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll(".onglet").forEach((o) => o.classList.toggle("actif", o === b));
    $("#onglet-photos").hidden = b.dataset.onglet !== "photos";
    $("#onglet-qr").hidden = b.dataset.onglet !== "qr";
    if (b.dataset.onglet === "qr") afficherQR();
  };
});

// ---------- Vues ----------
let minuterie = null;
function vueConnexion() {
  $("#vue-tableau").hidden = true;
  $("#vue-connexion").hidden = false;
  $("#alerte-config").hidden = !!(URL_SB && CONFIG.SUPABASE_CLE);
}
function vueTableau() {
  $("#vue-connexion").hidden = true;
  $("#vue-tableau").hidden = false;
  actualiser();
  clearInterval(minuterie);
  minuterie = setInterval(actualiser, 2 * 60 * 1000);
}

$("#form-connexion").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#erreur-connexion").textContent = "";
  if (!URL_SB || !CONFIG.SUPABASE_CLE) {
    $("#erreur-connexion").textContent = "Configure d'abord config.js.";
    return;
  }
  try {
    await auth("password", { email: $("#email").value.trim(), password: $("#mdp").value });
    vueTableau();
  } catch (err) {
    $("#erreur-connexion").textContent = err.message;
  }
});
$("#bouton-deconnexion").onclick = deconnexion;
$("#bouton-actualiser").onclick = actualiser;
$("#filtre-manquantes").onchange = afficherGrille;

// ---------- Installation sur PC ----------
let invitation = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  invitation = e;
  $("#bouton-installer").hidden = false;
});
$("#bouton-installer").onclick = async () => {
  if (!invitation) return;
  invitation.prompt();
  await invitation.userChoice;
  invitation = null;
  $("#bouton-installer").hidden = true;
};
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

// ---------- Démarrage ----------
session ? vueTableau() : vueConnexion();
