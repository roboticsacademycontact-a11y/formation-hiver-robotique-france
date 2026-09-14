/**
 * FORMATION D'HIVER ROBOTIQUE — Les Petits Génies de la Robotique
 * Réception des inscriptions du site.
 *
 * Ce script fait 3 choses à chaque inscription :
 *   1. il ajoute une ligne dans l'onglet "TOUTES LES INSCRIPTIONS"
 *   2. il ajoute la même ligne dans l'onglet du jour (Mercredi, Samedi, Dimanche…)
 *      et le trie automatiquement par heure de séance
 *   3. il envoie un e-mail à l'académie ET un e-mail de confirmation au parent
 *
 * Installation : voir INSTRUCTIONS.md
 */

var EMAIL_ACADEMIE = "robotics.academy.contact@gmail.com";
var TEL_ACADEMIE   = "07 51 21 01 00";
var NOM_CLASSEUR   = "Inscriptions Formation Robotique";

/* ---------- Protection anti-robot ---------- */
var CLE_SITE        = "LPG-hiver-2026-Metz-Thionville"; // doit être identique à celle du site
var DUREE_MINIMUM   = 5;    // secondes : en dessous, c'est un robot
var MAX_PAR_EMAIL   = 3;    // inscriptions autorisées par e-mail et par heure
var MAX_PAR_HEURE   = 30;   // inscriptions autorisées au total par heure

var ENTETES = ["Date d'inscription","Enfant","Âge","Ville","Jour","Heure","Créneau complet",
               "Parcours","Formule","Niveau","Parent / tuteur","Téléphone","E-mail","Infos médicales"];

var JOURS = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];

/* ---------- Point d'entrée appelé par le site ---------- */
function doPost(e) {
  try {
    var p  = e.parameter;

    /* --- 1. Filtres anti-robot (avant toute écriture) --- */
    var verdict = controle(p);
    if (verdict.bloque)  { journalRejet(p, verdict.motif); return reponse({ ok: false }); }
    if (verdict.silence) { return reponse({ ok: true }); }   // robot : on fait semblant d'accepter
    if (verdict.refus)   { return reponse({ ok: false, refus: verdict.refus }); }

    var ss = classeur();

    var jour  = extraitJour(p.Creneau);
    var heure = extraitHeure(p.Creneau);

    var ligne = [new Date(), p.Enfant, p.Age, p.Ville, jour, heure, p.Creneau,
                 p.Parcours, p.Formule, p.Niveau, p.Parent, p.Telephone, p.Email, p.Infos_medicales];

    ajouteLigne(ss, "TOUTES LES INSCRIPTIONS", ligne, false);
    ajouteLigne(ss, jour, ligne, true);   // onglet du jour, trié par heure

    envoieMails(p, jour, heure, ss.getUrl());

    return reponse({ ok: true });
  } catch (err) {
    return reponse({ ok: false, error: String(err) });
  }
}

function doGet() {
  return reponse({ ok: true, message: "Service d'inscription actif.", feuille: classeur().getUrl() });
}

/* ---------- Le classeur qui reçoit les inscriptions ----------
   Fonctionne dans les deux cas :
   - script rattaché à un Google Sheet  -> utilise ce classeur
   - script indépendant                 -> crée le classeur la 1re fois,
                                           puis réutilise toujours le même     */
function classeur() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("ID_CLASSEUR");
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (err) { /* recréé plus bas */ }
  }
  var actif = SpreadsheetApp.getActiveSpreadsheet();
  if (actif) {
    props.setProperty("ID_CLASSEUR", actif.getId());
    return actif;
  }
  var neuf = SpreadsheetApp.create(NOM_CLASSEUR);
  props.setProperty("ID_CLASSEUR", neuf.getId());
  return neuf;
}

/* Affiche l'adresse du classeur dans le journal (bouton Exécuter) */
function ouvrirLaListe() {
  var url = classeur().getUrl();
  Logger.log("Liste des inscriptions : " + url);
  return url;
}

/* ---------- Contrôles anti-robot ----------
   Renvoie :
     {bloque:...}  -> requête étrangère au site : rejet silencieux + journal
     {silence:true}-> robot pris au piège : on répond "ok" sans rien écrire
     {refus:"..."} -> envoi humain mais invalide : message affiché sur le site
     {}            -> inscription valide                                        */
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

/* Journal des tentatives bloquées (onglet "TENTATIVES BLOQUEES") */
function journalRejet(p, motif) {
  try {
    var ss = classeur();
    var sh = ss.getSheetByName("TENTATIVES BLOQUEES");
    if (!sh) {
      sh = ss.insertSheet("TENTATIVES BLOQUEES");
      sh.appendRow(["Date", "Motif", "Origine", "E-mail", "Enfant", "Créneau"]);
      sh.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#5e1212").setFontColor("#ffffff");
      sh.setFrozenRows(1);
    }
    if (sh.getLastRow() > 500) sh.deleteRows(2, 200);   // on garde le journal court
    sh.appendRow([new Date(), motif, p.Origine || "?", p.Email || "?", p.Enfant || "?", p.Creneau || "?"]);
  } catch (err) { /* le journal ne doit jamais bloquer une inscription */ }
}

/* ---------- Écriture dans la feuille ---------- */
function ajouteLigne(ss, nomOnglet, ligne, trierParHeure) {
  var sh = ss.getSheetByName(nomOnglet);
  if (!sh) {
    sh = ss.insertSheet(nomOnglet);
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(ENTETES);
    sh.getRange(1, 1, 1, ENTETES.length)
      .setFontWeight("bold").setBackground("#123a5e").setFontColor("#ffffff");
    sh.setFrozenRows(1);
  }
  sh.appendRow(ligne);

  if (trierParHeure && sh.getLastRow() > 2) {
    sh.getRange(2, 1, sh.getLastRow() - 1, ENTETES.length)
      .sort([{ column: 6, ascending: true }, { column: 1, ascending: true }]);
  }
  sh.autoResizeColumns(1, ENTETES.length);
}

/* ---------- Lecture du créneau ---------- */
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

/* ---------- E-mails ---------- */
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
    + "<p style='font-family:Arial;font-size:13px'>📋 <a href='" + urlFeuille + "'>Ouvrir la liste des inscriptions</a></p>";
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
