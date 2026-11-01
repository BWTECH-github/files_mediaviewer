/**
 * Betrachteradresse: #/files_mediaviewer/<Dateiname>
 *
 * Die Adresse führt die App selbst, immer mit leerem Chronik-Zustand (null).
 * Die Dateien-App liest bei Zurück/Vorwärts einen gesetzten Zustand als ihre
 * Adressparameter; der Zustand des Routers ({key: …}) schickte die Dateiliste
 * dabei ins Wurzelverzeichnis.
 */
const PREFIX = '#/' + require('../../package.json').name + '/';

/**
 * Dateiname aus der Adresse, sonst null.
 *
 * @return {string|null}
 */
export function fileFromAddress () {
	// location.href statt location.hash: so kommt der Anker in jedem Browser
	// so an, wie er gesetzt wurde (kodiert)
	const href = window.location.href;
	const index = href.indexOf('#');
	const anchor = index === -1 ? '' : href.slice(index);
	if (anchor.indexOf(PREFIX) !== 0 || anchor.length === PREFIX.length) {
		return null;
	}
	try {
		return decodeURIComponent(anchor.slice(PREFIX.length));
	}
	catch (e) {
		return null;
	}
}

/**
 * Setzt die Adresse auf eine Datei; ohne Datei fällt der Anker weg.
 *
 * Kodiert wird der ganze Name: „#“, „?“, „&“ oder „%“ schnitten die Adresse
 * sonst ab.
 *
 * @param {string|null} fileName
 * @param {boolean} [replace] Eintrag ersetzen statt einen neuen anzulegen
 */
export function setAddress (fileName, replace) {
	const url = window.location.pathname + window.location.search + (fileName ? PREFIX + encodeURIComponent(fileName) : '');
	window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
}
