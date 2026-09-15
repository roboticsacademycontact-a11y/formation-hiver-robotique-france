/**
 * FORMATION ROBOTIQUE — Les Petits Génies de la Robotique
 * Réception des inscriptions du site.
 *
 * Toutes les inscriptions arrivent dans le classeur
 *   « Prospects Essai gratuit Robotique 2026-2027 - Metz et Thionville »
 * et nulle part ailleurs :
 *
 *   1. onglet INSCRIPTIONS    -> la fiche complète (avec tarif, remise, net à payer)
 *   2. onglet SUIVI Metz      -> la ligne de suivi téléphonique, selon la ville
 *      ou  SUIVI Thionville
 *   3. e-mail à l'académie + e-mail de confirmation au parent
 *
 * Installation : voir INSTRUCTIONS.md
 */

/* ---------- Classeur de destination ----------
   « Prospects Essai gratuit Robotique 2026-2027 - Metz et Thionville ».
   Pour changer de classeur, remplacez cet identifiant (il se lit dans
   l'adresse du classeur, entre /d/ et /edit).                              */
var ID_CLASSEUR = "1yWPFFU_OKvMv0KMPFKUHixbMJLWMzTV5wT2jRZBes8s";

var EMAIL_ACADEMIE = "robotics.academy.contact@gmail.com";
var TEL_ACADEMIE   = "07 51 21 01 00";

/* ---------- Noms des onglets (tels qu'ils existent déjà dans le classeur) ---------- */
var ONGLET_INSCRIPTIONS = "INSCRIPTIONS";
var ONGLET_SUIVI        = { "Metz": "SUIVI Metz", "Thionville": "SUIVI Thionville" };
var ONGLET_SUIVI_DEFAUT = "SUIVI";      // repli si la ville n'est pas reconnue
var ONGLET_PARAMETRES   = "Parametres";
var ONGLET_TARIFS       = "Tarifs";
var ONGLET_BLOQUEES     = "TENTATIVES BLOQUEES";

/* ---------- Protection anti-robot ---------- */
var CLE_SITE        = "LPG-hiver-2026-Metz-Thionville"; // doit être identique à celle du site
var DUREE_MINIMUM   = 5;    // secondes : en dessous, c'est un robot
var MAX_PAR_EMAIL   = 3;    // inscriptions autorisées par e-mail et par heure
var MAX_PAR_HEURE   = 30;   // inscriptions autorisées au total par heure

/* ---------- Date limite de la remise de rentrée ----------
   Celle annoncée par le site. Au tout premier envoi suivant l'installation,
   le script aligne la ligne « Date limite remise » de l'onglet Parametres
   sur cette valeur, puis ne la touche plus jamais : vous restez libre de la
   modifier ensuite à la main.                                              */
var DATE_LIMITE_REMISE = "15/09/2026";

/* ---------- En-têtes attendus (ordre des colonnes des onglets existants) ---------- */
var ENTETES_INSCRIPTIONS = ["Cle","Date inscription","Annee","Enfant","Age","Ville","Lieu",
  "Jour","Heure","Creneau complet","Parcours","Formule","Niveau","Parent","Telephone",
  "E-mail","Tarif base","Remise","Net a payer","Origine","Notes"];

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

    var ss = classeur();
    alignementInitial(ss);

    /* --- 2. Mise en forme des informations --- */
    var lieu  = extraitLieu(p.Ville);
    var jour  = extraitJour(p.Creneau);
    var heure = extraitHeure(p.Creneau);
    var tarif = calculeTarif(ss, p.Age);

    /* --- 3. Écriture dans les onglets --- */
    ecritInscription(ss, p, lieu, jour, heure, tarif);
    ecritSuivi(ss, p, lieu, jour, heure);

    /* --- 4. E-mails --- */
    envoieMails(p, jour, heure, ss.getUrl());

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

/* Aligne une seule fois « Date limite remise » sur la date annoncée par le site. */
function alignementInitial(ss) {
  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty("DATE_LIMITE_ALIGNEE")) return;
    props.setProperty("DATE_LIMITE_ALIGNEE", "1");   // une seule fois, quoi qu'il arrive
    ecritParametre(ss, "Date limite remise", DATE_LIMITE_REMISE);
  } catch (err) { /* ne doit jamais bloquer une inscription */ }
}

