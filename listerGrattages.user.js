// ==UserScript==
// @name listeGrattages
// @namespace Violentmonkey Scripts
// @include */mountyhall/MH_Play/Actions/Competences/userscriptGrattage
// @include */mountyhall/MH_Play/Play_equipement.php*
// @grant none
// @version 1.6
// ==/UserScript==
//

/* Utilisation :
 * 1) Installez ce script dans Violent Monkey
 * 2) Connectez-vous à MH avec 2 PAs restants (session active)
 * 3) Ayez sur votre trõll les parchemins à analyser
 * 4a) pour lancer l'outil, cliquer sur le bouton à côté des parchemins dans la page equipement
 * 4b) ou alors rendez-vous à l'adresse : https://games.mountyhall.com/mountyhall/MH_Play/Actions/Competences/userscriptGrattage
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

// affichage bonus malus
const COULEUR_BONUS = '#336633'; // vert '336633'
const COULEUR_MALUS = '#990000'; // rouge '990000'
const COULEUR_AUTRE = '#000000'; // noir '000000'
//const COULEUR_SANS_EFFET = '#707070'; // gris '707070'

const AU_MOINS = 1;
const AU_PLUS = -1;


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

const QUALITE_BON = 1;
const QUALITE_NEUTRE = 0;
const QUALITE_MAUVAIS = -1;
const QUALITE_TERMINE = 9;
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
            attributs: [['title', 'Définir ce parchemin comme "bon".\nL\'objectif est de marquer les marchemins estimés bons à gratter, pour pouvoir facilement produire la liste des détails des parchemins à gratter.']],
            enfants: [document.createTextNode('V')],
            events: [{nom: 'click', fonction: this.changerQualite, bindElement: this, param: [QUALITE_BON, true]}],
            classesHtml: ['mh_form_submit'],
            style: "background-color: #c9d8c5; margin: 5px", // vert #c9d8c5 // bleu  #a8b6bf // orange #edd9c0
        });

        this.boutonCacher = Createur.elem('button', {
            id: this.id + '-boutonCacher',
            attributs: [['title', 'Cacher ce parchemin temporairement.\nL\'objectif est de retirer temporairement des parchemins de la liste. Ils redeviendront visibles lors d\'un tri/filtre ou en cliquant sur le bouton servant à les faire réapparaitre.']],
            enfants: [document.createTextNode('_')],
            events: [{nom: 'click', fonction: this.cacherParchemin, bindElement: this}],
            classesHtml: ['mh_form_submit'],
            style: "background-color: #a8b6bf; margin: 5px", // bleu
        });

        this.boutonMauvais = Createur.elem('button', {
            id: this.id + '-boutonMauvais',
            attributs: [['title', 'Définir ce parchemin comme "mauvais"\nL\'objectif est de ne plus voir les parchemins impropres au grattage et à l\'utilisation et de pouvoir ensuite les lister facilement (pour savoir lesquels utiliser pour construire des golems de papier ou pour goinfrre par exemple).']],
            enfants: [document.createTextNode('X')],
            events: [{nom: 'click', fonction: this.changerQualite, bindElement: this, param: [QUALITE_MAUVAIS, true]}],
            classesHtml: ['mh_form_submit'],
            style: "background-color: #edd9c0; margin: 5px", // orange
        });

        this.boutonTermine = Createur.elem('button', {
            id: this.id + '-boutonTermine',
            attributs: [['title', "Définir ce parchemin comme \"terminé\".\nL'objectif est de ne plus voir les parchemins avec lesquels on ne désire plus travailler: déjà gratté, bien en l'état, etc..."]],
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

        if (nouvelleQualite === QUALITE_BON) {
            if (this.qualite == QUALITE_BON) {
                if (inversion) this.devenirNeutre();
            }
            else {
                this.devenirBon();
            }
        }
        else if (nouvelleQualite === QUALITE_MAUVAIS) { // QUALITE_MAUVAIS
            if (this.qualite == QUALITE_MAUVAIS) {
                if (inversion) this.devenirNeutre();
            }
            else {
                this.devenirMauvais();
            }
        }
        else if (nouvelleQualite === QUALITE_TERMINE) { // QUALITE_MAUVAIS
            if (this.qualite == QUALITE_TERMINE) {
                if (inversion) this.devenirNeutre();
            }
            else {
                this.devenirTermine();
            }
        }
        else {
            console.log("Changement de marqueur inaproprié reçu pour le parchemin.");
        }
    }


    // TODO mettre un background transparent vert pour les bons et rouges pour les mauvais
    // TODO ligneDetail, ligneEffettotal, Ligne separation....
    // TODO faire fonction générique pour devenirXXX
    devenirBon() {
        this.qualite = QUALITE_BON;
        this.ligneEffetsGlyphes.style.backgroundColor = "#c9d8c533";// TODO mettre en constantes vert #c9d8c5 // bleu  #a8b6bf // orange #edd9c0
        this.ligneEffetTotal.style.backgroundColor = "#c9d8c533";
        this.boutonBon.style.display = 'inline-block';
        this.boutonCacher.style.display = 'none';
        this.boutonMauvais.style.display = 'none';
        this.boutonTermine.style.display = 'none';
        if (document.getElementById('affichagesBonsCheckbox').checked) {  // moche de passer par là... et comme ça...
            this.afficherParchemin();
        }
        else {
            this.cacherParchemin();
        }
    }

    devenirNeutre() {
        this.qualite = QUALITE_NEUTRE;
        this.ligneEffetsGlyphes.style.backgroundColor = "#11111100";
        this.ligneEffetTotal.style.backgroundColor = "#11111100";
        this.boutonBon.style.display = 'inline-block';
        this.boutonCacher.style.display = 'inline-block';
        this.boutonMauvais.style.display = 'inline-block';
        this.boutonTermine.style.display = 'inline-block';
        if (this.affiche) {
            this.afficherParchemin();
        }
        else {
            this.cacherParchemin();
        }
    }

    devenirMauvais() {
        this.qualite = QUALITE_MAUVAIS;
        this.ligneEffetsGlyphes.style.backgroundColor = "#edd9c033";
        this.ligneEffetTotal.style.backgroundColor = "#edd9c033";
        this.boutonBon.style.display = 'none';
        this.boutonCacher.style.display = 'none';
        this.boutonMauvais.style.display = 'inline-block';
        this.boutonTermine.style.display = 'none';
        if (document.getElementById('affichagesMauvaisCheckbox').checked) {
            this.afficherParchemin();
        }
        else {
            this.cacherParchemin();
        }
    }

    devenirTermine() {
        this.qualite = QUALITE_TERMINE;
        this.ligneEffetsGlyphes.style.backgroundColor = "#ffee9022"; // gold
        this.ligneEffetTotal.style.backgroundColor = "#ffee9022";
        this.boutonBon.style.display = 'none';
        this.boutonCacher.style.display = 'none';
        this.boutonMauvais.style.display = 'none';
        this.boutonTermine.style.display = 'inline-block';
        if (document.getElementById('affichagesTerminesCheckbox').checked) {
            this.afficherParchemin();
        }
        else {
            this.cacherParchemin();
        }
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
    Etes-vous bien connecté à MH ? Disposez-vous de 2PA ? Connaissez-vous la compétence Gratter ?`);
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
    constructor(parent) {
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

        this.parcheminsEnCoursDAjout = {};
        this.indexEnCoursDAjout = [];

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
        }

        displayDebug(" DEBUT parcheminsRecus");
        displayDebug(parcheminsRecus.slice());
        displayDebug(" DEBUT this.parchemins");
        displayDebug(JSON.parse(JSON.stringify(this.parchemins)));

        // REMARQUE !!! On supprime les parchemins que l'on connait déjà pour faire moins d'appels.
        const parcheminsATraiter = [];
        for (const p of parcheminsRecus) {
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

        displayDebug(" APRES FILTRE parcheminsATraiter");
        displayDebug(parcheminsATraiter.slice());

        if (nombreObtenu !== 0 && parcheminsATraiter.length == 0) {
            alert(`Aucun nouveau parchemin trouvé.\nEn avez-vous de nouveaux dans votre inventaire ?`);
        }

        for (const p of parcheminsATraiter) {

            if (p.id in this.parchemins) {
                this.parchemins[p.id].cacherParchemin();  // cacher precedent qu'il existe et soit affiché ou pas
                delete this.parchemins[p.id]; // au cas où ?
            }

            this.parcheminsEnCoursDAjout[p.id] = new ParcheminEnPage(p.id, p.nom);
            const position = this.indexEnCoursDAjout.indexOf(p.id);
            if (position !== -1) {
                this.indexindexEnCoursDAjout.splice(position, 1);
            }
            this.indexEnCoursDAjout.push(p.id);
        }
        ;
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

    reinitialiserChoix(affiche, cochages) {
        for (const id in this.parchemins) {
            if (affiche) this.parchemins[id].affiche = true;
            if (cochages) {
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
                p.devenirBon();                  // en fait un peu trop, mais ça passe, faudrait scinder fonctions
            }
            else if (p.qualite == QUALITE_MAUVAIS) {
                p.devenirMauvais();
            }
            else if (p.qualite == QUALITE_TERMINE) {
                p.devenirTermine();
            }
            else if (p.affiche) {
                p.devenirNeutre();
            }
        }
    }

    afficherParcheminsFiltres() {
        displayDebug("afficherParcheminsFiltres");
        // choix de reinitialiser pour pouvoir cocher les options les plus puissantes et voir rapidement l'interet
        // laisser les cochages de l'utilisateur aussi peut être inétressant (et demander moins de progra. ;) ), j'ai fait comme je préfère
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
                if (p.calculerValeurMax(ZONE, false) <= 0) garde = false; // pourrait mettre à true si on veut coher pour un max effet de zone
            }

            if (garde) {
                if (duree > 0) {
                    if (duree > p.calculerValeurMax(DUREE, false)) garde = false;
                }
            }

            if (garde) {
                if (type == AU_MOINS) {
                    if (carac == COMBINAISON) {
                        valeur = p.calculerTotalPuissances();
                    }
                    else if (carac == TOUTES) {
                        const caracMax = p.calculerCaracMax();
                        valeur = p.calculerValeurMax(caracMax, true);
                    }
                    else {
                        valeur = p.calculerValeurMax(carac, true);
                    }
                    if (valeur < puissance) garde = false;
                }
                else if (type == AU_PLUS) {
                    if (carac == COMBINAISON) {
                        valeur = p.calculerTotalPuissances();
                    }
                    else if (carac == TOUTES) {
                        const caracMin = p.calculerCaracMin();
                        valeur = p.calculerValeurMin(caracMin, true);
                    }
                    else {
                        valeur = p.calculerValeurMin(carac, true);
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
        for (const id of  idParcheminsASupprimer) {
            if (id in this.parchemins) this.parchemins[id].changerQualite(QUALITE_MAUVAIS);
        }
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
            const parcheminsIdMauvais = [];
            const parcheminsHtmlTermines = [];
            const parcheminsHtmlAutres = [];

            function preparerHtml(p) {
                const cochages = p.cochagesGlyphes;
                let cochagesTexte = "grattages : aucun";
                if (cochages.includes(1)) {
                    cochagesTexte = "<strong>grattages : " + cochages.map((x, i) => (Boolean(x) ? (i + 1) : '')).join(" ") + "</strong>";
                }
                return `<p><strong>${p.id}</strong> - ${p.nom} <em>${p.effetDeBaseTexte}</em> : ${cochagesTexte} => ${p.effetTotalHtml}</p>`;
            }

            for (const id of this.index) {
                if (this.parchemins[id].qualite === QUALITE_BON) {
                    parcheminsIdBons.push(id);
                    parcheminsHtmlBons.push(preparerHtml(this.parchemins[id]));
                }
                else if (this.parchemins[id].qualite === QUALITE_MAUVAIS) {
                    parcheminsIdMauvais.push(id);
                }
                else if (this.parchemins[id].qualite === QUALITE_TERMINE) {
                    //parcheminsIdTermines.push(id);  // utile ?
                    parcheminsHtmlTermines.push(preparerHtml(this.parchemins[id]));
                }
                else {
                    if (this.parchemins[id].affiche) {
                        parcheminsHtmlAutres.push(preparerHtml(this.parchemins[id]));
                    }
                }
            }

            let reponse = '<p><strong style="color:darkgreen">Parchemins \"bons\" :</strong> ' + (parcheminsIdBons.length ? parcheminsIdBons.join(', ') : 'aucun') + '</p>';
            reponse += '<p><strong style="color:orangered">Parchemins \"mauvais\" :</strong> ' + (parcheminsIdMauvais.length ? parcheminsIdMauvais.join(', ') : 'aucun') + '</p>';
            reponse += '<p><strong style="color:darkgreen">Détails parchemins \"bons\" :</strong> ' + (parcheminsHtmlBons.length ? parcheminsHtmlBons.join('') : 'aucun') + '</p>';
            reponse += '<p><strong style="color:gold">Détails parchemins \"terminés\" :</strong> ' + (parcheminsHtmlTermines.length ? parcheminsHtmlTermines.join('') : 'aucun') + '</p>';
            reponse += '<p><strong style="color:dimgrey">Détails autres parchemins visibles :</strong> ' + (parcheminsHtmlAutres.length ? parcheminsHtmlAutres.join('') : 'aucun') + '</p>';

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
        this._attacherBoutonsChargementHall();
        this._attacherInterfaceSupprimerParchemins();
        this._attacherInterfaceRecapituler();
        this._attacherInterfaceFiltrer();
        this._attacherCriteresAffichages()
        this._attacherTableParchemins();

        displayDebug("fin _preparerPageListe");
    }

    _attacherMessageIntro() {
        this.zone.innerHTML =
            '<p>Pour pouvoir charger de nouveaux parchemins, vous devez être <strong>connecté</strong> à Mountyhall, <strong>connaitre</strong> la compétence Grattage et disposer de <strong>au moins 2 PA</strong>. ' +
            'Ne prend pas en compte les parchemins "spéciaux" (mission, sortilège...)<br>' +
            'Survoler avec la souris : les noms des parchemins pour voir les effets initiaux, les glyphes pour voir les détails, les champs et boutons pour plus d\'infos.</p>';
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
            style: "margin: 10px 5pxpx 10px 5px",
            parent: divBoutonsChargement,
            events: [{nom: 'click', fonction: this.chargerLocalement, bindElement: this}],
            classesHtml: ['mh_form_submit'],
            attributs: [['title', `Charge les parchemins depuis la mémoire local de votre navigateur.
    Nécessite une sauvegarde au préalable.`]]
        });

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
            attributs: [['title', `Ajoute aux les parchemins en cours les parchemins fournis en format texte structuré.`]]
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

        this.zoneDateEnregistrement = Createur.elem('span', {style: "margin: 10px", parent: divBoutonsChargement});
    }


    _attacherBoutonsChargementHall() {
        const divBoutonsChargementHall = Createur.elem('div', {
            parent: this.zone,
            style: "margin:0vmin; padding:0.1vmin; border:solid 0px black"
        });

        this.boutonChargerListeParchemins = Createur.elem('button', {                        // boutonChargerDepuisHall
            texte: 'Débuter Grattage pour liste parchemins (Hall)',
            style: "margin: 10px 5px 10px 5px; background-color: #FF851B", //orange
            parent: divBoutonsChargementHall,
            events: [{nom: 'click', fonction: this.chargerListeParcheminsGrattablesDepuisHall, bindElement: this}],
            classesHtml: ['mh_form_submit'],
            attributs: [['title', `Cliquer sur ce bouton débute l'action grattage pour récupérer la liste des parchemins que vous pouvez gratter.
Le second bouton est ensuite préparé pour pouvoir aller chercher les glyphes des parchemins, un à un.`]]
        });

        this.boutonChargerGlyphes = Createur.elem('button', {
            texte: 'Débuter Grattage pour glyphes (Hall) du parchemin :',
            style: "margin: 10px 5px 10px 5px; background-color: #FF851B", //orange
            parent: divBoutonsChargementHall,
            events: [{nom: 'click', fonction: this.chargerParcheminDepuisHall, bindElement: this}],
            classesHtml: ['mh_form_submit'],
            attributs: [['title', `Cliquer sur ce bouton démarre la compétence Gratter pour aller chercher les glyphes du parchemin 
dont l'id se trouve dans le champ ci-contre, pour ensuite l'afficher dans la page.
Vous devez au préalable charger la liste des parchemins à gratter via le bouton précédent.
Après la recherche des glyphes d'un parchemin, le champ est mis à jour automatiquement avec le numéro du prochain parchemin de la liste.`]]
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
            texte: 'Définir parchemins "mauvais"',
            style: "margin: 10px",
            parent: divParcheminsASupprimer,
            events: [{nom: 'click', fonction: this.nettoyerParchemins, bindElement: this}],
            classesHtml: ['mh_form_submit']
        });

        Createur.elem('input', {              // si besoin de nom : const inputParcheminsASupprimer =
            id: 'parcheminsASupprimer',
            attributs: [['type', 'text'], ['size', '100'], ['placeholder', 'Introduire dans ce champ les numéros des parchemins considérés comme "mauvais", séparés par des virgules']],
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
    L'outil va également cocher les glyphes pour obtenir l'effet le plus puissant recherché.

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
            `<label style="margin:5px 0 5px 20px; padding:3px" for="dureeRecherche">Durée minimum :</label>
                <input style="margin:5px 20px 5px 0; padding:3px; width: 4em" id="dureeRecherche" name="dureeRecherche" type="number" 
                min="0" max="45" step="1" value="0">`;

        html +=
            `<input style="margin:5px 0 5px 5px; padding:3px" id="effetZoneObligatoire" name="effetZoneObligatoire" type="checkbox">
                  <label style="margin:5px 5px 5px 0; padding:3px" for="effetZoneObligatoire">Effet de zone possible</label>`;

        html +=
            `<button style="margin:5px; padding:3px" class="mh_form_submit" id="boutonRecherche">Filtrer et Trier</button>`;

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

        // ---------- checkbox bons

        this.affichagesBonsCheckbox = Createur.elem('input', {
            id: "affichagesBonsCheckbox",
            parent: divCriteresAffichages,
            style: "margin:5px 0 5px 5px; padding:3px",
            attributs: [["type", "checkbox"], ["checked", true], ["name", "affichagesBonsCheckbox"]],
            events: [{nom: 'change', fonction: this.afficherSelonQualite, bindElement: this, param: [QUALITE_BON]}]
        });

        Createur.elem('label', {
            texte: "Afficher les \"bons\"",
            parent: divCriteresAffichages,
            style: "margin:5px 5px 5px 0; padding:3px",
            attributs: [["for", "affichagesBonsCheckbox"]]
        });
        this.affichagesBonsCheckbox.checked = true;


        // ---------- checkbox mauvais

        this.affichagesMauvaisCheckbox = Createur.elem('input', {
            id: "affichagesMauvaisCheckbox",
            parent: divCriteresAffichages,
            style: "margin:5px 0 5px 20px; padding:3px",
            attributs: [["type", "checkbox"], ["checked", "false"], ["name", "affichagesMauvaisCheckbox"]],
            events: [{nom: 'change', fonction: this.afficherSelonQualite, bindElement: this, param: [QUALITE_MAUVAIS]}]
        });
        this.affichagesMauvaisCheckbox.checked = false;

        Createur.elem('label', {
            texte: "Afficher les \"mauvais\"",
            parent: divCriteresAffichages,
            style: "margin:5px 5px 5px 0; padding:3px",
            attributs: [["for", "affichagesMauvaisCheckbox"]]
        });

        // ---------- checkbox terminé

        this.affichagesTerminesCheckbox = Createur.elem('input', {
            id: "affichagesTerminesCheckbox",
            parent: divCriteresAffichages,
            style: "margin:5px 0 5px 20px; padding:3px",
            attributs: [["type", "checkbox"], ["checked", "false"], ["name", "affichagesTerminesCheckbox"]],
            events: [{nom: 'change', fonction: this.afficherSelonQualite, bindElement: this, param: [QUALITE_TERMINE]}]
        });
        this.affichagesTerminesCheckbox.checked = true;

        Createur.elem('label', {
            texte: "Afficher les \"terminés\"",
            parent: divCriteresAffichages,
            style: "margin:5px 5px 5px 0; padding:3px",
            attributs: [["for", "affichagesTerminesCheckbox"]]
        });


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

    }

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
    afficherSelonQualite(qualiteConcernee) {
        let valeurCheckbox = true;
        if (qualiteConcernee === QUALITE_BON) valeurCheckbox = this.affichagesBonsCheckbox.checked;
        else if (qualiteConcernee === QUALITE_MAUVAIS) valeurCheckbox = this.affichagesMauvaisCheckbox.checked;
        else if (qualiteConcernee === QUALITE_TERMINE) valeurCheckbox = this.affichagesTerminesCheckbox.checked;

        for (const id in this.parchemins) {
            if (this.parchemins[id].qualite === qualiteConcernee) {
                if (valeurCheckbox) {
                    this.parchemins[id].afficherParchemin();
                }
                else {
                    this.parchemins[id].cacherParchemin();
                }
            }
        }
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
    // TODO ne plus enregistrer l'indexe, le recréer au chargement. A la limite en précisant le critère (pour lorsqque remplacement par exemple)
    exporterParchemins() {
        const sauvegarde = {     // Sauvegarde pourrait avoir sa classe
            parchemins: [],
            index: this.index,
            dateEnregistrement: new Date().toISOString()
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

        //this.construireIndex(); on garde l'ancien.
    }

    importerParcheminsEtAfficher(sauvegarde, critereCompleter) {
        this.importerParchemins(sauvegarde, critereCompleter);
        this.afficherParcheminsAdequats();
        this.viderTexteRecapitulatif();
        console.log("Parchemin plus ancien : " + this.recupererDateAjoutParcheminPlusAncien());
        console.log("Parchemin plus récent : " + this.recupererDateAjoutParcheminPlusRecent());
    }

    chargerLocalement() {
        if (window.localStorage.getItem('sauvegardeListerGrattages')) {
            const sauvegarde = JSON.parse(window.localStorage.getItem('sauvegardeListerGrattages'));
            this.importerParcheminsEtAfficher(sauvegarde);
        }
        else {
            alert('Aucune donnée trouvée localement.');
        }
    }

    supprimerTousLesParchemins() {
        if (confirm("Désirez-vous effacer les parchemins en cours ?")) {
            this.parchemins = {};
            this.index = [];
            this.incomplets = [];
            this.afficherParcheminsAdequats();
        }
    }

    sauvegarderLocalement() {
        const sauvegardeTexte = JSON.stringify(this.exporterParchemins());
        console.log(sauvegardeTexte); // normalement il y a l'export pour ça...
        window.localStorage.setItem('sauvegardeListerGrattages', sauvegardeTexte);
        alert("Etat sauvegardé.");
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

if (window.location.pathname == "/mountyhall/MH_Play/Play_equipement.php") {
    traitementEquipement();
}
if (window.location.pathname == "/mountyhall/MH_Play/Play_equipement.php?as_curSect=equip") {
    traitementEquipement();
}

//--------------------- parchemins hardcodes --------------//

// 4 parchos
const SAUVEGARDE =
    `{"parchemins":[{"id":"4986515","nom":"Traité de Clairvoyance","effetDeBaseTexte":"Vue : +4 | TOUR : -120 min","glyphesNumeros":["94488","87335","38177","16672","29969","57632","56613","16672","72997","72999"],"glyphesCoches":[0,0,0,0,0,0,0,0,0,0],"affiche":true,"qualite":0},{"id":"8505213","nom":"Rune des Cyclopes","effetDeBaseTexte":"ATT : +4 D3 | DEG : +4 | Vue : -4","glyphesNumeros":["95521","75049","90396","26924","26902","97553","46369","85285","9509","78100"],"glyphesCoches":[0,0,0,0,0,0,0,0,0,0],"affiche":true,"qualite":0},{"id":"10769725","nom":"Yeu'Ki'Pic","effetDeBaseTexte":"Vue : -9 | Effet de Zone","glyphesNumeros":["61722","45336","61720","95501","85269","11529","26892","61720","88344","23833"],"glyphesCoches":[0,0,0,0,0,0,0,0,0,0],"affiche":true,"qualite":0},{"id":"10789472","nom":"Yeu'Ki'Pic","effetDeBaseTexte":"Vue : -9 | Effet de Zone","glyphesNumeros":["58649","99613","91417","62737","49416","71944","58649","3337","32033","60697"],"glyphesCoches":[0,0,0,0,0,0,0,0,0,0],"affiche":true,"qualite":0}],` +
    `"index":["4986515","8505213","10769725","10789472"],` +
    `"dateEnregistrement":"14/06/2019 à 12:55:57"}`;

// 1 parchos
const SAUVEGARDE_1 =
    `{"parchemins":[{"id":"985004","nom":"Rune des Foins","effetDeBaseTexte":"DEG : -1 | Vue : -1 | PV : -2 D3","glyphesNumeros":["85261","75033","30984","102664","88332","65800","67848","53512","83213","11537"],"glyphesCoches":[0,0,0,0,0,0,0,0,0,0],"affiche":true,"qualite":0}],` +
    `"index":["985004"],` +
    `"dateEnregistrement":"14/06/2019 à 12:52:16"}`;


