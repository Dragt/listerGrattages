// ==UserScript==
// @name grattageComplet
// @namespace Violentmonkey Scripts
// @include */mountyhall/MH_Play/Actions/Competences/userscriptGrattage
// @include */maListeParchemins/grattage*
// @include */mountyhall/MH_Play/Play_equipement.php*
// @include *Play_a_Competence26c.php*
// @include */mountyhall/MH_Play/Actions/Competences/Play_a_Competence26b.php*
// @grant none
// @version 2.0
// ==/UserScript==
//

// ---------- INFOS
// Il s'agit de 3 scripts réunis en 1
// GrattageFD.user.js affiche lors du grattage l'effet des glyphes
// listerGrattages.user.js permet de visualiser et tester tous ses grattages dans une seule page, de les classer et de les enregistrer
// grattageAfficherComposants.user.js permet d'afficher la solidité et l'usure des composants durant un grattage



/* Utilisation listerGrattages.user.js :
 * 1) Installez ce script dans Violent Monkey
 * 2) Connectez-vous à MH avec 2 PAs restants (session active)
 * 3) Ayez sur votre trõll les parchemins à analyser
 * 4a) pour lancer l'outil, cliquer sur le bouton à côté des parchemins dans la page equipement
 *
 * Pour l'utiliser comme un script js classique lié à une page html, simplement mettre la constante STATIQUE à 1
 */

/* 2019-06-01 v1.0 : version de base
 * On peut cocher les glyphes à gratter pour voir directement l'effet final du parcho
 * On peut survoler le nom du parcho pour voir son effet initial
 * On peut survoler un glyphe pour voir les détails le concernant (je n'affiche juste pas les images)
 * On peut supprimer de la liste un parchemin qu'on n'estime pas intéressant à garder
 * Le petit numéro entre crochets indique le numéro initial de traitement du parcho dans la page, pratique pour s'y retrouver et voir combien de parchos sont traités au total
 * Le bouton pour afficher un récapitulatif affiche en début de page les grattages indiqués pour les parchemins gardés, facile à copier/coller.
 * */

/* 2019-06-02 v1.1 :
 * Affiche lite parchemins gardés et rejetés dans récapitulatif
 * Permet de supprimer des parchemins sur base d'une liste fournie
 * Affiche l'effet de base dans le récapitulatif
 */

/*  v1.2 :
 * intégration dans interface mh
 */

/*  v1.3 :
 * DOMParser pour traiter les requêtes et éviter les appels inutiles aux ressources images sur le serveur
 * introduction classes Parchemin et Glyphe pour avoir plus simple à traiter les données
 * refactoring complet pour rigoler
 * améliorations affichages résumé
 * Possibilité de filtrer et trier
 * Possibilité d'enregistrer et charger localement, en plus du chargement automatique depuis le hall
 * Possibilité d'importer et d'exporter au format texte
 */

/*  v1.4 :
 * structure en dictionnaire pour les parchemins
 * notion de parchemins "bons" et "mauvais", avec boutons pour les faire changer de catégorie et filtre
 * ne va plus chercher les parchemins déjà connus en local, pour soulager au max le serveur (à tester)
 * possibiliter de choisir si les données importées complètent ou remplace l'actuel
 * recapitulatif remanié
 * champ de duree separe des autres carac
 */

/*
 * v1.5
 * charger les parchemins 1 à 1...
 * modifier une page existante plutôt que la 404...
 */

/* v1.6
 * Ajout du marqueur "terminé" pour les parchemins
 * mini amélioration récapitulatif
 * possibilité de cacher tous les parchemins neutres
 * ajout du tri en "combinaison"
 * enregistrement des dates d'ajouts de parchemin
 */

/* v1.7
 * groupe "pas toucher" ajouté
 * suppression de la possibilité de "cacher"
 * amélioration du rapport récapitulatif
 * plus d'infos lors du survol de la souris
 * possibilité d'afficher les parchemins sur soi.
 * possibilité de supprimer un parchemin (et non plus de définir une liste comme mauvais)
 * sauvegarde les critères d'affichage
 * Le filtre/tri ne change plus le "cochage" des parchemins marqués "à gratter" ou "termines
 */

/* v1.8
 * possibilite d'enregistrer et recuperer les sauvegardes en ligne
 */
 
 /* v1.9
 * ajout de la possibilité d'afficher la solidité et l'usure des composants durant un grattage
 */
 
  /* v2.0 
 * renommage du script en grattageComplet
 * intégration du script de vapu pour voir l'effet des glyphes lors du grattage
 * REMARQUE : cela signifie que les deux logiques sont implémentées dans ce script, il y aurait moins d'homogénéiser
 */



// ****************************************************************************************************************************
// Inspiré de l'algorithme de détermination des effets des Grattages des gribouillages par trollthar (85665) et
// du script d'aide de Vapulabehemot, inspirés des recherche de Bran (El'Haine).
// ****************************************************************************************************************************

//-------------------------------- Debug Mode --------------------------------//
const debugLevel = 0;
function displayDebug(data, level = 1) {
    if (debugLevel >= level) {
        window.console.log("[listerGrattages]", data);
    }
}
displayDebug(window.location.href);

//---------------------- variables globales et constantes : Général -----------------------//

const STATIQUE = 0;               // 0 -> normal en ligne // 1 -> utilise pachemins hardcodés en bas de fichier
const EXPORTER_PARCHEMINS = 0;   // affiche en console l'enregistrement des parchemins après récupération dans le hall
const CHARGEMENT_AUTOMATIQUE = 0;

const MAX_APPELS = 100;  // nombre maximum -1 de parchemins traités en une fois par l'outil
let compteurSecuriteNombreAppels = 0;

// attention au include Violent Monkey qui doit correspondre
const urlOutilListerGrattage = "/mountyhall/MH_Play/Actions/Competences/userscriptGrattage";
const urlAutreQueMountihall = "/maListeParchemins/grattage.html";

const SERVEUR_CLOUD = "https://mh-storage.herokuapp.com";
const SERVICE_SAUVEGARDE = "/listerGrattages/api/v1/ajouter";
const SERVICE_CHARGEMENT = "/listerGrattages/api/v1/recuperer";

// affichage bonus malus
const COULEUR_BONUS = '#336633'; // vert '336633'
const COULEUR_MALUS = '#990000'; // rouge '990000'
const COULEUR_AUTRE = '#000000'; // noir '000000'
//const COULEUR_SANS_EFFET = '#707070'; // gris '707070'

const AU_MOINS = 1;
const AU_PLUS = -1;

let NUMERO_TROLL;

if (STATIQUE) NUMERO_TROLL = 666666666;


//---------------------- variables globales et constantes : Analyse des glyphes  -----------------------//

// caractéristiques, avec les noms/abréviations utilisés dans MountyHall
// et dans l'ordre des affichages dans MountyHall
// ATT | ESQ | DEG | REG | Vue | PV | TOUR | Armure | Effet de Zone // plus Durée

const ATT = 0;
const ESQ = 1;
const DEG = 2;
const REG = 3;
const VUE = 4;
const PV = 5;
const TOUR = 6;
const ARM = 7;
const ZONE = 8;
const DUREE = 9;
const TOUTES = 88;
const COMBINAISON = 77;

const CARAC = [
    {
        id: 0,
        presentation: 'ATT',
        unite: [1, ' D3']
    },
    {
        id: 1,
        presentation: 'ESQ',
        unite: [1, ' D3']
    },
    {
        id: 2,
        presentation: 'DEG',
        unite: [1, '']
    },
    {
        id: 3,
        presentation: 'REG',
        unite: [1, '']
    },
    {
        id: 4,
        presentation: 'Vue',
        unite: [1, '']
    },
    {
        id: 5,
        presentation: 'PV',
        unite: [1, 'D3']
    },
    {
        id: 6,
        presentation: 'TOUR',
        unite: [-15, 'min']
    },
    {
        id: 7,
        presentation: 'Armure',
        unite: [1, '']
    },
    {
        id: 8,
        presentation: 'Effet de Zone',
        unite: [1, '']
    },
    {
        id: 9,
        presentation: 'Durée',
        unite: [1, 'Tour']
    }
];

//TODO : générer automatiquement
const CARACTERISTIQUES_GLYPHES = {

    '1320': [CARAC[ATT], CARAC[ATT]],
    '1344': [CARAC[ATT], CARAC[ESQ]],
    '3368': [CARAC[ATT], CARAC[DEG]],
    '4392': [CARAC[ATT], CARAC[ARM]],
    '5416': [CARAC[ATT], CARAC[REG]],
    '6440': [CARAC[ATT], CARAC[VUE]],
    '7464': [CARAC[ATT], CARAC[PV]],
    '8488': [CARAC[ATT], CARAC[TOUR]],
    '9512': [CARAC[ATT], CARAC[DUREE]],
    '10536': [CARAC[ATT], CARAC[ZONE]],

    '11560': [CARAC[ESQ], CARAC[ATT]],
    '12584': [CARAC[ESQ], CARAC[ESQ]],
    '13608': [CARAC[ESQ], CARAC[DEG]],
    '14632': [CARAC[ESQ], CARAC[ARM]],
    '15656': [CARAC[ESQ], CARAC[REG]],
    '16680': [CARAC[ESQ], CARAC[VUE]],
    '17704': [CARAC[ESQ], CARAC[PV]],
    '18728': [CARAC[ESQ], CARAC[TOUR]],
    '19752': [CARAC[ESQ], CARAC[DUREE]],
    '20776': [CARAC[ESQ], CARAC[ZONE]],

    '21800': [CARAC[DEG], CARAC[ATT]],
    '22824': [CARAC[DEG], CARAC[ESQ]],
    '23848': [CARAC[DEG], CARAC[DEG]],
    '24872': [CARAC[DEG], CARAC[ARM]],
    '25896': [CARAC[DEG], CARAC[REG]],
    '26920': [CARAC[DEG], CARAC[VUE]],
    '27944': [CARAC[DEG], CARAC[PV]],
    '28968': [CARAC[DEG], CARAC[TOUR]],
    '29992': [CARAC[DEG], CARAC[DUREE]],
    '31016': [CARAC[DEG], CARAC[ZONE]],

    '32040': [CARAC[ARM], CARAC[ATT]],
    '33064': [CARAC[ARM], CARAC[ESQ]],
    '34088': [CARAC[ARM], CARAC[DEG]],
    '35112': [CARAC[ARM], CARAC[ARM]],
    '36136': [CARAC[ARM], CARAC[REG]],
    '37160': [CARAC[ARM], CARAC[VUE]],
    '38184': [CARAC[ARM], CARAC[PV]],
    '39208': [CARAC[ARM], CARAC[TOUR]],
    '40232': [CARAC[ARM], CARAC[DUREE]],
    '41256': [CARAC[ARM], CARAC[ZONE]],

    '42280': [CARAC[REG], CARAC[ATT]],
    '43304': [CARAC[REG], CARAC[ESQ]],
    '44328': [CARAC[REG], CARAC[DEG]],
    '45352': [CARAC[REG], CARAC[ARM]],
    '46376': [CARAC[REG], CARAC[REG]],
    '47400': [CARAC[REG], CARAC[VUE]],
    '48424': [CARAC[REG], CARAC[PV]],
    '49448': [CARAC[REG], CARAC[TOUR]],
    '50472': [CARAC[REG], CARAC[DUREE]],
    '51496': [CARAC[REG], CARAC[ZONE]],

    '52520': [CARAC[VUE], CARAC[ATT]],
    '53544': [CARAC[VUE], CARAC[ESQ]],
    '54568': [CARAC[VUE], CARAC[DEG]],
    '55592': [CARAC[VUE], CARAC[ARM]],
    '56616': [CARAC[VUE], CARAC[REG]],
    '57640': [CARAC[VUE], CARAC[VUE]],
    '58664': [CARAC[VUE], CARAC[PV]],
    '59688': [CARAC[VUE], CARAC[TOUR]],
    '60712': [CARAC[VUE], CARAC[DUREE]],
    '61736': [CARAC[VUE], CARAC[ZONE]],

    '62760': [CARAC[PV], CARAC[ATT]],
    '63784': [CARAC[PV], CARAC[ESQ]],
    '64808': [CARAC[PV], CARAC[DEG]],
    '65832': [CARAC[PV], CARAC[ARM]],
    '66856': [CARAC[PV], CARAC[REG]],
    '67880': [CARAC[PV], CARAC[VUE]],
    '68904': [CARAC[PV], CARAC[PV]],
    '69928': [CARAC[PV], CARAC[TOUR]],
    '70952': [CARAC[PV], CARAC[DUREE]],
    '71976': [CARAC[PV], CARAC[ZONE]],

    '73000': [CARAC[TOUR], CARAC[ATT]],
    '74024': [CARAC[TOUR], CARAC[ESQ]],
    '75048': [CARAC[TOUR], CARAC[DEG]],
    '76072': [CARAC[TOUR], CARAC[ARM]],
    '77096': [CARAC[TOUR], CARAC[REG]],
    '78120': [CARAC[TOUR], CARAC[VUE]],
    '79144': [CARAC[TOUR], CARAC[PV]],
    '80168': [CARAC[TOUR], CARAC[TOUR]],
    '81192': [CARAC[TOUR], CARAC[DUREE]],
    '82216': [CARAC[TOUR], CARAC[ZONE]],

    '83240': [CARAC[DUREE], CARAC[ATT]],
    '84264': [CARAC[DUREE], CARAC[ESQ]],
    '85288': [CARAC[DUREE], CARAC[DEG]],
    '86312': [CARAC[DUREE], CARAC[ARM]],
    '87336': [CARAC[DUREE], CARAC[REG]],
    '88360': [CARAC[DUREE], CARAC[VUE]],
    '89384': [CARAC[DUREE], CARAC[PV]],
    '90408': [CARAC[DUREE], CARAC[TOUR]],
    '91432': [CARAC[DUREE], CARAC[DUREE]],
    '92456': [CARAC[DUREE], CARAC[ZONE]],

    '93480': [CARAC[ZONE], CARAC[ATT]],
    '94504': [CARAC[ZONE], CARAC[ESQ]],
    '95528': [CARAC[ZONE], CARAC[DEG]],
    '96552': [CARAC[ZONE], CARAC[ARM]],
    '97576': [CARAC[ZONE], CARAC[REG]],
    '98600': [CARAC[ZONE], CARAC[VUE]],
    '99624': [CARAC[ZONE], CARAC[PV]],
    '100648': [CARAC[ZONE], CARAC[TOUR]],
    '101672': [CARAC[ZONE], CARAC[DUREE]],
    '102696': [CARAC[ZONE], CARAC[ZONE]]
};


const FINESSES_GLYPHES = {
    0: 'Très gras',
    1: 'Gras',
    2: 'Moyen',
    3: 'Fin',
    4: 'Très fin (version 3)',
    5: 'Très fin (version 2)',
    6: 'Très fin (version 1)',
};

// orientation
// const MOINS_PLUS = 0;
// const MOINS_MOINS = 1;
// const PLUS_MOINS = 2;
// const PLUS_PLUS = 3;

const ORIENTATIONS_GLYPHES = {
    0: {nom: 'Initiale', impact: [-1, +1], impactTexte: 'Malus | Bonus'},
    1: {nom: 'Symétrie Horizontale', impact: [-1, -1], impactTexte: 'Malus | Malus'},
    2: {nom: 'Symétrie Verticale', impact: [+1, -1], impactTexte: 'Bonus | Malus'},
    3: {nom: 'Symétrie Centrale', impact: [+1, +1], impactTexte: 'Bonus | Bonus'}
};

//-------------------------------- Définition des classes --------------------------------//

// _ devant un fonction ou une variable : indiquer qu'ils sont conceptuellement plutôt privés
// assez moche et pas fort nécessaire ici... parfois pas toujours appliqué

//************************* Classe Createur *************************
// permet de raccourcir l'écriture de création d'éléments (même si moins performant, forcément)

class Createur {

    static elem(tag, param = {}) {
        const el = document.createElement(tag);
        if ('id' in param) el.setAttribute('id', param.id);
        if ('texte' in param) el.appendChild(document.createTextNode(param.texte));
        if ('html' in param) el.innerHTML = param.html;
        if ('style' in param) el.setAttribute('style', param.style);
        if ('parent' in param) param.parent.appendChild(el);
        if ('enfants' in param) for (const enfant of param.enfants) el.appendChild(enfant);
        if ('classesHtml' in param) for (const classe of param.classesHtml) el.classList.add(classe);
        if ('attributs' in param) for (const attr of param.attributs) el.setAttribute(attr[0], attr[1]);
        if ('events' in param) {
            for (const event of param.events) {
                const bindingParams = [];
                const bindingElement = (('bindElement' in event) ? event.bindElement : el);
                bindingParams.push(bindingElement);
                if ('param' in event) bindingParams.push(...event.param);
                el.addEventListener(event.nom, event.fonction.bind(...bindingParams));
            }
        }
        return el;
    }
}

//************************* Classe Parchemin *************************
// contient les données liées à un parchemin, y compris ses glyphes

const EN_COURS = 0;
const TERMINE = 1;
/* Exemple OBSOLETE :
 {"id":"9308040",
 "nom":"Yeu'Ki'Pic Gribouillé",
 "effetDeBaseTexte":"Vue : -6 | PV : +6 D3 | Effet de Zone",
 "glyphes":[
 //, ...
 ],
 "complet":false,
 "potentiellementInteressant":true} */

// constructor(id, nom=undefined, effetDeBaseTexte=undefined, glyphes=[] )
// ajouterGlyphe(glyphe)
// effetTotal(glyphesRetires=[0, 0, 0, 0, 0, 0, 0, 0, 0, 0])

class Parchemin {

    /**
     * @return {number}
     */
    static get NOMBRE_GLYPHES() {
        return 10;
    }

    constructor(id,
                nom = undefined,
                effetDeBaseTexte = undefined,
                glyphes = [],
                dateAjout = new Date().toISOString(),
                etat = EN_COURS) {
        this.id = id;
        this.nom = nom;
        this.effetDeBaseTexte = effetDeBaseTexte;
        this.complet = false;                             // considéré complet lorsque 10 glyphes
        this.glyphes = [];
        this.dateAjout = dateAjout;
        this.etat = etat;
        if (!(glyphes.length === 0)) {
            for (const g of glyphes) this.ajouterGlyphe(g);   // array d'objets Glyphes
            this.etat = TERMINE;
        }

    }

    ajouterGlyphe(glyphe) {
        if (glyphe.traitable) {
            this.glyphes.push(glyphe);
            if (this.glyphes.length === (Parchemin.NOMBRE_GLYPHES)) {
                this.complet = true;
            }
        }
    }

    effetTotal(glyphesRetires = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) {
        const total = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (const glyphe of this.glyphes.filter((x, i) => !(Boolean(glyphesRetires[i])))) {
            for (const [caracId, e] of Object.entries(glyphe.effet)) {
                total[Number(caracId)] += e;
            }
        }
        return total;
    }

}

//************************* Classe ParcheminEnPage *************************

const QUALITE_PAS_TOUCHER = 2;
const QUALITE_BON = 1;
const QUALITE_NEUTRE = 0;
const QUALITE_MAUVAIS = -1;
const QUALITE_TERMINE = 9;
const QUALITE_SUR_MOI = 20;
// constructor(id, nom, effetDeBaseTexte, glyphes)
// get cochagesGlyphes
// get effetTotalHtml
// calculerCaracMax
// calculerValeurMax(carac, cocher=false)
// calculerCaracMin
// calculerValeurMin(carac, cocher=false)
// creerLignes(parent, position)
// _creerLigneEffetsGlyphes(parent, position)
// _creerLigneEffetTotal(parent)
// _creerLigneSeparation(parent)
// static _mettreEnFormeTd(td)
// cacherParchemin()
// rafraichirEffetTotal()
// static creerParchemin(enregistrement)

// Parchemin dans une page html pour l'outil, crée et connait les éléments html correspondant
class ParcheminEnPage extends Parchemin {

    static get W_COL1() {
        return "10vw"
    };

