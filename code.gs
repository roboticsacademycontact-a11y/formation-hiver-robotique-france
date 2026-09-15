/**
 * FORMATION ROBOTIQUE — Les Petits Génies de la Robotique
 * Réception des inscriptions du site.
 *
 * À chaque inscription :
 *   1. classeur « Inscriptions Formation Robotique » :
 *      onglet TOUTES LES INSCRIPTIONS + onglet du jour (trié par heure)
 *      -> c'est la source que lit le Centre de gestion (onglet INSCRITS,
 *         tarif, remise, échéances : calculés par le Centre de gestion)
 *   2. classeur « Prospects Essai gratuit Robotique 2026-2027 » :
 *      onglet SUIVI Metz ou SUIVI Thionville, selon la ville (Source = Site)
 *   3. e-mail à l'académie + e-mail de confirmation au parent
 *   Si une écriture échoue : e-mail « ⚠️ Inscription NON enregistrée ».
 *
 * Installation : voir INSTRUCTIONS.md
 */

/* ---------- Classeurs de destination ----------
   L'identifiant se lit dans l'adresse du classeur, entre /d/ et /edit.     */
var ID_CLASSEUR     = "1yWPFFU_OKvMv0KMPFKUHixbMJLWMzTV5wT2jRZBes8s";   // Prospects (SUIVI)
var ID_INSCRIPTIONS = "16RhXc1AvmCUahgQvdflPor4ajMcx9k9XhxohIFItV-Y";   // Inscriptions Formation Robotique

var EMAIL_ACADEMIE = "robotics.academy.contact@gmail.com";
var TEL_ACADEMIE   = "07 51 21 01 00";

/* ---------- Noms des onglets (tels qu'ils existent déjà dans le classeur) ---------- */
var ONGLET_TOUTES       = "TOUTES LES INSCRIPTIONS";   // lu par le Centre de gestion
var ONGLET_SUIVI        = { "Metz": "SUIVI Metz", "Thionville": "SUIVI Thionville" };
var ONGLET_SUIVI_DEFAUT = "SUIVI";      // repli si la ville n'est pas reconnue
var ONGLET_BLOQUEES     = "TENTATIVES BLOQUEES";

/* ---------- Protection anti-robot ---------- */
var CLE_SITE        = "LPG-hiver-2026-Metz-Thionville"; // doit être identique à celle du site
var DUREE_MINIMUM   = 5;    // secondes : en dessous, c'est un robot
var MAX_PAR_EMAIL   = 3;    // inscriptions autorisées par e-mail et par heure
var MAX_PAR_HEURE   = 30;   // inscriptions autorisées au total par heure

/* ---------- En-têtes attendus (ordre des colonnes des onglets existants) ---------- */
/* Ordre IMPOSÉ : le Centre de gestion lit ces colonnes par position (A à N). */
var ENTETES_TOUTES = ["Date d'inscription","Enfant","Âge","Ville","Jour","Heure","Créneau complet",
  "Parcours","Formule","Niveau","Parent / tuteur","Téléphone","E-mail","Infos médicales"];

var ENTETES_SUIVI = ["Date","Nom complet","Téléphone","Ville","Âge","Âge exact",
  "Créneau souhaité","Source","Doublon ?","Appelé le","Joignable ?","Essai prévu le",
  "Venu ?","Inscrit ?","Notes","E-mail"];

var JOURS = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];

/* =========================================================
   POINT D'ENTRÉE APPELÉ PAR LE SITE
   ========================================================= */
function doPost(e) {
  try {
    var p = e.parameter;

    /* --- 1. Filtres anti-robot (avant toute écriture) --- */
    var verdict = controle(p);
    if (verdict.bloque)  { journalRejet(p, verdict.motif); return reponse({ ok: false }); }
    if (verdict.silence) { return reponse({ ok: true }); }   // robot : on fait semblant d'accepter
    if (verdict.refus)   { return reponse({ ok: false, refus: verdict.refus }); }

    var ss  = classeur();
    var ins = classeurInscriptions();

    /* --- 2. Mise en forme des informations --- */
    var lieu  = extraitLieu(p.Ville);
    var jour  = extraitJour(p.Creneau);
    var heure = extraitHeure(p.Creneau);

    /* --- 3. Écriture dans les onglets --- */
    ecritToutes(ins, p, jour, heure);
    ecritSuivi(ss, p, lieu, jour, heure);

    /* --- 4. E-mails --- */
    envoieMails(p, jour, heure, ins.getUrl());

    return reponse({ ok: true });
  } catch (err) {
    /* Une inscription ne doit jamais être perdue : si le classeur est
       inaccessible, l'académie reçoit quand même tout par e-mail, et le site
       bascule de son côté sur FormSubmit.                                   */
    alerteEcritureImpossible(e && e.parameter, err);
    return reponse({ ok: false, error: String(err) });
  }
}

