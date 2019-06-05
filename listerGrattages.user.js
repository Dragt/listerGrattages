// ==UserScript==
// @name listeGrattages
// @namespace Violentmonkey Scripts
// @include */mountyhall/grattage*
// @grant none
// @version 1.1.1
// ==/UserScript==
//

/* Utilisation :
* 1) installer ce script via Violent Monkey
* 2) Connecter vous à MH
* 3) Ayez sur votre trolls les parchemins à analyser
* 4) Rendez-vous dans un autre onglet sur la page https://games.mountyhall.com/mountyhall/grattage
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

let debugLevel = 0;

function displayDebug(data, level = 1) {
	if (debugLevel >= level) {
		window.console.log(data);
	}
}

document.getElementsByTagName('body')[0].innerHTML =
	'<p>Vous devez être connecté à Mountyhall. Pour chaque parchemin sur vous, vous ferez 2 appels au serveur mountyhall. Utilisez cet outil de manière responsable.<br>' +
	'Non testé avec des parchemins "spéciaux". (mission, sortilège...)<br>' +
	'Survolez avec la souris les noms des parchemins pour voir les effets initiaux. Survolez les glyphes pour voir les détails.</p>';
document.getElementsByTagName('body')[0].style.padding = '20px';

let divParcheminsASupprimer = document.createElement('div');
document.getElementsByTagName('body')[0].appendChild(divParcheminsASupprimer);

let boutonSupprimerParchemins = document.createElement('button');
boutonSupprimerParchemins.appendChild(document.createTextNode('Supprimer parchemins'));
boutonSupprimerParchemins.style.margin = '10px';
boutonSupprimerParchemins.addEventListener('click', supprimerParchemins);
divParcheminsASupprimer.appendChild(boutonSupprimerParchemins);

let inputParcheminsASupprimer = document.createElement('input');
inputParcheminsASupprimer.setAttribute('type', 'text');
inputParcheminsASupprimer.setAttribute('size', '120');
inputParcheminsASupprimer.setAttribute('id', 'parcheminsASupprimer');
inputParcheminsASupprimer.setAttribute('placeholder', 'Introduire dans ce champ les numéros des parchemins à supprimer, séparés par des virgules');
divParcheminsASupprimer.appendChild(inputParcheminsASupprimer);

let divBoutonRecapitulatif = document.createElement('div');
document.getElementsByTagName('body')[0].appendChild(divBoutonRecapitulatif);
let boutonAfficherRecapitulatif = document.createElement('button');
boutonAfficherRecapitulatif.style.margin = '10px';
boutonAfficherRecapitulatif.style.width = window.getComputedStyle(boutonSupprimerParchemins).getPropertyValue("width");
boutonAfficherRecapitulatif.appendChild(document.createTextNode('Afficher Récapitulatif'));
boutonAfficherRecapitulatif.addEventListener('click', afficherRecapitulatif);
divBoutonRecapitulatif.appendChild(boutonAfficherRecapitulatif);

let zoneRecapitulatif = document.createElement('div');
zoneRecapitulatif.setAttribute('id', 'recapitulatif');
document.getElementsByTagName('body')[0].appendChild(zoneRecapitulatif);

let table = document.createElement('table');
//table.innerHTML = '<tr><th>parchemin</th><th>Effets (total et glyhpes)</th></tr>';

document.getElementsByTagName('body')[0].appendChild(table);

//const urlGrattage = "https://games.mountyhall.com/mountyhall/MH_Play/Actions/Competences/Play_a_CompetenceYY.php??ai_CoutPA=2&ai_JetComp=90&ai_IdComp=26&as_NomComp=Grattage&ab_FlagUse=0&ai_Concentration=0&ai_IDTarget=";
// https://games.mountyhall.com/mountyhall/MH_Play/Play_action.php?x=28&y=12&as_Action=ACTION+%21%21&as_SelectName=%A0%A0Grattage+%282+PA%29+-+82+%25&as_Action2=&ai_ToDo=126
// https://games.mountyhall.com/mountyhall/MH_Play/Actions/Play_a_Competence.php?ai_IdComp=26&ai_IDTarget=
//const urlGrattage =   "https://games.mountyhall.com/mountyhall/MH_Play/Actions/Competences/Play_a_CompetenceYY.php??ai_CoutPA=2&ai_JetComp=82&ai_IdComp=26&as_NomComp=Grattage&ab_FlagUse=0&ai_Concentration=0&ai_IDTarget=";
const urlGrattage = "https://games.mountyhall.com/mountyhall/MH_Play/Actions/Play_a_Competence.php?ai_IdComp=26&ai_IDTarget=";
let parchemins = [];
let parcheminsNoms = {};
let parcheminsEffetsBase = {};
let parcheminsEffetFinal = {};
let parcheminsSupprimes = {};
let parcheminsGlyphes = {};
let glyphesCoches = {};
let nombreParchemins = 0;
let parcheminTraite = 0;

listerParchemins();



function listerParchemins() {
	let xhr = new XMLHttpRequest();
	xhr.open("GET", urlGrattage);
	xhr.onload = extraireParchemins;
	xhr.send();
}

function extraireParchemins() {
	let htmlResponse = document.createElement('div');
	htmlResponse.innerHTML = this.responseText;
	
	//console.log(htmlResponse.innerHTML);
	
	for (let option of htmlResponse.querySelectorAll('optgroup option')) {
		parchemins.push(option.value);
		parcheminsNoms[option.value] = option.innerHTML.split(' - ')[1];
	}
	nombreParchemins = parchemins.length;
	displayDebug("parchemins : ");
	displayDebug(parchemins);
	displayDebug("nombreParchemins : " + nombreParchemins);
	recupererGlyphes();
}

function recupererGlyphes() {
	displayDebug("recupererGlyphes");
	
	console.log("parchemin traite : " + parcheminTraite);
	
	if (parcheminTraite >= nombreParchemins) { // >= nombreParchemins // >= 2
		console.log('fini');
	}
	else {
		grattageAllerEtapeUn(parchemins[parcheminTraite]);
	}
}

function grattageAllerEtapeUn(parchemin) {
	displayDebug("grattageAllerEtapeUn");
	let xhr = new XMLHttpRequest();
	xhr.open("GET", urlGrattage);
	xhr.onload = grattageAllerEtapeDeux.bind(xhr, parchemin);
	xhr.send();
}

function grattageAllerEtapeDeux(parchemin) {
	displayDebug("grattageAllerEtapeDeux");
	const urlGrattage2 = "https://games.mountyhall.com/mountyhall/MH_Play/Actions/Competences/Play_a_Competence26b.php";
	let htmlResponse = document.createElement('div');
	htmlResponse.innerHTML = this.responseText;
	
	inputs = new FormData(htmlResponse.querySelector('#ActionForm'));
	inputs.set('ai_IDTarget', parchemin);
	
	let xhr = new XMLHttpRequest();
	xhr.open("POST", urlGrattage2);
	xhr.onload = extraireGlyphes.bind(xhr, parchemin) ;
	xhr.send(inputs);
}

function extraireGlyphes(parchemin) {
	displayDebug("extraireGlyphes");
	let htmlResponse = document.createElement('div');
	htmlResponse.innerHTML = this.responseText;
	
	parcheminsEffetsBase[parchemin] = htmlResponse.querySelectorAll('td')[2].innerHTML;
	
	let glyphes = [];
	for (let image of htmlResponse.querySelectorAll(".l_grib1")) {
		glyphes.push(image.src.split('Code=')[1]);
	}
	parcheminsGlyphes[parchemin] = glyphes;
	traiterGlyphes(parchemin);
	parcheminTraite++;
	displayDebug(parcheminsGlyphes, 2);
	recupererGlyphes();
}

function traiterGlyphes(parchemin) {
	displayDebug("traiterGlyphes");
	let analyse = analyseGribouillages(parcheminsGlyphes[parchemin].join(' '));
	displayDebug(analyse, 2);
	
	let trEffetsGlyphes = document.createElement('tr');
	table.appendChild(trEffetsGlyphes);
	
	let tdIdParchemin = document.createElement('td');
	tdIdParchemin.setAttribute('title', parcheminsEffetsBase[parchemin]);
	let boutonSupprimer = document.createElement('button');
	boutonSupprimer.setAttribute('id', parchemin + '-supprimer');
	boutonSupprimer.appendChild(document.createTextNode('X'));
	boutonSupprimer.addEventListener('click', supprimerParchemin);
	boutonSupprimer.setAttribute('title', 'Supprimer ce parchemin');
	tdIdParchemin.appendChild(boutonSupprimer);
	tdIdParchemin.appendChild(document.createTextNode('[' +  (parcheminTraite + 1) + ']  ' + parchemin));
	
	trEffetsGlyphes.append(tdIdParchemin);
	let tdEffetsGlyphes = document.createElement('td');
	trEffetsGlyphes.append(tdEffetsGlyphes);
	let tableEffetsGlyphes = createtableGlyphes(parchemin);
	let trDetailsEffetsGlyphes = document.createElement('tr');
	tableEffetsGlyphes.appendChild(trDetailsEffetsGlyphes);
	
	
	// TODO pas top les id commencant par un chiffre, même si légal
	for(let i = 0; i < analyse.effetGribouillages.length; i++) {
		//  pas top infoGribouillages en html dans title, traitement un peu bourrin ici
		let htmlParser = new DOMParser().parseFromString(analyse.infoGribouillages[i], 'text/html');
		let detailsGlyphe = htmlParser.body.textContent || "";
		detailsGlyphe = detailsGlyphe.replace('Epaisseur', '\nEpaisseur')
									 .replace('Orientation', '\nOrientation')
									 .replace('Caractéristique 1', '\nCaractéristique 1')
									 .replace('Caractéristique 2', ' - Caractéristique 2')
									 .replace('Résult', '\nRésult');
		trDetailsEffetsGlyphes.append(createTdGlyphe(analyse.effetGribouillages[i],
													 detailsGlyphe,
													 parchemin + '-glyphe-' + i));
	}
	tdEffetsGlyphes.appendChild(tableEffetsGlyphes);
	
	let trEffetTotal = document.createElement('tr');
	table.appendChild(trEffetTotal);
	let tdNomParchemin = createTd(parcheminsNoms[parchemin]);
	tdNomParchemin.setAttribute('title', parcheminsEffetsBase[parchemin]);
	trEffetTotal.append(tdNomParchemin);
	let tdEffet =  createTd(analyse.effetParchemin);
	parcheminsEffetFinal[parchemin] = tdEffet.innerHTML;
	tdEffet.setAttribute('id', parchemin + "-effet");
	trEffetTotal.append(tdEffet);
	
	glyphesCoches[parchemin] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	
	table.appendChild(createEmptyTr());
}

function createTd(contenu) {
	let td = document.createElement('td');
	//td.appendChild(document.createTextNode(contenu));
	td.innerHTML = contenu;
	td.style.padding = '15px';
	return td;
}

function createTdGlyphe(contenu, infos, id) {
	let tdGlyphe = createTd(contenu);
	//td.appendChild(document.createTextNode(contenu));
	tdGlyphe.title = infos;
	tdGlyphe.setAttribute('id', id);
	return tdGlyphe;
}

function createtableGlyphes(parchemin) {
	let table = document.createElement('table');
	let tr = document.createElement('tr');
	table.appendChild(tr);
	
	for (let i = 0 ;  i < 10; i++) {
		let th = document.createElement('th');
		let checkbox = document.createElement('input');
		checkbox.setAttribute('type', 'checkbox');
		checkbox.setAttribute('id', parchemin + '-checkbox-' + i);
		checkbox.addEventListener('change', cliquerCheckboxGlyphe);
		th.appendChild(checkbox);
		let span = document.createElement('span');
		span.appendChild(document.createTextNode('glyphe ' + (i+1)));
		th.appendChild(span);
		tr.appendChild(th);
	}
	
	return table;
}

function createEmptyTr() {
	let tr = document.createElement('tr');
	tr.appendChild(createTd('------------------', ''));
	return tr;
}

function cliquerCheckboxGlyphe() {
	displayDebug("clic");
	let infosGlyphes = this.id.split('-');
	let parchemin = infosGlyphes[0];
	let indiceGlyphe = infosGlyphes[2];
	let glyphe = document.getElementById(parchemin + '-glyphe-' + indiceGlyphe);
	
	if (this.checked) {
		glyphe.style.opacity = 0.25;
		glyphesCoches[parchemin][indiceGlyphe] = 1;
	}
	else {
		glyphe.style.opacity = 1;
		glyphesCoches[parchemin][indiceGlyphe] = 0;
	}
	rafraichirEffetTotal(parchemin);
}

const SANS_EFFET = 57632;
function rafraichirEffetTotal(parchemin) {
	let parcheminGratte = parcheminsGlyphes[parchemin].map((e, i) => glyphesCoches[parchemin][i] ? SANS_EFFET : e );
	let analyse = analyseGribouillages(parcheminGratte.join(' '));
	document.getElementById(parchemin + "-effet").innerHTML = analyse.effetParchemin;
	parcheminsEffetFinal[parchemin] = document.getElementById(parchemin + "-effet").innerHTML;
}

function supprimerParchemins() {
	let parcheminsASupprimer = document.getElementById('parcheminsASupprimer').value.replace(/\s/g, "").split(',');
	for (let p of parcheminsASupprimer) {
		let boutonSupprimer = document.getElementById(p + '-supprimer');
		if (boutonSupprimer) supprimerParchemin.call(boutonSupprimer);
	}
}

function supprimerParchemin() {
	let tr = this.parentNode.parentNode;
	tr.nextElementSibling.nextElementSibling.style.display = 'none';
	tr.nextElementSibling.style.display = 'none';
	tr.style.display = 'none';
	parcheminsSupprimes[this.id.split('-')[0]] = true;
}


function afficherRecapitulatif() {
	let reponse = '';
	let parcheminsFiltres = parchemins.filter(x => !(x in parcheminsSupprimes));
	for (let p of parcheminsFiltres) {
		reponse += `<p>${p} - ${parcheminsNoms[p]} ${parcheminsEffetsBase[p]} : grattages `;
		let grattes = 0;
		for (let i = 0; i < glyphesCoches[p].length; i++) {
			if (glyphesCoches[p][i]) {
				reponse += (i + 1) + ' ';
				grattes++;
			}
		}
		if (grattes === 0) reponse += 'aucun ';
		reponse += "=> " + parcheminsEffetFinal[p] + '</p>';
	}
	reponse += '<p><strong>parchemins gardés :</strong> ' + parcheminsFiltres.join(', ') + '</p>';
	reponse += '<p><strong>parchemins rejetés :</strong> ' + Object.keys(parcheminsSupprimes).join(', ') + '</p>';
	
	document.getElementById('recapitulatif').innerHTML = reponse;
}




/* ******************* RECUPERE DE VAPU ET TARTAROT *********************  */

var couleurBonus = '336633'; // vert '336633'
var couleurMalus = '990000'; // rouge '990000'
var couleurAutre= '000000'; // noir '000000'
var couleurSansEffet = '707070'; // gris '707070'


// *** Analyse la suite de numéros de gribouillages reçue en paramètre et retourne le résultat sous forme d'un tableau de tableaux ***
function analyseGribouillages(parchemin) {
	displayDebug("analyseGribouillages");
	displayDebug(parchemin, 2);
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
		displayDebug(numeros, 2);
		
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