    constructor(id,
                nom,
                effetDeBaseTexte = undefined,
                glyphes = [],
                dateAjout = new Date().toISOString(),
                etat = EN_COURS,
                affiche = true,
                qualite = QUALITE_NEUTRE) {
        super(id, nom, effetDeBaseTexte, glyphes, dateAjout, etat);
        this.ligneEffetsGlyphes;    // TODO pas top ce système en trois ligne, trimballé du passé, à refactorer en un element
        this.ligneEffetTotal;
        this.tdEffetTotal;
        this.ligneSeparation;
        this.affiche = affiche; // pour l'afficher ou non dans l'outil
        this.qualite = qualite;

        this.boutonBon;
        this.boutonCacher;
        this.boutonMauvais;

    }

    get cochagesGlyphes() {
        return this.glyphes.map(g => Number(g.coche));
    }

    // todo ou alors je pourrais créer des nodes, plus propre...
    // A voir : affiche volontairement les durées négatives des durées (ême si équivalent 0), plus clair pour composer
    // pour effet de zone n'affiche quand même pas 0 ou négatif pour bien marquer différence
    get effetTotalHtml() {
        const total = this.effetTotal(this.cochagesGlyphes);
        const totalHtml = [];
        for (let i = 0; i < total.length; i++) {
            if (total[i] == 0 && i != DUREE) continue;                  // pas d'effet, sauf pour Durée où on affiche
            if ((total[i] <= 0) && i == ZONE) continue;   // pas d'efet de zone
            let s = '';
            const bonus = ((i === TOUR) ? -1 : +1);
            let couleur = (((total[i] * bonus) > 0) ? COULEUR_BONUS : COULEUR_MALUS );
            if (i === DUREE || i == ZONE) couleur = COULEUR_AUTRE;
            if (i === DUREE && ((total[i] > 1) || (total[i] < -1))) s = 's';

            let html = `<span style="color:${couleur};font-weight:bold">`;
            html += CARAC[i].presentation + " : " + (total[i] > 0 ? '+' : '') + total[i] + ' ' + CARAC[i].unite[1] + s;
            html += "</span>";
            totalHtml.push(html);
        }
        return totalHtml.join(" | ");
    }

    calculerCaracMax() {
        const valeursMax = [];
        for (let i = 0; i < 10; i++) {
            if ((i != ZONE) && (i != DUREE)) {
                valeursMax.push(this.calculerValeurMax(i, false));
            }
            else {
                valeursMax.push(-Infinity);
            }
        }
        return valeursMax.indexOf(Math.max(...valeursMax));
    }

    calculerValeurMax(carac, cocher = false) {
        // d'abord fait en reducer mais pas aussi lisible...
        let max = 0;
        for (const g of this.glyphes) {
            if (!g.estSansEffet) {
                for (let i = 0; i < g.caracteristiques.length; i++) {

                    if (g.caracteristiques[i].id == carac) {
                        if (ORIENTATIONS_GLYPHES[g.orientation].impact[i] > 0) {
                            max += (g.puissance - i);
                            break;                    // si le premier est de la carac, le second ne le sera pas...
                        }
                        if (ORIENTATIONS_GLYPHES[g.orientation].impact[i] < 0) {
                            if (!((i == 1 && g.puissance == 1)))  // si la valeur n'est pas 0 (deuxième carac à très gras)
                                if (cocher) g.cocher();            // la mise à jour du total se fait lors de l'affichage
                            break;
                        }
                    }
                }
            }
        }
        displayDebug('calculerValeurMax / parchemin : ' + this.id + " / carac : " + carac + " / valeur : " + max);
        return max;
    }

    calculerCaracMin() {
        const valeursMin = [];
        for (let i = 0; i < 10; i++) {
            if ((i != ZONE) && (i != DUREE)) {
                valeursMin[i] = this.calculerValeurMin(i, false);
            }
            else {
                valeursMin[i] = Infinity;
            }
        }
        return valeursMin.indexOf(Math.min(...valeursMin));
    }

    calculerValeurMin(carac, cocher = false) {
        let min = 0;
        for (const g of this.glyphes) {
            if (!g.estSansEffet) {
                for (let i = 0; i < g.caracteristiques.length; i++) {
                    if (g.caracteristiques[i].id == carac) {
                        if (ORIENTATIONS_GLYPHES[g.orientation].impact[i] < 0) {
                            min -= (g.puissance - i);  // attention deuxième carac -1 en puissance
                        }
                        else if (ORIENTATIONS_GLYPHES[g.orientation].impact[i] > 0) {
                            if (!((i == 1 && g.puissance == 1)))
                                if (cocher) g.cocher();
                            //break;
                        }
                    }
                }
            }
        }
        displayDebug('calculerValeurMin / parchemin : ' + this.id + " / carac : " + carac + " / valeur : " + min);
        return min;
    }

    // TODO : décider ce qui est fait exactement ici : total puissance ? total puissance positive ou négative?
    // TODO : Multiplié par la durée ou non ? Qui des PV qui sont directs ? Bref, comme c'est ça donne déjà une indication...
    calculerTotalPuissances() {
        let total = 0;
        let duree = 0;
        for (const g of this.glyphes) {
            if (!g.estSansEffet) {
                for (let i = 0; i < g.caracteristiques.length; i++) {
                    if (g.caracteristiques[i].id !== ZONE) {
                        if (g.caracteristiques[i].id === DUREE) {
                            if (ORIENTATIONS_GLYPHES[g.orientation].impact[i] > 0) {
                                duree += (g.puissance - i + 1);
                            }
                        }
                        else {
                            if (ORIENTATIONS_GLYPHES[g.orientation].impact[i] > 0) {
                                total += (g.puissance - i);
                            }
                            else {
                                total -= (g.puissance - i);
                            }
                        }
                    }
                }
            }
        }
        return total * duree;
    }

    // REMARQUE : crée mais n'affiche pas
    creerLignes(parent, position) {
        this.ligneEffetsGlyphes = this._creerLigneEffetsGlyphes(parent, position);
        this.ligneEffetTotal = this._creerLigneEffetTotal(parent);
        this.ligneSeparation = this._creerLigneSeparation(parent);
    }

    _creerLigneEffetsGlyphes(parent, position) {
        const trEffetsGlyphes = Createur.elem('tr', {parent: parent, style: "text-align: center; display: none"}); //tout est caché par défaut

        this.boutonBon = Createur.elem('button', {
            id: this.id + '-boutonBon',
            attributs: [['title', 'Définir ce parchemin comme "à gratter".\nL\'objectif est de marquer les marchemins estimés bons à gratter, pour pouvoir facilement produire la liste des détails des parchemins à gratter.']],
            enfants: [document.createTextNode('V')],
            events: [{nom: 'click', fonction: this.changerQualite, bindElement: this, param: [QUALITE_BON, true]}],
            classesHtml: ['mh_form_submit'],
            style: "background-color: #c9d8c5; margin: 5px", // vert #c9d8c5 // bleu  #a8b6bf // orange #edd9c0
        });

        // boutonCacher evenu bouton des pas toucher
        this.boutonCacher = Createur.elem('button', {
            id: this.id + '-boutonPasToucher',
            attributs: [['title', 'Définir que ce parchemin "pas toucher".\nL\'objectif est d\'indiquer que ce parchemin doit être gardé tel quel.']],
            enfants: [document.createTextNode('_')],
            events: [{nom: 'click', fonction: this.changerQualite, bindElement: this, param: [QUALITE_PAS_TOUCHER, true]}],
            classesHtml: ['mh_form_submit'],
            style: "background-color: #a8b6bf; margin: 5px", // bleu
        });

        this.boutonMauvais = Createur.elem('button', {
            id: this.id + '-boutonMauvais',
            attributs: [['title', 'Définir ce parchemin comme "mauvais"\nL\'objectif est de ne plus voir les parchemins impropres au grattage et à l\'utilisation et de pouvoir ensuite les lister facilement (pour savoir lesquels utiliser pour construire des golems de papier ou pour goinfrer par exemple).']],
            enfants: [document.createTextNode('X')],
            events: [{nom: 'click', fonction: this.changerQualite, bindElement: this, param: [QUALITE_MAUVAIS, true]}],
            classesHtml: ['mh_form_submit'],
            style: "background-color: #edd9c0; margin: 5px", // orange
        });

        this.boutonTermine = Createur.elem('button', {
            id: this.id + '-boutonTermine',
            attributs: [['title', "Définir ce parchemin comme \"terminé\".\nL'objectif est de ne plus voir les parchemins avec lesquels on ne désire plus travailler: déjà gratté, très joli, etc..."]],
            enfants: [document.createTextNode('\u2605')],
            events: [{nom: 'click', fonction: this.changerQualite, bindElement: this, param: [QUALITE_TERMINE, true]}],
            classesHtml: ['mh_form_submit'],
            style: "background-color: #ffee90EE; margin: 5px", // gold
        });

        Createur.elem('td', {                                     // si besoin de nom : const tdIdParchemin
            attributs: [['title', this.effetDeBaseTexte]],
            parent: trEffetsGlyphes,
            style: "width: " + ParcheminEnPage.W_COL1,
            enfants: [
                Createur.elem('span', {
                    texte: '[' + (position + 1) + ']  ',
                    classesHtml: ['positionParchemin'],
                    attributs: [['data-positionparchemin', position + 1]]
                }),
                document.createTextNode(this.id),
                Createur.elem('br'),
                this.boutonBon,
                this.boutonCacher,
                this.boutonMauvais,
                this.boutonTermine
            ]
        });

        const tdEffetsGlyphes = Createur.elem('td', {parent: trEffetsGlyphes});
        const tableEffetsGlyphes = Createur.elem('table', {id: this.id, parent: tdEffetsGlyphes});
        const trcheckboxGlyphes = Createur.elem('tr', {parent: tableEffetsGlyphes});
        const trDetailsEffetsGlyphes = Createur.elem('tr', {parent: tableEffetsGlyphes});

        // bien mais plus lent ? :) for (const [i, glyphe] of parchemin.glyphes())
        for (let i = 0; i < this.glyphes.length; i++) {
            const thGlyphe = this.glyphes[i].creerThCheckboxGlyphe(this, i);
            trcheckboxGlyphes.append(thGlyphe);
            const tdGlyphe = this.glyphes[i].creerTdEffetGlyphe(this.id + '-glyphe-' + i);
            trDetailsEffetsGlyphes.append(tdGlyphe);
        }
        return trEffetsGlyphes;
    }


    changerQualite(nouvelleQualite, inversion = false) {

        if (nouvelleQualite === QUALITE_BON) { // à gratter
            if (this.qualite == QUALITE_BON) {
                if (inversion) this.devenirNeutre();
            }
            else {
                this.devenirBon();
            }
        }
        else if (nouvelleQualite === QUALITE_MAUVAIS) {
            if (this.qualite == QUALITE_MAUVAIS) {
                if (inversion) this.devenirNeutre();
            }
            else {
                this.devenirMauvais();
            }
        }
        else if (nouvelleQualite === QUALITE_TERMINE) {
            if (this.qualite == QUALITE_TERMINE) {
                if (inversion) this.devenirNeutre();
            }
            else {
                this.devenirTermine();
            }
        }
        else if (nouvelleQualite === QUALITE_PAS_TOUCHER) {
            if (this.qualite == QUALITE_PAS_TOUCHER) {
                if (inversion) this.devenirNeutre();
            }
            else {
                this.devenirPasToucher();
            }
        }
        else {
            console.log("Changement de marqueur inaproprié reçu pour le parchemin.");
        }
    }


    rendreVisibleParcheminAdequat(coche, actif, listeAffiches=[]) {
        // soit une liste est fournie et on se base dessus, soit on utilise les cochages
        if (listeAffiches.length > 0 ) { // vu fonctionnement pas besoin de document.getElementById('affichagesSurSoiCheckbox').checked
            if (listeAffiches.includes(this.id)) { //TODO pas terrible, définir clairement le type
                this.afficherParchemin();
            }
            else {
                this.cacherParchemin();
            }
        }
        else {
            if(actif) { // sinon on ne change rien à l'affichage, normalement en mode sur soi
                if (coche) {
                    this.afficherParchemin();
                }
                else {
                    this.cacherParchemin();
                }
            }
        }
    }

    // TODO faire fonction générique pour devenirXXX
    devenirBon(listeAffiches=[]) {
        this.qualite = QUALITE_BON;
        this.ligneEffetsGlyphes.style.backgroundColor = "#c9d8c533";// TODO mettre en constantes vert #c9d8c5 // bleu  #a8b6bf // orange #edd9c0
        this.ligneEffetTotal.style.backgroundColor = "#c9d8c533";
        this.boutonBon.style.display = 'inline-block';
        this.boutonCacher.style.display = 'none';
        this.boutonMauvais.style.display = 'none';
        this.boutonTermine.style.display = 'none';

        const coche = document.getElementById('affichagesBonsCheckbox').checked;  // moche de passer par là... et comme ça...
        const actif = !(document.getElementById('affichagesBonsCheckbox').disabled);
        this.rendreVisibleParcheminAdequat(coche, actif, listeAffiches);
    }

    devenirNeutre(listeAffiches=[]) {
        this.qualite = QUALITE_NEUTRE;
        this.ligneEffetsGlyphes.style.backgroundColor = "#11111100";
        this.ligneEffetTotal.style.backgroundColor = "#11111100";
        this.boutonBon.style.display = 'inline-block';
        this.boutonCacher.style.display = 'inline-block';
        this.boutonMauvais.style.display = 'inline-block';
        this.boutonTermine.style.display = 'inline-block';
        const coche = document.getElementById('affichagesNeutresCheckbox').checked;  // moche de passer par là... et comme ça...
        const actif = !(document.getElementById('affichagesNeutresCheckbox').disabled);
        this.rendreVisibleParcheminAdequat(coche, actif, listeAffiches);
    }

    devenirMauvais(listeAffiches=[]) {
        this.qualite = QUALITE_MAUVAIS;
        this.ligneEffetsGlyphes.style.backgroundColor = "#edd9c033"; // rouge
        this.ligneEffetTotal.style.backgroundColor = "#edd9c033";
        this.boutonBon.style.display = 'none';
        this.boutonCacher.style.display = 'none';
        this.boutonMauvais.style.display = 'inline-block';
        this.boutonTermine.style.display = 'none';
        const coche = document.getElementById('affichagesMauvaisCheckbox').checked;  // moche de passer par là... et comme ça...
        const actif = !(document.getElementById('affichagesMauvaisCheckbox').disabled);
        this.rendreVisibleParcheminAdequat(coche, actif, listeAffiches);
    }

    devenirPasToucher(listeAffiches=[]) {
        this.qualite = QUALITE_PAS_TOUCHER;
        this.ligneEffetsGlyphes.style.backgroundColor = "#a8b6bf33"; // bleu
        this.ligneEffetTotal.style.backgroundColor = "#a8b6bf33";
        this.boutonBon.style.display = 'none';
        this.boutonCacher.style.display = 'inline-block';
        this.boutonMauvais.style.display = 'none';
        this.boutonTermine.style.display = 'none';
        const coche = document.getElementById('affichagesPasToucherCheckbox').checked;  // moche de passer par là... et comme ça...
        const actif = !(document.getElementById('affichagesPasToucherCheckbox').disabled);
        this.rendreVisibleParcheminAdequat(coche, actif, listeAffiches);
    }

    devenirTermine(listeAffiches=[]) {
        this.qualite = QUALITE_TERMINE;
        this.ligneEffetsGlyphes.style.backgroundColor = "#ffee9022"; // gold
        this.ligneEffetTotal.style.backgroundColor = "#ffee9022";
        this.boutonBon.style.display = 'none';
        this.boutonCacher.style.display = 'none';
        this.boutonMauvais.style.display = 'none';
        this.boutonTermine.style.display = 'inline-block';
        const coche = document.getElementById('affichagesTerminesCheckbox').checked;  // moche de passer par là... et comme ça...
        const actif = !(document.getElementById('affichagesTerminesCheckbox').disabled);
        this.rendreVisibleParcheminAdequat(coche, actif, listeAffiches);
    }


    _creerLigneEffetTotal(parent) {
        const trEffetTotal = Createur.elem('tr', {parent: parent, style: "text-align: center; display: none"});
        const tdNomParchemin = Createur.elem('td', {
            texte: this.nom,
            attributs: [['title', this.effetDeBaseTexte]],
            style: "width: " + ParcheminEnPage.W_COL1,
            parent: trEffetTotal
        });
        ParcheminEnPage._mettreEnFormeTd(tdNomParchemin);
        this.tdEffetTotal = Createur.elem('td', {
            id: this.id + "-effet",
            html: this.effetTotalHtml,
            parent: trEffetTotal
        });
        ParcheminEnPage._mettreEnFormeTd(this.tdEffetTotal);
        return trEffetTotal;
    }

    _creerLigneSeparation(parent) {                                   // potentiellement static ...
        const trSeparation = Createur.elem('tr', {parent: parent, style: "text-align: center; display: none"});
        const tdTirets = Createur.elem('td', {
            texte: '-----',
            style: "width: " + ParcheminEnPage.W_COL1,
            parent: trSeparation
        });
        ParcheminEnPage._mettreEnFormeTd(tdTirets);
        return trSeparation;
    }

    static _mettreEnFormeTd(td) {
        td.style.padding = '15px'; // TODO trouver mieux et utiliser constantes
    }

    // this est le parchemin, même si appelé depuis le bouton
    cacherParchemin() {
        // on peut ainsi cacher un parchemin, qu'il soit existant ou non dans la page
        if (this.ligneEffetsGlyphes && this.ligneEffetTotal && this.ligneSeparation) {
            this.ligneEffetsGlyphes.style.display = 'none';
            this.ligneEffetTotal.style.display = 'none';
            this.ligneSeparation.style.display = 'none';
            this.affiche = false;
        }
    }

    afficherParchemin() {
        // TODO : il faudrait ne pas garder dans parchemins ceux qui ne sont pas terminés ? Complexité inutile ? Pas top pour numéro d'indexe non plus
        if (this.etat === TERMINE) {
            this.ligneEffetsGlyphes.style.display = 'table-row';
            this.ligneEffetTotal.style.display = 'table-row';
            this.ligneSeparation.style.display = 'table-row';
            this.affiche = true;
        }
    }

    rafraichirEffetTotal() {
        this.tdEffetTotal.innerHTML = this.effetTotalHtml;
    }

    static creerParchemin(enregistrement) {
        const nouveauxGlyphes = [];
        for (const [i, numero] of Object.entries(enregistrement.glyphesNumeros)) {
            nouveauxGlyphes.push(new GlypheEnPage(numero, enregistrement.glyphesCoches[i]));
        }
        return new ParcheminEnPage(
            enregistrement.id,
            enregistrement.nom,
            enregistrement.effetDeBaseTexte,
            nouveauxGlyphes,
            enregistrement.dateAjout,
            enregistrement.etat,
            enregistrement.affiche,
            enregistrement.qualite);
    }
}

//************************* Classe Glyphe *************************
// Est-ce que le #pour les champs privés déjà en place ?
// Est-ce que le lazy getter est implémenté maintenant ?
// tous est final figé ici une fois contruit, donc je calcule tout une fois au début

/* Exemple :
 {"numero":"56593",
 "_numeroUtilise":"56592",
 "_debutFamille":56584,
 "_repereCaracteristiques":56616,
 "caracteristiques":[
 {"id":4,
 "presentation":"Vue",
 "unite":[1,""]},
 {"id":3,
 "presentation":"REG",
 "unite":[1,""]}],
 "finesse":1,
 "orientation":0,
 "traitable":true,
 "effet":{"3":1,"4":-2},
 "effetTexte":"Vue : -2  REG : +1 ",
 "detailsTexte":"Gribouillage : 56593\nFinesse : 1 [Gras] / Puissance : 2\nOrientation : 0 [Malus | Bonus, Initiale]\nCaractéristique 1 : Vue / Caractéristique 2 : REG\nEffet du glyphe : Vue : -2  REG : +1 ",
 "effetHtml":"<span style=\"color:#990000;font-weight:bold\">Vue : -2 </span><br><span style=\"color:#336633;font-weight:bold\">REG : +1 </span>"} */

