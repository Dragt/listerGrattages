// ==UserScript==
// @name listerGrattages
// @namespace Violentmonkey Scripts
// @include */mountyhall/MH_Play/Actions/Competences/userscriptGrattage
// @include */mountyhall/MH_Play/Play_equipement.php
// @grant none
// @version 1.3
// ==/UserScript==
//

/* Utilisation :
 * 1) Installez ce script dans Violent Monkey
 * 2) Connectez-vous à MH avec 2 PAs restants (session active)
 * 3) Ayez sur votre trõll les parchemins à analyser
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
 * Possibilité d'enregistrer et charger localement, plus de chargement automatique depuis le hall
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

const MAX_APPELS = 200;  // nombre maximum -1 de parchemins traités en une fois par l'outil
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

const ATT   = 0;
const ESQ   = 1;
const DEG   = 2;
const REG   = 3;
const VUE   = 4;
const PV    = 5;
const TOUR  = 6;
const ARM   = 7;
const ZONE  = 8;
const DUREE = 9;
const TOUTES = 88;

const CARAC = [
    {
        id : 0,
        presentation : 'ATT',
        unite : [1,' D3']
    },
    {
        id : 1,
        presentation : 'ESQ',
        unite : [1,' D3']
    },
    {
        id : 2,
        presentation : 'DEG',
        unite : [1, '']
    },
    {
        id : 3,
        presentation : 'REG',
        unite : [1, '']
    },
    {
        id : 4,
        presentation : 'Vue',
        unite : [1, '']
    },
    {
        id : 5,
        presentation : 'PV',
        unite : [1, 'D3']
    },
    {
        id : 6,
        presentation : 'TOUR',
        unite : [-15, 'min']
    },
    {
        id : 7,
        presentation : 'Armure',
        unite : [1, '']
    },
    {
        id : 8,
        presentation : 'Effet de Zone',
        unite : [1, '']
    },
    {
        id : 9,
        presentation : 'Durée',
        unite : [1, 'Tour']
    }
];

//TODO : générer automatiquement
const CARACTERISTIQUES_GLYPHES = {

    '1320'  : [CARAC[ATT], CARAC[ATT]],
    '1344'  : [CARAC[ATT], CARAC[ESQ]],
    '3368'  : [CARAC[ATT], CARAC[DEG]],
    '4392'  : [CARAC[ATT], CARAC[ARM]],
    '5416'  : [CARAC[ATT], CARAC[REG]],
    '6440'  : [CARAC[ATT], CARAC[VUE]],
    '7464'  : [CARAC[ATT], CARAC[PV]],
    '8488'  : [CARAC[ATT], CARAC[TOUR]],
    '9512'  : [CARAC[ATT], CARAC[DUREE]],
    '10536' : [CARAC[ATT], CARAC[ZONE]],

    '11560' : [CARAC[ESQ], CARAC[ATT]],
    '12584' : [CARAC[ESQ], CARAC[ESQ]],
    '13608' : [CARAC[ESQ], CARAC[DEG]],
    '14632' : [CARAC[ESQ], CARAC[ARM]],
    '15656' : [CARAC[ESQ], CARAC[REG]],
    '16680' : [CARAC[ESQ], CARAC[VUE]],
    '17704' : [CARAC[ESQ], CARAC[PV]],
    '18728' : [CARAC[ESQ], CARAC[TOUR]],
    '19752' : [CARAC[ESQ], CARAC[DUREE]],
    '20776' : [CARAC[ESQ], CARAC[ZONE]],

    '21800' : [CARAC[DEG], CARAC[ATT]],
    '22824' : [CARAC[DEG], CARAC[ESQ]],
    '23848' : [CARAC[DEG], CARAC[DEG]],
    '24872' : [CARAC[DEG], CARAC[ARM]],
    '25896' : [CARAC[DEG], CARAC[REG]],
    '26920' : [CARAC[DEG], CARAC[VUE]],
    '27944' : [CARAC[DEG], CARAC[PV]],
    '28968' : [CARAC[DEG], CARAC[TOUR]],
    '29992' : [CARAC[DEG], CARAC[DUREE]],
    '31016' : [CARAC[DEG], CARAC[ZONE]],

    '32040' : [CARAC[ARM], CARAC[ATT]],
    '33064' : [CARAC[ARM], CARAC[ESQ]],
    '34088' : [CARAC[ARM], CARAC[DEG]],
    '35112' : [CARAC[ARM], CARAC[ARM]],
    '36136' : [CARAC[ARM], CARAC[REG]],
    '37160' : [CARAC[ARM], CARAC[VUE]],
    '38184' : [CARAC[ARM], CARAC[PV]],
    '39208' : [CARAC[ARM], CARAC[TOUR]],
    '40232' : [CARAC[ARM], CARAC[DUREE]],
    '41256' : [CARAC[ARM], CARAC[ZONE]],

    '42280' : [CARAC[REG], CARAC[ATT]],
    '43304' : [CARAC[REG], CARAC[ESQ]],
    '44328' : [CARAC[REG], CARAC[DEG]],
    '45352' : [CARAC[REG], CARAC[ARM]],
    '46376' : [CARAC[REG], CARAC[REG]],
    '47400' : [CARAC[REG], CARAC[VUE]],
    '48424' : [CARAC[REG], CARAC[PV]],
    '49448' : [CARAC[REG], CARAC[TOUR]],
    '50472' : [CARAC[REG], CARAC[DUREE]],
    '51496' : [CARAC[REG], CARAC[ZONE]],

    '52520' : [CARAC[VUE], CARAC[ATT]],
    '53544' : [CARAC[VUE], CARAC[ESQ]],
    '54568' : [CARAC[VUE], CARAC[DEG]],
    '55592' : [CARAC[VUE], CARAC[ARM]],
    '56616' : [CARAC[VUE], CARAC[REG]],
    '57640' : [CARAC[VUE], CARAC[VUE]],
    '58664' : [CARAC[VUE], CARAC[PV]],
    '59688' : [CARAC[VUE], CARAC[TOUR]],
    '60712' : [CARAC[VUE], CARAC[DUREE]],
    '61736' : [CARAC[VUE], CARAC[ZONE]],

    '62760' : [CARAC[PV], CARAC[ATT]],
    '63784' : [CARAC[PV], CARAC[ESQ]],
    '64808' : [CARAC[PV], CARAC[DEG]],
    '65832' : [CARAC[PV], CARAC[ARM]],
    '66856' : [CARAC[PV], CARAC[REG]],
    '67880' : [CARAC[PV], CARAC[VUE]],
    '68904' : [CARAC[PV], CARAC[PV]],
    '69928' : [CARAC[PV], CARAC[TOUR]],
    '70952' : [CARAC[PV], CARAC[DUREE]],
    '71976' : [CARAC[PV], CARAC[ZONE]],

    '73000' : [CARAC[TOUR], CARAC[ATT]],
    '74024' : [CARAC[TOUR], CARAC[ESQ]],
    '75048' : [CARAC[TOUR], CARAC[DEG]],
    '76072' : [CARAC[TOUR], CARAC[ARM]],
    '77096' : [CARAC[TOUR], CARAC[REG]],
    '78120' : [CARAC[TOUR], CARAC[VUE]],
    '79144' : [CARAC[TOUR], CARAC[PV]],
    '80168' : [CARAC[TOUR], CARAC[TOUR]],
    '81192' : [CARAC[TOUR], CARAC[DUREE]],
    '82216' : [CARAC[TOUR], CARAC[ZONE]],

    '83240' : [CARAC[DUREE], CARAC[ATT]],
    '84264' : [CARAC[DUREE], CARAC[ESQ]],
    '85288' : [CARAC[DUREE], CARAC[DEG]],
    '86312' : [CARAC[DUREE], CARAC[ARM]],
    '87336' : [CARAC[DUREE], CARAC[REG]],
    '88360' : [CARAC[DUREE], CARAC[VUE]],
    '89384' : [CARAC[DUREE], CARAC[PV]],
    '90408' : [CARAC[DUREE], CARAC[TOUR]],
    '91432' : [CARAC[DUREE], CARAC[DUREE]],
    '92456' : [CARAC[DUREE], CARAC[ZONE]],

    '93480' :  [CARAC[ZONE], CARAC[ATT]],
    '94504' :  [CARAC[ZONE], CARAC[ESQ]],
    '95528' :  [CARAC[ZONE], CARAC[DEG]],
    '96552' :  [CARAC[ZONE], CARAC[ARM]],
    '97576' :  [CARAC[ZONE], CARAC[REG]],
    '98600' :  [CARAC[ZONE], CARAC[VUE]],
    '99624' :  [CARAC[ZONE], CARAC[PV]],
    '100648' : [CARAC[ZONE], CARAC[TOUR]],
    '101672' : [CARAC[ZONE], CARAC[DUREE]],
    '102696' : [CARAC[ZONE], CARAC[ZONE]]
};


const FINESSES_GLYPHES = {
    0 : 'Très gras',
    1 : 'Gras',
    2 : 'Moyen',
    3 : 'Fin',
    4 : 'Très fin (version 3)',
    5 : 'Très fin (version 2)',
    6 : 'Très fin (version 1)',
};

// orientation
// const MOINS_PLUS = 0;
// const MOINS_MOINS = 1;
// const PLUS_MOINS = 2;
// const PLUS_PLUS = 3;

const ORIENTATIONS_GLYPHES = {
    0 : { nom : 'Initiale',             impact : [-1, +1], impactTexte : 'Malus | Bonus' },
    1 : { nom : 'Symétrie Horizontale', impact : [-1, -1], impactTexte : 'Malus | Malus' },
    2 : { nom : 'Symétrie Verticale',   impact : [+1, -1], impactTexte : 'Bonus | Malus' },
    3 : { nom : 'Symétrie Centrale',    impact : [+1, +1], impactTexte : 'Bonus | Bonus' }
};

//-------------------------------- Définition des classes --------------------------------//

// _ devant un fonction ou une variable : indiquer qu'ils sont conceptuellement plutôt privés
// assez moche et pas fort nécessaire ici... parfois pas toujours appliqué

//************************* Classe Createur *************************
// permet de raccourcir l'écriture de création d'éléments (même si moins performant, forcément)

class Createur {

    static elem(tag, param={}) {
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

/* Exemple :
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
    static get NOMBRE_GLYPHES() { return 10; }

    constructor(id, nom=undefined, effetDeBaseTexte=undefined, glyphes=[] ) {
        this.id = id;
        this.nom = nom;
        this.effetDeBaseTexte = effetDeBaseTexte;
        this.complet = false;                             // considéré complet lorsque 10 glyphes
        this.glyphes = [];
        for (const g of glyphes) this.ajouterGlyphe(g);   // array d'objets Glyphes
    }

    ajouterGlyphe(glyphe) {
        if (glyphe.traitable) {
            this.glyphes.push(glyphe);
            if (this.glyphes.length === (Parchemin.NOMBRE_GLYPHES)) {
                this.complet = true;
            }
        }
    }

    effetTotal(glyphesRetires=[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) {
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
// supprimerParchemin()
// rafraichirEffetTotal()
// static creerParchemin(enregistrement)

// Parchemin dans une page html pour l'outil, crée et connait les éléments html correspondant
class ParcheminEnPage extends Parchemin {

    static get W_COL1() { return "10vw"};

    constructor(id, nom, effetDeBaseTexte, glyphes, garde=true) {
        super(id, nom, effetDeBaseTexte, glyphes);
        this.ligneEffetsGlyphes;    // TODO pas top ce système en trois ligne, trimballé du passé, à refactorer en un element
        this.ligneEffetTotal;
        this.tdEffetTotal;
        this.ligneSeparation;
        this.potentiellementInteressant = garde; // pour l'afficher ou non dans l'outil
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
            if (i === DUREE || i == ZONE ) couleur = COULEUR_AUTRE;
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
        for(let i = 0; i < 10; i++) {
            if (i != ZONE) {
                valeursMax.push(this.calculerValeurMax(i, false));
            }
        }
        return valeursMax.indexOf(Math.max(...valeursMax));
    }

    calculerValeurMax(carac, cocher=false) {
        // d'abord fait en reducer mais pas aussi lisible...
        let max = 0;
        for (const g of this.glyphes) {
            if (!g.estSansEffet) {
                for (let i = 0; i < g.caracteristiques.length; i++) {
                    if (g.caracteristiques[i].id == carac) {
                        if (ORIENTATIONS_GLYPHES[g.orientation].impact[i] > 0) {
                            max += g.puissance - i;
                            break;                    // si le premier est de la carac, le second ne le sera pas...
                        }
                        if (ORIENTATIONS_GLYPHES[g.orientation].impact[i] < 0) {
                            if (cocher) g.cocher();            // la mise à jour du total se fait lros de l'affichage
                            break;
                        }
                    }
                }
            }
        }
        displayDebug('calculerValeurMin / parchemin : ' + this.id + " / carac : " + carac + " / valeur : " + max);
        return max;
    }

    calculerCaracMin() {
        const valeursMin = [];
        for(let i = 0; i < 10; i++) {
            if (i != ZONE) {
                valeursMin.push(this.calculerValeurMin(i, false));
            }
        }
        return valeursMin.indexOf(Math.min(...valeursMin));
    }

    calculerValeurMin(carac, cocher=false) {
        let min = 0;
        for (const [i, g] of Object.entries(this.glyphes)) {
            if (!g.estSansEffet) {
                for (let i = 0; i < g.caracteristiques.length; i++) {
                    if (g.caracteristiques[i].id == carac) {
                        if (ORIENTATIONS_GLYPHES[g.orientation].impact[i] < 0) {
                            min -= g.puissance + i;  // attention deuxième carac -1 en puissance
                        }
                        else if (ORIENTATIONS_GLYPHES[g.orientation].impact[i] > 0) {
                            if (cocher) g.cocher();
                        }
                    }
                }
            }
        }
        displayDebug('calculerValeurMin / parchemin : ' + this.id + " / carac : " + carac + " / valeur : " + min);
        return min;
    }

    creerLignes(parent, position) {
        this.ligneEffetsGlyphes = this._creerLigneEffetsGlyphes(parent, position);
        this.ligneEffetTotal = this._creerLigneEffetTotal(parent);
        this.ligneSeparation = this._creerLigneSeparation(parent);
    }

    _creerLigneEffetsGlyphes(parent, position) {
        const trEffetsGlyphes = Createur.elem('tr', { parent: parent });
        const boutonSupprimer = Createur.elem('button', {
            id: this.id + '-supprimer',
            attributs: [['title', 'Supprimer ce parchemin']],
            enfants: [document.createTextNode('X')],
            events: [{ nom: 'click', fonction: this.supprimerParchemin, bindElement: this }],
            classesHtml: ['mh_form_submit'] });

        Createur.elem('td', {                                     // si besoin de nom : const tdIdParchemin
            attributs: [['title', this.effetDeBaseTexte]],
            parent: trEffetsGlyphes,
            style: "width: " + ParcheminEnPage.W_COL1,
            enfants: [boutonSupprimer, document.createTextNode('[' +  (position + 1) + ']  ' + this.id)] });

        const tdEffetsGlyphes = Createur.elem('td', { parent: trEffetsGlyphes });
        const tableEffetsGlyphes = Createur.elem('table', { id: this.id, parent: tdEffetsGlyphes });
        const trcheckboxGlyphes = Createur.elem('tr', { parent: tableEffetsGlyphes });
        const trDetailsEffetsGlyphes = Createur.elem('tr', { parent: tableEffetsGlyphes });

        // bien mais plus lent ? :) for (const [i, glyphe] of parchemin.glyphes())
        for(let i = 0; i < this.glyphes.length; i++) {
            const thGlyphe = this.glyphes[i].creerThCheckboxGlyphe(this, i);
            trcheckboxGlyphes.append(thGlyphe);
            const tdGlyphe = this.glyphes[i].creerTdEffetGlyphe(this.id + '-glyphe-' + i);
            trDetailsEffetsGlyphes.append(tdGlyphe);
        }
        return trEffetsGlyphes;
    }

    _creerLigneEffetTotal(parent) {
        const trEffetTotal = Createur.elem('tr', { parent: parent });
        const tdNomParchemin = Createur.elem('td', {
            texte : this.nom,
            attributs: [['title', this.effetDeBaseTexte]],
            style: "width: " + ParcheminEnPage.W_COL1,
            parent: trEffetTotal });
        ParcheminEnPage._mettreEnFormeTd(tdNomParchemin);
        this.tdEffetTotal = Createur.elem('td', { id: this.id + "-effet", html: this.effetTotalHtml, parent: trEffetTotal });
        ParcheminEnPage._mettreEnFormeTd(this.tdEffetTotal);
        return trEffetTotal;
    }

    _creerLigneSeparation(parent) {                                   // potentiellement static ...
        const trSeparation = Createur.elem('tr', { parent: parent });
        const tdTirets = Createur.elem('td', {
            texte: '------------------',
            style: "width: " + ParcheminEnPage.W_COL1,
            parent : trSeparation });
        ParcheminEnPage._mettreEnFormeTd(tdTirets);
        return trSeparation;
    }

    static _mettreEnFormeTd(td) {
        td.style.padding = '15px'; // TODO trouver mieux et utiliser constantes
    }

    // this est le parchemin, même si appelé depuis le bouton
    supprimerParchemin() {
        this.ligneEffetsGlyphes.style.display = 'none';
        this.ligneEffetTotal.style.display = 'none';
        this.ligneSeparation.style.display = 'none';
        this.potentiellementInteressant = false;
    }

    rafraichirEffetTotal() {
        this.tdEffetTotal.innerHTML = this.effetTotalHtml;
    }

    static creerParchemin(enregistrement) {
        const nouveauxGlyphes = [];
        for (const [i, numero] of Object.entries(enregistrement.glyphesNumeros)) {
            nouveauxGlyphes.push(new GlypheEnPage(numero, enregistrement.glyphesCoches[i]));
        }
        return new ParcheminEnPage(enregistrement.id, enregistrement.nom, enregistrement.effetDeBaseTexte, nouveauxGlyphes, enregistrement.garde);
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

    static get NUMERO_DEBUT() { return 1288; }
    static get INTERVALLE() { return 1024; }

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

    static get W_EFF() { return "7vw"};

    constructor(numero, coche=false) { // td, parcheminEnPage
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
            attributs: [['title', this.detailsTexte]] });
        if (this.coche) this.cocher();
        return this.tdEffet;
    }

    creerThCheckboxGlyphe(parchemin, positionGlyphe) {
        let th = Createur.elem('th');
        this.checkbox = Createur.elem('input', {
            id: parchemin.id + '-checkbox-' + positionGlyphe,
            attributs: [['type', 'checkbox']],
            parent: th,
            events: [{ nom: 'change', fonction: this.traiterCheckboxGlyphe, bindElement: this, param: [parchemin]}] });
        let span = Createur.elem('span', { texte: ('glyphe ' + (positionGlyphe+1)), parent: th });
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
                if (id === DUREE || id == ZONE ) couleur = COULEUR_AUTRE;
                let html = `<span style="color:${couleur};font-weight:bold;white-space: nowrap">`;
                let s = (id === DUREE && ((this.effet[id] > 1) || (this.effet[id] < -1))) ? 's' : '';
                // vestige... gare au type de id tout de même... switch (Number(id)) {    case DUREE :

                html +=CARAC[id].presentation + " : " + (this.effet[id] > 0 ? '+' : '') + this.effet[id] + ' ' + CARAC[id].unite[1] +s;
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

    static get URL_GRATTAGE_1() { return "https://games.mountyhall.com/mountyhall/MH_Play/Actions/Play_a_Competence.php?ai_IdComp=26&ai_IDTarget="; }
    static get URL_GRATTAGE_2() { return "https://games.mountyhall.com/mountyhall/MH_Play/Actions/Competences/Play_a_Competence26b.php"; }

    constructor (demandeur) {
        this.demandeur = demandeur;
    }

    static appelerServiceHtml(appelant, type, url, callbackHtml, parametres=[], inputs=[]) {
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
        parcheminPourComposition.effetDeBaseTexte = reponseHtml.querySelectorAll('td')[2].innerHTML;
        for (const image of reponseHtml.querySelectorAll(".l_grib1")) {
            const glyphe = new Glyphe(image.src.split('Code=')[1]);
            parcheminPourComposition.ajouterGlyphe(glyphe);
        }
        this.demandeur.recevoirParcheminInfosComposition(parcheminPourComposition);
    }
}



//************************* Classe OutilListerGrattage *************************

// constructor(parent)
// chargerDepuisHall()
// recevoirParcheminsInfosBase(parcheminsRecus)
// _appelerRechercherGlyphes(position)
// recevoirParcheminInfosComposition(parcheminRecu)
// reinitialiserChoix(interessant, cochages)
// afficherTousParchemins()
// afficherParcheminsGardes()
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
        this.parchemins = [];
        this.incomplets = [];
        this.filtre = {};
        this.zoneDateEnregistrement;
        this.texteRecapitulatif;

        // idéalement une classe pour la gui, mais ici c'est encore restreint
        this.table;
        this._preparerPageListe();

        if (STATIQUE) {
            this.importerParchemins(JSON.parse(SAUVEGARDE));
            this.afficherParcheminsGardes();
        }
        else {
            this.chargerLocalement();
        }
    }

    chargerDepuisHall() {
        // à mettre après préparation pour pouvoir table déjà créée ?
        this.viderTableParchemins();
        this.viderTexteRecapitulatif();
        this.recuperateur = new Recuperateur(this);
        this.recuperateur.vaChercherParchemins();
        this.zoneDateEnregistrement.innerText = "Moment du chargement : " + new Date().toLocaleString();
    }

    // recoit les id/nom des parchemins du recuperateur (pourrait les recevoir un à un, intérêt ici ?)
    // ensuite enclenche les appels pour recuperer les glyphes
    recevoirParcheminsInfosBase(parcheminsRecus) {
        displayDebug("recevoirParcheminsInfosBase");
        displayDebug(parcheminsRecus);
        this.parchemins =  parcheminsRecus.map(p => new ParcheminEnPage(p.id, p.nom));
        // Attention requêtes pour les glyphes des différents parchemins les unes à la suite des autres, ne doivent pas se chevaucher
        compteurSecuriteNombreAppels = 0;
        this._appelerRechercherGlyphes(0);
    }

    _appelerRechercherGlyphes(position) {
        if (compteurSecuriteNombreAppels++ > MAX_APPELS) return; // empêcher un trop gros nombre d'appels au serveur
        if ((position < this.parchemins.length) ) this.recuperateur.vaChercherGlyphes(this.parchemins[position].id);
        else {
            displayDebug("fin _appelerRechercherGlyphes, nombre : " + this.parchemins.length);
            if (EXPORTER_PARCHEMINS) { // pour récupérer les parchemins et travailler en local
                console.log(JSON.stringify(this.exporterParchemins()));
            }
        }
    }

    // recoit les effets de base/Glyphes d'un parchemin du recuperateur
    // provoque l'affichage et fait l'appel pour le parchemin suivant
    recevoirParcheminInfosComposition(parcheminRecu) {
        displayDebug("recevoirParcheminInfosComposition : " + parcheminRecu.id);
        // TODO renvoyer des parchemins 'pas complètement remplis' aux recevoirxxx permettait d'utiliser une structure existante,
        // TODO mais un peu lourdingue de recréer les objets enPage (et recalculs pour glyphes surtout !...) et de devoir retrouver le parchemin correspondant équivalent
        // TODO Pptions : recevoirxxx avec juste les données nécessaires ? recoivent et complètent les vrais parchemins (solution initiale...)?
        // TODO Créent des xxxEnPage même si étrange ? Trouver comment caster efficacement du parent -> enfant en js ?

        const position = this.parchemins.findIndex(x => x.id === parcheminRecu.id);
        const parcheminEnPage = this.parchemins[position];
        parcheminEnPage.effetDeBaseTexte = parcheminRecu.effetDeBaseTexte;
        for (const glyphe of parcheminRecu.glyphes) {
            parcheminEnPage.ajouterGlyphe(new GlypheEnPage(glyphe.numero));
        }

        displayDebug('------------------------------------------------');
        displayDebug(parcheminEnPage);
        //displayDebug(JSON.stringify(parcheminEnPage));

        // si le parchemin n'est pas traitable/complet, on l'affiche quand même avec glyphes manquants [old : le retire directement]
        if (!parcheminEnPage.complet) {
            this.incomplets.push(parcheminEnPage.id + " " + parcheminEnPage.nom);
            displayDebug("parchemin incomplet : " + parcheminEnPage.id + " " + parcheminEnPage.nom);
            //this.parchemins.splice(position, 1);
            //this._appelerRechercherGlyphes(position) ;
        }
        //else {
        //    this._appelerRechercherGlyphes(position + 1) ;
        //    this._afficherParchemin(parcheminEnPage, position);
        //}

        this._appelerRechercherGlyphes(position + 1) ;
        this._afficherParchemin(parcheminEnPage, position);

        // après avoir reçu des glyphes d'un parchemin à traiter, on fait la requête pour le parchemin suivant
        // TODO A quel point plus lourd de retrouver l'indice ? convertir en dict pour parchemins... ?G?
        // TODO Ou garder simplement indice en mémoire ? D'autant plus que j'ai déjà le compteur de securite en globale ! :D

    }


    reinitialiserChoix(interessant, cochages) {
        for (const p of this.parchemins) {
            if (interessant) p.potentiellementInteressant = true;
            if (cochages) {
                for(const g of p.glyphes) {
                    g.decocher();
                }
            }
        }
    }

    // TODO fournir en parametres un index de l'ordre des parchemins pour l'utiliser de manière universelle, avec le tri aussi
    afficherTousParchemins() {
        this.viderTableParchemins();
        for (let i = 0; i < this.parchemins.length; i++) {
            this._afficherParchemin(this.parchemins[i], i);
        }
    }

    // TODO : un peu bizarre... le i affiche correspond au parchemin dans l'array ? Pour filtre pas comme ça je crois
    afficherParcheminsGardes() {
        this.viderTableParchemins();
        for (let i = 0; i < this.parchemins.length; i++) {
            if (this.parchemins[i].potentiellementInteressant) {
                this._afficherParchemin(this.parchemins[i], i);
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
        const zone = this.filtre.zone.checked;
        let parcheminsATrier = [];

        for(const p of this.parchemins) {
            let garde = true;
            let valeur;

            if (zone) {
                if (p.calculerValeurMax(ZONE, true) <= 0) garde = false;
            }

            if (garde) {
                if (type == AU_MOINS) {
                    if(carac == TOUTES) {
                        const caracMax = p.calculerCaracMax();
                        valeur = p.calculerValeurMax(caracMax, true);
                    }
                    else {
                        valeur = p.calculerValeurMax(carac, true);
                    }
                    if (valeur < puissance) garde = false;
                }
                else if (type == AU_PLUS) {
                    if(carac == TOUTES) {
                        const caracMin = p.calculerCaracMin();
                        valeur = p.calculerValeurMin(caracMin, true);
                    }
                    else {
                        valeur = p.calculerValeurMin(carac, true);
                    }
                    if (valeur > puissance) garde = false;
                }
            }
            p.potentiellementInteressant = garde;
            if (garde) parcheminsATrier.push([p, valeur]);
        }

        if (type == AU_MOINS) parcheminsATrier.sort((x, y) => (y[1] - x[1])); // TODO tri secondaire prédéfini, par exemple tours, dégats, ...
        else if (type == AU_PLUS) parcheminsATrier.sort((x, y) => (x[1] - y[1]));

        this.viderTableParchemins();
        for (let i = 0; i < parcheminsATrier.length; i++) {
            this._afficherParchemin(parcheminsATrier[i][0], i);
        }
    }

    // volontaire ici aussi d'appeler et d'afficher un à un petit à petit dans la dom,
    // plus lourd au total mais visuellement plus direct si beaucoup de parchemins.
    _afficherParchemin(parchemin, position) {
        parchemin.creerLignes(this.table, position);
    }

    nettoyerParchemins() {
        const parcheminsASupprimer = document.getElementById('parcheminsASupprimer').value.replace(/\s/g, "").split(','); //enlève les blancs et espaces
        for (const p of this.parchemins) {
            if (parcheminsASupprimer.includes(p.id)) p.supprimerParchemin();
        }
    }

    afficherRecapitulatif() {
        const htmlParcheminsModifies = [];
        const htmlParcheminsNonModifies = [];
        const parcheminsIdModifies = [];
        const parcheminsIdSupprimes = [];

        for (const p of this.parchemins) {
            if (!p.potentiellementInteressant) {
                parcheminsIdSupprimes.push(p.id);
            }
            else {
                const cochages = p.cochagesGlyphes;
                let cochagesTexte = "grattages : aucun";
                if (cochages.includes(1))  cochagesTexte = "<strong>grattages : " + cochages.map((x, i) => (Boolean(x) ? (i + 1) : '')).join(" ") + "</strong>";
                const html = `<p><strong>${p.id}</strong> - ${p.nom} <em>${p.effetDeBaseTexte}</em> : ${cochagesTexte} => ${p.effetTotalHtml}</p>`;

                if (cochages.includes(1)) {
                    htmlParcheminsModifies.push(html);
                    parcheminsIdModifies.push(p.id);
                }
                else htmlParcheminsNonModifies.push(html);
            }
        }

        let reponse = '<p><strong style="color:darkgreen">Parchemins gardés :</strong> ' + (parcheminsIdModifies.length ? parcheminsIdModifies.join(', ') : 'aucun') + '</p>';
        reponse += '<p><strong style="color:orangered">Parchemins rejetés :</strong> ' + (parcheminsIdSupprimes.length ? parcheminsIdSupprimes.join(', ') : 'aucun') + '</p>';
        reponse += '<p><strong style="color:darkgreen">Détails parchemins gardés :</strong> ' + (htmlParcheminsModifies.length ? htmlParcheminsModifies.join('') : 'aucun') + '</p>';
        reponse += '<p><strong style="color:dimgrey">Détails parchemins inchangés :</strong> ' + (htmlParcheminsNonModifies.length ? htmlParcheminsNonModifies.join('') : 'aucun') + '</p>';

        this.texteRecapitulatif.innerHTML = reponse;
    }


    // Prépare l'interface de l'outil
    _preparerPageListe() {
        displayDebug("_preparerPageListe");
        if (!this.parent) {
            this.parent = document.getElementsByTagName('body')[0];
            this.parent.innerHTML = "";
        }
        this.zone = Createur.elem('div', { id: "listerGrattages", style: "padding:20px", parent: this.parent });

        this._attacherMessageIntro();
        this._attacherBoutonsChargement();
        this._attacherInterfaceSupprimerParchemins();
        this._attacherInterfaceRecapituler();
        this._attacherInterfaceFiltrer();
        this._attacherTableParchemins();

        displayDebug("fin _preparerPageListe");
    }

    _attacherMessageIntro() {
        this.zone.innerHTML =
            '<p>Pour que l\'outil fonctionne, vous devez être <strong>connecté</strong> à Mountyhall et disposer de <strong>au moins 2 PA</strong>.<br>' +
            'Lors d\'un appel au Hall, pour chaque parchemin sur vous, vous ferez 2 appels au serveur mountyhall. Utilisez cet outil de manière responsable.<br>' +
            'Non testé avec des parchemins "spéciaux". (mission, sortilège...)<br>' +
            'Survolez avec la souris les noms des parchemins pour voir les effets initiaux. Survolez les glyphes pour voir les détails.</p>';
    }

    _attacherBoutonsChargement() {
        const divBoutonsChargement = Createur.elem('div', { parent: this.zone, style: "margin:0vmin; padding:0.1vmin; border:solid 0px black" });

        Createur.elem('button', {                       // boutonChargerLocalement
            texte : 'Charger le dernier état (local)',
            style: "margin: 10px",
            parent: divBoutonsChargement,
            events: [{nom: 'click', fonction: this.chargerLocalement, bindElement: this}],
            classesHtml: ['mh_form_submit'] });

        Createur.elem('button', {                        // boutonSauvegarderLocalement
            texte : 'Sauvegarder l\'état Actuel (local)',
            style: "margin: 10px",
            parent: divBoutonsChargement,
            events: [{nom: 'click', fonction: this.sauvegarderLocalement, bindElement: this}],
            classesHtml: ['mh_form_submit'] });

        Createur.elem('button', {                        // boutonSauvegarderLocalement
            texte : 'Charger depuis votre inventaire (Hall)',
            style: "margin: 10px",
            parent: divBoutonsChargement,
            events: [{nom: 'click', fonction: this.chargerDepuisHall, bindElement: this}],
            classesHtml: ['mh_form_submit'] });

        this.zoneDateEnregistrement = Createur.elem('span', { style: "margin: 10px", parent: divBoutonsChargement });
    }

    _attacherInterfaceSupprimerParchemins() {
        const divParcheminsASupprimer = Createur.elem('div', { parent: this.zone, style: "margin:1vmin; padding:1vmin; border:solid 1px black" });

        this.boutonSupprimerParchemins = Createur.elem('button', {             // moué, this un peu facile pour faire paser un truc...
            texte : 'Supprimer parchemins',
            style: "margin: 10px",
            parent: divParcheminsASupprimer,
            events: [{nom: 'click', fonction: this.nettoyerParchemins, bindElement: this}],
            classesHtml: ['mh_form_submit'] });

        Createur.elem('input', {              // si besoin de nom : const inputParcheminsASupprimer =
            id: 'parcheminsASupprimer',
            attributs: [['type', 'text'], ['size', '120'], ['placeholder', 'Introduire dans ce champ les numéros des parchemins à supprimer, séparés par des virgules']],
            parent: divParcheminsASupprimer });
    }

    _attacherInterfaceRecapituler() {
        const divBoutonRecapitulatif = Createur.elem('div', { parent: this.zone, style: "margin:1.5vmin; padding:1.5vmin; border:solid 1px black" });

        Createur.elem('button', {               // si besoin de nom : const boutonAfficherRecapitulatif =
            texte : 'Afficher Récapitulatif',
            style: "margin: 10px, width: " + window.getComputedStyle(this.boutonSupprimerParchemins).getPropertyValue("width"),
            parent: divBoutonRecapitulatif,
            events: [{nom: 'click', fonction: this.afficherRecapitulatif, bindElement: this}],
            classesHtml: ['mh_form_submit'] });

        this.texteRecapitulatif = Createur.elem('div', {                // si besoin de nom : const zoneRecapitulatif =
            id: 'recapitulatif',
            parent: divBoutonRecapitulatif });
    }

    viderTexteRecapitulatif() {
        this.texteRecapitulatif.innerHTML = "";
    }

    _attacherInterfaceFiltrer() {
        // idée au départ de pemettre de trier et filtrer sur chaque carac, avec min et max...
        // ... mais est-ce bine nécessaire ? (Aller jusqu'à deux ou 3 caracs en même temps ?)

        const divFiltrer = Createur.elem('div', { parent: this.zone, style: "margin:1vmin; padding:1vmin; border:solid 1px black" });

        let html =
            `<select style="margin:5px; padding:5px" id="typeRecherche" name="typeRecherche" title="la valeur indiquée sera comprise">
                <option value="${AU_MOINS}" selected>Plus grand que</option>
                <option value="${AU_PLUS}">Plus petit que</option>
            </select>`;

        html +=
            `<label style="margin:5px 0 5px 5px; padding:3px" for="puissanceRecherche">Puissance (-45 à 45) :</label>
            <input style="margin:5px 5px 5px 0; padding:3px" id="puissanceRecherche" name="puissanceRecherche" type="number" 
            min="-50" max="50" step="1" value="0">`;

        html += `<select style="margin:5px; padding:3px" id="caracRecherche" name="caracRecherche" >`;
        html += `<option value="${TOUTES}">Toutes caracs</option>`;
        let copie = [...CARAC];
        copie.splice(8,1);                          // sans efet de zone
        for (const c of copie) {
            html += `<option value="${c.id}">${c.presentation}</option>`;
        }
        html += "</select>";

        html +=
            `<input style="margin:5px 0 5px 5px; padding:3px" id="effetZoneObligatoire" name="effetZoneObligatoire" type="checkbox">
              <label style="margin:5px 5px 5px 0; padding:3px" for="effetZoneObligatoire">Effet de zone obligatoire</label>`

        html +=
            `<button style="margin:5px; padding:3px" class="mh_form_submit" id="boutonRecherche">Filtrer et Trier</button>`;

        divFiltrer.innerHTML = html;

        this.filtre.type = document.getElementById('typeRecherche');
        this.filtre.puissance = document.getElementById('puissanceRecherche');
        this.filtre.carac = document.getElementById('caracRecherche');
        this.filtre.zone = document.getElementById('effetZoneObligatoire');
        this.filtre.bouton = document.getElementById('boutonRecherche');
        this.filtre.bouton.addEventListener('click', this.afficherParcheminsFiltres.bind(this));

        // reste événements à gérer
    }

    _attacherTableParchemins() {
        this.table = Createur.elem('table', { id: "DragttageTable", parent: this.zone,
            style: "margin:1vmin; padding:1vmin; border:solid 1px black"});
    }

    viderTableParchemins() {
        this.table.innerHTML = "";
    }


    exporterParchemins() {
        const dateEnregistrement = new Date().toLocaleString();
        const sauvegarde = [];
        for (const p of this.parchemins) {
            let enregistrement = {
                id: p.id,
                nom: p.nom,
                effetDeBaseTexte: p.effetDeBaseTexte,
                glyphesNumeros: [],
                glyphesCoches: [],
                garde: p.potentiellementInteressant,
                dateEnregistrement: dateEnregistrement
            };
            for(const g of p.glyphes) {
                enregistrement.glyphesNumeros.push(g.numero);
                enregistrement.glyphesCoches.push(Number(g.coche));
            }
            sauvegarde.push(enregistrement);
        }
        return sauvegarde;
    }

    importerParchemins(sauvegarde) {
        this.parchemins = [];
        for (const enregistrement of sauvegarde) {
            this.parchemins.push(ParcheminEnPage.creerParchemin(enregistrement));
        }
    }

    chargerLocalement() {
        if (window.localStorage.getItem('sauvegardeListerGrattages')) {
            const sauvegarde = JSON.parse(window.localStorage.getItem('sauvegardeListerGrattages'));
            if (sauvegarde[0]) this.zoneDateEnregistrement.innerText = "Date de la sauvegarde : " + sauvegarde[0].dateEnregistrement;
            this.importerParchemins(sauvegarde);
            this.afficherParcheminsGardes();
            this.viderTexteRecapitulatif();
        }
        else {
            alert('Aucune donnée trouvée localement.');
        }
    }

    // TODO ne sauvegarde pas l'ordre des parchemins... faudrait y réfléhir, serait facile de trier la liste d'origine...
    sauvegarderLocalement() {
        const sauvegardeTexte = JSON.stringify(this.exporterParchemins());
        console.log(sauvegardeTexte);
        window.localStorage.setItem('sauvegardeListerGrattages', sauvegardeTexte);
        alert ('Etat sauvegardé. (A priori.)');
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
    } catch(e) {
        displayDebug(e);
        return false;
    }

    if(liens.length>0 && liens[0].onclick!==void(0)) {
        str = liens[0].onclick.toString();
        numTroll = parseInt(/\d+/.exec(str)[0]);
        displayDebug("numTroll = "+numTroll);
    }
    return numTroll;
}

function ouvrirListe() {
// Ouvre la page de listing
    // Ouvrir dans un nouvel onglet:
    //window.open("/mountyhall/Dragttage");
    // Ouvrir dans la frame de contenu:
    window.location.assign(urlOutilListerGrattage);
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
    tr = document.getElementById("mh_objet_hidden_"+numTroll+"Parchemin");
    if(!tr) {
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
    document.addEventListener('DOMContentLoaded', () => {new OutilListerGrattage()});
}

if (window.location.pathname == urlOutilListerGrattage) {
    displayDebug("C'est parti !");
    new OutilListerGrattage();
}

if (window.location.pathname == "/mountyhall/MH_Play/Play_equipement.php") {
    traitementEquipement();
}

//--------------------- parchemins hardcodes --------------//

const SAUVEGARDE =
    `[{"id":"7083001","nom":"Rune Explosive Gribouillé","effetDeBaseTexte":"DEG : +4 | REG : -4 | Vue : -5 | PV : -2 D3 | TOUR : -15 min | Effet de Zone","glyphesNumeros":["102664","101645","50449","49424","54569","71944","70921"],"glyphesCoches":[true,true,true,false,false,false,false],"garde":true},` +
    `{"id":"7190229","nom":"Traité de Clairvoyance","effetDeBaseTexte":"Vue : +5 | TOUR : -150 min","glyphesNumeros":["48393","99601","35112","45328","11529","76078","47384","55596","81199","24864"],"glyphesCoches":[false,false,false,false,false,false,false,false,false,false],"garde":false},` +
    `{"id":"8781310","nom":"Rune des Foins Gribouillé","effetDeBaseTexte":"DEG : +4 | Vue : -1 | PV : -12 D3 | Armure : +4","glyphesNumeros":["64809","62729","84236","86284","58633","62729","46345","65832","84236"],"glyphesCoches":[false,false,false,false,false,false,false,false,false],"garde":false},` +
    `{"id":"8980203","nom":"Idées Confuses Gribouillé","effetDeBaseTexte":"ATT : -5 D3 | REG : -5 | Vue : -3 | TOUR : +75 min | Effet de Zone","glyphesNumeros":["20752","101641","61720","74008","50473","9513","90396","57640"],"glyphesCoches":[false,false,false,false,false,false,false,false],"garde":false},` +
    `{"id":"9033982","nom":"Traité de Clairvoyance Gribouillé","effetDeBaseTexte":"Vue : -6 | TOUR : -210 min","glyphesNumeros":["77101","91433","60697","59688","60719","77103","60697"],"glyphesCoches":[false,false,false,false,false,false,false],"garde":true},` +
    `{"id":"9308040","nom":"Yeu'Ki'Pic Gribouillé","effetDeBaseTexte":"Vue : -6 | PV : +6 D3 | Effet de Zone","glyphesNumeros":["56593","54545","89377","51464","95509","89377","12560","54545","85269"],"glyphesCoches":[false,false,false,false,false,false,false,false,false],"garde":true},` +
    `{"id":"10406560","nom":"Rune des Cyclopes Gribouillé","effetDeBaseTexte":"ATT : +5 D3 | DEG : +6 | Vue : -1 | Armure : +3 | Effet de Zone","glyphesNumeros":["57640","26924","37150","61742","92452","30990","6444"],"glyphesCoches":[false,false,false,false,false,false,false],"garde":true},` +
    `{"id":"10542064","nom":"Yeu'Ki'Pic","effetDeBaseTexte":"Vue : -9 | Effet de Zone","glyphesNumeros":["52497","88340","32017","30992","47368","100640","54553","61720","80152","10504"],"glyphesCoches":[false,false,false,false,false,false,false,false,false,false],"garde":true},` +
    `{"id":"10769725","nom":"Yeu'Ki'Pic","effetDeBaseTexte":"Vue : -9 | Effet de Zone","glyphesNumeros":["61722","45336","61720","95501","85269","11529","26892","61720","88344","23833"],"glyphesCoches":[false,false,false,false,false,false,false,false,false,false],"garde":true}]`;