/* Prévient l'académie qu'une inscription n'a pas pu être écrite. */
function alerteEcritureImpossible(p, err) {
  try {
    p = p || {};
    var corps = "<p style='font-family:Arial'>Une inscription est arrivée mais n'a pas pu être "
      + "écrite dans le classeur. <strong>Recopiez-la à la main</strong>, puis corrigez la cause.</p>"
      + "<p style='font-family:Arial;color:#a00'><strong>Erreur :</strong> " + String(err) + "</p>"
      + "<table style='font-family:Arial;font-size:14px;border-collapse:collapse'>"
      + tr("Enfant", p.Enfant) + tr("Âge", p.Age) + tr("Ville", p.Ville)
      + tr("Créneau", p.Creneau) + tr("Parcours", p.Parcours) + tr("Formule", p.Formule)
      + tr("Niveau", p.Niveau) + tr("Parent", p.Parent) + tr("Téléphone", p.Telephone)
      + tr("E-mail", p.Email) + tr("Infos médicales", p.Infos_medicales)
      + "</table>";
    MailApp.sendEmail({ to: EMAIL_ACADEMIE,
      subject: "⚠️ Inscription NON enregistrée — " + (p.Enfant || "?"),
      htmlBody: corps });
  } catch (e2) { /* ne jamais masquer l'erreur d'origine */ }
}

function doGet() {
  return reponse({ ok: true, message: "Service d'inscription actif." });
}

/* ---------- Les classeurs ---------- */
function classeur() {                 // Prospects (onglets SUIVI)
  return SpreadsheetApp.openById(ID_CLASSEUR);
}
function classeurInscriptions() {     // Inscriptions Formation Robotique
  return SpreadsheetApp.openById(ID_INSCRIPTIONS);
}

/* Affiche l'adresse des classeurs dans le journal (bouton Exécuter) */
function ouvrirLaListe() {
  var a = classeurInscriptions(), b = classeur();
  Logger.log("Inscriptions : " + a.getName() + " — " + a.getUrl());
  Logger.log("Prospects    : " + b.getName() + " — " + b.getUrl());
  return a.getUrl();
}

/* =========================================================
   ÉCRITURE — TOUTES LES INSCRIPTIONS + onglet du jour
   (classeur « Inscriptions Formation Robotique »)
   ========================================================= */
function ecritToutes(ins, p, jour, heure) {
  var ligne = [new Date(), p.Enfant, p.Age, p.Ville, jour, heure, p.Creneau,
               p.Parcours, p.Formule, p.Niveau, p.Parent, texte(p.Telephone), p.Email,
               p.Infos_medicales];

  var toutes = ongletExistant(ins, ONGLET_TOUTES, ENTETES_TOUTES);
  toutes.appendRow(ligne);

  var feuilleJour = ongletExistant(ins, jour, ENTETES_TOUTES);
  feuilleJour.appendRow(ligne);
  trieParHeure(feuilleJour);
}

/* Trie un onglet du jour par heure de séance (colonne F), en-tête exclu. */
function trieParHeure(sh) {
  var n = sh.getLastRow();
  if (n > 2) sh.getRange(2, 1, n - 1, ENTETES_TOUTES.length).sort({ column: 6, ascending: true });
}

/* =========================================================
   ÉCRITURE — onglet SUIVI Metz / SUIVI Thionville
   ========================================================= */
function ecritSuivi(ss, p, lieu, jour, heure) {
  var nom = ONGLET_SUIVI[lieu];
  if (!nom) {
    // Ville non reconnue : on ne perd pas le prospect, il part dans l'onglet
    // de suivi général s'il existe.
    if (!trouveOnglet(ss, ONGLET_SUIVI_DEFAUT)) return;
    nom = ONGLET_SUIVI_DEFAUT;
  }

  var sh = ongletExistant(ss, nom, ENTETES_SUIVI);
  var cols = indexColonnes(sh, ENTETES_SUIVI);

  var valeurs = {
    "Date"             : new Date(),
    "Nom complet"      : p.Enfant,
    "Téléphone"        : texte(p.Telephone),
    "Ville"            : lieu,
    "Âge"              : p.Age,
    "Âge exact"        : ageExact(p.Age),
    "Créneau souhaité" : creneauCourt(jour, heure, p.Creneau, lieu),
    "Source"           : "Site",
    "Doublon ?"        : dejaPresent(sh, cols, p) ? "Doublon" : "",
    "Inscrit ?"        : estUneInscription(p.Formule) ? "Inscrit" : "",
    "Notes"            : notes(p),
    "E-mail"           : p.Email
  };

  sh.appendRow(ligneOrdonnee(cols, valeurs, sh.getLastColumn()));
}