// constructor(numero)
// _analyserGlyphe()
// static _calculerNumeroUtilise(numero)
// static _calculerDebutFamille(numero)
// static _calculerFinesse(numero, debutFamille)
// static _calculerOrientation(numero, debutFamille)
// determinerSiTraitable()
// calculerEffet()
// composerEffetTexte()
// composerDetailsTexte()
// get puissance
// get estSansEffet

class Glyphe {

    static get NUMERO_DEBUT() {
        return 1288;
    }

    static get INTERVALLE() {
        return 1024;
    }

    constructor(numero) {
        this.numero = numero;
        this.caracteristiques;
        this.orientation;
        this.finesse;
        this.effet;
        this.effetTexte;
        this.detailsTexte;
        this.traitable;

        // champs qui ne varient pas, pour éviter de les recalculer
        this._numeroUtilise;
        this._debutFamille;
        this._repereCaracteristiques;
        // this._dejaGratte = false; glyphes inconnus non traités pour le moment

        this._analyserGlyphe();
    }

    _analyserGlyphe() {
        this._numeroUtilise = Glyphe._calculerNumeroUtilise(this.numero);
        this._debutFamille = Glyphe._calculerDebutFamille(this._numeroUtilise);
        this._repereCaracteristiques = this._debutFamille + 32;
        this.caracteristiques = CARACTERISTIQUES_GLYPHES[this._repereCaracteristiques];
        this.finesse = Glyphe._calculerFinesse(this._numeroUtilise, this._debutFamille);
        this.orientation = Glyphe._calculerOrientation(this._numeroUtilise, this._debutFamille);
        this.traitable = this.determinerSiTraitable();
        if (this.traitable) {
            this.effet = this.calculerEffet();
            this.effetTexte = this.composerEffetTexte();
            this.detailsTexte = this.composerDetailsTexte();
        }
    }

    static _calculerNumeroUtilise(numero) {
        // Si le numéro est impair, on utilise le numéro pair le précédant
        return numero % 2 ? String(Number(numero) - 1) : numero;
    }

    static _calculerDebutFamille(numero) {
        return (parseInt((numero - Glyphe.NUMERO_DEBUT) / Glyphe.INTERVALLE) * Glyphe.INTERVALLE) + Glyphe.NUMERO_DEBUT;
    }

    static _calculerFinesse(numero, debutFamille) {
        return parseInt((numero - debutFamille) / 8);
    }

    static _calculerOrientation(numero, debutFamille) {
        return ( (numero - debutFamille) / 2 ) % 4;
    }

    determinerSiTraitable() {
        if (this.numero < Glyphe.NUMERO_DEBUT) return false;
        if (!(this._repereCaracteristiques in CARACTERISTIQUES_GLYPHES)) return false;
        if (!(this.finesse in FINESSES_GLYPHES)) return false;
        return true;
    }

    calculerEffet() {
        let valeur1;
        let valeur2;

        // sans effet lorsque les deux caracs sont les mêmes
        if (CARAC[this.caracteristiques[0].id] === CARAC[this.caracteristiques[1].id]) {
            valeur1 = 0;
            valeur2 = 0;
        }
        else {
            const signe1 = ORIENTATIONS_GLYPHES[this.orientation].impact[0];
            const puissance1 = this.puissance;
            const unite1 = CARAC[this.caracteristiques[0].id].unite[0];
            const signe2 = ORIENTATIONS_GLYPHES[this.orientation].impact[1];
            const puissance2 = this.puissance - 1;
            const unite2 = CARAC[this.caracteristiques[1].id].unite[0];
            // [{id:, present:, unite}]

            valeur1 = signe1 * puissance1 * unite1;
            valeur2 = signe2 * puissance2 * unite2;
        }

        const caracs = {};
        caracs[this.caracteristiques[0].id] = valeur1;
        caracs[this.caracteristiques[1].id] = valeur2;

        return caracs;
    }

    composerEffetTexte() {
        const textes = [];

        // TODO chrome trie les indice numériques des objets par défaut comme effet... flemme de changer en array ou autre, donc parcourt de l'array carac
        for (const id of this.caracteristiques.map(x => x.id)) {
            if (this.effet[id] != 0) {
                switch (Number(id)) {
                    case DUREE :
                        const s = ((this.effet[id] > 1) || (this.effet[id] < -1)) ? 's' : '';
                        textes.push(CARAC[id].presentation + " : " + (this.effet[id] > 0 ? '+' : '') + this.effet[id] + ' ' + CARAC[id].unite[1] + s);
                        break;
                    default :
                        textes.push(CARAC[id].presentation + " : " + (this.effet[id] > 0 ? '+' : '') + this.effet[id] + ' ' + CARAC[id].unite[1]);
                }
            }
        }

        if (textes.length === 0) textes.push("Sans effet");
        return textes.join(' ');
    }

    composerDetailsTexte() {
        const details =
            `Gribouillage : ${this.numero}
    Finesse : ${this.finesse} [${FINESSES_GLYPHES[this.finesse]}] / Puissance : ${this.puissance}
    Orientation : ${this.orientation} [${ORIENTATIONS_GLYPHES[this.orientation].impactTexte}, ${ORIENTATIONS_GLYPHES[this.orientation].nom}]
    Caractéristique 1 : ${this.caracteristiques[0].presentation} / Caractéristique 2 : ${this.caracteristiques[1].presentation}
    Effet du glyphe : ${this.effetTexte}`;
        return details;
    }

    get puissance() {
        return Math.min(5, this.finesse + 1);
    }

    get estSansEffet() {
        return this.caracteristiques[0].id === this.caracteristiques[1].id;
    }

}


// constructor(numero, coche=false)
// constructor(numero)
// creerTdEffetGlyphe(id)
// creerThCheckboxGlyphe(parchemin, positionGlyphe)
// traiterCheckboxGlyphe(glyphe, parchemin)
// composerEffetHtml()

//************************* Classe GlypheEnPage *************************
class GlypheEnPage extends Glyphe {

    static get W_EFF() {
        return "7vw"
    };

    constructor(numero, coche = false) { // td, parcheminEnPage
        super(numero);
        this.coche = coche;
        this.tdEffet; // = td;
        this.checkbox;
        //this.parcheminEnPage; // = parcheminEnPage;
        this.effetHtml = this.composerEffetHtml();
    }

    //static element(tag, id, texteContenu, classes=[], attributs=[], parent, enfants=[])
    creerTdEffetGlyphe(id) {
        this.tdEffet = Createur.elem('td', {
            id: id,
            html: this.effetHtml,
            style: "padding:5px; text-align:center; width:" + GlypheEnPage.W_EFF,
            attributs: [['title', this.detailsTexte]]
        });
        if (this.coche) this.cocher();
        return this.tdEffet;
    }

    creerThCheckboxGlyphe(parchemin, positionGlyphe) {
        let th = Createur.elem('th');
        this.checkbox = Createur.elem('input', {
            id: parchemin.id + '-checkbox-' + positionGlyphe,
            attributs: [['type', 'checkbox']],
            parent: th,
            events: [{nom: 'change', fonction: this.traiterCheckboxGlyphe, bindElement: this, param: [parchemin]}]
        });
        let span = Createur.elem('span', {texte: ('glyphe ' + (positionGlyphe + 1)), parent: th});
        if (this.coche) this.cocher();
        return th;
    }

    traiterCheckboxGlyphe(parchemin) {
        if (this.checkbox.checked) {
            this.cocher();
        }
        else {
            this.decocher();
        }
        parchemin.rafraichirEffetTotal();
    }

    // moyen de faire plus propre, générique, scindé, similaire/compatible avec parchemin... mais bon. :)
    composerEffetHtml() {
        let textes = [];

        // TODO chrome trie les indice numériques des objets par défaut comme effet... flemme de changer en array ou autre, donc parcourt de l'array carac
        for (const id of this.caracteristiques.map(x => x.id)) {
            if (this.effet[id] != 0) {

                let bonus = ((id == TOUR) ? -1 : +1);
                let couleur = (((this.effet[id] * bonus) > 0) ? COULEUR_BONUS : COULEUR_MALUS );
                if (id === DUREE || id == ZONE) couleur = COULEUR_AUTRE;
                let html = `<span style="color:${couleur};font-weight:bold;white-space: nowrap">`;
                let s = (id === DUREE && ((this.effet[id] > 1) || (this.effet[id] < -1))) ? 's' : '';
                // vestige... gare au type de id tout de même... switch (Number(id)) {    case DUREE :

                html += CARAC[id].presentation + " : " + (this.effet[id] > 0 ? '+' : '') + this.effet[id] + ' ' + CARAC[id].unite[1] + s;
                html += "</span>";
                textes.push(html);
            }
        }

        if (textes.length === 0) textes.push("Sans effet");
        return textes.join('<br>');
    }

    cocher() {
        this.coche = true;
        if (this.checkbox) this.checkbox.checked = true;
        if (this.tdEffet) this.tdEffet.style.opacity = 0.25;

    }

    decocher() {
        this.coche = false;
        if (this.checkbox) this.checkbox.checked = false;
        if (this.tdEffet) this.tdEffet.style.opacity = 1;
    }

    //static creerGlyphe(glyphe) {}


}

//************************* Classe Recuperateur *************************

// constructor (demandeur)
// static appelerServiceHtml(appelant, type, url, callbackHtml, parametres=[], inputs=[])
// vaChercherParchemins()
// _extraireParchemins(reponseHtml)
// vaChercherGlyphes(parcheminId)
// _grattageAllerEtapeDeux(reponseHtml, parcheminId)
// _extraireGlyphes(reponseHtml, parcheminId)

// récupère les glyphes et les parchos
class Recuperateur {

    static get URL_GRATTAGE_1() {
        return "https://games.mountyhall.com/mountyhall/MH_Play/Actions/Play_a_Competence.php?ai_IdComp=26&ai_IDTarget=";
    }

    static get URL_GRATTAGE_2() {
        return "https://games.mountyhall.com/mountyhall/MH_Play/Actions/Competences/Play_a_Competence26b.php";
    }

    constructor(demandeur) {
        this.demandeur = demandeur;
    }

    static appelerServiceHtml(appelant, type, url, callbackHtml, parametres = [], inputs = []) {
        const xhr = new XMLHttpRequest();
        xhr.open(type, url);
        xhr.onload = function () {
            const parser = new DOMParser();
            const reponseHtml = parser.parseFromString(this.responseText, "text/html");
            callbackHtml.call(appelant, reponseHtml, ...parametres);
        };
        xhr.send(...inputs);

        //Attention ancienne "mauvaise solution.
        // Je me demandais ce qui serait le plus performant entre un DomParser et un innerHTML
        //Avantage du domparser : il ne fait pas les requêtes pour les images au serveur !
        //let htmlResponse = document.createElement('div');
        //htmlResponse.innerHTML = this.responseText;
    }

    vaChercherParchemins() {
        displayDebug("vaChercherParchemins");
        // appelle la page de grattage MH pour en extraire les parchemins grattables
        Recuperateur.appelerServiceHtml(this, "GET", Recuperateur.URL_GRATTAGE_1, this._extraireParchemins);
    }

    // récupère les parchemins grattables, les instancie, puis appelle le traitement pour les analyser
    _extraireParchemins(reponseHtml) {
        displayDebug("_extraireParchemins : ")
        //displayDebug(reponseHtml.querySelector('body').innerHTML);

        displayDebug("this.parchemins :");  // attention à bien faire une copie pour afficher object, sinon affiche dernier état de la référence en console
        displayDebug(JSON.parse(JSON.stringify(this.demandeur.parchemins)));

        const parcheminsRecuperes = [];
        for (const option of reponseHtml.querySelectorAll('optgroup option')) {
            const nomParchemin = option.innerHTML.split(' - ')[1];
            const parchemin = new Parchemin(option.value, nomParchemin);
            parcheminsRecuperes.push(parchemin);
        }

        this.demandeur.recevoirParcheminsInfosBase(parcheminsRecuperes);
    }


    // appelle derrière la première page du grattage, puis la seconde pour le parchemin pour récupérer les glyphes
    vaChercherGlyphes(parcheminId) {
        Recuperateur.appelerServiceHtml(this, "GET", Recuperateur.URL_GRATTAGE_1, this._grattageAllerEtapeDeux, [parcheminId]);
    }

    // ... d'où on appelle la seconde page de grattage ...
    _grattageAllerEtapeDeux(reponseHtml, parcheminId) {

        const inputs = new FormData(reponseHtml.querySelector('#ActionForm'));
        inputs.set('ai_IDTarget', parcheminId);

        Recuperateur.appelerServiceHtml(this, "POST", Recuperateur.URL_GRATTAGE_2, this._extraireGlyphes, [parcheminId], [inputs]);
    }

    // ... d'où on récupère les glyphes pour les fournir au demandeur
    _extraireGlyphes(reponseHtml, parcheminId) {
        const parcheminPourComposition = new Parchemin(parcheminId);
        try {
            parcheminPourComposition.effetDeBaseTexte = reponseHtml.querySelectorAll('td')[2].innerHTML;

            for (const image of reponseHtml.querySelectorAll(".l_grib1")) {
                const glyphe = new Glyphe(image.src.split('Code=')[1]);
                parcheminPourComposition.ajouterGlyphe(glyphe);
            }
        }
        catch (e) {
            console.log(e);
            alert(`Problème rencontré lors de la récupération des glyphes.
    Etes-vous bien connecté à MH ? Disposez-vous de 2PA ? Connaissez-vous la compétence Gratter ?
    (Des parchemins vierges peuvent également générer ce message.)`);
        }
        finally {
            this.demandeur.recevoirParcheminInfosComposition(parcheminPourComposition);
        }
    }
}


//************************* Classe OutilListerGrattage *************************

const CRITERE_DATE = 90;
const CRITERE_ID = 91;

const IMPORTER_COMPLETER = 1;
const IMPORTER_REMPLACER = 2;

const PAS_DE_CHARGEMENT_MH = 5;

// constructor(parent)
// chargerDepuisHall()
// construireIndex(index=this.parchemins)
// recevoirParcheminsInfosBase(parcheminsRecus)
// _appelerRechercherGlyphes(position)
// recevoirParcheminInfosComposition(parcheminRecu)
// reinitialiserChoix(affiche, cochages)
// genererTousParchemins()
// ...()
// afficherParcheminsFiltres()
// _afficherParchemin(parchemin, position)
// nettoyerParchemins()
// afficherRecapitulatif()
// _preparerPageListe()
// _attacherMessageIntro()
// _attacherBoutonsChargement()
// _attacherInterfaceSupprimerParchemins()
// _attacherInterfaceRecapituler()
// _attacherInterfaceFiltrer()
// _attacherTableParchemins()
// viderTableParchemins()
// exporterParchemins()
// importerParchemins(sauvegarde)
// chargerLocalement()
// sauvegarderLocalement()

// TODO exploser la classe en plusieurs, elle fait trop de choses
class OutilListerGrattage {
    constructor(parent, optionChargement) {
        this.parent = parent;
        this.zone;
        this.parchemins = {};
        // index pour connaitre ordre dds parchemins
        this.index = [];
        this.indexNouveauxParchemins = [];
        this.incomplets = [];
        this.filtre = {};
        this.zoneDateEnregistrement;
        this.texteRecapitulatif;
        this.affichagesBonsCheckbox; // TODO penser comment enregistrer et recharger préférences d'avant
        this.affichagesMauvaisCheckbox;
        // TODO enregistrer le critere de tri actuel

        // this.dateDerniereModification; // pas utile ?
        // ??? TODO permet de tester si correspond à celle de la sauvegarde, pour afficher si sauvé ou non

        // this.parcheminsSurSoi = ["4986515", "10769725"]; // simuler parchemins sur soi
        this.parcheminsSurSoi = [];
        this.parcheminsEnCoursDAjout = {};
        this.indexEnCoursDAjout = [];

        this.optionChargement = optionChargement;

        // date de creation... on s'en fiche, date d'ajout premier parcho plus intéressante... sinon serait remplacé lors de nouveaux imports
        // date de dernier (et premier) ajout peut être retrouvé en regardant les dates d'ajout des parchemins
        // date de derniere modification vis-à-vis de l'interface pas utile ?

        // idéalement une classe pour la gui, mais ici c'est encore restreint
        this.table;
        this._preparerPageListe();

        if (STATIQUE) {
            this.importerParcheminsEtAfficher(JSON.parse(SAUVEGARDE));
        }
        else {
            this.chargerLocalement();
        }
    }

    // TODO : pour le moment pas optimal ?, on trie tout, même ce qu'on ne veut pas afficher
    // TODO : Integrer la construction de l'indexe de AfficherParcheminsFiltres ici
    construireIndex(critere = CRITERE_ID) {
        switch (critere) {
            case CRITERE_DATE :
            case CRITERE_ID:
            default:   // par id de parchemin
                this.index = Object.keys(this.parchemins).sort((i1, i2) => i1 - i2);
        }
    }


    chargerListeParcheminsGrattablesDepuisHall() {
        // à mettre après préparation pour pouvoir utiliser table déjà créée ?
        // this.viderTableParchemins();    // pas nécessaire
        // this.viderTexteRecapitulatif(); // pas nécessaire ?
        //this.index = [];              // pas nécessaire

        if (!(CHARGEMENT_AUTOMATIQUE)) this.bloquerBoutonsChargement();

        this.recuperateur = new Recuperateur(this);
        this.recuperateur.vaChercherParchemins();
    }

    // recoit les id/nom des parchemins du recuperateur (pourrait les recevoir un à un, intérêt ici ?)
    // ensuite enclenche les appels pour recuperer les glyphes
    recevoirParcheminsInfosBase(parcheminsRecus) {
        displayDebug("recevoirParcheminsInfosBase");
        displayDebug(parcheminsRecus);

        const nombreObtenu = parcheminsRecus.length;
        if (nombreObtenu === 0) {
            alert(`Aucun parchemin trouvé. 
    Etes-vous bien connecté à MH ? 
    Avez-vous encore 2 PA ? 
    Connaissez-vous la compétence Gratter ?`);
            this.debloquerBoutonsChargement();
            return;
        }

        displayDebug(" DEBUT parcheminsRecus");
        displayDebug(parcheminsRecus.slice());
        displayDebug(" DEBUT this.parchemins");
        displayDebug(JSON.parse(JSON.stringify(this.parchemins)));

        this.parcheminsSurSoi = [];
        // REMARQUE !!! On supprime les parchemins que l'on connait déjà pour faire moins d'appels.
        const parcheminsATraiter = [];
        for (const p of parcheminsRecus) {
            this.parcheminsSurSoi.push(p.id);
            if (p.id in this.parchemins) {
                if (this.parchemins[p.id].etat === EN_COURS) {
                    parcheminsATraiter.push(p);
                }
            }
            else {
                parcheminsATraiter.push(p);
            }
        }
        // old : filter... parcheminsRecus = parcheminsRecus.filter(p => {console.log(this.parchemins, p.id, !(p.id in this.parchemins)); return !(p.id in this.parchemins)});

        // TODO fonctionnaliser un peu tout ce programme c'est devenu fort marécageux. :)
        alert('Liste des parchemins sur vous mise à jour.');
        this.activerModeAffichageSurSoi();

        displayDebug(" APRES FILTRE parcheminsATraiter");
        displayDebug(parcheminsATraiter.slice());

        if (nombreObtenu !== 0 && parcheminsATraiter.length == 0) {
            alert(`Aucun nouveau parchemin trouvé.\nEn avez-vous de nouveaux dans votre inventaire ?`);
        }
        else {
            alert('Listes des parchemins pour lesquels ajouter des glyphes mise à jour.');
        }

        for (const p of parcheminsATraiter) {

            if (p.id in this.parchemins) {
                this.parchemins[p.id].cacherParchemin();  // cacher precedent qu'il existe et soit affiché ou pas
                delete this.parchemins[p.id]; // au cas où ?
            }

            this.parcheminsEnCoursDAjout[p.id] = new ParcheminEnPage(p.id, p.nom);
            const position = this.indexEnCoursDAjout.indexOf(p.id);
            if (position !== -1) {
                this.indexEnCoursDAjout.splice(position, 1);
            }
            this.indexEnCoursDAjout.push(p.id);
        }

        // old : foreach...
        // old : this.construireIndex(CRITERE_ID); // on garde l'ordre précédent avant ajout pour le début, comme ça les nouveaux arrivent à la fin ?

        // Attention requêtes pour les glyphes des différents parchemins les unes à la suite des autres, ne doivent pas se chevaucher
        compteurSecuriteNombreAppels = 0;
        this.indexNouveauxParchemins = parcheminsATraiter.map(p => p.id);

        if (CHARGEMENT_AUTOMATIQUE) {
            this._appelerRechercherGlyphes();
        }
        else {
            this.rafraichirBoutonPourChercherGlyphes();
            this.debloquerBoutonsChargement();
        }
    }


