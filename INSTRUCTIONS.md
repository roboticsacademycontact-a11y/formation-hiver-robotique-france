# Inscriptions du site : fonctionnement et maintenance

Le parent remplit le formulaire et clique **une seule fois**. Ensuite, tout est automatique :

- **Classeur « Inscriptions Formation Robotique »** : la fiche complète s'ajoute dans
  **TOUTES LES INSCRIPTIONS** et dans l'onglet du jour (Mercredi, Samedi…), trié par heure.
  C'est la source que lit le **Centre de gestion** (onglet INSCRITS, tarif, remise, échéances).
- **Classeur « Prospects Essai gratuit Robotique 2026-2027 - Metz et Thionville »** : une ligne
  s'ajoute dans **SUIVI Metz** ou **SUIVI Thionville** selon la ville, avec `Source = Site`.
- l'**académie** reçoit un e-mail avec toutes les infos ;
- le **parent** reçoit un e-mail de confirmation.

> ⚠️ N'écrivez pas les inscriptions ailleurs que dans TOUTES LES INSCRIPTIONS :
> le Centre de gestion reconstruit l'onglet INSCRITS toutes les 10 minutes à partir de
> cet onglet et des lignes « Inscrit » des onglets SUIVI. Il lit les colonnes A à N **par position**.

## Où se trouve le script

Projet Apps Script **« Projet sans titre »**, rattaché au classeur
**Inscriptions Formation Robotique** (propriétaire : robotics.academy.contact@gmail.com).
Il contient deux fichiers :

- **Code.gs** : ce fichier `code.gs` ;
- **SyncProspection.gs** : recopie dans TOUTES LES INSCRIPTIONS les prospects marqués
  « Inscrit » à la main dans les onglets SUIVI (sans doublon : même nom + même téléphone).
  **Ne pas le supprimer.**

Déploiement actif : **« Rentree le 7 octobre »**, exécuté en tant que
nassira.barhoumi@gmail.com, accès « Tout le monde ». Son adresse est celle de `SCRIPT_URL`
dans **index.html**.

> Ne collez pas ce script dans le projet « Centre de gestion LPGR » (rattaché au classeur
> Prospects) : il remplacerait le tableau de bord.

## Modifier le script

1. Ouvrez le projet ci-dessus → fichier **Code.gs** → `Ctrl+A` → collez **code.gs** → `Ctrl+S`.
2. Exécutez **`verifierInstallation`**. Le journal doit se terminer par `=> Tout est bon.` :

   ```
   Inscriptions : Inscriptions Formation Robotique
   OK     TOUTES LES INSCRIPTIONS (écriture autorisée)
   Prospects : Prospects Essai gratuit Robotique 2026-2027 - Metz et Thionville
   OK     SUIVI Metz (écriture autorisée)
   OK     SUIVI Thionville (écriture autorisée)
   => Tout est bon.
   ```

   - `MANQUE` : un onglet a été renommé (casse et accents sont tolérés).
   - `NOTE … colonnes introuvables` : un en-tête de SUIVI a été renommé ; la colonne restera vide.
   - `ÉCHEC` : le compte qui exécute le script n'a pas accès au classeur en « Éditeur ».
3. Exécutez **`testerInscription`** : une inscription « ZZTEST Robot » est écrite dans les trois
   onglets, affichée dans le journal, puis effacée. Aucun e-mail n'est envoyé.
4. **Déployer → Gérer les déploiements** → crayon ✏️ → Version : **Nouvelle version** → **Déployer**.
   L'URL reste la même, rien à changer sur le site.
5. Contrôle : ouvrez l'URL du déploiement dans le navigateur ; elle doit afficher
   `{"ok":true,"message":"Service d'inscription actif."}`.

## Où va chaque information

**TOUTES LES INSCRIPTIONS** et onglets du jour (colonnes A à N, ordre imposé)

`Date d'inscription · Enfant · Âge · Ville · Jour · Heure · Créneau complet · Parcours ·
Formule · Niveau · Parent / tuteur · Téléphone · E-mail · Infos médicales`

**SUIVI Metz / SUIVI Thionville** (colonnes repérées par leur titre)

`Date · Nom complet · Téléphone · Ville · Âge · Âge exact · Créneau souhaité · Source ·
Doublon ? · Appelé le · Joignable ? · Essai prévu le · Venu ? · Inscrit ? · Notes · E-mail`

- **Nom complet** = le nom de l'enfant ; le parent, le niveau, la formule et le parcours sont dans **Notes**.
- **Doublon ?** passe à `Doublon` si le téléphone ou l'e-mail existe déjà (`+33…` = `0…`).
- **Inscrit ?** passe à `Inscrit`, sauf pour une séance d'essai.
- Ville non reconnue : la ligne part dans l'onglet `SUIVI` s'il existe.
- Le téléphone est enregistré comme texte : le 0 initial est conservé.

## Protection anti-robot

Le site envoie une clé (`CLE_SITE`, identique dans **index.html** et **code.gs**), un champ piège
et la durée de remplissage. Les appels sans la bonne clé sont rejetés et notés dans l'onglet
**TENTATIVES BLOQUEES** du classeur Prospects.

## Si une inscription n'arrive pas dans le classeur

Le script ne perd jamais une inscription : si l'écriture échoue, l'académie reçoit un e-mail
**« ⚠️ Inscription NON enregistrée »** avec toutes les informations, à recopier à la main ;
le site bascule sur **FormSubmit** et le parent reçoit quand même sa confirmation.

⚠️ La toute première inscription via FormSubmit déclenche un e-mail d'activation
à `robotics.academy.contact@gmail.com` : il faut cliquer une fois sur le lien de confirmation.