/* Un même téléphone ou e-mail déjà présent dans l'onglet de suivi */
function dejaPresent(sh, cols, p) {
  if (sh.getLastRow() < 2) return false;
  var cTel  = cols["Téléphone"];
  var cMail = cols["E-mail"];
  if (!cTel && !cMail) return false;

  var lignes = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var tel  = chiffres(p.Telephone);
  var mail = (p.Email || "").toLowerCase().trim();

  for (var i = 0; i < lignes.length; i++) {
    if (cTel && tel && chiffres(String(lignes[i][cTel - 1])) === tel)                 return true;
    if (cMail && mail && String(lignes[i][cMail - 1]).toLowerCase().trim() === mail)  return true;
  }
  return false;
}

/* =========================================================
   OUTILS D'ÉCRITURE
   ========================================================= */

/* Récupère un onglet existant ; le crée avec ses en-têtes s'il manque. */
function ongletExistant(ss, nom, entetes) {
  var sh = trouveOnglet(ss, nom);
  if (!sh) {
    sh = ss.insertSheet(nom);
    sh.appendRow(entetes);
    sh.getRange(1, 1, 1, entetes.length)
      .setFontWeight("bold").setBackground("#123a5e").setFontColor("#ffffff");
    sh.setFrozenRows(1);
  }
  return sh;
}

/* Retrouve un onglet même si sa casse ou ses accents diffèrent. */
function trouveOnglet(ss, nom) {
  var sh = ss.getSheetByName(nom);
  if (sh) return sh;
  var cible = sansAccent(nom).replace(/\s+/g, " ").trim();
  var tous = ss.getSheets();
  for (var i = 0; i < tous.length; i++) {
    if (sansAccent(tous[i].getName()).replace(/\s+/g, " ").trim() === cible) return tous[i];
  }
  return null;
}

/* Position de chaque colonne d'après la ligne d'en-tête réelle de l'onglet :
   si vous déplacez ou ajoutez une colonne, le script suit.                  */
function indexColonnes(sh, attendus) {
  var cols = {};
  if (sh.getLastColumn() === 0) return cols;
  var entetes = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  for (var i = 0; i < entetes.length; i++) {
    var titre = String(entetes[i]).trim();
    if (titre) cols[titre] = i + 1;
  }
  // tolérance aux accents : "Telephone" trouve "Téléphone", et inversement
  for (var j = 0; j < attendus.length; j++) {
    if (cols[attendus[j]]) continue;
    for (var k = 0; k < entetes.length; k++) {
      if (sansAccent(String(entetes[k])) === sansAccent(attendus[j])) {
        cols[attendus[j]] = k + 1;
        break;
      }
    }
  }
  return cols;
}

/* Construit la ligne en plaçant chaque valeur dans SA colonne */
function ligneOrdonnee(cols, valeurs, largeur) {
  var ligne = [];
  for (var i = 0; i < largeur; i++) ligne.push("");
  for (var titre in valeurs) {
    if (!valeurs.hasOwnProperty(titre)) continue;
    var c = cols[titre];
    if (c) ligne[c - 1] = valeurs[titre];
  }
  return ligne;
}

/* =========================================================
   LECTURE DES INFORMATIONS DU FORMULAIRE
   ========================================================= */

/* "Metz — 9 rue de Sablon" -> "Metz" */
function extraitLieu(ville) {
  var v = sansAccent(ville || "");
  if (v.indexOf("thionville") !== -1) return "Thionville";
  if (v.indexOf("metz") !== -1)       return "Metz";
  return "";
}

function extraitJour(creneau) {
  creneau = creneau || "";
  for (var i = 0; i < JOURS.length; i++) {
    if (creneau.indexOf(JOURS[i]) !== -1) return JOURS[i];
  }
  return "À définir";
}

function extraitHeure(creneau) {
  var m = (creneau || "").match(/(\d{1,2})h(\d{2})/);
  if (!m) return "";
  return ("0" + m[1]).slice(-2) + "h" + m[2];   // ex : "09h00" (pour un tri correct)
}