    _appelerRechercherGlyphes() {
        if (++compteurSecuriteNombreAppels > MAX_APPELS) return; // empêcher un trop gros nombre d'appels au serveur

        if (this.indexNouveauxParchemins.length > 0) {
            this.recuperateur.vaChercherGlyphes(this.indexNouveauxParchemins.shift());
        }
        else {
            displayDebug("fin _appelerRechercherGlyphes, nombre : " + this.parchemins.length);
            if (EXPORTER_PARCHEMINS) { // pour récupérer les parchemins et travailler en local
                console.log(JSON.stringify(this.exporterParchemins()));
            }
            displayDebug("nombre d'appels à la fin : " + compteurSecuriteNombreAppels);
        }
    }

    // recoit les effets de base/Glyphes d'un parchemin du recuperateur
    // provoque l'affichage et fait l'appel pour le parchemin suivant
    recevoirParcheminInfosComposition(parcheminRecu) {
        displayDebug("recevoirParcheminInfosComposition : " + parcheminRecu.id);
        // TODO renvoyer des parchemins 'pas complètement remplis' aux recevoirxxx permettait d'utiliser une structure existante,
        // TODO mais un peu lourdingue de recréer les objets enPage (et recalculs pour glyphes surtout !...) et de devoir retrouver le parchemin correspondant équivalent
        // TODO Pptions : recevoirxxx avec juste les données nécessaires ? recoivent et complètent les vrais parchemins (solution initiale...)?
        // TODO Créent des xxxEnPage même si étrange ? Trouver comment caster efficacement du parent -> enfant en js, ou alors le définir ?


        this.parchemins[parcheminRecu.id] = this.parcheminsEnCoursDAjout[parcheminRecu.id];
        const p = this.parchemins[parcheminRecu.id];
        const position = this.index.indexOf(p.id);
        if (position !== -1) {
            this.index.splice(position, 1);
        }
        this.index.push(p.id);
        p.effetDeBaseTexte = parcheminRecu.effetDeBaseTexte;
        for (const glyphe of parcheminRecu.glyphes) {
            p.ajouterGlyphe(new GlypheEnPage(glyphe.numero));
        }
        ;
        p.etat = TERMINE;

        delete this.parcheminsEnCoursDAjout[parcheminRecu.id]; // pas nécessaire, plus propre ?

        // si le parchemin n'est pas traitable/complet, on l'affiche quand même avec glyphes manquants [old : le retire directement]
        if (!p.complet) {
            this.incomplets.push(p.id);                                 // la liste des incomplets ne sert à rien pour le moment :)
            displayDebug("parchemin incomplet : " + p.id + " " + p.nom);
        }

        const positions = this.parent.querySelectorAll('.positionParchemin');
        const dernierePosition = positions.length > 0 ? Number(positions[positions.length - 1].dataset.positionparchemin) : 0;
        this._genererParcheminHtml(p, dernierePosition); // TODO ouch, suite au refactoring je n'ai plus la position, rustine à la va vite, à voir si ça tient. :) Sinon rustine avec compteurSecuriteNombreAppels, sinon rustine this.index.length
        p.afficherParchemin();

        const maintenant = new Date();
        this.zoneDateEnregistrement.innerText = "Moment du dernier chargement : " + maintenant.toLocaleString();

        if (CHARGEMENT_AUTOMATIQUE) {
            this._appelerRechercherGlyphes();
            // après avoir reçu des glyphes d'un parchemin à traiter, on fait la requête pour le parchemin suivant si automatique
        }
        else {
            this.rafraichirBoutonPourChercherGlyphes();
            this.debloquerBoutonsChargement();
        }
    }

    // TODO : affiche plus nécessaire, on ne cache plus
    // TODO : envoyer la liste des groupes pour lesquels on veut reinitialiser ? Ici hardcode tout sauf "a gratter" et "termines"
    reinitialiserChoix(affiche, cochages) {
        for (const id in this.parchemins) {
            if (affiche) this.parchemins[id].affiche = true; // inutile
            if (cochages && !([QUALITE_BON, QUALITE_TERMINE].includes(this.parchemins[id].qualite))) {
                for (const g of this.parchemins[id].glyphes) {
                    g.decocher();
                }
            }
        }
    }

    afficherParcheminsAdequats() {
        this.genererTousParcheminsDansPageHtml();
        this.rafraichirAffichageParchemins();
    }

    genererTousParcheminsDansPageHtml() {
        this.viderTableParchemins();
        for (let i = 0; i < this.index.length; i++) {        // attention index
            this._genererParcheminHtml(this.parchemins[this.index[i]], i);
        }
        // Attention, attache tous les bontons ici sans faire attention à la qualité du parchemin !
    }

    // numero correspond à l'affichage, sans trou
    rafraichirAffichageParchemins() {
        for (let id of this.index) {
            const p = this.parchemins[id];
            if (p.qualite == QUALITE_BON) {
                p.devenirBon(this.affichagesSurSoiCheckbox.checked ? this.parcheminsSurSoi : []);             // en fait un peu trop, mais ça passe, faudrait scinder fonctions
            }
            else if (p.qualite == QUALITE_MAUVAIS) {
                p.devenirMauvais(this.affichagesSurSoiCheckbox.checked ? this.parcheminsSurSoi : []);
            }
            else if (p.qualite == QUALITE_TERMINE) {
                p.devenirTermine(this.affichagesSurSoiCheckbox.checked ? this.parcheminsSurSoi : []);
            }
            else if (p.qualite == QUALITE_PAS_TOUCHER) {
                p.devenirPasToucher(this.affichagesSurSoiCheckbox.checked ? this.parcheminsSurSoi : []);
            }
            else {
                p.devenirNeutre(this.affichagesSurSoiCheckbox.checked ? this.parcheminsSurSoi : []);
            }
        }
    }

    afficherParcheminsFiltres() {
        displayDebug("afficherParcheminsFiltres");
        // choix de reinitialiser pour pouvoir cocher les options les plus puissantes et voir rapidement l'interet
        // laisser les cochages de l'utilisateur aussi peut être inétressant (et demander moins de progra. ;) ), j'ai fait comme je préfère
        // pour finir laisse choix pour "à gratter" et "termine"
        this.reinitialiserChoix(true, true);
        const type = this.filtre.type.value;
        const puissance = Number(this.filtre.puissance.value);
        const carac = Number(this.filtre.carac.value);
        const duree = Number(this.filtre.duree.value);
        const zone = this.filtre.zone.checked;
        let parcheminsATrier = [];

        for (const id in this.parchemins) {
            const p = this.parchemins[id];
            let garde = true;
            let valeur = ((type == AU_MOINS) ? -Infinity : Infinity); // besoin d'initialiser pour que le tri fonctionnne

            if (zone) {
                if (p.calculerValeurMax(ZONE, false) <= 0) garde = false; // pourrait mettre à true si on veut cocher pour un max effet de zone
            }

            if (garde) {
                if (duree > 0) {
                    if (duree > p.calculerValeurMax(DUREE, false)) garde = false;
                }
            }

            if (garde) {
                const cocher = !([QUALITE_BON, QUALITE_TERMINE].includes(p.qualite)); // hardcode ici qu'on ne coche pas pour les "à gratter" et "termines"
                if (type == AU_MOINS) {
                    if (carac == COMBINAISON) {
                        valeur = p.calculerTotalPuissances();
                    }
                    else if (carac == TOUTES) {
                        const caracMax = p.calculerCaracMax();
                        valeur = p.calculerValeurMax(caracMax, cocher);
                    }
                    else {
                        valeur = p.calculerValeurMax(carac, cocher);
                    }
                    if (valeur < puissance) garde = false;
                }
                else if (type == AU_PLUS) {
                    if (carac == COMBINAISON) {
                        valeur = p.calculerTotalPuissances();
                    }
                    else if (carac == TOUTES) {
                        const caracMin = p.calculerCaracMin();
                        valeur = p.calculerValeurMin(caracMin, cocher);
                    }
                    else {
                        valeur = p.calculerValeurMin(carac, cocher);
                    }
                    if (valeur > puissance) garde = false;
                }
            }
            p.affiche = garde;
            //if (garde) // je les mets tous pour créer index complet, tri plus lourd évidemment, à tester
            parcheminsATrier.push([id, valeur]);
        }

        if (type == AU_MOINS) parcheminsATrier.sort((v1, v2) => (v2[1] - v1[1])); // TODO tri secondaire prédéfini, par exemple tours, dégats, ...
        else if (type == AU_PLUS) parcheminsATrier.sort((v1, v2) => (v1[1] - v2[1]));
        this.index = parcheminsATrier.map(x => x[0]);

        this.afficherParcheminsAdequats();
    }

    // volontaire ici aussi d'appeler et d'afficher un à un petit à petit dans la dom,
    // plus lourd au total mais visuellement plus direct si beaucoup de parchemins.
    // REMARQUE : crée mais n'affiche pas
    _genererParcheminHtml(parchemin, position) {
        parchemin.creerLignes(this.table, position);
    }

    nettoyerParchemins() {
        const idParcheminsASupprimer = document.getElementById('parcheminsASupprimer').value.replace(/\s/g, "").split(','); //enlève les blancs et espaces
        let message = "Parchemin(s) supprimé(s) : \n";
        for (const id of  idParcheminsASupprimer) {
            // old if (id in this.parchemins) this.parchemins[id].changerQualite(QUALITE_MAUVAIS);
            if (id in this.parchemins) {
                message += id + " " + this.parchemins[id].effetDeBaseTexte + "\n";
                this.parchemins[id].cacherParchemin(); // pas top il reste caché dans la page, mais fait l'affaire
                delete this.parchemins[id];
                this.index = this.index.filter(x => (x != id));
            }
        }
        alert(message);
    }


    afficherRecapitulatif() {

        if (this.boutonAfficherRecapitulatif.dataset.affiche === "oui") {
            this.boutonAfficherRecapitulatif.dataset.affiche = "non";
            this.boutonAfficherRecapitulatif.innerHTML = "Afficher Récapitulatif";
            this.texteRecapitulatif.innerText = "";
        }
        else {
            this.boutonAfficherRecapitulatif.dataset.affiche = "oui";
            this.boutonAfficherRecapitulatif.innerText = "Effacer Récapitulatif";

            const parcheminsIdBons = [];
            const parcheminsHtmlBons = [];
            const parcheminsIdTermines = [];
            const parcheminsHtmlTermines = [];
            const parcheminsIdPasToucher = [];
            const parcheminsHtmlPasToucher = [];
            const parcheminsIdMauvais = [];
            const parcheminsHtmlMauvais = [];
            const parcheminsIdAutres = [];
            const parcheminsHtmlAutres = [];

            function preparerHtml(p, avecGlyphes=true) {
                const cochages = p.cochagesGlyphes;
                let cochagesTexte = "grattages : aucun";
                if (cochages.includes(1)) {
                    cochagesTexte = "<strong>grattages : " + cochages.map((x, i) => (Boolean(x) ? (i + 1) : '')).join(" ") + "</strong>";
                }
                if (avecGlyphes) {
                    return `<p><strong>${p.id}</strong> - ${p.nom} <em>${p.effetDeBaseTexte}</em> : ${cochagesTexte} => ${p.effetTotalHtml}</p>`;
                }
                else {
                    return `<p><strong>${p.id}</strong> - ${p.nom} <em>${p.effetDeBaseTexte}</em></p>`;
                }
            }

            for (const id of this.index) {
                if (this.parchemins[id].qualite === QUALITE_BON) {
                    parcheminsIdBons.push(id);
                    parcheminsHtmlBons.push(preparerHtml(this.parchemins[id]));
                }
                else if (this.parchemins[id].qualite === QUALITE_MAUVAIS) {
                    parcheminsIdMauvais.push(id);
                    parcheminsHtmlMauvais.push(preparerHtml(this.parchemins[id], false));
                }
                else if (this.parchemins[id].qualite === QUALITE_TERMINE) {
                    parcheminsIdTermines.push(id);
                    parcheminsHtmlTermines.push(preparerHtml(this.parchemins[id]));
                }
                else if (this.parchemins[id].qualite === QUALITE_PAS_TOUCHER) {
                    parcheminsIdPasToucher.push(id);
                    parcheminsHtmlPasToucher.push(preparerHtml(this.parchemins[id], false));
                }
                else {
                    if (this.parchemins[id].qualite === QUALITE_NEUTRE) {
                        parcheminsIdAutres.push(id);
                        parcheminsHtmlAutres.push(preparerHtml(this.parchemins[id]));
                    }
                }
            }

            let reponse = '<p><strong><em>---------------------------------------- Numéros ----------------------------------------</em></strong></p>';
            reponse += '<p><strong style="color:darkgreen">Parchemins \"à gratter\" :</strong> ' + (parcheminsIdBons.length ? parcheminsIdBons.join(', ') : 'aucun') + '</p>';
            reponse += '<p><strong style="color:gold">Parchemins \"terminés\" :</strong> ' + (parcheminsIdTermines.length ? parcheminsIdTermines.join(', ') : 'aucun') + '</p>';
            reponse += '<p><strong style="color:mediumblue">Parchemins \"à garder tels quels\" :</strong> ' + (parcheminsIdPasToucher.length ? parcheminsIdPasToucher.join(', ') : 'aucun') + '</p>';
            reponse += '<p><strong style="color:orangered">Parchemins \"mauvais\" :</strong> ' + (parcheminsIdMauvais.length ? parcheminsIdMauvais.join(', ') : 'aucun') + '</p>';
            reponse += '<p><strong style="color:darkslategrey">Parchemins \"neutres\" à traiter :</strong> ' + (parcheminsIdAutres.length ? parcheminsIdAutres.join(', ') : 'aucun') + '</p>';

            reponse += '<p><strong><em>---------------------------------------- Détails ----------------------------------------</em></strong></p>';
            reponse += '<p><strong style="color:darkgreen">Détails parchemins \"à gratter\" :</strong> ' + (parcheminsHtmlBons.length ? parcheminsHtmlBons.join('') : 'aucun') + '</p>';
            reponse += '<p><strong style="color:gold">Détails parchemins \"terminés\" :</strong> ' + (parcheminsHtmlTermines.length ? parcheminsHtmlTermines.join('') : 'aucun') + '</p>';
            reponse += '<p><strong style="color:mediumblue">Détails parchemins \"à garder tels quels\" :</strong> ' + (parcheminsHtmlPasToucher.length ? parcheminsHtmlPasToucher.join('') : 'aucun') + '</p>';
            reponse += '<p><strong style="color:orangered">Détails parchemins \"mauvais\" :</strong> ' + (parcheminsHtmlMauvais.length ? parcheminsHtmlMauvais.join('') : 'aucun') + '</p>';

            reponse += '<p><strong style="color:darkslategrey">Détails parchemins \"neutres\" à traiter :</strong> ' + (parcheminsHtmlAutres.length ? parcheminsHtmlAutres.join('') : 'aucun') + '</p>';

            this.texteRecapitulatif.innerHTML = reponse;
        }
    }


    // Prépare l'interface de l'outil
    _preparerPageListe() {
        displayDebug("_preparerPageListe");
        if (!this.parent) {
            this.parent = document.getElementsByTagName('body')[0];
            this.parent.innerHTML = "";
        }
        this.zone = Createur.elem('div', {id: "listerGrattages", style: "padding:5px", parent: this.parent});

        this._attacherMessageIntro();
        this._attacherBoutonsChargement();
        if (this.optionChargement !== PAS_DE_CHARGEMENT_MH) this._attacherBoutonsChargementHall();
        this._attacherInterfaceSupprimerParchemins();
        this._attacherInterfaceRecapituler();
        this._attacherInterfaceFiltrer();
        this._attacherCriteresAffichages()
        this._attacherTableParchemins();

        displayDebug("fin _preparerPageListe");
    }

    _attacherMessageIntro() {
        this.zone.innerHTML =
            '<p>Pour pouvoir charger de nouveaux parchemins, vous devez être <strong>connecté</strong> à Mountyhall, <strong>connaitre</strong> la compétence Grattage et disposer de <strong>au moins 2 PA</strong>.<br>' +
            '<strong>Survoler avec la souris :</strong> les noms des parchemins pour voir les effets initiaux, les glyphes pour voir les détails, les champs et boutons pour plus d\'infos.</p>';
    }

    _attacherBoutonsChargement() {
        const divBoutonsChargement = Createur.elem('div', {
            parent: this.zone,
            style: "margin:0vmin; padding:0.1vmin; border:solid 0px black"
        });

        Createur.elem('button', {                        // boutonSauvegarderLocalement
            texte: 'Sauvegarder (navigateur)',
            style: "margin: 10px 5px 10px 10px; background-color: #0074D9", // bleu
            parent: divBoutonsChargement,
            events: [{nom: 'click', fonction: this.sauvegarderLocalement, bindElement: this}],
            classesHtml: ['mh_form_submit'],
            attributs: [['title', `Sauvegarde en local dans votre navigateur vos parchemins et l'état de vos analyses.`]]
        });

        Createur.elem('button', {                       // boutonChargerLocalement
            texte: 'Charger (navigateur)',
            style: "margin: 10px 5px 10px 5px",
            parent: divBoutonsChargement,
            events: [{nom: 'click', fonction: this.chargerLocalement, bindElement: this}],
            classesHtml: ['mh_form_submit'],
            attributs: [['title', `Charge les parchemins depuis la mémoire locale de votre navigateur.
Il s'agit du chargement PAR DEFAUT.
Nécessite une sauvegarde au préalable.
Ne supprime aucun parchemin de la liste en cours. Ajoute et place en fin de liste les parchemins se trouvant dans la sauvegarde.
Si vous désirez obtenir exactement et uniquement l'état de la sauvegarde, vous pouvez au préalable supprimer les parchemins en cours via le bouton adéquat.`]]
        });

        // ------------------------

        Createur.elem('button', {                       // boutonImporterTexte
            texte: 'Importer (texte)',
            style: "margin: 10px 5px 10px 20px",
            parent: divBoutonsChargement,
            events: [{nom: 'click', fonction: this.validerImport, bindElement: this, param: [IMPORTER_REMPLACER]}],
            classesHtml: ['mh_form_submit'],
            attributs: [['title', `Remplace les parchemins en cours par ceux fournis en format texte structuré.`]]
        });

        Createur.elem('button', {                       // boutonAjouterTexte
            texte: 'Ajouter (texte)',
            style: "margin: 10px 5px 10px 5px",
            parent: divBoutonsChargement,
            events: [{nom: 'click', fonction: this.validerImport, bindElement: this}],
            classesHtml: ['mh_form_submit'],
            attributs: [['title', `Ajoute aux parchemins en cours les parchemins fournis en format texte structuré.`]]
        });

        Createur.elem('button', {                       // boutonExporterLocalement
            texte: 'Exporter (texte)',
            style: "margin: 10px 20px 10px 5px",
            parent: divBoutonsChargement,
            events: [{nom: 'click', fonction: this.afficherExport, bindElement: this}],
            classesHtml: ['mh_form_submit'],
            attributs: [['title', `Place dans votre presse-papier une copie des parchemins au format texte structuré.
    Vous pouvez donc ensuite coller (ctrl-v) simplement l'enregistrement.`]]
        });

        // ------------------------ TURLU

        Createur.elem('button', {                        // boutonSauvegarderEnLigne
            texte: 'Sauvegarder (cloud)',
            style: "margin: 10px 5px 10px 20px; background-color: #0074D9", // bleu
            parent: divBoutonsChargement,
            events: [{nom: 'click', fonction: this.sauvegarderEnLigne, bindElement: this}],
            classesHtml: ['mh_form_submit'],
            attributs: [['title', `Sauvegarde dans le cloud vos parchemins et l'état de vos analyses.
Ceci enregistre "en ligne" les données concernant cette page, sur un serveur distinct de Mountyhall, pour pouvoir les récupérer par la suite.
Les données enregistrées concernent uniquement les parchemins, leurs glyphes ainsi que les paramètres de l'interface.
Le serveur de données peut être considéré comme "amateur" : il a pour simple vocation d'être "utile". Pour donner une idée, le gestionnaire de ce service l'utilise sans crainte et conseillerait à ses amis de l'utiliser. Cependant, si vous considérez les données de vos parchemins comme cruciales et strictement confidentielles, il ne vous est pas recommandé d'utiliser ce service. (Cela va de même pour tous les outils externes à mh...) De plus, ce service pouvant tomber en panne ou être arrêté à tout moment, il vous est conseillé de conserver des copies locales de vos données (exporter sous format texte) si elles ont de l'importance pour vous.
Pour information, le gestionnaire de ce service se réserve le droit de traiter les données des parchemins stockés, de manière anonyme, pour effectuer des études globales concernant la compétence Gratter. Exemple : déterminer la puissance moyenne des glyphes, quelles sont les puissances les plus hautes obtenues, quelles sont les glyphes les plus fréquentes, etc.`]]
        });
        // TODO : title pourrait être trop long dans certains navigateurs

        Createur.elem('button', {                       // boutonChargerEnLigne
            texte: 'Charger (cloud)',
            style: "margin: 10px 10px 10px 5px",
            parent: divBoutonsChargement,
            events: [{nom: 'click', fonction: this.chargerEnLigne, bindElement: this}],
            classesHtml: ['mh_form_submit'],
            attributs: [['title', `Charge les parchemins depuis le cloud.
Nécessite une sauvegarde au préalable.
Ne supprime aucun parchemin de la liste en cours. Ajoute et place en fin de liste les parchemins se trouvant dans la sauvegarde.
Si vous désirez obtenir exactement et uniquement l'état de la sauvegarde, vous pouvez au préalable supprimer les parchemins en cours via le bouton adéquat.`]]
        });

        // ------------------------

        this.zoneDateEnregistrement = Createur.elem('span', {style: "margin: 10px", parent: divBoutonsChargement});
    }


