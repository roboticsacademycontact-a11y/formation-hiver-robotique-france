# Activer l'inscription automatique (liste + e-mails)

Objectif : le parent remplit le formulaire et clique **une seule fois**. Ensuite, tout est automatique :

- une ligne s'ajoute dans un **Google Sheet** (onglet « TOUTES LES INSCRIPTIONS » + un onglet par jour, trié par heure) ;
- l'**académie** reçoit un e-mail avec toutes les infos ;
- le **parent** reçoit un e-mail de confirmation.

Durée : environ 10 minutes, une seule fois. Tout est gratuit.

---

## Étape 1 — Créer le classeur

1. Connectez-vous à Google avec **robotics.academy.contact@gmail.com**.
2. Allez sur https://sheets.new
3. Renommez le classeur : **Inscriptions Formation Robotique**.

## Étape 2 — Coller le script

1. Dans le classeur : menu **Extensions → Apps Script**.
2. Supprimez tout le code affiché (`function myFunction() {}`).
3. Ouvrez le fichier **code.gs** (dans ce dossier), copiez tout son contenu et collez-le.
4. Cliquez sur l'icône 💾 **Enregistrer**.

## Étape 3 — Déployer

1. En haut à droite : **Déployer → Nouveau déploiement**.
2. Cliquez sur l'engrenage ⚙️ à côté de « Sélectionner le type » → choisissez **Application Web**.
3. Réglez :
   - Description : `Inscriptions site`
   - Exécuter en tant que : **Moi (robotics.academy.contact@gmail.com)**
   - Qui a accès : **Tout le monde**  ← important, sinon le site ne pourra pas envoyer
4. Cliquez **Déployer**, puis **Autoriser l'accès** → choisissez votre compte → « Paramètres avancés » → « Accéder à … (non sécurisé) » → **Autoriser**.
   (Ce message apparaît parce que le script est le vôtre et n'est pas publié sur le store Google : c'est normal.)
5. Copiez l'**URL de l'application Web** affichée. Elle ressemble à :
   `https://script.google.com/macros/s/AKfycb....../exec`

## Étape 4 — Brancher le site

1. Ouvrez **index.html**.
2. Cherchez la ligne (vers la ligne 674) :
   ```js
   var SCRIPT_URL = "";
   ```
3. Collez l'URL entre les guillemets :
   ```js
   var SCRIPT_URL = "https://script.google.com/macros/s/AKfycb....../exec";
   ```
4. Enregistrez, puis mettez le fichier en ligne (GitHub Pages).

## Étape 5 — Tester

Faites une inscription de test sur le site. Vous devez voir :

- le message vert « ✅ Inscription enregistrée ! » ;
- une nouvelle ligne dans le Google Sheet, dans l'onglet **TOUTES LES INSCRIPTIONS** **et** dans l'onglet du jour (ex. « Mercredi ») ;
- un e-mail dans la boîte de l'académie ;
- un e-mail de confirmation dans la boîte du parent (regardez aussi les spams la première fois).

---

## Tant que l'étape 4 n'est pas faite

Le site continue de fonctionner : si `SCRIPT_URL` est vide, l'inscription part par **FormSubmit**
(e-mail à l'académie + e-mail de confirmation au parent). Seule la liste automatique manque.

⚠️ La toute première inscription via FormSubmit déclenche un e-mail d'activation de Google
à l'adresse `robotics.academy.contact@gmail.com` : il faut cliquer une fois sur le lien de confirmation.

## Si vous modifiez code.gs plus tard

Apps Script → **Déployer → Gérer les déploiements** → crayon ✏️ → Version : **Nouvelle version** → **Déployer**.
L'URL reste la même, rien à changer sur le site.

## Colonnes de la liste

`Date d'inscription · Enfant · Âge · Ville · Jour · Heure · Créneau complet · Parcours · Formule · Niveau · Parent · Téléphone · E-mail · Infos médicales`

Chaque onglet de jour est retrié automatiquement par heure à chaque nouvelle inscription :
vous avez donc en permanence la liste de chaque séance, prête à imprimer.