/* Format court des onglets SUIVI : "dimanche 10h30-12h00 (thionville)" */
function creneauCourt(jour, heure, creneau, lieu) {
  if (jour === "À définir" || !heure) return "à voir ensemble au téléphone";
  var heures = (creneau || "").match(/(\d{1,2})h(\d{2})/g);
  var plage  = (heures && heures.length >= 2) ? heures[0] + "-" + heures[1] : heure;
  return (jour + " " + plage + " (" + lieu + ")").toLowerCase();
}

/* "9 ans" -> 9 */
function ageExact(age) {
  var m = String(age || "").match(/\d+/);
  return m ? Number(m[0]) : "";
}

function sansAccent(txt) {
  txt = String(txt || "").toLowerCase();
  var avec = "àáâãäåçèéêëìíîïñòóôõöùúûüýÿ";
  var sans = "aaaaaaceeeeiiiinooooouuuuyy";
  var out = "";
  for (var i = 0; i < txt.length; i++) {
    var k = avec.indexOf(txt.charAt(i));
    out += (k === -1) ? txt.charAt(i) : sans.charAt(k);
  }
  return out;
}

/* Force le texte : "0612…" garde son 0 initial dans le classeur */
function texte(v) {
  return v ? "'" + v : "";
}

function chiffres(txt) {
  return String(txt || "").replace(/\D/g, "").replace(/^33/, "0");
}

/* Une séance d'essai n'est pas encore une inscription */
function estUneInscription(formule) {
  return sansAccent(formule).indexOf("essai") === -1;
}

/* Colonne Notes : ce que le formulaire recueille en plus des colonnes dédiées */
function notes(p) {
  var bouts = ["Inscription site"];
  if (p.Parent)          bouts.push("Parent : " + p.Parent);
  if (p.Niveau)          bouts.push(p.Niveau);
  if (p.Formule)         bouts.push(p.Formule);
  if (p.Parcours)        bouts.push(p.Parcours);
  if (p.Infos_medicales && p.Infos_medicales !== "—") {
    bouts.push("Infos médicales : " + p.Infos_medicales);
  }
  return bouts.join(" · ");
}

/* =========================================================
   CONTRÔLES ANTI-ROBOT
   Renvoie :
     {bloque:...}  -> requête étrangère au site : rejet silencieux + journal
     {silence:true}-> robot pris au piège : on répond "ok" sans rien écrire
     {refus:"..."} -> envoi humain mais invalide : message affiché sur le site
     {}            -> inscription valide
   ========================================================= */
function controle(p) {
  // a) clé du site absente ou fausse -> quelqu'un appelle l'adresse directement
  if (p.Cle !== CLE_SITE) return { bloque: true, motif: "cle invalide" };

  // b) champ piège rempli -> robot
  if (p.Piege) return { silence: true };

  // c) formulaire validé en moins de 5 secondes -> robot
  if (p.Duree !== undefined && p.Duree !== "" && Number(p.Duree) < DUREE_MINIMUM) {
    return { refus: "trop_rapide" };
  }

  // d) champs obligatoires
  if (!p.Enfant || !p.Email || !p.Telephone || !p.Creneau || !p.Ville || !p.Parent) {
    return { refus: "incomplet" };
  }

  // e) format de l'e-mail et du téléphone
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(p.Email))          return { refus: "email" };
  if ((p.Telephone.replace(/\D/g, "")).length < 8)             return { refus: "telephone" };

  // f) même inscription renvoyée deux fois de suite
  var cache = CacheService.getScriptCache();
  var empreinte = "insc_" + Utilities.base64Encode(p.Email + "|" + p.Enfant + "|" + p.Creneau);
  if (cache.get(empreinte)) return { refus: "doublon" };
  cache.put(empreinte, "1", 600);            // 10 minutes

  // g) limite par e-mail et limite globale, par heure
  if (compteur(cache, "mail_" + p.Email.toLowerCase()) > MAX_PAR_EMAIL) return { refus: "trop_essais" };
  if (compteur(cache, "total") > MAX_PAR_HEURE) return { bloque: true, motif: "limite horaire atteinte" };

  return {};
}

function compteur(cache, cle) {
  var n = Number(cache.get(cle) || 0) + 1;
  cache.put(cle, String(n), 3600);           // 1 heure
  return n;
}