    _attacherBoutonsChargementHall() {
        const divBoutonsChargementHall = Createur.elem('div', {
            parent: this.zone,
            style: "margin:0vmin; padding:0.1vmin; border:solid 0px black"
        });

        this.boutonChargerListeParchemins = Createur.elem('button', {                        // boutonChargerDepuisHall
            texte: 'Grattage, récupérer la liste des parchemins sur moi',
            style: "margin: 10px 5px 10px 5px; background-color: #FF851B", //orange
            parent: divBoutonsChargementHall,
            events: [{nom: 'click', fonction: this.chargerListeParcheminsGrattablesDepuisHall, bindElement: this}],
            classesHtml: ['mh_form_submit'],
            attributs: [['title', `Cliquer sur ce bouton débute l'action grattage pour récupérer la liste des parchemins que vous pouvez gratter.
Le second bouton est ensuite préparé pour pouvoir aller chercher les glyphes des parchemins, un à un.
Vous devez être connecté, connaitre Gratter et disposer de 2PA (qui ne seront pas consommés) pour utiliser cette fonctionnalité.`]]
        });

        this.boutonChargerGlyphes = Createur.elem('button', {
            texte: 'Grattage, récupérer glyphes du parchemin :',
            style: "margin: 10px 5px 10px 5px; background-color: #FF851B", //orange
            parent: divBoutonsChargementHall,
            events: [{nom: 'click', fonction: this.chargerParcheminDepuisHall, bindElement: this}],
            classesHtml: ['mh_form_submit'],
            attributs: [['title', `Cliquer sur ce bouton démarre la compétence Gratter pour aller chercher les glyphes du parchemin 
dont l'id se trouve dans le champ ci-contre, pour ensuite l'afficher dans la page.
Vous devez au préalable charger la liste des parchemins à gratter via le bouton précédent.
Après la recherche des glyphes d'un parchemin, le champ est mis à jour automatiquement avec le numéro du prochain parchemin de la liste.
Vous devez être connecté, connaitre Gratter et disposer de 2PA (qui ne seront pas consommés) pour utiliser cette fonctionnalité.
Des parchemins "spéciaux" (ogham, rune, sort, invention extraordinaire, mission, gribouillé, vierge...) peuvent générer des lignes vides.
Un nouveau parchemin est ajouté en bas de liste en tant que parchemin neutre. (Les parchemins neutres sont rendus visibles.)`]]
        });

        this.inputParcheminACharger = Createur.elem('input', {
            style: "margin: 10px 5px 10px 5px; width: 8em",
            parent: divBoutonsChargementHall,
            attributes: [['type', 'number'], ['step', '1']]
        });

        this.encoreCombien = Createur.elem('span', {
            style: "margin: 10px 5px 10px 5px", //orange
            texte: "Infos : survoler les boutons avec la souris",
            parent: divBoutonsChargementHall
        });

        if (STATIQUE) {
            this.bloquerBoutonsChargement()
        }

    }

    bloquerBoutonsChargement() {
        this.boutonChargerListeParchemins.style.backgroundColor = "#AAAAAA"; // gris
        this.boutonChargerListeParchemins.disabled = true;
        this.boutonChargerGlyphes.style.backgroundColor = "#AAAAAA";
        this.boutonChargerGlyphes.disabled = true;
    }

    debloquerBoutonsChargement() {
        this.boutonChargerListeParchemins.style.backgroundColor = "#FF851B"; // orange
        this.boutonChargerListeParchemins.disabled = false;
        this.boutonChargerGlyphes.style.backgroundColor = "#FF851B";
        this.boutonChargerGlyphes.disabled = false;
    }

    rafraichirBoutonPourChercherGlyphes() {
        if (this.indexNouveauxParchemins.length > 0) {
            this.inputParcheminACharger.value = this.indexNouveauxParchemins[0];
            this.encoreCombien.innerText = "Encore " + this.indexNouveauxParchemins.length + " parchemin(s)";
        }
        else {
            this.inputParcheminACharger.value = "";
            this.encoreCombien.innerText = "Plus de parchemins à charger";
        }
    }


    chargerParcheminDepuisHall() {
        const IdParchemin = this.inputParcheminACharger.value;
        if (this.indexNouveauxParchemins.includes(IdParchemin)) {
            this.recuperateur.vaChercherGlyphes(this.inputParcheminACharger.value);
            const position = this.indexNouveauxParchemins.indexOf(IdParchemin);
            if (position !== -1) {
                this.indexNouveauxParchemins.splice(position, 1);
            }
            this.bloquerBoutonsChargement();

            // on affiche les neutres pour voir les nouveaux arriver
            if (this.affichagesNeutresCheckbox.checked === false) {
                this.affichagesNeutresCheckbox.checked = true;
                this.affichagesNeutresCheckbox.dispatchEvent(new Event('change'));
            }

            // fait après réception plutôt
            //if (this.indexNouveauxParchemins.length > 0) {
            //    this.inputParcheminACharger.value = this.indexNouveauxParchemins[0];
            //}
            //else {
            //    this.inputParcheminACharger.value = "";
            //}
        }
        else {
            // TODO Il serait possible d'aller le tester et récupérer dans les infos de la première page puisqu'on y passe, si on ne l'a pas éjà cherché
            alert("Il faut d'abord charger la liste des parchemins \n(avant de pouvoir aller chercher les glyphes d'un parchemin).");
        }
    }

    _attacherInterfaceSupprimerParchemins() {
        const divParcheminsASupprimer = Createur.elem('div', {
            parent: this.zone,
            style: "margin:1vmin; padding:1vmin; border:solid 1px black"
        });

        Createur.elem('button', {                       // boutonChargerLocalement
            texte: 'Supprimer tous les parchemins',
            style: "margin: 10px 20px 10px 5px",
            parent: divParcheminsASupprimer,
            events: [{nom: 'click', fonction: this.supprimerTousLesParchemins, bindElement: this}],
            classesHtml: ['mh_form_submit']
        });

        this.boutonSupprimerParchemins = Createur.elem('button', {             // moué, this un peu facile pour faire passer un truc...
            texte: 'Supprimer parchemin de la liste',
            style: "margin: 10px",
            parent: divParcheminsASupprimer,
            events: [{nom: 'click', fonction: this.nettoyerParchemins, bindElement: this}],
            classesHtml: ['mh_form_submit'],
            attributs: [['title', `Introduire le numéro du parchemin à supprimer de la liste.
Vous ne pourrez plus voir ses informations, sauf si vous le chargez à nouveau ou si vous chargez une sauvegarde précédente.
Possibilité d'introduire plusieurs numéros séparés par une virgule.`]]
        });

        Createur.elem('input', {              // si besoin de nom : const inputParcheminsASupprimer =
            id: 'parcheminsASupprimer',
            attributs: [['type', 'text'], ['size', '25'], ['placeholder', 'Introduire numéro de parchemin'],
            ['title', `Introduire le numéro du parchemin à supprimer de la liste.
Vous ne pourrez plus voir ses informations, sauf si vous le chargez à nouveau ou si vous chargez une sauvegarde précédente.
Possibilité d'introduire plusieurs numéros séparés par une virgule.`]],
            parent: divParcheminsASupprimer
        });
    }

    // TODO : doit d'abord afficher les bons, puis les neutres, puis la liste des id des mauvais (pas d'impact des caches ou coches)
    _attacherInterfaceRecapituler() {
        const divBoutonRecapitulatif = Createur.elem('div', {
            parent: this.zone,
            style: "margin:1vmin; padding:1.5vmin; border:solid 1px black"
        });

        this.boutonAfficherRecapitulatif = Createur.elem('button', {               // si besoin de nom : const boutonAfficherRecapitulatif =
            texte: 'Afficher Récapitulatif',
            style: "margin: 5px; width: " + window.getComputedStyle(this.boutonSupprimerParchemins).getPropertyValue("width"),
            parent: divBoutonRecapitulatif,
            events: [{nom: 'click', fonction: this.afficherRecapitulatif, bindElement: this}],
            classesHtml: ['mh_form_submit'],
            attributes: [["data-affiche", "non"]]
        });

        this.texteRecapitulatif = Createur.elem('div', {                // si besoin de nom : const zoneRecapitulatif =
            id: 'recapitulatif',
            parent: divBoutonRecapitulatif
        });
    }

    viderTexteRecapitulatif() {
        this.texteRecapitulatif.innerHTML = "";
    }

    // TODO séparer la durée des autres caractéristiques, elle est un peu à part.
    // choisir si on veut voir les gardés, supprimés ou mis de côtés (encore à faire)
    _attacherInterfaceFiltrer() {
        // idée au départ de pemettre de trier et filtrer sur chaque carac, avec min et max...
        // ... mais est-ce bine nécessaire ? (Aller jusqu'à deux ou 3 caracs en même temps ?)

        const divFiltrer = Createur.elem('div', {
            parent: this.zone,
            style: "margin:1vmin; padding:1vmin; border:solid 1px black"
        });

        let html =
            `<select style="margin:5px; padding:5px" id="typeRecherche" name="typeRecherche" title="la valeur indiquée sera comprise">
                    <option value="${AU_MOINS}" selected>Plus grand que</option>
                    <option value="${AU_PLUS}">Plus petit que</option>
                </select>`;

        html +=
            `<label style="margin:5px 0 5px 5px; padding:3px" for="puissanceRecherche"
                  title="Chaque point de puissance a un impact sur l'effet.
    ATT, ESQ, PV => 1D3
    DEG, REG, PV, Vue, Duree, Zone => 1
    Tour => 15 min"
                >Puissance (-45 à 45) :</label>
                <input style="margin:5px 5px 5px 0; padding:3px; width: 4em" id="puissanceRecherche" name="puissanceRecherche" type="number" 
                min="-45" max="45" step="1" value="0"
                title="Chaque point de puissance a un impact sur l'effet.
    ATT, ESQ, PV => 1D3
    DEG, REG, PV, Vue, Duree, Zone => 1
    Tour => 15 min">`;

        html += `<select style="margin:5px; padding:3px" id="caracRecherche" name="caracRecherche" 
              title=" Toutes caracs : travaille sur base de la carac la plus élevée (ou la plus basse), 
    en dehors de la durée et de l'effet de zone, pour chaque parchemin. 
    En cas d'égalité il en prend une au hasard.
    L'outil va également cocher les glyphes des parchemins pour obtenir l'effet le plus puissant recherché SAUF pour les parchemins marqués 'à gratter' et 'terminés' pour lesquels les cochages enregistrés ne seront pas modifiés.

Combinaison : travaille sur base de la somme du total de tous les effets du parchemin (hors effet de zone et hors durée) multiplié par la durée positive potentielle du parchemin.">`;
        html += `<option value="${TOUTES}">Toutes caracs</option>`;
        let copie = [...CARAC];
        copie.splice(9, 1);                   // sans duree
        copie.splice(8, 1);                   // sans efet de zone
        for (const c of copie) {
            html += `<option value="${c.id}">${c.presentation}</option>`;
        }
        html += `<option value="${COMBINAISON}">Combinaison</option>`;
        html += "</select>";

        html +=
            `<label style="margin:5px 0 5px 20px; padding:3px" for="dureeRecherche" title="Durée devant potentiellement pouvoir être atteinte">Durée minimum :</label>
                <input style="margin:5px 20px 5px 0; padding:3px; width: 4em" id="dureeRecherche" name="dureeRecherche" type="number" 
                min="0" max="45" step="1" value="0" title="Durée devant potentiellement pouvoir être atteinte">`;

        html +=
            `<input style="margin:5px 0 5px 5px; padding:3px" id="effetZoneObligatoire" name="effetZoneObligatoire" type="checkbox" title="Effet de zone doit potentiellement pouvoir être atteint">
                  <label style="margin:5px 5px 5px 0; padding:3px" for="effetZoneObligatoire" title="Effet de zone doit potentiellement pouvoir être atteint">Effet de zone possible</label>`;

        html +=
            `<button style="margin:5px; padding:3px" class="mh_form_submit" id="boutonRecherche" 
title="N'affiche que les parchemins répondant aux critères.
Trie grosso modo sur base du critère de puissance demandé (puis sur l'id des parchemins en cas d'égalité).
L'outil va également cocher les glyphes des parchemins pour obtenir l'effet le plus puissant recherché SAUF pour les parchemins marqués 'à gratter' et 'terminés' pour lesquels les cochages enregistrés ne seront pas modifiés.
Change le numéro d'ordre affiché pour les parchemins.">Filtrer et Trier</button>`;

        divFiltrer.innerHTML = html;

        this.filtre.type = document.getElementById('typeRecherche');
        this.filtre.puissance = document.getElementById('puissanceRecherche');
        this.filtre.carac = document.getElementById('caracRecherche');
        this.filtre.duree = document.getElementById('dureeRecherche');
        this.filtre.zone = document.getElementById('effetZoneObligatoire');
        this.filtre.bouton = document.getElementById('boutonRecherche');
        this.filtre.bouton.addEventListener('click', this.afficherParcheminsFiltres.bind(this));
    }


    _attacherCriteresAffichages() {

        const divCriteresAffichages = Createur.elem('div', {
            parent: this.zone,
            style: "margin:1vmin; padding:1vmin; border:solid 0px black"
        });

        // ---------------

        Createur.elem('span', {
            parent: divCriteresAffichages,
            style: "margin: 5px 0 5px 5px; padding: 3px; font-weight: bold",
            texte : "Afficher les parchemins :"
        });

        // ---------- checkbox bons

        this.affichagesBonsCheckbox = Createur.elem('input', {
            id: "affichagesBonsCheckbox",
            parent: divCriteresAffichages,
            style: "margin:5px 0 5px 5px; padding:3px",
            attributs: [["type", "checkbox"], ["checked", "true"], ["name", "affichagesBonsCheckbox"]],
            events: [{nom: 'change', fonction: this.afficherSelonQualite, // bindElement: // on le bind à l'outil
                param: [QUALITE_BON, this]}]
        });
        this.affichagesBonsCheckbox.checked = true;

        this.affichagesBonsLabel = Createur.elem('label', {
            texte: "\"à gratter\"",
            parent: divCriteresAffichages,
            style: "margin:5px 5px 5px 0; padding:3px",
            attributs: [["for", "affichagesBonsCheckbox"]]
        });


        // ---------- checkbox mauvais

        this.affichagesMauvaisCheckbox = Createur.elem('input', {
            id: "affichagesMauvaisCheckbox",
            parent: divCriteresAffichages,
            style: "margin:5px 0 5px 20px; padding:3px",
            attributs: [["type", "checkbox"], ["checked", "true"], ["name", "affichagesMauvaisCheckbox"]],
            events: [{nom: 'change', fonction: this.afficherSelonQualite,
                param: [QUALITE_MAUVAIS, this]}]
        });
        this.affichagesMauvaisCheckbox.checked = true;

        this.affichagesMauvaisLabel = Createur.elem('label', {
            texte: "    \"mauvais\"",
            parent: divCriteresAffichages,
            style: "margin:5px 5px 5px 0; padding:3px",
            attributs: [["for", "affichagesMauvaisCheckbox"]]
        });

        // ---------- checkbox terminé

        this.affichagesTerminesCheckbox = Createur.elem('input', {
            id: "affichagesTerminesCheckbox",
            parent: divCriteresAffichages,
            style: "margin:5px 0 5px 20px; padding:3px",
            attributs: [["type", "checkbox"], ["checked", "true"], ["name", "affichagesTerminesCheckbox"]],
            events: [{nom: 'change', fonction: this.afficherSelonQualite,
                param: [QUALITE_TERMINE, this]}]
        });
        this.affichagesTerminesCheckbox.checked = true;

        this.affichagesTerminesLabel = Createur.elem('label', {
            texte: "\"terminés\"",
            parent: divCriteresAffichages,
            style: "margin:5px 5px 5px 0; padding:3px",
            attributs: [["for", "affichagesTerminesCheckbox"]]
        });

        // ---------- checkbox pas toucher

        this.affichagesPasToucherCheckbox = Createur.elem('input', {
            id: "affichagesPasToucherCheckbox",
            parent: divCriteresAffichages,
            style: "margin:5px 0 5px 20px; padding:3px",
            attributs: [["type", "checkbox"], ["checked", "true"], ["name", "affichagesPasToucherCheckbox"]],
            events: [{nom: 'change', fonction: this.afficherSelonQualite,
                param: [QUALITE_PAS_TOUCHER, this]}]
        });
        this.affichagesPasToucherCheckbox.checked = true;

        this.affichagesPasToucherLabel = Createur.elem('label', {
            texte: "\"pas toucher\"",
            parent: divCriteresAffichages,
            style: "margin:5px 5px 5px 0; padding:3px",
            attributs: [["for", "affichagesPasToucherCheckbox"]]
        });

        // ---------- checkbox neutres

        this.affichagesNeutresCheckbox = Createur.elem('input', {
            id: "affichagesNeutresCheckbox",
            parent: divCriteresAffichages,
            style: "margin:5px 0 5px 20px; padding:3px",
            attributs: [["type", "checkbox"], ["checked", "true"], ["name", "affichagesNeutresCheckbox"]],
            events: [{nom: 'change', fonction: this.afficherSelonQualite,
                param: [QUALITE_NEUTRE, this]}]
        });
        this.affichagesNeutresCheckbox.checked = true;

        this.affichagesNeutresLabel = Createur.elem('label', {
            texte: "\"neutres\"",
            parent: divCriteresAffichages,
            style: "margin:5px 5px 5px 0; padding:3px",
            attributs: [["for", "affichagesNeutresCheckbox"]]
        });

        //-----------

        Createur.elem('span', {
            parent: divCriteresAffichages,
            style: "margin:5px 0 5px 5px; padding:3px; font-weight: bold",
            texte : "Ou bien alors :"
        });

        // ---------- checkbox voir sur moi

        this.affichagesSurSoiCheckbox = Createur.elem('input', {
            id: "affichagesSurSoiCheckbox",
            parent: divCriteresAffichages,
            style: "margin:5px 0 5px 20px; padding:3px",
            attributs: [["type", "checkbox"],
                ["checked", "false"],
                ["disabled", "true"],
                ["name", "affichagesSurSoiCheckbox"],
            ["title", "Pour pouvoir utiliser cette option, il faut au préalable avoir cliqué sur le bouton : \"Grattage, récupérer la liste des parchemins sur moi.\""]],
            events: [{nom: 'change', fonction: this.afficherSelonQualite,
                param: [QUALITE_SUR_MOI, this]}]
        });
        this.affichagesSurSoiCheckbox.checked = false;

        this.affichagesSurSoiLabel = Createur.elem('label', {
            texte: "\"uniquement les parchemins sur moi\"",
            parent: divCriteresAffichages,
            style: "margin: 5px 5px 5px 0; padding:3px; color: #00000077",
            attributs: [["for", "affichagesSurSoiCheckbox"], ["title", "Pour utiliser cette option, il faut au préalable avoir cliqué sur le bouton : \"Grattage, récupérer la liste des parchemins sur moi.\""]]
        });

        if (this.parcheminsSurSoi.length > 0) this.activerModeAffichageSurSoi();

        // ---------- checkbox deja gratté // Est-ce vraiment intéressant ? Qui a la priorité entre bon/mauvais ou déjà gratté ?
        //
        // this.affichagesDejaGratteCheckbox = Createur.elem('input', {
        //     id : "affichagesDejaGratteCheckbox",
        //     parent: divCriteresAffichages,
        //     style: "margin:5px 0 5px 20px; padding:3px",
        //     attributs : [["type", "checkbox"], ["checked", "false"], ["name", "affichagesDejaGratteCheckbox"]],
        //     events: [{nom: 'change', fonction: this.afficherSelonQualite, bindElement: this, param: [QUALITE_GRATTE]}]
        // });
        // this.affichagesDejaGratteCheckbox.checked = false;
        //
        // Createur.elem('label', {
        //     texte : "Afficher les parchemins déjà grattés.",
        //     parent: divCriteresAffichages,
        //     style: "margin:5px 5px 5px 0; padding:3px",
        //     attributs : [["for", "affichagesDejaGratteCheckbox"]]
        // });


        /*
        // ---------- bouton rendre visible

        Createur.elem('input', {                         // boutonRendreVisibleCaches
            id: "boutonRendreVisibleCaches",
            parent: divCriteresAffichages,
            style: "margin:5px 0 5px 20px; padding:3px", // background-color: #a8b6bf
            attributs: [["type", "button"], ["name", "boutonRendreVisibleCaches"], ["value", "Rendre visibles les parchemins \"neutres\""]],
            events: [{nom: 'click', fonction: this.rendreVisibleCaches, bindElement: this}],
            classesHtml: ['mh_form_submit']
        });

        Createur.elem('input', {                         // boutonRendreVisibleCaches
            id: "boutonCacherNeutres",
            parent: divCriteresAffichages,
            style: "margin:5px 0 5px 20px; padding:3px", // background-color: #a8b6bf
            attributs: [["type", "button"], ["name", "boutonCacherNeutres"], ["value", "Cacher les parchemins \"neutres\""]],
            events: [{nom: 'click', fonction: this.cacherNeutres, bindElement: this}],
            classesHtml: ['mh_form_submit']
        });
        */

    }

