// ============================================================
//  APP RÉSIDENTS — logique
// ============================================================
const $ = (s) => document.querySelector(s);

function lire(cle) { try { return localStorage.getItem(cle); } catch (e) { return null; } }
function ecrire(cle, val) { try { localStorage.setItem(cle, val); } catch (e) {} }

function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const etat = {
  langue: lire("langue"),
  chambre: lire("chambre"),
  photo: null,
};

// La chambre peut venir du QR code : ...?chambre=12
const chambreQR = new URLSearchParams(location.search).get("chambre");
if (chambreQR && CONFIG.CHAMBRES.includes(chambreQR)) {
  etat.chambre = chambreQR;
  ecrire("chambre", chambreQR);
}
if (etat.chambre && !CONFIG.CHAMBRES.includes(etat.chambre)) etat.chambre = null;
if (etat.langue && !TEXTES[etat.langue]) etat.langue = null;

function t(cle) {
  return (TEXTES[etat.langue] || TEXTES.fr)[cle] || TEXTES.fr[cle] || cle;
}

function afficher(id) {
  document.querySelectorAll(".ecran").forEach((e) => (e.hidden = e.id !== id));
  window.scrollTo(0, 0);
}

function appliquerLangue() {
  const langue = LANGUES.find((l) => l.code === etat.langue) || LANGUES[0];
  document.documentElement.lang = langue.code;
  document.documentElement.dir = langue.dir;
  document.querySelectorAll("[data-t]").forEach((el) => (el.textContent = t(el.dataset.t)));
}

// ---------- Écran langue ----------
function ecranLangue() {
  const liste = $("#liste-langues");
  liste.innerHTML = "";
  LANGUES.forEach((l) => {
    const b = document.createElement("button");
    b.textContent = l.nom;
    b.lang = l.code;
    b.dir = l.dir;
    b.onclick = () => {
      etat.langue = l.code;
      ecrire("langue", l.code);
      demarrer();
    };
    liste.appendChild(b);
  });
  afficher("ecran-langue");
}

// ---------- Écran chambre ----------
function ecranChambre() {
  const liste = $("#liste-chambres");
  liste.innerHTML = "";
  CONFIG.CHAMBRES.forEach((c) => {
    const b = document.createElement("button");
    b.textContent = c;
    b.onclick = () => {
      etat.chambre = c;
      ecrire("chambre", c);
      demarrer();
    };
    liste.appendChild(b);
  });
  afficher("ecran-chambre");
}

// ---------- Écran tâches ----------
function lireFaits() {
  try { return JSON.parse(lire("faits-" + aujourdhui())) || []; } catch (e) { return []; }
}

const observateur = "IntersectionObserver" in window
  ? new IntersectionObserver((entrees) => {
      entrees.forEach((e) => {
        if (e.isIntersecting) e.target.play().catch(() => {});
        else e.target.pause();
      });
    }, { threshold: 0.6 })
  : null;

function ecranTaches() {
  $("#num-chambre").textContent = etat.chambre;
  const liste = $("#liste-taches");
  liste.innerHTML = "";
  const faits = lireFaits();

  TACHES.forEach((tache) => {
    const carte = document.createElement("article");
    carte.className = "carte tache" + (faits.includes(tache.id) ? " faite" : "");

    const titre = document.createElement("div");
    titre.className = "tache-titre";
    titre.innerHTML = `<span class="tache-icone">${tache.icone}</span><span class="tache-nom"></span>`;
    titre.querySelector(".tache-nom").textContent = t(tache.id);
    carte.appendChild(titre);

    const video = document.createElement("video");
    video.src = tache.video;
    video.muted = true;
    video.loop = true;
    video.controls = true;
    video.preload = "metadata";
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.addEventListener("error", () => {
      const vide = document.createElement("div");
      vide.className = "video-absente";
      vide.textContent = "🎬 " + t("bientot");
      video.replaceWith(vide);
    });
    carte.appendChild(video);
    if (observateur) observateur.observe(video);

    const bouton = document.createElement("button");
    bouton.className = "bouton-fait";
    const majBouton = () => {
      const fait = carte.classList.contains("faite");
      bouton.textContent = (fait ? "✅ " : "⬜ ") + t("fait");
    };
    majBouton();
    bouton.onclick = () => {
      carte.classList.toggle("faite");
      const liste = lireFaits().filter((id) => id !== tache.id);
      if (carte.classList.contains("faite")) liste.push(tache.id);
      ecrire("faits-" + aujourdhui(), JSON.stringify(liste));
      majBouton();
    };
    carte.appendChild(bouton);

    liste.appendChild(carte);
  });

  $("#deja-envoye").hidden = lire("photo-envoyee") !== aujourdhui() + "|" + etat.chambre;
  reinitialiserPhoto();
  afficher("ecran-taches");
}