/* Journal des tentatives bloquées */
function journalRejet(p, motif) {
  try {
    var ss = classeur();
    var sh = ss.getSheetByName(ONGLET_BLOQUEES);
    if (!sh) {
      sh = ss.insertSheet(ONGLET_BLOQUEES);
      sh.appendRow(["Date", "Motif", "Origine", "E-mail", "Enfant", "Créneau"]);
      sh.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#5e1212").setFontColor("#ffffff");
      sh.setFrozenRows(1);
    }
    if (sh.getLastRow() > 500) sh.deleteRows(2, 200);   // on garde le journal court
    sh.appendRow([new Date(), motif, p.Origine || "?", p.Email || "?", p.Enfant || "?", p.Creneau || "?"]);
  } catch (err) { /* le journal ne doit jamais bloquer une inscription */ }
}

/* =========================================================
   E-MAILS
   ========================================================= */
function envoieMails(p, jour, heure, urlFeuille) {
  // 1) Message pour l'académie
  var sujetAcad = "🤖 Nouvelle inscription — " + p.Enfant + " — " + jour + " " + heure;
  var corpsAcad =
      "<h2 style='font-family:Arial'>Nouvelle inscription</h2>"
    + "<table style='font-family:Arial;font-size:14px;border-collapse:collapse'>"
    + tr("Enfant", p.Enfant) + tr("Âge", p.Age) + tr("Ville", p.Ville)
    + tr("Jour", jour) + tr("Heure", heure) + tr("Créneau", p.Creneau)
    + tr("Parcours", p.Parcours) + tr("Formule", p.Formule) + tr("Niveau", p.Niveau)
    + tr("Parent", p.Parent) + tr("Téléphone", p.Telephone) + tr("E-mail", p.Email)
    + tr("Infos médicales", p.Infos_medicales)
    + "</table>"
    + "<p style='font-family:Arial;font-size:13px'>📋 <a href='" + urlFeuille + "'>Ouvrir le classeur des prospects et inscriptions</a></p>";
  MailApp.sendEmail({ to: EMAIL_ACADEMIE, subject: sujetAcad, htmlBody: corpsAcad, replyTo: p.Email });

  // 2) Confirmation pour le parent
  if (p.Email) {
    var sujetParent = "✅ Inscription confirmée — Formation Robotique (" + p.Enfant + ")";
    var corpsParent =
        "<div style='font-family:Arial;font-size:14px;line-height:1.6'>"
      + "<p>Bonjour " + p.Parent + ",</p>"
      + "<p>Nous avons bien reçu l'inscription de <strong>" + p.Enfant + "</strong> (" + p.Age
      + ") à la Formation Robotique des <strong>Petits Génies de la Robotique</strong> "
      + "(rentrée le 7 octobre, jusqu'au 30 juin).</p>"
      + "<table style='font-size:14px;border-collapse:collapse'>"
      + tr("Ville", p.Ville) + tr("Jour", jour) + tr("Heure", heure) + tr("Créneau", p.Creneau)
      + tr("Parcours", p.Parcours) + tr("Formule", p.Formule)
      + "</table>"
      + "<p>Nous vous recontactons très vite pour confirmer le groupe et vous communiquer le tarif.</p>"
      + "<p>📞 " + TEL_ACADEMIE + " &nbsp;·&nbsp; 💬 WhatsApp : " + TEL_ACADEMIE + "<br>"
      + "📍 9, rue de Sablon, Metz &nbsp;·&nbsp; 📍 6, rue de la Tour, 57100 Thionville</p>"
      + "<p>À bientôt !<br><strong>Les Petits Génies de la Robotique</strong> 🤖</p></div>";
    MailApp.sendEmail({ to: p.Email, subject: sujetParent, htmlBody: corpsParent, replyTo: EMAIL_ACADEMIE });
  }
}

function tr(cle, valeur) {
  return "<tr><td style='padding:4px 12px 4px 0;color:#555'>" + cle
       + "</td><td style='padding:4px 0'><strong>" + (valeur || "—") + "</strong></td></tr>";
}

/* ---------- Réponse JSON ---------- */
function reponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}

/* =========================================================
   OUTILS À LANCER À LA MAIN (menu Exécuter de l'éditeur)
   ========================================================= */

/* Vérifie que le script voit les deux classeurs, leurs onglets, et peut y écrire. */
function verifierInstallation() {
  var souci = 0;
  souci += verifieClasseur("Inscriptions", classeurInscriptions, [ONGLET_TOUTES]);
  souci += verifieClasseur("Prospects", classeur, ["SUIVI Metz", "SUIVI Thionville"]);
  Logger.log(souci === 0 ? "=> Tout est bon." : "=> " + souci + " point(s) à corriger.");
}