    // plus utilise
    rendreVisibleCaches() {
        for (const id in this.parchemins) {
            if (this.parchemins[id].qualite === QUALITE_NEUTRE) /// hmm... devrait-on pouvoir cacher un bon alors que "bons visibles" est coché ?
                if (!this.parchemins[id].affiche)
                    this.parchemins[id].afficherParchemin();
        }
    }

    cacherNeutres() {
        for (const id in this.parchemins) {
            if (this.parchemins[id].qualite === QUALITE_NEUTRE)
                if (this.parchemins[id].affiche)
                    this.parchemins[id].cacherParchemin();
        }
    }

    // TODO à méditer : est-ce ok ou non de cacher les bons ou mauvais en jouant en parallèle sur l'aspect caché temporairement ?
    // TODO : est-ce que le checkbox pourait envoyer directement la valeur du check pour ne pas avoir à les récupérer ici ?
    // bind sur le checkbox !
    afficherSelonQualite(qualiteConcernee, outil) {

        if (qualiteConcernee === QUALITE_SUR_MOI) {
            if(this.checked) {
                outil.passerModeAffichageSurSoi();
            }
            else {
                outil.passerModeAffichageNormal();
            }
        }
        else {
            for (const id in outil.parchemins) {
                if (outil.parchemins[id].qualite === qualiteConcernee) {
                    if (this.checked) {
                        outil.parchemins[id].afficherParchemin();
                    }
                    else {
                        outil.parchemins[id].cacherParchemin();
                    }
                }
            }
        }
    }

    activerModeAffichageSurSoi() {
        if(this.affichagesSurSoiCheckbox.disabled) {
            this.affichagesSurSoiCheckbox.disabled = false;
            this.affichagesSurSoiLabel.style.color = "black";
        }
    }

    passerModeAffichageSurSoi() {
        this.affichagesBonsCheckbox.disabled = true;
        this.affichagesTerminesCheckbox.disabled = true;
        this.affichagesPasToucherCheckbox.disabled = true;
        this.affichagesMauvaisCheckbox.disabled = true;
        this.affichagesNeutresCheckbox.disabled = true;

        this.affichagesBonsLabel.style.opacity = 0.5;
        this.affichagesTerminesLabel.style.opacity = 0.5;
        this.affichagesPasToucherLabel.style.opacity = 0.5;
        this.affichagesMauvaisLabel.style.opacity = 0.5;
        this.affichagesNeutresLabel.style.opacity = 0.5;

        this.afficherParcheminsAdequats();

    }

    passerModeAffichageNormal() {
        this.affichagesBonsCheckbox.disabled = false;
        this.affichagesTerminesCheckbox.disabled = false;
        this.affichagesPasToucherCheckbox.disabled = false;
        this.affichagesMauvaisCheckbox.disabled = false;
        this.affichagesNeutresCheckbox.disabled = false;

        this.affichagesBonsLabel.style.opacity = 1;
        this.affichagesTerminesLabel.style.opacity = 1;
        this.affichagesPasToucherLabel.style.opacity = 1;
        this.affichagesMauvaisLabel.style.opacity = 1;
        this.affichagesNeutresLabel.style.opacity = 1;

        this.afficherParcheminsAdequats();
    }

    _attacherTableParchemins() {
        this.table = Createur.elem('table', {
            id: "DragttageTable", parent: this.zone,
            style: "margin:1vmin; padding:1vmin; border:solid 1px black"
        });
    }

    viderTableParchemins() {
        this.table.innerHTML = "";
    }

    // renvoie un objet sauvegarde
    // attention array de parchemins et non un object
    // TODO ne plus enregistrer l'indexe, le recréer au chargement. A la limite en précisant le critère (pour lorsque remplacement par exemple)
    exporterParchemins() {
        const sauvegarde = {     // Sauvegarde pourrait avoir sa classe
            numeroTroll: String(NUMERO_TROLL),
            dateEnregistrement: new Date().toISOString(),
            criteresAffichage: this.recupererCriteresAffichage(),
            parchemins: [],
            index: this.index
        };
        for (const id in this.parchemins) {
            const p = this.parchemins[id];
            let enregistrement = {
                id: p.id,
                nom: p.nom,
                effetDeBaseTexte: p.effetDeBaseTexte,
                glyphesNumeros: [],
                glyphesCoches: [],
                affiche: p.affiche,
                qualite: p.qualite,
                etat: p.etat,
                dateAjout: p.dateAjout
            };
            for (const g of p.glyphes) {
                enregistrement.glyphesNumeros.push(g.numero);
                enregistrement.glyphesCoches.push(Number(g.coche));
            }
            sauvegarde.parchemins.push(enregistrement);
        }
        return sauvegarde;
    }

    // reçoit un objet sauvergarde
    importerParchemins(sauvegarde, critereCompleter = IMPORTER_COMPLETER) {

        if (critereCompleter === IMPORTER_REMPLACER) {
            this.parchemins = {};
            this.index = sauvegarde.index;
        }
        else {
            if (!(this.parchemins)) { // s'il n'y a rien on crée... possible ? :)
                this.parchemins = {};
                this.index = sauvegarde.index;
            }
            else {
                this.index = this.index.concat(sauvegarde.index);
            }
        }

        // arrivé après, donc s'il y a pas on ne fait rien. Et initialisé par défaut par classe
        if (sauvegarde.dateEnregistrement) {
            const dateRecue = new Date(sauvegarde.dateEnregistrement);
            // this.dateEnregistrementDuDernierImport  = dateRecue; // inutile, en tout cas pour le moment
            this.zoneDateEnregistrement.innerText = "Date de la sauvegarde : " + dateRecue.toLocaleString();
        }
        for (const enregistrement of sauvegarde.parchemins) {
            this.parchemins[enregistrement.id] = ParcheminEnPage.creerParchemin(enregistrement);
        }

        if (sauvegarde.criteresAffichage) this.adapterCriteresAffichage(sauvegarde.criteresAffichage); // réfléchir si meilleur endroit pour ça

        //this.construireIndex(); on garde l'ancien.
    }

    importerParcheminsEtAfficher(sauvegarde, critereCompleter) {
        this.importerParchemins(sauvegarde, critereCompleter);
        this.afficherParcheminsAdequats();
        this.viderTexteRecapitulatif();
        console.log("Parchemin plus ancien : " + this.recupererDateAjoutParcheminPlusAncien());
        console.log("Parchemin plus récent : " + this.recupererDateAjoutParcheminPlusRecent());
    }

    recupererCriteresAffichage() {
        return {
            aGratter : this.affichagesBonsCheckbox.checked,
            mauvais : this.affichagesMauvaisCheckbox.checked,
            termines : this.affichagesTerminesCheckbox.checked,
            pasToucher : this.affichagesPasToucherCheckbox.checked,
            neutres : this.affichagesNeutresCheckbox.checked,
        }
    }

    // ne se charge pas d'appeler le rafraichissement
    adapterCriteresAffichage(criteresAffichage) {
        this.affichagesBonsCheckbox.checked = criteresAffichage.aGratter;
        this.affichagesMauvaisCheckbox.checked = criteresAffichage.mauvais;
        this.affichagesTerminesCheckbox.checked = criteresAffichage.termines;
        this.affichagesPasToucherCheckbox.checked = criteresAffichage.pasToucher;
        this.affichagesNeutresCheckbox.checked = criteresAffichage.neutres;
    }

    chargerLocalement() {
        if (window.localStorage.getItem('sauvegardeListerGrattages')) {
            const sauvegarde = JSON.parse(window.localStorage.getItem('sauvegardeListerGrattages'));
            this.importerParcheminsEtAfficher(sauvegarde);
        }
        else {
            alert('Aucune sauvegarde trouvée localement dans le navigateur.\n(Vous pourriez essayer de charger depuis le cloud ?)');
        }
    }

    chargerEnLigne() {
        const url = SERVEUR_CLOUD + SERVICE_CHARGEMENT;
        fetch(url, {
            method : "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({numeroTroll: String(NUMERO_TROLL)})
        }).then(
            response => response.json()
        ).then(
            data => {
                console.log(data);
                if ("error" in data) {
                    alert("Problème rencontré lors de la récupération des données.");
                }
                else if ("aucun" in data) {
                    alert("Aucune sauvegarde retrouvée.");
                }
                else {
                    this.importerParcheminsEtAfficher(data);
                }
            }
        );
    }

    supprimerTousLesParchemins() {
        if (confirm("Désirez-vous supprimer tous les parchemins en cours ?")) {
            this.parchemins = {};
            this.index = [];
            this.incomplets = [];
            this.afficherParcheminsAdequats();
        }
    }

    sauvegarderLocalement() {
        if (confirm(`Désirez-vous sauvegarder localement dans votre navigateur ?
Cela écrasera l'éventuelle sauvegarde précédente.

(Si vous désirez plutôt compléter l'état de la sauvegarde précédente, veuillez au préalable charger cette sauvegarde via le bouton adéquat pour compléter la liste en cours.)`)) {
            const sauvegardeTexte = JSON.stringify(this.exporterParchemins());
            console.log(sauvegardeTexte); // normalement il y a l'export pour ça...
            window.localStorage.setItem('sauvegardeListerGrattages', sauvegardeTexte);
            alert("Etat sauvegardé.");
        }
    }

    sauvegarderEnLigne() {

        if (confirm(`Désirez-vous sauvegarder dans le cloud ?
Cela écrasera l'éventuelle sauvegarde précédente.

(Si vous désirez plutôt compléter l'état de la sauvegarde précédente, veuillez au préalable charger cette sauvegarde via le bouton adéquat pour compléter la liste en cours.)`)) {

            const sauvegardeTexte = JSON.stringify(this.exporterParchemins());

            const url = SERVEUR_CLOUD + SERVICE_SAUVEGARDE;
            fetch(url, {
                method : "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: sauvegardeTexte
            }).then(
                response => response.json()
            ).then(
                data => {
                    if ("error" in data) {
                        alert("Problème rencontré lors de l'enregistrement des données.");
                    }
                    else {
                        alert("Sauvegarde enregistrée.");
                    }
                }
            );
        }
    }

    validerImport(critereCompleter) {
        const introduit = prompt("Collez l'enregistrement (Ctrl+V) à importer :", "");
        let sauvegarde;
        if (introduit) {
            try {
                sauvegarde = JSON.parse(introduit);
                this.importerParcheminsEtAfficher(sauvegarde, critereCompleter);
                alert("Enregistrement importé.");
            }
            catch (e) {
                alert("Problème rencontré lors de l'import");
                console.log(e);
            }
        }
    }

    afficherExport() {
        // Ouch, le default value de chrome c'est maximum 2000 carac. Infini pour les autres... infini à l'insertion
        //prompt(" Voici l'enregistrement à copier (Ctrl+C) pour ensuite l'importer manuellement :",
        //JSON.stringify(this.exporterParchemins()));

        // Et pas possible de copier directement dans clipboard?... donc passer par un élément...
        copierDansPressePapier(this.exporterParchemins());
        alert("L'enregistrement est copié dans le presse-papier.\n" +
            "Vous pouvez maintenant le copier (Ctrl+v).");

        function copierDansPressePapier(texte) {
            // Create new element
            const textarea = document.createElement('textarea');
            textarea.value = JSON.stringify(texte);
            textarea.setAttribute('readonly', '');
            // ta.style.display = 'none'; // doit être visible pour être sélectionné? ...
            textarea.style = {position: 'absolute', left: '-9999px'}; // donc on le fout n'importe où
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
    }


    recupererDateAjoutParcheminPlusAncien() {
        return new Date(Math.min(...Object.values(this.parchemins).map(x => new Date(x.dateAjout)))).toLocaleString();
    }

    recupererDateAjoutParcheminPlusRecent() {
        return new Date(Math.max(...Object.values(this.parchemins).map(x => new Date(x.dateAjout)))).toLocaleString();
    }

}


//************************* fin classes *************************


//-------------------- Traitement de la page d'équipement --------------------//

function getNumTroll() {
    // Récupère le num de trõll dans la frame Menu
    // Menu = top.frames["Sommaire"].document
    // onclick du nom du trõll: "EnterPJView(numTroll,750,550)"
    // Faudrait vraiment coller des id dans l'équipement...
    let
        liens,
        str,
        numTroll = false;
    try {
        liens = top.frames["Sommaire"].document.getElementsByTagName("a");
    } catch (e) {
        displayDebug(e);
        return false;
    }

    if (liens.length > 0 && liens[0].onclick !== void(0)) {
        str = liens[0].onclick.toString();
        numTroll = parseInt(/\d+/.exec(str)[0]);
        displayDebug("numTroll = " + numTroll);
    }
    return numTroll;
}

function ouvrirListe() {
    // Ouvrir dans un nouvel onglet: //window.open("/mountyhall/Dragttage");
    // Ouvrir dans la frame de contenu: //window.location.assign(urlOutilListerGrattage);

    // TODO pour le moment déplacé rapidement dans la page d'équipement, pour rapidement ne plus la construire dans une 404
    const titre2 = document.getElementById('titre2');
    titre2.style.display = 'none';          // titre equipement
    document.getElementById('EquipementForm').style.display = 'none';  // le matos

    const mhPlay = document.getElementById('mhPlay');    //zone principale des données de l'écran
    const zoneListeParchemins = document.createElement("div");   //div dans lequel on va tout mettre
    zoneListeParchemins.style.textAlign = "left";
    mhPlay.insertBefore(zoneListeParchemins, titre2);
    new OutilListerGrattage(zoneListeParchemins);
}

function traitementEquipement() {
    // Ajout du lien dans l'équipement
    displayDebug("traitementEquipement");
    let
        numTroll = getNumTroll(),
        tr, td, btn,
        titreParchos;

    if (!numTroll) {
        displayDebug("Numéro de Trõll non trouvé : abandon");
        return;
    }
    NUMERO_TROLL = numTroll;

    tr = document.getElementById("mh_objet_hidden_" + numTroll + "Parchemin");
    if (!tr) {
        displayDebug("Table des parchos non trouvée : abandon");
        return;
    }

    // Récupération de la ligne de titre des parchos
    // titreParchos.cells:
    // 0: [+] / [-]
    // 1: "Parchemin"
    // 2: nb parchos
    // 3: poids total
    titreParchos = document.evaluate(
        "./preceding-sibling::tr[1]//table//tr[1]",
        tr, null, 9, null
    ).singleNodeValue;
    titreParchos.cells[1].style.width = "100px";
    td = titreParchos.insertCell(2);
    btn = document.createElement("input");
    btn.type = "button";
    btn.className = "mh_form_submit";
    btn.value = "Lister les grattages";
    btn.onclick = ouvrirListe;
    td.appendChild(btn);
}


//---------------------- MAIN -----------------------//

if (STATIQUE) {
    document.addEventListener('DOMContentLoaded', () => {
        new OutilListerGrattage()
    });
}

// A ne pas utiliser...
if (window.location.pathname == urlOutilListerGrattage) {
    displayDebug("C'est parti !");
    new OutilListerGrattage();
}

// si un jour les données sont ailleurs, pour l'utiliser sans être connecté à MH...
// là deux domaines différents donc 2 local storages différents
if (window.location.pathname == urlAutreQueMountihall) {
    displayDebug("C'est parti sans chargement!");
    document.body.innerHTML = "";
    new OutilListerGrattage(document.body, PAS_DE_CHARGEMENT_MH);
}

if (window.location.pathname == "/mountyhall/MH_Play/Play_equipement.php") {
    traitementEquipement();
}
if (window.location.pathname == "/mountyhall/MH_Play/Play_equipement.php?as_curSect=equip") {
    traitementEquipement();
}

//--------------------- parchemins hardcodes --------------//

// 4 parchos
const SAUVEGARDE =
    `{"dateEnregistrement":"2019-06-29T23:21:49.552Z","criteresAffichage":{"aGratter":true,"mauvais":false,"termines":true,"pasToucher":false,"neutres":true},"parchemins":[{"id":"4986515","nom":"Traité de Clairvoyance","effetDeBaseTexte":"Vue : +4 | TOUR : -120 min","glyphesNumeros":["94488","87335","38177","16672","29969","57632","56613","16672","72997","72999"],"glyphesCoches":[0,0,0,0,0,0,0,0,0,0],"affiche":false,"qualite":2,"etat":1,"dateAjout":"2019-06-29T23:20:00.602Z"},{"id":"8505213","nom":"Rune des Cyclopes","effetDeBaseTexte":"ATT : +4 D3 | DEG : +4 | Vue : -4","glyphesNumeros":["95521","75049","90396","26924","26902","97553","46369","85285","9509","78100"],"glyphesCoches":[0,0,0,0,0,0,0,0,0,0],"affiche":false,"qualite":-1,"etat":1,"dateAjout":"2019-06-29T23:20:00.606Z"},{"id":"10769725","nom":"Yeu'Ki'Pic","effetDeBaseTexte":"Vue : -9 | Effet de Zone","glyphesNumeros":["61722","45336","61720","95501","85269","11529","26892","61720","88344","23833"],"glyphesCoches":[0,0,0,0,0,0,0,0,0,0],"affiche":true,"qualite":1,"etat":1,"dateAjout":"2019-06-29T23:20:00.607Z"},{"id":"10789472","nom":"Yeu'Ki'Pic","effetDeBaseTexte":"Vue : -9 | Effet de Zone","glyphesNumeros":["58649","99613","91417","62737","49416","71944","58649","3337","32033","60697"],"glyphesCoches":[0,0,0,0,0,0,0,0,0,0],"affiche":true,"qualite":0,"etat":1,"dateAjout":"2019-06-29T23:20:00.608Z"}],"index":["4986515","8505213","10769725","10789472"]}`


// ---------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------

// -------------------------------------- grattageAfficherComposants ------------------------------------

// ------------------------------------- utilitaire ---------------------------------
class Do {

