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
			OCA.Mediaviewer.followAddress(fileList.files);
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

	const openFromAddress = () => {
		const fileName = fileFromAddress();
		if (!fileName) {
			// Ohne Medium in der Adresse schließt ein offener Betrachter
			if (OCA.Mediaviewer.followAddress) {
				OCA.Mediaviewer.followAddress();
			}
			return;
		}
		// Ohne Liste oder während sie lädt (Zurück/Vorwärts in einen anderen
		// Ordner, Linkseite) entscheidet ihr nächstes "updated". _reloadCall
		// ist der laufende Abruf der Liste: reload() setzt ihn, reloadCallback
		// räumt ihn weg.
		if (!currentList || currentList._reloadCall) {
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
		setAddress(null, true);
		if (OCA.Mediaviewer.followAddress) {
			OCA.Mediaviewer.followAddress();
		}
	};

	OC.Plugins.register('OCA.Files.FileList', {
		attach (fileList) {
			currentList = fileList;
			fileList.$fileList.on('updated.' + app.name, () => {
				if (fileList === currentList) {
					openFromAddress();
				}
			});
		},
		detach (fileList) {
			fileList.$fileList.off('.' + app.name);
			if (fileList === currentList) {
				currentList = null;
			}
		}
	});

	window.addEventListener('popstate', openFromAddress);
});
