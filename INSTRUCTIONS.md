# Activer l'inscription automatique (classeur Prospects + e-mails)

Objectif : le parent remplit le formulaire et clique **une seule fois**. Ensuite, tout est automatique :

- la fiche complète s'ajoute dans l'onglet **INSCRIPTIONS** (avec tarif, remise et net à payer) ;
- une ligne de suivi s'ajoute dans **SUIVI Metz** ou **SUIVI Thionville** selon la ville, avec `Source = Site` ;
- l'**académie** reçoit un e-mail avec toutes les infos ;
- le **parent** reçoit un e-mail de confirmation.

Tout arrive dans un seul classeur :
**Prospects Essai gratuit Robotique 2026-2027 - Metz et Thionville**
(`1yWPFFU_OKvMv0KMPFKUHixbMJLWMzTV5wT2jRZBes8s`).

Durée : environ 10 minutes, une seule fois. Tout est gratuit.

---

## Étape 1 — Ouvrir le bon classeur

1. Connectez-vous à Google avec **robotics.academy.contact@gmail.com**
   (le compte **propriétaire** du classeur Prospects — c'est important, voir « En cas d'erreur d'autorisation » plus bas).
2. Ouvrez le classeur **Prospects Essai gratuit Robotique 2026-2027 - Metz et Thionville**.

## Étape 2 — Coller le script

1. Dans le classeur : menu **Extensions → Apps Script**.
2. Supprimez tout le code affiché.
3. Ouvrez le fichier **code.gs** (dans ce dossier), copiez tout son contenu et collez-le.
4. Cliquez sur l'icône 💾 **Enregistrer**.

## Étape 3 — Vérifier que le script voit bien le classeur

Dans l'éditeur Apps Script, choisissez la fonction **`verifierInstallation`** puis **Exécuter**.
Le journal doit se terminer par `=> Tout est bon.` :

```
Classeur : Prospects Essai gratuit Robotique 2026-2027 - Metz et Thionville
OK     INSCRIPTIONS
OK     SUIVI Metz
OK     SUIVI Thionville
OK     Parametres
OK     Tarifs
OK     écriture autorisée
Tarif 10 ans : 800 € · remise 10 % · net 720 €
Date limite remise : 30/09/2026  (le site annonce 15/09/2026)
=> Tout est bon.
```

- `MANQUE` signale un onglet renommé : corrigez le nom en haut de **code.gs**
  (`ONGLET_INSCRIPTIONS`, `ONGLET_SUIVI`, …). Les différences de casse et d'accents
  sont déjà gérées : `Paramètres` et `Parametres` sont reconnus comme le même onglet.
- `ÉCHEC Classeur inaccessible` ou `écriture refusée` : voir « En cas d'erreur d'autorisation ».

## Étape 3 bis — Essai à blanc (recommandé)

Toujours dans l'éditeur, exécutez **`testerInscription`**. Le script écrit une vraie
inscription de test dans les onglets, affiche les deux lignes produites dans le journal,
**puis les efface**. Aucun e-mail n'est envoyé. C'est la façon la plus sûre de vérifier
que les colonnes tombent au bon endroit avant d'ouvrir le formulaire au public.

## Étape 4 — Déployer

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

## Étape 5 — Brancher le site

1. Ouvrez **index.html**.
2. Cherchez la ligne `var SCRIPT_URL = "…";` (vers la ligne 688).
3. Collez l'URL entre les guillemets.
4. Enregistrez, puis mettez le fichier en ligne (GitHub Pages).

## Étape 6 — Tester

Faites une inscription de test sur le site. Vous devez voir :

- le message vert « ✅ Inscription enregistrée ! » ;
- une nouvelle ligne dans l'onglet **INSCRIPTIONS** ;
- une nouvelle ligne dans **SUIVI Metz** ou **SUIVI Thionville**, avec `Source = Site` ;
- un e-mail dans la boîte de l'académie ;
- un e-mail de confirmation dans la boîte du parent (regardez aussi les spams la première fois).

Supprimez ensuite les deux lignes de test.

---

## Où va chaque information

**Onglet INSCRIPTIONS**

`Cle · Date inscription · Annee · Enfant · Age · Ville · Lieu · Jour · Heure · Creneau complet ·
Parcours · Formule · Niveau · Parent · Telephone · E-mail · Tarif base · Remise · Net a payer ·
Origine · Notes`

- **Tarif base** est lu dans l'onglet **Tarifs**, d'après l'âge de l'enfant.
- **Remise** et **Net a payer** viennent de l'onglet **Parametres**
  (`Remise rentree` et `Date limite remise`). Passé la date limite, la remise tombe à 0 %.
- **Origine** vaut toujours `Site`.

**Onglets SUIVI Metz / SUIVI Thionville**

`Date · Nom complet · Téléphone · Ville · Âge · Âge exact · Créneau souhaité · Source ·
Doublon ? · Appelé le · Joignable ? · Essai prévu le · Venu ? · Inscrit ? · Notes · E-mail`

- **Nom complet** = le nom de l'enfant ; le parent est rappelé dans **Notes**.
- **Doublon ?** passe à `Doublon` si le téléphone ou l'e-mail existe déjà dans l'onglet
  (les numéros `+33…` et `0…` sont reconnus comme identiques).
- **Inscrit ?** passe à `Inscrit`, sauf pour une séance d'essai — qui reste un prospect à suivre.
- Si la ville n'est reconnue ni comme Metz ni comme Thionville, la ligne part dans l'onglet
  `SUIVI` général s'il existe, plutôt que d'être perdue.

Le script repère les colonnes **par leur titre**, pas par leur position : vous pouvez déplacer
ou insérer une colonne sans rien casser. Ne renommez simplement pas les en-têtes.

## La date limite de la remise

À la **première inscription** reçue après l'installation, le script aligne tout seul la ligne
**Date limite remise** de l'onglet `Parametres` sur la date annoncée par le site
(constante `DATE_LIMITE_REMISE` en haut de **code.gs**, actuellement `15/09/2026`).

Il ne le fait **qu'une seule fois** : si vous modifiez cette date à la main ensuite,
le script la respecte et n'y touche plus. Pour forcer l'alignement, exécutez
**`corrigerDateLimiteRemise`** dans l'éditeur.

Passé cette date, la remise tombe automatiquement à 0 % et `Net a payer` vaut le tarif plein.

## Si une inscription n'arrive pas dans le classeur

Le script ne perd jamais une inscription. Si le classeur est inaccessible au moment de
l'envoi, l'académie reçoit un e-mail **« ⚠️ Inscription NON enregistrée »** contenant toutes
les informations du formulaire, à recopier à la main ; le site, de son côté, bascule sur
FormSubmit et le parent reçoit quand même sa confirmation.

## En cas d'erreur d'autorisation

Si le journal du classeur affiche
`You do not have permission to access the requested document`, c'est que le script tourne sous
un compte qui n'a pas accès au classeur. Le script doit être créé **depuis le compte propriétaire**
du classeur Prospects, ou ce compte doit partager le classeur en **Éditeur** avec le compte du script.

## Tant que l'étape 5 n'est pas faite

Le site continue de fonctionner : si `SCRIPT_URL` est vide **ou si Google est injoignable**,
l'inscription part par **FormSubmit** (e-mail à l'académie + e-mail de confirmation au parent).
Seule l'écriture dans le classeur manque.

⚠️ La toute première inscription via FormSubmit déclenche un e-mail d'activation
à l'adresse `robotics.academy.contact@gmail.com` : il faut cliquer une fois sur le lien de confirmation.

## Si vous modifiez code.gs plus tard

Apps Script → **Déployer → Gérer les déploiements** → crayon ✏️ → Version : **Nouvelle version** → **Déployer**.
L'URL reste la même, rien à changer sur le site.
