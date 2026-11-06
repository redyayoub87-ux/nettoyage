# App « Ma chambre propre » — guide d'installation

Deux applications installables, sans App Store, coût 0 € :

- **App Résidents** (téléphone) : choix de la langue, vidéos par tâche, photo de la chambre.
- **App Gestion** (ton PC) : photos du jour par chambre, compteur, QR codes à imprimer.

## Contenu du dossier

```
index.html, app.js, style.css   → app Résidents
textes.js                       → tâches + traductions (5 langues)
config.js                       → TES RÉGLAGES (seul fichier à remplir)
lit.mp4, armoire.mp4, ...        → tes vidéos (à ajouter, à côté des autres fichiers)
gestion.html, gestion.js...      → app Gestion (PC)
supabase.sql                    → à coller une fois dans Supabase
icônes .png, manifest, sw.js     → ce qui rend l'app installable
```

## Étape 1 — Supabase (stockage des photos, gratuit)

1. Crée un compte sur supabase.com → **New project** (région : Europe).
2. Menu **SQL Editor** → colle tout `supabase.sql` → **Run**.
3. Menu **Authentication → Users → Add user** : crée ton compte (e-mail + mot de passe).
   Ajoute aussi un collègue si besoin.
4. Menu **Authentication → Sign In / Providers** : désactive « Allow new users to sign up »
   (personne d'autre ne peut créer de compte).
5. Menu **Project Settings → API** : copie l'**URL** et la clé **anon / publishable**.
6. Ouvre `config.js` et colle-les. Modifie aussi la liste `CHAMBRES`.

⚠️ Ne mets jamais la clé « service_role » / « secret » dans `config.js`.

## Étape 2 — Tes vidéos

Ajoute tes 4 vidéos à côté des autres fichiers (pas dans un dossier) avec exactement ces noms :
`lit.mp4`, `armoire.mp4`, `table.mp4`, `poubelle.mp4`.

Conseil : compresse-les avec HandBrake (gratuit), préréglage « Fast 720p30 », moins de 5 Mo chacune.
Tant qu'une vidéo manque, l'app affiche « Vidéo bientôt disponible ».

## Étape 3 — Mettre en ligne (GitHub Pages, gratuit)

1. Crée un compte sur github.com → **New repository** (nom : `nettoyage`, Public).
2. **Add file → Upload files** → glisse tout le contenu du dossier → **Commit**.
3. **Settings → Pages** → Source : *Deploy from a branch* → branche `main` → **Save**.
4. Après 1-2 minutes, ton app est en ligne :
   - Résidents : `https://TONNOM.github.io/nettoyage/`
   - Gestion : `https://TONNOM.github.io/nettoyage/gestion.html`

## Étape 4 — Installer l'app Gestion sur ton PC

1. Ouvre l'adresse Gestion dans **Chrome** ou **Edge**.
2. Clique sur **« ⬇️ Installer sur ce PC »** (ou l'icône d'installation à droite de la barre d'adresse).
3. L'app a maintenant son icône sur le bureau / dans le menu Démarrer.
4. Connecte-toi avec le compte créé à l'étape 1.

## Étape 5 — QR codes et installation chez les résidents

1. Dans l'app Gestion → onglet **QR codes** → **Imprimer**.
2. Colle le QR de chaque chambre dans la chambre correspondante.
3. Le résident scanne → l'app s'ouvre directement sur sa chambre.
4. Pour l'installer :
   - **Android** : bouton « Installer l'application » en bas de l'app.
   - **iPhone** : Safari → Partager ⬆️ → « Sur l'écran d'accueil ».
     Sur iPhone, l'app installée redemande la chambre une fois (normal).

## Comment ça marche

- Le résident envoie une photo par jour. Il **ne peut ni voir ni supprimer** les photos.
- Dans l'app Gestion, seule la **dernière photo** de chaque chambre est gardée :
  les anciennes sont supprimées automatiquement à l'ouverture.
- Vert = photo reçue aujourd'hui. Rouge = pas encore.
- Clique sur une photo pour l'agrandir ou la supprimer.

## Modifier l'app

- **Ajouter une tâche** : une ligne dans `TACHES` (textes.js) + son nom dans les 5 langues + sa vidéo.
- **Changer un texte** : textes.js.
- Après chaque modification, change `nettoyage-v1` en `nettoyage-v2` dans `sw.js`
  pour que les téléphones prennent la nouvelle version.

## Avant le lancement

- [ ] Faire vérifier les traductions **pashto, dari et tigrinya** par quelqu'un qui parle la langue.
- [ ] Faire valider la partie **photos** par la direction / le responsable RGPD
      (photos de la chambre seulement, accès réservé au personnel, une seule photo gardée).
- [ ] Tester avec 2-3 résidents.
