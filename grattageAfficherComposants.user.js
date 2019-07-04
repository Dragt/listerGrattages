// ==UserScript==
// @name grattageAfficherComposants
// @namespace Violentmonkey Scripts
// @include *Play_a_Competence26c.php*
// @grant none
// @version 1.0
// ==/UserScript==
//


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