function verifieClasseur(libelle, ouvrir, onglets) {
  var ss, souci = 0;
  try {
    ss = ouvrir();
  } catch (err) {
    Logger.log("ÉCHEC  " + libelle + " : classeur inaccessible : " + err);
    Logger.log("       Partagez-le en « Éditeur » avec le compte qui exécute ce script.");
    return 1;
  }
  Logger.log(libelle + " : " + ss.getName());
  for (var i = 0; i < onglets.length; i++) {
    var sh = trouveOnglet(ss, onglets[i]);
    if (!sh) { Logger.log("MANQUE " + onglets[i]); souci++; continue; }
    var attendus = (onglets[i] === ONGLET_TOUTES) ? [] : ENTETES_SUIVI;
    var cols = indexColonnes(sh, attendus), absents = [];
    for (var a = 0; a < attendus.length; a++) if (!cols[attendus[a]]) absents.push(attendus[a]);
    if (absents.length) Logger.log("NOTE   " + onglets[i] + " : colonnes introuvables (laissées vides) : " + absents.join(", "));
    try {
      sh.getRange(1, 1).setValue(sh.getRange(1, 1).getValue());
      Logger.log("OK     " + onglets[i] + " (écriture autorisée)");
    } catch (err) {
      Logger.log("ÉCHEC  " + onglets[i] + " : écriture refusée : " + err);
      souci++;
    }
  }
  return souci;
}

/* Inscription de test complète : écrit dans les onglets, montre le résultat,
   puis efface les lignes ajoutées. Aucun e-mail. Ne touche à rien d'autre.  */
function testerInscription() {
  var ss  = classeur();
  var ins = classeurInscriptions();
  var faux = {
    Enfant: "ZZTEST Robot", Age: "11 ans", Ville: "Metz — 9 rue de Sablon",
    Parcours: "🤖 Robotique, IoT & IA",
    Formule: "Formation annuelle — 1 séance / semaine (1h ou 1h30 selon l'âge)",
    Creneau: "🌥️ Mercredi — 13h30 à 15h00 (1h30 · 10 ans et +)",
    Niveau: "Débutant — aucune connaissance", Parent: "Test Automatique",
    Telephone: "0600000000", Email: "test@example.com", Infos_medicales: "—",
    Cle: CLE_SITE, Piege: "", Duree: "42", Origine: "test"
  };

  var lieu  = extraitLieu(faux.Ville);
  var jour  = extraitJour(faux.Creneau);
  var heure = extraitHeure(faux.Creneau);

  var onglets = [];
  try {
    ecritToutes(ins, faux, jour, heure);
    ecritSuivi(ss, faux, lieu, jour, heure);

    onglets = [trouveOnglet(ins, ONGLET_TOUTES), trouveOnglet(ins, jour),
               trouveOnglet(ss, ONGLET_SUIVI[lieu])];
    for (var i = 0; i < onglets.length; i++) {
      var sh = onglets[i];
      if (!sh) continue;
      var l = ligneTest(sh);
      Logger.log("Ligne écrite dans " + sh.getName() + " (ligne " + l + ") : "
                 + sh.getRange(l, 1, 1, sh.getLastColumn()).getValues()[0].join(" | "));
    }
  } finally {
    var tous = [trouveOnglet(ins, ONGLET_TOUTES), trouveOnglet(ins, jour),
                trouveOnglet(ss, ONGLET_SUIVI[lieu])];
    for (var k = 0; k < tous.length; k++) if (tous[k]) effaceLignesTest(tous[k]);
    Logger.log("Lignes de test effacées. Aucun e-mail n'a été envoyé.");
  }
}

/* Numéro de la ligne ZZTEST dans un onglet (la dernière trouvée). */
function ligneTest(sh) {
  var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  for (var l = v.length - 1; l >= 1; l--) {
    if (v[l].join(" ").indexOf("ZZTEST") !== -1) return l + 1;
  }
  return sh.getLastRow();
}

/* Supprime toutes les lignes contenant ZZTEST dans un onglet. */
function effaceLignesTest(sh) {
  for (var l = sh.getLastRow(); l >= 2; l--) {
    var ligne = sh.getRange(l, 1, 1, sh.getLastColumn()).getValues()[0].join(" ");
    if (ligne.indexOf("ZZTEST") !== -1) sh.deleteRow(l);
  }
}