    static elem(tag, options={}) {
        const el = document.createElement(tag);
        
        if ('id' in options) el.setAttribute('id', options.id);
        if ('html' in options) el.innerHTML = options.html;
        if ('text' in options) el.appendChild(document.createTextNode(options.text));
        if ('attributes' in options) for (const attr of options.attributes) el.setAttribute(attr[0], attr[1]);
        if ('events' in options) {
            for (const event of options.events) {
                const bindParams = [];
                const bindObject = (('bindObject' in event) ? event.bindObject : el);
                bindParams.push(bindObject);
                if ('params' in event) bindParams.push(...event.params);
                el.addEventListener(event.name, event.callback.bind(...bindParams));
            } 
        }
        if ('htmlClasses' in options) for (const className of options.htmlClasses) el.classList.add(className);
        if ('style' in options) el.setAttribute('style', options.style);
        if ('children' in options) for (const enfant of options.children) el.appendChild(enfant);
        if ('parent' in options) options.parent.appendChild(el);
        
        return el;
    }
}

// ----------------------------


function afficherDetailsCompo(numeroComposant) {
	fetch(window.location.origin + "/mountyhall/View/TresorHistory.php" + "?ai_IDTresor=" + numeroComposant)
    .then(response => response.text())
    .then(texte => { 
      const parser = new DOMParser();
      const reponseHtml = parser.parseFromString(texte, "text/html");
      const details = reponseHtml.querySelector('.mh_tdpage tbody').querySelectorAll('tr:nth-of-type(11) td:nth-of-type(2), tr:nth-of-type(12) td:nth-of-type(2)');
      const detailsHTML = "Etat : " + "<strong>" + details[0].innerHTML + "</strong>" + " - " + "Solidité : " + "<strong>" + details[1].innerHTML + "</strong>";
	  document.querySelector("#detailsCompo-" + numeroComposant).innerHTML = detailsHTML;
    });
}

function afficherComposants() {
  
  const divComposants = Do.elem('div');
  const composants = document.querySelector('[name=ai_IdCompo1]').querySelectorAll('option');
  for (let i = 1; i < composants.length; i++) {
    Do.elem('p', {text: composants[i].innerHTML,  
                  style: 'text-align: left', 
                  parent: divComposants,
                  children: [Do.elem('button', {
                                     text : "Afficher détails",  
                                     style: 'margin: 5px',
                                     events : [{name: 'click',
                                                callback: afficherDetailsCompo, 
                                                params: [composants[i].value]}
                                              ]
                             }),
                             Do.elem('span', {id: "detailsCompo-" + composants[i].value})
                             ]
                 });
  }
  
  const parent = document.getElementById('mhPlay');
  parent.insertBefore(divComposants , document.getElementById('footer1'));
}


// -------------- MAIN

if (window.location.pathname == "/mountyhall/MH_Play/Actions/Competences/Play_a_Competence26c.php") {
    afficherComposants();
}



// ---------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------

// -------------------------------------- grattageFD ------------------------------------




/**************************************************************************************************************************
*  Script : GrattageFD "Aide au Grattage dans MountyHall"                                                                 *
*  Compatibilité : encodage UTF-8 (Greasemonkey, Chrome)                                                                  *
*  Auteur : Vapulabehemot (82169)                                                                                         *
*  Contributeurs : - basé sur l'étude de El'Haine (91821)                                                                 *
*                    http://www.mountyhall.com/Forum/display_topic_threads.php?ForumID=17&TopicID=156343&PagePosition=1	  *	
*                  - intégration de l'algorithme de détermination des gribouillages de trollthar (85665)                  *
*                    http://www.mountyhall.com/Forum/display_topic_threads.php?ThreadID=2454151#2454151                   *
*  Historique : 1.1.2 (03/03/2019, Roule) Correction return en dehors d'une fonction					                  *
*				1.1.1 (18/04/2013) compatibilité avec les parchemins gribouillés "naturels"				                  *
*				1.1.0 (17/04/2013) reconnaissance des gribouillages totalement grattés									  * 
*				1.0.0 (13/04/2013) gestion du Grattage de parchemins pour modification de leurs effets					  * 
*				0.0.1 (06/04/2013)                                                                                        *
**************************************************************************************************************************/


// 
// @name GrattageFD
// @description Aide au Grattage dans MountyHall, version 1.1.2 du 12/03/2019, par Vapulabehemot (82169) + Roule
// @version 1.1.2
// @include */mountyhall/MH_Play/Actions/Competences/Play_a_Competence26b.php*
// @injectframes 1
// @namespace https://greasyfork.org/users/70018
// 


// *** CONSTANTES ***
var couleurBonus = '336633'; // vert '336633'
var couleurMalus = '990000'; // rouge '990000'
var couleurAutre= '000000'; // noir '000000'
var couleurSansEffet = '707070'; // gris '707070'


// *** Procédure principale exécutée sur la page de la compétence Grattage ***
if (window.self.location.toString().indexOf('Competences/Play_a_Competence26b.php') != -1) {
	bloc_main_grattage: try {
		// vérification du type de Grattage et décompte du nombre de gribouillages
		//'l_grib1' = Grattage d'un parchemin avec gribouillages alignés (dix gribouillages pour un parchemin, trois pour un parchemin gribouillé "naturel") 
		var l_grib1 = document.getElementsByClassName("l_grib1");
		if (l_grib1.length == 0) {
			break bloc_main_grattage;
		} 
				
		// récupération du formulaire
		var form = document.getElementsByName('ActionForm')[0];
		
		//récupération des numéros des gribouillages
		var gribouillages = new Array();
		var idGribouillages = new Array();
		var parchemin = '';
		for (var i=0;i<l_grib1.length;i++) {
			gribouillages[i] = form.childNodes[6].childNodes[1].childNodes[0].childNodes[i];
			// vérification de la présence des cases à cocher
			if (gribouillages[i].childNodes[0].type != "checkbox") {
				// gribouillage totalement Gratté non-sélectionnable : ajout d'une case à cocher invisible pour reproduire l'organisation des gribouillages[i]
				var unInput = document.createElement('input');
				unInput.type = "checkbox";
				unInput.value = 0;
				unInput.style.visibility = 'hidden';
				gribouillages[i].insertBefore(unInput, gribouillages[i].firstChild);
			}
			idGribouillages[i] = (gribouillages[i].childNodes[2].getAttribute('src')).replace('Play_a_Competence26_img.php?Code=', '');
			parchemin += idGribouillages[i] + ' ';
		}

		// analyse des gribouillages
		var resultatAnalyse = analyseGribouillages(parchemin.replace(/\s+$/g,''));
		var infoGribouillages = resultatAnalyse['infoGribouillages'];
		var effetGribouillages = resultatAnalyse['effetGribouillages'];
		var effetParchemin = '<br/>Effet Théorique du parchemin actuel = ' + resultatAnalyse['effetParchemin'];

		// génération de la fenêtre d'informations
		creerInfos();
		
		// ajout sur les gribouillages de la gestion d'affichage de la fenêtre d'informations 
		for (var i=0;i<l_grib1.length;i++) {
			gribouillages[i].childNodes[2].id = i;
			gribouillages[i].childNodes[2].addEventListener('mouseover', afficheInfos, true);
			gribouillages[i].childNodes[2].addEventListener('mouseout', cacheInfos, true);
		}

		// ajout sur les gribouillages de la gestion des cases à cocher
		for (var i=0;i<l_grib1.length;i++) {
			gribouillages[i].childNodes[0].addEventListener('click', cliqueGribouillage, true);
		}
		
		// ajout des zones d'affichage des effets sous les gribouillages 
		for (var i=0;i<l_grib1.length;i++) {
			var uneDiv = document.createElement('div');
			uneDiv.title = 'Effet du gribouillage';
			uneDiv.innerHTML = effetGribouillages[i];
			gribouillages[i].appendChild(uneDiv);
		}

		// ajout de la zone d'affichage de l'effet total du parchemin avant et après Grattage
		var uneDiv = document.createElement('div');
		uneDiv.innerHTML = effetParchemin + '</br></br>&nbsp';
		form.insertBefore(uneDiv, form.childNodes[7]);
	}
	catch (e) {
		alert('Main() : ' + e.message);
	}
}


// *** Analyse la suite de numéros de gribouillages reçue en paramètre et retourne le résultat sous forme d'un tableau de tableaux ***
function analyseGribouillages(parchemin) {
	try {
		var infoGribouillages = new Array();
		var effetGribouillages = new Array();
		var effetParchemin = '';
		var resultatAnalyse = new Array();
		
		// ****************************************************************************************************************************	
		// *** algorithme de détermination des effets des Grattages des gribouillages par trollthar (85665) : version du 21/02/2013 ***
		// ****************************************************************************************************************************
		//  + traduction du python vers le javascript
		//  + tableau des caractéristiques
		//  + exclusion des gribouillages déjà grattés et totalement grattés
		//  + remplacement de la sortie console par des sauvegardes dans le tableau de résultat
		//  + remplacement de l'effet du Grattage du gribouillage par l'effet du gribouillage
		
		var numerosOriginaux = parchemin.split(' ');
		var numeros = parchemin.split(' ');

		// + tableau des caractéristiques, avec les noms/abréviations utilisés dans MountyHall et dans l'ordre des affichages dans MountyHall
		// ATT | ESQ | DEG | REG | Vue | PV | TOUR | Armure | Effet de Zone
		// plus Durée
		var caracteristiques = new Array();
		caracteristiques[0] = 'ATT : ';
		caracteristiques[1] = 'ESQ : ';
		caracteristiques[2] = 'DEG : ';
		caracteristiques[3] = 'REG : ';
		caracteristiques[4] = 'Vue : ';
		caracteristiques[5] = 'PV : ';
		caracteristiques[6] = 'TOUR : ';
		caracteristiques[7] = 'Armure : ';
		caracteristiques[8] = 'Effet de Zone : ';
		caracteristiques[9] = 'Durée : ';
		
		var effetDict = new Array();
		effetDict[1320] = [caracteristiques[0],caracteristiques[0]];
		effetDict[2344] = [caracteristiques[0],caracteristiques[1]];
		effetDict[3368] = [caracteristiques[0],caracteristiques[2]];
		effetDict[4392] = [caracteristiques[0],caracteristiques[7]];
		effetDict[5416] = [caracteristiques[0],caracteristiques[3]];
		effetDict[6440] = [caracteristiques[0],caracteristiques[4]];
		effetDict[7464] = [caracteristiques[0],caracteristiques[5]];
		effetDict[8488] = [caracteristiques[0],caracteristiques[6]];
		effetDict[9512] = [caracteristiques[0],caracteristiques[9]];
		effetDict[10536] = [caracteristiques[0],caracteristiques[8]];

		effetDict[11560] = [caracteristiques[1],caracteristiques[0]];
		effetDict[12584] = [caracteristiques[1],caracteristiques[1]];
		effetDict[13608] = [caracteristiques[1],caracteristiques[2]];
		effetDict[14632] = [caracteristiques[1],caracteristiques[7]];
		effetDict[15656] = [caracteristiques[1],caracteristiques[3]];
		effetDict[16680] = [caracteristiques[1],caracteristiques[4]];
		effetDict[17704] = [caracteristiques[1],caracteristiques[5]];
		effetDict[18728] = [caracteristiques[1],caracteristiques[6]];
		effetDict[19752] = [caracteristiques[1],caracteristiques[9]];
		effetDict[20776] = [caracteristiques[1],caracteristiques[8]];

		effetDict[21800] = [caracteristiques[2],caracteristiques[0]];
		effetDict[22824] = [caracteristiques[2],caracteristiques[1]];
		effetDict[23848] = [caracteristiques[2],caracteristiques[2]];
		effetDict[24872] = [caracteristiques[2],caracteristiques[7]];
		effetDict[25896] = [caracteristiques[2],caracteristiques[3]];
		effetDict[26920] = [caracteristiques[2],caracteristiques[4]];
		effetDict[27944] = [caracteristiques[2],caracteristiques[5]];
		effetDict[28968] = [caracteristiques[2],caracteristiques[6]];
		effetDict[29992] = [caracteristiques[2],caracteristiques[9]];
		effetDict[31016] = [caracteristiques[2],caracteristiques[8]];

		effetDict[32040] = [caracteristiques[7],caracteristiques[0]];
		effetDict[33064] = [caracteristiques[7],caracteristiques[1]];
		effetDict[34088] = [caracteristiques[7],caracteristiques[2]];
		effetDict[35112] = [caracteristiques[7],caracteristiques[7]];
		effetDict[36136] = [caracteristiques[7],caracteristiques[3]];
		effetDict[37160] = [caracteristiques[7],caracteristiques[4]];
		effetDict[38184] = [caracteristiques[7],caracteristiques[5]];
		effetDict[39208] = [caracteristiques[7],caracteristiques[6]];
		effetDict[40232] = [caracteristiques[7],caracteristiques[9]];
		effetDict[41256] = [caracteristiques[7],caracteristiques[8]];

		effetDict[42280] = [caracteristiques[3],caracteristiques[0]];
		effetDict[43304] = [caracteristiques[3],caracteristiques[1]];
		effetDict[44328] = [caracteristiques[3],caracteristiques[2]];
		effetDict[45352] = [caracteristiques[3],caracteristiques[7]];
		effetDict[46376] = [caracteristiques[3],caracteristiques[3]];
		effetDict[47400] = [caracteristiques[3],caracteristiques[4]];
		effetDict[48424] = [caracteristiques[3],caracteristiques[5]];
		effetDict[49448] = [caracteristiques[3],caracteristiques[6]];
		effetDict[50472] = [caracteristiques[3],caracteristiques[9]];
		effetDict[51496] = [caracteristiques[3],caracteristiques[8]];

		effetDict[52520] = [caracteristiques[4],caracteristiques[0]];
		effetDict[53544] = [caracteristiques[4],caracteristiques[1]];
		effetDict[54568] = [caracteristiques[4],caracteristiques[2]];
		effetDict[55592] = [caracteristiques[4],caracteristiques[7]];
		effetDict[56616] = [caracteristiques[4],caracteristiques[3]];
		effetDict[57640] = [caracteristiques[4],caracteristiques[4]];
		effetDict[58664] = [caracteristiques[4],caracteristiques[5]];
		effetDict[59688] = [caracteristiques[4],caracteristiques[6]];
		effetDict[60712] = [caracteristiques[4],caracteristiques[9]];
		effetDict[61736] = [caracteristiques[4],caracteristiques[8]];

		effetDict[62760] = [caracteristiques[5],caracteristiques[0]];
		effetDict[63784] = [caracteristiques[5],caracteristiques[1]];
		effetDict[64808] = [caracteristiques[5],caracteristiques[2]];
		effetDict[65832] = [caracteristiques[5],caracteristiques[7]];
		effetDict[66856] = [caracteristiques[5],caracteristiques[3]];
		effetDict[67880] = [caracteristiques[5],caracteristiques[4]];
		effetDict[68904] = [caracteristiques[5],caracteristiques[5]];
		effetDict[69928] = [caracteristiques[5],caracteristiques[6]];
		effetDict[70952] = [caracteristiques[5],caracteristiques[9]];
		effetDict[71976] = [caracteristiques[5],caracteristiques[8]];

		effetDict[73000] = [caracteristiques[6],caracteristiques[0]];
		effetDict[74024] = [caracteristiques[6],caracteristiques[1]];
		effetDict[75048] = [caracteristiques[6],caracteristiques[2]];
		effetDict[76072] = [caracteristiques[6],caracteristiques[7]];
		effetDict[77096] = [caracteristiques[6],caracteristiques[3]];
		effetDict[78120] = [caracteristiques[6],caracteristiques[4]];
		effetDict[79144] = [caracteristiques[6],caracteristiques[5]];
		effetDict[80168] = [caracteristiques[6],caracteristiques[6]];
		effetDict[81192] = [caracteristiques[6],caracteristiques[9]];
		effetDict[82216] = [caracteristiques[6],caracteristiques[8]];

		effetDict[83240] = [caracteristiques[9],caracteristiques[0]];
		effetDict[84264] = [caracteristiques[9],caracteristiques[1]];
		effetDict[85288] = [caracteristiques[9],caracteristiques[2]];
		effetDict[86312] = [caracteristiques[9],caracteristiques[7]];
		effetDict[87336] = [caracteristiques[9],caracteristiques[3]];
		effetDict[88360] = [caracteristiques[9],caracteristiques[4]];
		effetDict[89384] = [caracteristiques[9],caracteristiques[5]];
		effetDict[90408] = [caracteristiques[9],caracteristiques[6]];
		effetDict[91432] = [caracteristiques[9],caracteristiques[9]];
		effetDict[92456] = [caracteristiques[9],caracteristiques[8]];

		effetDict[93480] = [caracteristiques[8],caracteristiques[0]];
		effetDict[94504] = [caracteristiques[8],caracteristiques[1]];
		effetDict[95528] = [caracteristiques[8],caracteristiques[2]];
		effetDict[96552] = [caracteristiques[8],caracteristiques[7]];
		effetDict[97576] = [caracteristiques[8],caracteristiques[3]];
		effetDict[98600] = [caracteristiques[8],caracteristiques[4]];
		effetDict[99624] = [caracteristiques[8],caracteristiques[5]];
		effetDict[100648] = [caracteristiques[8],caracteristiques[6]];
		effetDict[101672] = [caracteristiques[8],caracteristiques[9]];
		effetDict[102696] = [caracteristiques[8],caracteristiques[8]];

		var uniteCarac = new Array();
		uniteCarac[caracteristiques[0]] = [1,' D3'];
		uniteCarac[caracteristiques[1]] = [1,' D3'];
		uniteCarac[caracteristiques[2]] = [1,''];
		uniteCarac[caracteristiques[7]] = [1,''];
		uniteCarac[caracteristiques[3]] = [1,''];
		uniteCarac[caracteristiques[4]] = [1,''];
		uniteCarac[caracteristiques[5]] = [1,' D3'];
		uniteCarac[caracteristiques[6]] = [-15,' min'];
		uniteCarac[caracteristiques[9]] = [1,' Tour'];
		uniteCarac[caracteristiques[8]] = [1,''];

		var effetTotal = new Array();
		effetTotal[caracteristiques[0]] = 0;
		effetTotal[caracteristiques[1]] = 0;
		effetTotal[caracteristiques[2]] = 0;
		effetTotal[caracteristiques[7]] = 0;
		effetTotal[caracteristiques[3]] = 0;
		effetTotal[caracteristiques[4]] = 0;
		effetTotal[caracteristiques[5]] = 0;
		effetTotal[caracteristiques[6]] = 0;
		effetTotal[caracteristiques[9]] = 0;
		effetTotal[caracteristiques[8]] = 0;

		var epaisseurDict = new Array();
		epaisseurDict[0] = 'Très gras';
		epaisseurDict[1] = 'Gras';
		epaisseurDict[2] = 'Moyen';
		epaisseurDict[3] = 'Fin';
		epaisseurDict[4] = 'Très fin (version 3)';
		epaisseurDict[5] = 'Très fin (version 2)';
		epaisseurDict[6] = 'Très fin (version 1)';

		var orientationDict = new Array();
		orientationDict[0] = 'Initiale';
		orientationDict[1] = 'Symétrie Horizontale';
		orientationDict[2] = 'Symétrie Verticale';
		orientationDict[3] = 'Symétrie Centrale';

		// Si le numéro est impair, on utilise le numéro pair le précédant
		for (var i=0;i<numeros.length;i++) {
			numeros[i] = parseInt(numeros[i]);
			if (numeros[i]%2==1){
				numeros[i] -=1;
			}
		}
			  
		var numeroDeb = 1288
		var intervalle = 1024

		// boucle sur les numéros donnés en entrée
		for (var i=0;i<numeros.length;i++) {

			var debFamille = parseInt((numeros[i]-numeroDeb)/intervalle)*intervalle+numeroDeb;
			var repereTableau = debFamille+32;
			var epaisseur = parseInt((numeros[i]-debFamille)/8);
			var orientation = (numeros[i]-debFamille)/2%4;
			
			// + exclusion des gribouillages déjà Grattés ou totalement Grattés
			if (numeros[i] < numeroDeb || effetDict[repereTableau] == null || epaisseurDict[epaisseur] == null){
				infoGribouillages[i] = '<center><b>Gribouillage ' + numerosOriginaux[i] + '</b></center>';
				if (gribouillages[i].childNodes[0].value == 0) {
					infoGribouillages[i] += '<hr/><i>Grattage impossible</i>';
					effetGribouillages[i] = ajouteMiseEnForme('Vierge') + '<br/>&nbsp;';
				}
				else {
					infoGribouillages[i] += '<hr/><i>Résultat du Grattage</i> :<br/>&nbsp;&nbsp;' + ajouteMiseEnForme('Aucun changement d\'effet');
					effetGribouillages[i] = ajouteMiseEnForme('Sans effet') + '<br/>&nbsp;';
				}
			}
			else {
			
				var carac1 = effetDict[repereTableau][0];
				var carac2 = effetDict[repereTableau][1];
						 
				// + remplacement de la sortie console par des sauvegardes dans infoGribouillages et effetGribouillages
				infoGribouillages[i] = '<center><b>Gribouillage ' + numerosOriginaux[i] + '</b></center>';
				infoGribouillages[i] += '<hr/>Epaisseur : ' + epaisseurDict[epaisseur];
				infoGribouillages[i] += '<br/>&nbsp;&nbsp;<b>&#8594;</b>&nbsp;Puissance : ' + Math.min(5, epaisseur+1);
				infoGribouillages[i] += '<br/>Orientation : ' + orientationDict[orientation];
				var bonusMalusDict = new Array();
				bonusMalusDict['Initiale'] = 'Malus | Bonus';
				bonusMalusDict['Symétrie Horizontale'] = 'Malus | Malus';
				bonusMalusDict['Symétrie Verticale'] = 'Bonus | Malus';
				bonusMalusDict['Symétrie Centrale'] = 'Bonus | Bonus';
				infoGribouillages[i] += '<br/>&nbsp;&nbsp;<b>&#8594;</b>&nbsp;' + bonusMalusDict[orientationDict[orientation]];
				
				//  + remplacement de l'effet du Grattage du gribouillage par l'effet du gribouillage et sauvegarde dans effetGribouillages
				effetGribouillages[i] = '';
			
				if (epaisseur == 0) {

					if (orientation == 0 || orientation == 1) {
						if (carac1 != carac2) {
							infoGribouillages[i] += '<br/>Caractéristique 1 : ' + carac1.substring(0, carac1.length - 3);
							infoGribouillages[i] += '<br/>Caractéristique 2 : Aucune';
							infoGribouillages[i] += '<hr/><i>Résultat du Grattage</i> :<br/>&nbsp;&nbsp;' + ajouteMiseEnForme(carac1 + (epaisseur+1)*uniteCarac[carac1][0] + uniteCarac[carac1][1]);
							effetGribouillages[i] += ajouteMiseEnForme(carac1 + (-1*(epaisseur+1)*uniteCarac[carac1][0]) + uniteCarac[carac1][1]) + '<br/>&nbsp;';
							effetTotal[carac1] += (epaisseur+1)*uniteCarac[carac1][0];
						}
						else {
							infoGribouillages[i] += '<br/>Caractéristique 1 : ' + carac1.substring(0, carac1.length - 3);
							infoGribouillages[i] += '<br/>Caractéristique 2 : ' + carac2.substring(0, carac2.length - 3);
							infoGribouillages[i] += '<br/>&nbsp;&nbsp;(deux caractéristiques identiques s\'annulent)';
							infoGribouillages[i] += '<hr/><i>Résultat du Grattage</i> :<br/>&nbsp;&nbsp;' + ajouteMiseEnForme('Aucun changement');
							effetGribouillages[i] += ajouteMiseEnForme('Sans effet') + '<br/>&nbsp;';
						}
					}
					else {
						if (carac1 != carac2) {
							infoGribouillages[i] += '<br/>Caractéristique 1 : ' + carac1.substring(0, carac1.length - 3);
							infoGribouillages[i] += '<br/>Caractéristique 2 : Aucune';
							infoGribouillages[i] += '<hr/><i>Résultat du Grattage</i> :<br/>&nbsp;&nbsp;' + ajouteMiseEnForme(carac1 + (-1*(epaisseur+1)*uniteCarac[carac1][0]) + uniteCarac[carac1][1]);
							effetGribouillages[i] += ajouteMiseEnForme(carac1 + (epaisseur+1)*uniteCarac[carac1][0] + uniteCarac[carac1][1]) + '<br/>&nbsp;';
							effetTotal[carac1] -= (epaisseur+1)*uniteCarac[carac1][0];
						}
						else {
							infoGribouillages[i] += '<br/>Caractéristique 1 : ' + carac1.substring(0, carac1.length - 3);
							infoGribouillages[i] += '<br/>Caractéristique 2 : ' + carac2.substring(0, carac2.length - 3);
							infoGribouillages[i] += '<br/>&nbsp;&nbsp;(deux caractéristiques identiques s\'annulent)';
							infoGribouillages[i] += '<hr/><i>Résultat du Grattage</i> :<br/>&nbsp;&nbsp;' + ajouteMiseEnForme('Aucun changement');
							effetGribouillages[i] += ajouteMiseEnForme('Sans effet') + '<br/>&nbsp;';
						}
					}
					
				}
				else {

					infoGribouillages[i] += '<br/>Caractéristique 1 : ' + carac1.substring(0, carac1.length - 3);
					infoGribouillages[i] += '<br/>Caractéristique 2 : ' + carac2.substring(0, carac2.length - 3);
				
					if (orientation == 0) {
						if (carac1 != carac2) {
							infoGribouillages[i] += '<hr/><i>Résultat du Grattage</i> :<br/>&nbsp;&nbsp;' + ajouteMiseEnForme(carac1 + (epaisseur+1)*uniteCarac[carac1][0] + uniteCarac[carac1][1]);
							infoGribouillages[i] += ' | ' + ajouteMiseEnForme(carac2 + (-1*epaisseur*uniteCarac[carac2][0]) + uniteCarac[carac2][1]);
							effetGribouillages[i] += ajouteMiseEnForme(carac1 + (-1*(epaisseur+1)*uniteCarac[carac1][0]) + uniteCarac[carac1][1]);
							effetGribouillages[i] += '<br/>' + ajouteMiseEnForme(carac2 + epaisseur*uniteCarac[carac2][0] + uniteCarac[carac2][1]);
							effetTotal[carac1] += (epaisseur+1)*uniteCarac[carac1][0];
							effetTotal[carac2] -= epaisseur*uniteCarac[carac2][0];
						}
						else {
							infoGribouillages[i] += '<br/>&nbsp;&nbsp;(deux caractéristiques identiques s\'annulent)';
							infoGribouillages[i] += '<hr/><i>Résultat du Grattage</i> :<br/>&nbsp;&nbsp;' + ajouteMiseEnForme('Aucun changement');
							effetGribouillages[i] += ajouteMiseEnForme('Sans effet') + '<br/>&nbsp;';
						}
					}
					
					if (orientation == 1) {
						if (carac1 != carac2) {
							infoGribouillages[i] += '<hr/><i>Résultat du Grattage</i> :<br/>&nbsp;&nbsp;' + ajouteMiseEnForme(carac1 + (epaisseur+1)*uniteCarac[carac1][0] + uniteCarac[carac1][1]);
							infoGribouillages[i] += ' | ' + ajouteMiseEnForme(carac2 + epaisseur*uniteCarac[carac2][0] + uniteCarac[carac2][1]);
							effetGribouillages[i] += ajouteMiseEnForme(carac1 + (-1*(epaisseur+1)*uniteCarac[carac1][0]) + uniteCarac[carac1][1]);
							effetGribouillages[i] += '<br/>' + ajouteMiseEnForme(carac2 + (-1*epaisseur*uniteCarac[carac2][0]) + uniteCarac[carac2][1]);
							effetTotal[carac1] += (epaisseur+1)*uniteCarac[carac1][0];
							effetTotal[carac2] += epaisseur*uniteCarac[carac2][0];
						}
						else {
							infoGribouillages[i] += '<br/>&nbsp;&nbsp;(deux caractéristiques identiques s\'annulent)';
							infoGribouillages[i] += '<hr/><i>Résultat du Grattage</i> :<br/>&nbsp;&nbsp;' + ajouteMiseEnForme('Aucun changement');
							effetGribouillages[i] += ajouteMiseEnForme('Sans effet') + '<br/>&nbsp;';
						}
					}

					if (orientation == 2) {
						if (carac1 != carac2) {
							infoGribouillages[i] += '<hr/><i>Résultat du Grattage</i> :<br/>\t' + ajouteMiseEnForme(carac1 + (-1*(epaisseur+1)*uniteCarac[carac1][0]) + uniteCarac[carac1][1]);
							infoGribouillages[i] += ' | ' + ajouteMiseEnForme(carac2 + epaisseur*uniteCarac[carac2][0] + uniteCarac[carac2][1]);
							effetGribouillages[i] += ajouteMiseEnForme(carac1 + (epaisseur+1)*uniteCarac[carac1][0] + uniteCarac[carac1][1]);
							effetGribouillages[i] += '<br/>' + ajouteMiseEnForme(carac2 + (-1*epaisseur*uniteCarac[carac2][0]) + uniteCarac[carac2][1]);
							effetTotal[carac1] -= (epaisseur+1)*uniteCarac[carac1][0];
							effetTotal[carac2] += epaisseur*uniteCarac[carac2][0];
						}
						else {
							infoGribouillages[i] += '<br/>&nbsp;&nbsp;(deux caractéristiques identiques s\'annulent)';
							infoGribouillages[i] += '<hr/><i>Résultat du Grattage</i> :<br/>&nbsp;&nbsp;' + ajouteMiseEnForme('Aucun changement');
							effetGribouillages[i] += ajouteMiseEnForme('Sans effet') + '<br/>&nbsp;';
						}
					}	

					if (orientation == 3) {
						if (carac1 != carac2) {
							infoGribouillages[i] += '<hr/><i>Résultat du Grattage</i> :<br/>\t' + ajouteMiseEnForme(carac1 + (-1*(epaisseur+1)*uniteCarac[carac1][0]) + uniteCarac[carac1][1]);
							infoGribouillages[i] += ' | ' + ajouteMiseEnForme(carac2 + (-1*epaisseur*uniteCarac[carac2][0]) + uniteCarac[carac2][1]);
							effetGribouillages[i] += ajouteMiseEnForme(carac1 + (epaisseur+1)*uniteCarac[carac1][0] + uniteCarac[carac1][1]);
							effetGribouillages[i] += '<br/>' + ajouteMiseEnForme(carac2 + epaisseur*uniteCarac[carac2][0] + uniteCarac[carac2][1]);
							effetTotal[carac1] -= (epaisseur+1)*uniteCarac[carac1][0];
							effetTotal[carac2] -= epaisseur*uniteCarac[carac2][0];
						}
						else {
							infoGribouillages[i] += '<br/>&nbsp;&nbsp;(deux caractéristiques identiques s\'annulent)';
							infoGribouillages[i] += '<hr/><i>Résultat du Grattage</i> :<br/>&nbsp;&nbsp;' + ajouteMiseEnForme('Aucun changement');
							effetGribouillages[i] += ajouteMiseEnForme('Sans effet') + '<br/>&nbsp;';
						}
					}
					
				}
				
			}
			
		}
		
		for (var i=0;i<caracteristiques.length;i++) {
			if (effetTotal[caracteristiques[i]] != 0 || caracteristiques[i] == caracteristiques[9]) {
				if (caracteristiques[i] == caracteristiques[8]) {
					if (effetTotal[caracteristiques[i]] < 0) {
						effetParchemin += ajouteMiseEnForme(caracteristiques[8]).replace(' : ','') + ' | ';
					}
				}
				else {
					effetParchemin += ajouteMiseEnForme(caracteristiques[i] + (-1*effetTotal[caracteristiques[i]]) + uniteCarac[caracteristiques[i]][1], 'effetTotal') + ' | ';	
				}
			}
		}
		effetParchemin = effetParchemin.substring(0, effetParchemin.length - 3);
		
		resultatAnalyse['infoGribouillages'] = infoGribouillages;
		resultatAnalyse['effetGribouillages'] = effetGribouillages;
		resultatAnalyse['effetParchemin'] = effetParchemin;
		return resultatAnalyse;
	}
	catch (e) {
		alert('analyseGribouillages() : ' + e.message);
	}
}


// *** Met en forme la chaîne de caractères passée en paramètre, en fonction de son contenu et du type de mise en forme passé en deuxième paramètre ***
function ajouteMiseEnForme(chaineATraiter, typeMiseEnForme) {
	try {
		// traitement des chaînes de caractères de type caractéristique
		if (chaineATraiter.indexOf(' : ') != -1) {
			// récupération de la caractéristique, de sa valeur et de l'unité 
			var caracteristique = chaineATraiter.substring(0, chaineATraiter.indexOf(' : ')+3);
			var autres = chaineATraiter.substring(chaineATraiter.indexOf(' : ')+3, chaineATraiter.length);
			var valeur = 0;
			var unite = '';
			if (autres.indexOf(' ') == -1) {
				valeur = autres.substring(0, autres.length);		
			}
			else {
				valeur = autres.substring(0, autres.indexOf(' ')+1);
				unite = autres.substring(autres.indexOf(' ')+1, autres.length)
			}
			
			// traitements de la chaîne de caractères en fonction de la caractéristique
			var chaineTraitee = '';
			// cas spécifique de la caractéristique 'Durée : '
			if (caracteristique == 'Durée : ') {
				if (valeur > 0) {
					chaineTraitee = '<b><font color = "' + couleurAutre + '">' + caracteristique;
					// pas de '+' devant le nombre de Tours dans l'effet total du parchemin
					if(typeMiseEnForme != 'effetTotal') {
						chaineTraitee += '+';
					}
					chaineTraitee += valeur + unite;
				}
				else {
					// pas de nombre de Tours négatif dans l'effet total du parchemin
					if(typeMiseEnForme == 'effetTotal') {
						chaineTraitee = '<b><font color = "' + couleurAutre + '">' + 'Durée : 0 Tour';
						valeur = 0;
					}
					else {
						chaineTraitee = '<b><font color = "' + couleurAutre + '">' + chaineATraiter;
					}
				}
				// gestion du singulier/pluriel
				if (valeur < -1 || valeur > 1) {
					chaineTraitee += 's</font></b>';
				}
				else {
					chaineTraitee += '</font></b>'
				}
			}
			// cas spécifique de la caractéristique 'Effet de Zone : '
			else if (caracteristique == 'Effet de Zone : ') {
				if (valeur > 0) {
					chaineTraitee = '<font color = "' + couleurAutre + '">' + caracteristique + '+' + valeur + unite + '</font>';
				}
				else {
					chaineTraitee = '<font color = "' + couleurAutre + '">' + chaineATraiter + '</font>';
				}
			}
			// cas spécifique de la caractéristique 'TOUR : '
			else if (caracteristique == 'TOUR : ') { 
				if (valeur > 0) {
					chaineTraitee = '<b><font color = "' + couleurMalus + '">' + caracteristique + '+' + valeur + unite + '</font></b>';
				}
				else {
					chaineTraitee = '<b><font color = "' + couleurBonus + '">' + caracteristique + valeur + unite + '</font></b>';
				}
			}
			// cas des autres caractéristiques
			else {
				if (valeur > 0) {
					chaineTraitee = '<b><font color = "' + couleurBonus + '">' + caracteristique + '+' + valeur + unite + '</font></b>';
				}
				else {
					chaineTraitee = '<b><font color = "' + couleurMalus + '">' + caracteristique + valeur + unite + '</font></b>';
				}
			}
			return chaineTraitee;
		}
		// traitement des chaînes de caractères autres que de type caractéristique
		else {
			return '<font color = "' + couleurSansEffet + '">' +chaineATraiter + '</font>';
		}
	}
	catch (e) {
		alert('ajouteMiseEnForme() : ' + e.message);
	}
}


// *** Gère la sélection de n'importe quel gribouillage ***
function cliqueGribouillage() {
	try {
		// si le gribouillage est sélectionné alors il est atténué
		if (this.checked) {
			this.parentNode.childNodes[2].style.opacity = 0.1;
			this.parentNode.childNodes[3].style.opacity = 0;
			this.parentNode.childNodes[3].title = '';
		}
		// si le gribouillage n'est pas sélectionné alors il est rétabli
		else {
			this.parentNode.childNodes[2].style.opacity = 1;
			this.parentNode.childNodes[3].style.opacity = 1;
			this.parentNode.childNodes[3].title = 'Effet du gribouillage';
		}
		
		// décompte du nombre de gribouillages sélectionnés
		var casesCochees = 0;
		var parcheminGratte = ''
		for (var i=0;i<l_grib1.length;i++) {
			casesCochees += gribouillages[i].childNodes[0].checked;
			if (gribouillages[i].childNodes[0].checked) {
				// inactivation du numéro du gribouillage sélectionné dans la suite de numéros définissant le parchemin
				parcheminGratte += '0 ';
			}	
			else {
				parcheminGratte += idGribouillages[i] + ' ';
			}
		}
		
		// si il y a au moins un gribouillage sélectionné alors le parchemin "virtuellement gratté" est analysé et le résultat est indiqué en dessous de l'effet actuel du parchemin
		if (casesCochees > 0) {
			form.childNodes[7].innerHTML = effetParchemin + '</br>Effet Théorique après Grattage = ' + analyseGribouillages(parcheminGratte.replace(/\s+$/g,''))['effetParchemin'] + '</br>&nbsp;';
		}
		else {
			form.childNodes[7].innerHTML = effetParchemin + '</br></br>&nbsp;';
		}
	}
	catch (e) {
		alert('cliqueGribouillage() : ' + e.message);
	}
}


// *** Création de la fenêtre d'informations, qui apparaîtra au survol d'un gribouillage ***
function creerInfos() {
	popup = document.createElement('div');
	popup.className = 'mh_tdpage';
	popup.setAttribute('style', 'position: absolute; border: 1px solid #000000; visibility: hidden; display: inline; z-index: 3; padding: 5px;');
	document.body.appendChild(popup);
}


// *** Renseigne le contenu de la fenêtre d'informations en fonction du gribouillage survolé et la rend visible ***
function afficheInfos(evt) {
	popup.innerHTML = infoGribouillages[this.getAttribute('id')];
	popup.style.left = Math.min(evt.pageX + 15, window.innerWidth - 400) + 'px';
	popup.style.top = evt.pageY + 15 + 'px';
	popup.style.visibility = 'visible';
}


// *** Rend invisible la fenêtre d'informations ***
function cacheInfos() {
	popup.style.visibility = 'hidden';
}