function doGet() {
  var ss = classeur();
  return reponse({ ok: true, message: "Service d'inscription actif.",
                   classeur: ss.getName(), feuille: ss.getUrl() });
}

/* ---------- Le classeur qui reçoit les inscriptions ---------- */
function classeur() {
  return SpreadsheetApp.openById(ID_CLASSEUR);
}

/* Affiche l'adresse du classeur dans le journal (bouton Exécuter) */
function ouvrirLaListe() {
  var ss = classeur();
  Logger.log("Inscriptions : " + ss.getName() + " — " + ss.getUrl());
  return ss.getUrl();
}

/* =========================================================
   ÉCRITURE — onglet INSCRIPTIONS
   ========================================================= */
function ecritInscription(ss, p, lieu, jour, heure, tarif) {
  var sh = ongletExistant(ss, ONGLET_INSCRIPTIONS, ENTETES_INSCRIPTIONS);
  var cols = indexColonnes(sh, ENTETES_INSCRIPTIONS);

  var valeurs = {
    "Cle"              : cle(p.Enfant),
    "Date inscription" : new Date(),
    "Annee"            : parametre(ss, "Annee scolaire courante", "2026-2027"),
    "Enfant"           : p.Enfant,
    "Age"              : p.Age,
    "Ville"            : p.Ville,
    "Lieu"             : lieu,
    "Jour"             : jour,
    "Heure"            : heure,
    "Creneau complet"  : p.Creneau,
    "Parcours"         : p.Parcours,
    "Formule"          : p.Formule,
    "Niveau"           : p.Niveau,
    "Parent"           : p.Parent,
    "Telephone"        : p.Telephone,
    "E-mail"           : p.Email,
    "Tarif base"       : tarif.base,
    "Remise"           : tarif.remise ? tarif.remise + " %" : "",
    "Net a payer"      : tarif.net,
    "Origine"          : "Site",
    "Notes"            : notes(p)
  };

  sh.appendRow(ligneOrdonnee(cols, valeurs, sh.getLastColumn()));
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
    "Téléphone"        : p.Telephone,
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
   TARIF — lu dans les onglets Parametres et Tarifs
   ========================================================= */
function calculeTarif(ss, age) {
  var n = ageExact(age);
  var base = "";

  var sh = trouveOnglet(ss, ONGLET_TARIFS);
  if (sh && n !== "" && sh.getLastRow() > 1) {
    var t = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
    for (var i = 0; i < t.length; i++) {
      var min = Number(t[i][1]), max = Number(t[i][2]);
      if (!isNaN(min) && !isNaN(max) && n >= min && n <= max) { base = Number(t[i][3]); break; }
    }
  }

  var remise = 0;
  var pct    = Number(parametre(ss, "Remise rentree", 0));
  var limite = parametre(ss, "Date limite remise", "");
  if (pct > 0 && dansLesDelais(limite)) remise = pct;

  var net = (base === "" ) ? "" : Math.round(base * (100 - remise) / 100);
  return { base: base, remise: remise, net: net };
}

/* La remise court-elle encore ? (date limite incluse) */
function dansLesDelais(limite) {
  if (!limite) return true;                       // pas de date limite renseignée
  var d = (limite instanceof Date) ? limite : dateFr(String(limite));
  if (!d) return true;
  d.setHours(23, 59, 59);
  return new Date() <= d;
}

/* "30/09/2026" -> Date */
function dateFr(txt) {
  var m = txt.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
}

/* Lecture d'une ligne de l'onglet Parametres */
function parametre(ss, nom, defaut) {
  var sh = trouveOnglet(ss, ONGLET_PARAMETRES);
  if (!sh || sh.getLastRow() < 2) return defaut;
  var t = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < t.length; i++) {
    if (String(t[i][0]).trim().toLowerCase() === String(nom).trim().toLowerCase()) {
      return t[i][1];
    }
  }
  return defaut;
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

/* Clé de rapprochement : "Léa Dupont" -> "lea dupont" */
function cle(nom) {
  return sansAccent(nom).replace(/\s+/g, " ").trim();
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

/* Écrit une ligne de l'onglet Parametres. Renvoie l'ancienne valeur, ou null. */
function ecritParametre(ss, nom, valeur) {
  var sh = trouveOnglet(ss, ONGLET_PARAMETRES);
  if (!sh || sh.getLastRow() < 2) return null;
  var t = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < t.length; i++) {
    if (sansAccent(String(t[i][0])).trim() === sansAccent(nom).trim()) {
      var avant = t[i][1];
      if (String(avant).indexOf(valeur) === -1) sh.getRange(i + 2, 2).setValue(valeur);
      return avant;
    }
  }
  return null;
}

/* Aligne la date limite de la remise sur celle annoncée par le site. */
function corrigerDateLimiteRemise() {
  var ss = classeur();
  var avant = ecritParametre(ss, "Date limite remise", DATE_LIMITE_REMISE);
  if (avant === null) {
    Logger.log("Ligne « Date limite remise » introuvable dans " + ONGLET_PARAMETRES + ".");
  } else {
    Logger.log("Date limite remise : " + avant + " -> " + DATE_LIMITE_REMISE);
  }
}

/* Vérifie que le script voit le classeur, ses onglets, et qu'il peut y écrire. */
function verifierInstallation() {
  var ss, souci = 0;
  try {
    ss = classeur();
  } catch (err) {
    Logger.log("ÉCHEC  Classeur inaccessible : " + err);
    Logger.log("       Le compte qui exécute ce script n'a pas accès au classeur " + ID_CLASSEUR + ".");
    Logger.log("       Partagez-le en « Éditeur » avec ce compte, ou recréez le script depuis le compte propriétaire.");
    return;
  }
  Logger.log("Classeur : " + ss.getName());

  var attendus = [ONGLET_INSCRIPTIONS, "SUIVI Metz", "SUIVI Thionville",
                  ONGLET_PARAMETRES, ONGLET_TARIFS];
  for (var i = 0; i < attendus.length; i++) {
    var sh = trouveOnglet(ss, attendus[i]);
    Logger.log((sh ? "OK     " : "MANQUE ") + attendus[i]);
    if (!sh) souci++;
  }

  /* Écriture réellement possible ? */
  try {
    var t = trouveOnglet(ss, ONGLET_INSCRIPTIONS);
    if (t) { t.getRange(1, 1).setValue(t.getRange(1, 1).getValue()); Logger.log("OK     écriture autorisée"); }
  } catch (err) {
    Logger.log("ÉCHEC  écriture refusée : " + err);
    souci++;
  }

  var tarif = calculeTarif(ss, "10 ans");
  Logger.log("Tarif 10 ans : " + tarif.base + " € · remise " + tarif.remise + " % · net " + tarif.net + " €");
  Logger.log("Date limite remise : " + parametre(ss, "Date limite remise", "(absente)")
             + "  (le site annonce " + DATE_LIMITE_REMISE + ")");
  Logger.log(souci === 0 ? "=> Tout est bon." : "=> " + souci + " point(s) à corriger.");
}

/* Inscription de test complète : écrit dans les onglets, montre le résultat,
   puis efface les lignes ajoutées. Ne touche à rien d'autre.               */
function testerInscription() {
  var ss = classeur();
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
  var tarif = calculeTarif(ss, faux.Age);

  ecritInscription(ss, faux, lieu, jour, heure, tarif);
  ecritSuivi(ss, faux, lieu, jour, heure);

  var a = trouveOnglet(ss, ONGLET_INSCRIPTIONS);
  var b = trouveOnglet(ss, ONGLET_SUIVI[lieu]);
  Logger.log("Ligne écrite dans " + ONGLET_INSCRIPTIONS + " (ligne " + a.getLastRow() + ") : "
             + a.getRange(a.getLastRow(), 1, 1, a.getLastColumn()).getValues()[0].join(" | "));
  if (b) {
    Logger.log("Ligne écrite dans " + b.getName() + " (ligne " + b.getLastRow() + ") : "
               + b.getRange(b.getLastRow(), 1, 1, b.getLastColumn()).getValues()[0].join(" | "));
  }

  effaceLignesTest(a); if (b) effaceLignesTest(b);
  Logger.log("Lignes de test effacées. Aucun e-mail n'a été envoyé.");
}

/* Supprime toutes les lignes contenant ZZTEST dans un onglet. */
function effaceLignesTest(sh) {
  for (var l = sh.getLastRow(); l >= 2; l--) {
    var ligne = sh.getRange(l, 1, 1, sh.getLastColumn()).getValues()[0].join(" ");
    if (ligne.indexOf("ZZTEST") !== -1) sh.deleteRow(l);
  }
}