// ---------- Photo ----------
function reinitialiserPhoto() {
  etat.photo = null;
  $("#champ-photo").value = "";
  $("#apercu").hidden = true;
  $("#apercu").removeAttribute("src");
  $("#actions-photo").hidden = true;
  $("#bouton-photo").hidden = false;
  statut("");
}

function statut(texte, erreur) {
  const p = $("#statut-photo");
  p.textContent = texte;
  p.classList.toggle("erreur", !!erreur);
}

// Réduit la photo (moins de données, envoi plus rapide)
async function compresser(fichier) {
  try {
    const img = await createImageBitmap(fichier, { imageOrientation: "from-image" });
    const max = 1600;
    const r = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * r);
    c.height = Math.round(img.height * r);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b || fichier), "image/jpeg", 0.8));
  } catch (e) {
    return fichier;
  }
}

function enTetesSupabase() {
  const h = { apikey: CONFIG.SUPABASE_CLE };
  // Les anciennes clés "anon" demandent aussi l'en-tête Authorization
  if (!CONFIG.SUPABASE_CLE.startsWith("sb_")) h.Authorization = "Bearer " + CONFIG.SUPABASE_CLE;
  return h;
}

async function envoyerPhoto(blob) {
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_CLE) throw new Error("Supabase non configuré (config.js)");
  const dossier = "chambre-" + etat.chambre.replace(/[^a-zA-Z0-9_-]/g, "_");
  const chemin = `${dossier}/${Date.now()}.jpg`;
  const rep = await fetch(`${CONFIG.SUPABASE_URL}/storage/v1/object/photos/${chemin}`, {
    method: "POST",
    headers: { ...enTetesSupabase(), "Content-Type": "image/jpeg" },
    body: blob,
  });
  if (!rep.ok) throw new Error(await rep.text());
}

$("#champ-photo").addEventListener("change", async (e) => {
  const fichier = e.target.files && e.target.files[0];
  if (!fichier) return;
  etat.photo = await compresser(fichier);
  $("#apercu").src = URL.createObjectURL(etat.photo);
  $("#apercu").hidden = false;
  $("#bouton-photo").hidden = true;
  $("#actions-photo").hidden = false;
  statut("");
});

$("#bouton-refaire").onclick = () => {
  reinitialiserPhoto();
  $("#champ-photo").click();
};

$("#bouton-envoyer").onclick = async () => {
  if (!etat.photo) return;
  const bouton = $("#bouton-envoyer");
  bouton.disabled = true;
  statut(t("envoi"));
  try {
    await envoyerPhoto(etat.photo);
    ecrire("photo-envoyee", aujourdhui() + "|" + etat.chambre);
    $("#deja-envoye").hidden = false;
    $("#actions-photo").hidden = true;
    $("#bouton-photo").hidden = false;
    statut(t("merci"));
  } catch (err) {
    console.error(err);
    statut(t("erreur"), true);
  } finally {
    bouton.disabled = false;
  }
};

// ---------- Réglages : revenir au choix langue / chambre ----------
$("#bouton-reglages").onclick = () => {
  etat.langue = null;
  etat.chambre = null;
  ecranLangue();
};

// ---------- Installation ----------
let invitation = null;
const estInstallee = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
const estIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  invitation = e;
  $("#aide-installation").hidden = false;
  $("#bouton-installer").hidden = false;
});
$("#bouton-installer").onclick = async () => {
  if (!invitation) return;
  invitation.prompt();
  await invitation.userChoice;
  invitation = null;
  $("#aide-installation").hidden = true;
};
if (estIOS && !estInstallee) {
  $("#aide-installation").hidden = false;
  $("#texte-ios").hidden = false;
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// ---------- Démarrage ----------
function demarrer() {
  appliquerLangue();
  if (!etat.langue) return ecranLangue();
  if (!etat.chambre) return ecranChambre();
  ecranTaches();
}
demarrer();
