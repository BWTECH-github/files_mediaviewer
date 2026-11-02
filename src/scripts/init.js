import { fileFromAddress, setAddress } from './address.js';

if (!OCA.Mediaviewer) {
	/**
	 * @namespace
	 */
	OCA.Mediaviewer = {};
}

OCA.Mediaviewer.app = require('./setup.js').default;

$(document).ready(function () {
	const app = OCA.Mediaviewer.app;
	const mountPoint = $('<div>', {
		id: app.name,
		html: '<div>'
	});

	if (!OCA.Files) {
		return;
	}

	// Lädt den Betrachter und lässt ihn der Adresse folgen; die Liste liefert
	// die Medien zum Blättern. Maßgeblich ist die Adresse, wenn das Bündel
	// bereitsteht: wer währenddessen Zurück drückt, bekommt nichts geöffnet.
	const show = (fileList) => {
		// Nur beim ersten Mal einhängen: ein erneutes append verschiebt den
		// Knoten, und ein offener Betrachter verlöre dabei den Fokus
		if (!$.contains(document.body, mountPoint[0])) {
			$('body').append(mountPoint);
		}

		OC.addScript(app.name, app.name).then(() => {
			OCA.Mediaviewer.followAddress(fileList);
		});
	};

	// ---- Register fileactions -------

	// Klick in der Liste: die Adresse bekommt einen neuen Eintrag in der Chronik
	let actionHandler = (fileName, context) => {
		if (fileFromAddress() !== fileName) {
			setAddress(fileName);
		}
		show(context.fileList);
	};

	app.config.mimetypes.forEach( (mimetype) => {

		// register only browser playable videotypes
		let n = mimetype.search("video");
		if (n === 0) {
			let hasVideo = document.createElement('video').canPlayType &&
				document.createElement('video').canPlayType(mimetype);
			if (!hasVideo) {
				return;
			}
		}

		let ViewMedia = {
			mime: mimetype,
			name: app.name,
			permissions: OC.PERMISSION_READ,
			displayName: t('files_mediaviewer', 'Open in Media Viewer'),
			iconClass: 'icon-toggle',
			actionHandler
		};

		if (OCA.Files.fileActions) {
			OCA.Files.fileActions.registerAction(ViewMedia);
			OCA.Files.fileActions.setDefault(mimetype, app.name);
		}
	});

	// ---- Betrachteradresse -------
	// Eine aufgerufene, neu geladene oder per Zurück/Vorwärts erreichte
	// Adresse #/files_mediaviewer/<Datei> öffnet das Medium, sobald die
	// Dateiliste es kennt.

	// Liste der gezeigten Ansicht (Dateien-App) bzw. der Linkseite
	let currentList = null;

	// Ordner ohne doppelte und abschließende Schrägstriche
	const normalizeDir = (dir) => ('/' + (dir || '')).replace(/\/+/g, '/').replace(/(.)\/$/, '$1');

	// Zeigt die Liste die Ansicht und den Ordner, die die Adresse nennt?
	// Nach Zurück/Vorwärts über einen Ansichtswechsel steht die alte Liste
	// noch da, bis das Markup der neuen Ansicht geladen ist.
	const listShowsAddress = (fileList) => {
		const params = OC.Util.History.parseUrlQuery();
		const publicApp = OCA.Sharing && OCA.Sharing.PublicApp;
		// Die Linkseite nennt den Ordner "path" (files_sharing public.js)
		if (publicApp && publicApp.fileList === fileList) {
			return normalizeDir(params.path || params.dir) === normalizeDir(fileList.getCurrentDirectory());
		}
		// data-view: die Ansicht, deren Liste im Behälter steht;
		// getActiveView(): die Ansicht, die die Adresse verlangt
		const view = $('#app-content-view').attr('data-view');
		if (view && OCA.Files.App && view !== OCA.Files.App.getActiveView()) {
			return false;
		}
		return normalizeDir(params.dir) === normalizeDir(fileList.getCurrentDirectory());
	};

	// Anker per replaceState weg; ein offener Betrachter schließt
	const dropAnchor = () => {
		setAddress(null, true);
		if (OCA.Mediaviewer.followAddress) {
			OCA.Mediaviewer.followAddress();
		}
	};

	const openFromAddress = () => {
		const fileName = fileFromAddress();
		if (!fileName) {
			// Ohne Medium in der Adresse schließt ein offener Betrachter
			if (OCA.Mediaviewer.followAddress) {
				OCA.Mediaviewer.followAddress();
			}
			return;
		}
		// Ohne Liste, während sie lädt (_reloadCall ist der laufende Abruf:
		// reload() setzt ihn, reloadCallback räumt ihn weg) oder solange sie
		// eine andere Ansicht bzw. einen anderen Ordner zeigt als die Adresse,
		// entscheidet ihr nächstes "updated". Den Anker jetzt zu entfernen,
		// schriebe einen gültigen Eintrag der Chronik dauerhaft um.
		if (!currentList || currentList._reloadCall || !listShowsAddress(currentList)) {
			return;
		}
		const file = currentList.findFile(fileName);
		const actions = file ? currentList.fileActions.getActions(file.mimetype, file.type, file.permissions) : {};
		if (actions[app.name]) {
			show(currentList);
			return;
		}
		// Datei fehlt, ist kein Medium oder hier nicht zu öffnen (Papierkorb):
		// Anker weg. Er ginge sonst beim nächsten Ordnerwechsel mit und
		// öffnete dort eine gleichnamige Datei.
		dropAnchor();
	};

	// ---- Fokus nach dem Schließen -------
	// Zurück auf die Zeile des zuletzt gezeigten Mediums, damit Tastaturnutzer
	// in der Liste dort weitermachen, wo sie waren. Lädt die Liste gerade neu
	// (die Linkseite tut das bei jedem Zurück/Vorwärts), ist ihre Tabelle
	// ausgeblendet; dann übernimmt ihr nächstes "updated".
	let pendingFocus = null;

	const focusRow = (fileList, name) => {
		const $row = fileList.findFileEl(name);
		const target = $row.find('a.name').get(0) || $row.get(0);
		if (target) {
			target.focus();
		}
	};

	/**
	 * @param {Object} [item] zuletzt gezeigtes Medium (name, path)
	 */
	OCA.Mediaviewer.restoreFocus = (item) => {
		pendingFocus = null;
		if (!currentList || !item || !item.name) {
			return;
		}
		if (!currentList._reloadCall) {
			focusRow(currentList, item.name);
			return;
		}
		// Nur warten, wenn die Liste den Ordner des Mediums neu lädt: in
		// einem anderen Ordner fände sich höchstens eine gleichnamige Datei
		const dir = normalizeDir(currentList.getCurrentDirectory());
		if (normalizeDir(item.path) === dir) {
			pendingFocus = { list: currentList, dir, name: item.name };
		}
	};

	const focusAfterUpdate = (fileList) => {
		const pending = pendingFocus;
		pendingFocus = null;
		const active = document.activeElement;
		// Hat der Nutzer den Fokus inzwischen selbst gesetzt, bleibt er dort
		if (pending && pending.list === fileList && pending.dir === normalizeDir(fileList.getCurrentDirectory()) &&
			(!active || active === document.body)) {
			focusRow(fileList, pending.name);
		}
	};

	OC.Plugins.register('OCA.Files.FileList', {
		attach (fileList) {
			currentList = fileList;
			fileList.$fileList.on('updated.' + app.name, () => {
				if (fileList === currentList) {
					focusAfterUpdate(fileList);
					openFromAddress();
				}
			});
		},
		detach (fileList) {
			fileList.$fileList.off('.' + app.name);
			if (fileList === currentList) {
				currentList = null;
			}
			if (pendingFocus && pendingFocus.list === fileList) {
				pendingFocus = null;
			}
		}
	});

	window.addEventListener('popstate', openFromAddress);

	// Wechselt die Liste den Ordner oder die Navigation die Ansicht, schreibt
	// der Kern eine neue Adresse und reicht den Anker dabei weiter, auch wenn
	// er einen fehlenden oder gesperrten Ordner mit einem Sprung in die
	// Wurzel quittiert. Dort öffnete der Anker eine gleichnamige Datei. Der
	// Handler sitzt am Dokument und läuft deshalb nach denen des Kerns (an der
	// Liste, an #app-content bzw. #app-navigation), also auf der schon
	// geschriebenen Adresse. Zurück/Vorwärts lösen keins der Ereignisse aus.
	$(document).on(`changeDirectory.${app.name} itemChanged.${app.name}`, (e) => {
		const fromList = e.type === 'changeDirectory' && !!currentList && e.target === currentList.$el[0];
		const fromNavigation = e.type === 'itemChanged' && e.target === $('#app-navigation')[0];
		if ((fromList || fromNavigation) && fileFromAddress()) {
			dropAnchor();
		}
	});
});
