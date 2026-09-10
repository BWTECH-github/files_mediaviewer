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
	
	// ---- Register fileactions -------

	let actionHandler = (fileName, context) => {
		$('body').append(mountPoint);

		OCA.Mediaviewer.files = context.fileList.files;

		OC.addScript(app.name, app.name).then(() => {
			// Steht die Adresse schon auf diesem Anker, waere ein weiterer
			// Sprung eine Navigation auf die eigene Stelle - vue-router meldet
			// das als Fehler ("Avoided redundant navigation to current
			// location"), sichtbar in der Konsole bei jedem Neuladen einer
			// bereits geoeffneten Betrachteradresse.
			const ziel = OC.joinPaths('#', app.name, fileName);
			if (window.location.hash !== ziel) {
				OC.redirect(ziel);
			}
		});
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
});
