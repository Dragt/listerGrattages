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


// ==UserScript==
// @name GrattageFD
// @description Aide au Grattage dans MountyHall, version 1.1.2 du 12/03/2019, par Vapulabehemot (82169) + Roule
// @version 1.1.2
// @include */mountyhall/MH_Play/Actions/Competences/Play_a_Competence26b.php*
// @injectframes 1
// @namespace https://greasyfork.org/users/70018
// ==/UserScript==


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





