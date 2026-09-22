/**
 * Medienbetrachter (files_mediaviewer) im Redesign, Ende zu Ende.
 *
 * Die Probe erzeugt ihre Medien selbst im Browser (PNG und JPEG per Canvas,
 * WebM-Video per MediaRecorder), lädt sie in den Ordner MV-Probe, legt einen
 * öffentlichen Link an und räumt beides wieder weg.
 *
 * Geprüft wird:
 *   - Medienbetrachter für Bilder angeboten (mit gallery fragt der Kern
 *     nach), für Video Standard
 *   - Öffnen aus der Dateiliste: Betrachter liegt obenauf, Bild geladen,
 *     Name und Zähler stimmen
 *   - Vor/Zurück per Knopf und Pfeiltaste, alle Medien des Ordners erreichbar
 *   - Zoom und Drehen
 *   - Video: Abspielen, Stumm, Neustart
 *   - Herunterladen, auch bei Namen mit # und &
 *   - Schließen per Knopf und Escape, Adresse wieder ohne Anker
 *   - Öffnen bei bereits gesetzter Betrachteradresse ohne Routerfehler
 *   - öffentlicher Ordner-Link: Bild (obenauf) und Video
 *   - 400 px: Bedienleiste im Bild
 *   - keine Konsolenfehler
 *
 * Aufruf: OC_PASSWORD=... node tests/visual/pruefe-mediaviewer.js
 *
 * @copyright Copyright (c) 2026, BW-Tech GmbH
 * @license AGPL-3.0
 */
'use strict';

let chromium;
try {
	({ chromium } = require('playwright'));
} catch (e) {
	({ chromium } = require('C:/git/owncloud.online-redesign/node_modules/playwright'));
}

const BASIS = process.env.OC_URL || 'http://127.0.0.1:18130';
const PASSWORT = process.env.OC_PASSWORD;
if (!PASSWORT) {
	console.error('OC_PASSWORD fehlt.');
	process.exit(2);
}

const ORDNER = 'MV-Probe';
const BILD = 'bild1.png';
const BILD_SONDER = 'Bild #2 & mehr.jpg';
const VIDEO = 'clip.webm';

const ergebnisse = [];
function pruefe(name, ok, zusatz) {
	ergebnisse.push({ name, ok: ok === true, zusatz: zusatz === undefined ? '' : String(zusatz) });
}

function konsoleMitschneiden(seite, liste) {
	seite.on('console', (m) => {
		const quelle = m.location().url || '';
		// eigenes Aufräumen (DELETE auf noch fehlenden Ordner) zählt nicht
		if (m.type() === 'error' && !/\/remote\.php\/dav\/files\/admin\/MV-Probe$/.test(quelle)) {
			liste.push(m.text().slice(0, 160) + ' @ ' + quelle.slice(0, 120));
		}
	});
	seite.on('pageerror', (e) => liste.push('Seitenfehler: ' + e.message.slice(0, 200)));
}

async function betrachterZustand(seite) {
	return seite.evaluate(() => {
		const w = document.querySelector('#files_mediaviewer .wrapper');
		const aktiv = document.querySelector('#files_mediaviewer .swiper-slide-active .viewer__media');
		const sichtbar = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
		const namen = Array.from(document.querySelectorAll('#files_mediaviewer .viewer__control__nametag')).filter(sichtbar).map((e) => e.textContent.trim());
		const zaehler = Array.from(document.querySelectorAll('#files_mediaviewer .viewer__controls--image .viewer__control__count, #files_mediaviewer .viewer__controls--video .viewer__control__count')).filter(sichtbar).map((e) => e.textContent.replace(/\s+/g, ' ').trim());
		let obenauf = false;
		if (sichtbar(w)) {
			const e = document.elementFromPoint(Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2));
			obenauf = !!e && !!e.closest('#files_mediaviewer');
			window.__mitte = e ? (e.id || e.className.toString() || e.tagName).slice(0, 60) + ' in ' + ((e.parentElement && (e.parentElement.id || e.parentElement.className.toString())) || '').slice(0, 60) : '';
		}
		return {
			offen: sichtbar(w),
			obenauf,
			anker: location.hash,
			name: namen[0] || '',
			zaehler: zaehler[0] || '',
			typ: aktiv ? aktiv.tagName.toLowerCase() : '',
			geladen: aktiv && aktiv.tagName === 'IMG' ? aktiv.complete && aktiv.naturalWidth > 0 : null,
			transform: aktiv ? aktiv.style.transform : '',
			mitte: window.__mitte || '',
		};
	});
}

async function warteAufName(seite, name) {
	await seite.waitForFunction((n) => Array.from(document.querySelectorAll('#files_mediaviewer .viewer__control__nametag'))
		.some((e) => e.getClientRects().length > 0 && e.textContent.trim() === n), name, { timeout: 15000 }).catch(() => {});
	await seite.waitForTimeout(600);
}

/**
 * Öffnet eine Datei aus der Liste. Bieten mehrere Apps einen Betrachter an
 * (hier auch gallery für Bilder), fragt der Kern "Wie möchtest du diese Datei
 * öffnen?" – dann den Medienbetrachter wählen.
 */
async function oeffne(seite, datei) {
	const zeile = seite.locator('#fileList tr[data-file="' + datei + '"]');
	await zeile.locator('.nametext').first().click({ timeout: 10000 }).catch(() => {});
	const wahl = zeile.locator('a.menuitem[data-action="files_mediaviewer"]').first();
	await wahl.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
	if (await wahl.isVisible().catch(() => false)) {
		await wahl.click({ timeout: 10000 }).catch(() => {});
		return true;
	}
	return false;
}

async function knopf(seite, klasse) {
	const k = seite.locator('#files_mediaviewer .viewer__controls:visible button.' + klasse).first();
	await k.click({ timeout: 10000 }).catch(() => {});
}

(async () => {
	const browser = await chromium.launch();
	const kontext = await browser.newContext({ locale: 'de-DE', viewport: { width: 1440, height: 900 }, acceptDownloads: true });
	const seite = await kontext.newPage();
	const konsole = [];
	await seite.goto(BASIS + '/index.php/login', { waitUntil: 'domcontentloaded' });
	await seite.fill('#user', 'admin');
	await seite.fill('#password', PASSWORT);
	await Promise.all([seite.waitForNavigation({ timeout: 60000 }).catch(() => {}), seite.click('#submit, button[type=submit], input[type=submit]')]);

	// --- Medien erzeugen und hochladen ---------------------------------------
	await seite.goto(BASIS + '/index.php/apps/files/', { waitUntil: 'load' });
	const hochgeladen = await seite.evaluate(async ([ordner, bild, bildSonder, video]) => {
		const h = { requesttoken: OC.requestToken };
		const basis = OC.linkToRemoteBase('dav') + '/files/admin/' + ordner;
		await fetch(basis, { method: 'DELETE', headers: h });
		await fetch(basis, { method: 'MKCOL', headers: h });
		const leinwand = (farbe, text) => {
			const c = document.createElement('canvas');
			c.width = 640; c.height = 480;
			const g = c.getContext('2d');
			g.fillStyle = farbe; g.fillRect(0, 0, 640, 480);
			g.fillStyle = '#fff'; g.font = 'bold 120px sans-serif'; g.fillText(text, 240, 280);
			return c;
		};
		const blob = (c, typ) => new Promise((r) => c.toBlob(r, typ, 0.9));
		const hoch = async (name, inhalt, typ) => (await fetch(basis + '/' + encodeURIComponent(name), { method: 'PUT', headers: Object.assign({ 'Content-Type': typ }, h), body: inhalt })).status;
		const status = {};
		status[bild] = await hoch(bild, await blob(leinwand('#c0392b', '1'), 'image/png'), 'image/png');
		status[bildSonder] = await hoch(bildSonder, await blob(leinwand('#2c3e50', '2'), 'image/jpeg'), 'image/jpeg');
		// 3 s WebM (VP8) aus einer bewegten Leinwand
		const c = document.createElement('canvas');
		c.width = 320; c.height = 240;
		const g = c.getContext('2d');
		const strom = c.captureStream(25);
		const rec = new MediaRecorder(strom, { mimeType: 'video/webm;codecs=vp8' });
		const teile = [];
		rec.ondataavailable = (e) => teile.push(e.data);
		const fertig = new Promise((r) => { rec.onstop = r; });
		rec.start(200);
		const start = performance.now();
		await new Promise((r) => {
			const malen = () => {
				const t = performance.now() - start;
				g.fillStyle = '#16a085'; g.fillRect(0, 0, 320, 240);
				g.fillStyle = '#fff'; g.fillRect((t / 10) % 300, 100, 20, 40);
				if (t < 3000) { requestAnimationFrame(malen); } else { r(); }
			};
			malen();
		});
		rec.stop();
		await fertig;
		status[video] = await hoch(video, new Blob(teile, { type: 'video/webm' }), 'video/webm');
		await hoch('notiz.txt', 'kein Medium', 'text/plain');
		return status;
	}, [ORDNER, BILD, BILD_SONDER, VIDEO]);
	pruefe('Probemedien hochgeladen', Object.values(hochgeladen).every((s) => s === 201 || s === 204), JSON.stringify(hochgeladen));

	konsoleMitschneiden(seite, konsole);

	// --- Standardaktion --------------------------------------------------------
	await seite.goto(BASIS + '/index.php/apps/files/?dir=%2F' + ORDNER, { waitUntil: 'load' });
	await seite.waitForSelector('#fileList tr[data-file="' + BILD + '"]', { timeout: 30000 }).catch(() => {});
	await seite.evaluate(() => {
		if (window.jQuery && jQuery.colorbox && document.getElementById('colorbox') && document.getElementById('colorbox').getClientRects().length) {
			jQuery.colorbox.close();
		}
	});
	const standard = await seite.evaluate(() => {
		const fa = OCA.Files.fileActions;
		const angeboten = (m) => Object.keys(fa.getActions(m, 'file', OC.PERMISSION_READ) || {}).indexOf('files_mediaviewer') !== -1;
		const d = fa.getDefaultFileAction('video/webm', 'file', OC.PERMISSION_READ);
		return { png: angeboten('image/png'), jpeg: angeboten('image/jpeg'), webm: d && d.name, kannWebm: document.createElement('video').canPlayType('video/webm') };
	});
	pruefe('Medienbetrachter für PNG/JPEG angeboten, Standard für WebM', standard.png && standard.jpeg && standard.webm === 'files_mediaviewer', JSON.stringify(standard));

	// --- öffnen ------------------------------------------------------------------
	const auswahl = await oeffne(seite, BILD);
	pruefe('Bild: Kern fragt nach dem Betrachter (gallery ebenfalls aktiv)', auswahl === true);
	await seite.waitForSelector('#files_mediaviewer .wrapper', { state: 'visible', timeout: 20000 }).catch(() => {});
	await warteAufName(seite, BILD);
	let z = await betrachterZustand(seite);
	pruefe('Öffnen: Betrachter liegt obenauf', z.offen && z.obenauf, JSON.stringify(z));
	pruefe('Öffnen: richtiges Bild geladen, Adresse mit Anker', z.name === BILD && z.geladen === true && /#\/?files_mediaviewer\/bild1\.png$|#files_mediaviewer\/bild1\.png$/.test(decodeURIComponent(z.anker)), JSON.stringify(z));
	pruefe('Zähler nennt Position und Anzahl (3 Medien, Textdatei nicht)', /\b3\b/.test(z.zaehler), z.zaehler);

	// --- Zoom und Drehen -------------------------------------------------------
	await knopf(seite, 'icon__zoom_in');
	await knopf(seite, 'icon__rotate_90_degrees_ccw');
	z = await betrachterZustand(seite);
	pruefe('Zoom und Drehen wirken', /scale\(1\.2/.test(z.transform) && /rotate\(-90deg\)/.test(z.transform), z.transform);

	// --- blättern ----------------------------------------------------------------
	const besucht = new Set([z.name]);
	for (let i = 0; i < 3; i++) {
		const vorher = (await betrachterZustand(seite)).name;
		await knopf(seite, 'icon__next');
		await seite.waitForFunction((alt) => Array.from(document.querySelectorAll('#files_mediaviewer .viewer__control__nametag'))
			.some((e) => e.getClientRects().length > 0 && e.textContent.trim() !== '' && e.textContent.trim() !== alt), vorher, { timeout: 8000 }).catch(() => {});
		await seite.waitForTimeout(500);
		besucht.add((await betrachterZustand(seite)).name);
	}
	pruefe('Weiter-Knopf erreicht alle Medien', [BILD, BILD_SONDER, VIDEO].every((n) => besucht.has(n)), Array.from(besucht).join(' | '));

	// Pfeiltaste zurück
	const vorPfeil = (await betrachterZustand(seite)).name;
	await seite.keyboard.press('ArrowLeft');
	await seite.waitForTimeout(900);
	const nachPfeil = (await betrachterZustand(seite)).name;
	pruefe('Pfeiltaste links blättert zurück', nachPfeil !== '' && nachPfeil !== vorPfeil, vorPfeil + ' -> ' + nachPfeil);

	// --- Video -------------------------------------------------------------------
	for (let i = 0; i < 3 && (await betrachterZustand(seite)).name !== VIDEO; i++) {
		await knopf(seite, 'icon__next');
		await seite.waitForTimeout(900);
	}
	z = await betrachterZustand(seite);
	pruefe('Video-Folie zeigt ein Videoelement', z.name === VIDEO && z.typ === 'video', JSON.stringify(z));
	if (standard.kannWebm) {
		await seite.locator('#files_mediaviewer .viewer__controls--video button.icon__play, #files_mediaviewer .viewer__controls--video button.icon__pause').first().click({ timeout: 10000 }).catch(() => {});
		await seite.waitForTimeout(1800);
		const spielt = await seite.evaluate(() => {
			const v = document.querySelector('#files_mediaviewer .swiper-slide-active video');
			return v ? { pausiert: v.paused, zeit: v.currentTime, fehler: v.error && v.error.code, bereit: v.readyState } : null;
		});
		pruefe('Video spielt ab', !!spielt && !spielt.pausiert && spielt.zeit > 0.3, JSON.stringify(spielt));
		await seite.locator('#files_mediaviewer .viewer__controls--video button.icon__volume_up, #files_mediaviewer .viewer__controls--video button.icon__volume_down').first().click({ timeout: 10000 }).catch(() => {});
		const stumm = await seite.evaluate(() => { const v = document.querySelector('#files_mediaviewer .swiper-slide-active video'); return v && v.muted; });
		pruefe('Stumm schaltet um', stumm === true, stumm);
		await knopf(seite, 'icon__replay');
		await seite.waitForTimeout(300);
		const neu = await seite.evaluate(() => { const v = document.querySelector('#files_mediaviewer .swiper-slide-active video'); return v && v.currentTime; });
		pruefe('Neustart springt an den Anfang', typeof neu === 'number' && neu < 1, neu);
	} else {
		pruefe('Browser kann WebM abspielen (Voraussetzung)', false, 'canPlayType leer');
	}

	// --- Herunterladen (Name mit # und &) --------------------------------------
	for (let i = 0; i < 3 && (await betrachterZustand(seite)).name !== BILD_SONDER; i++) {
		await knopf(seite, 'icon__prev');
		await seite.waitForTimeout(900);
	}
	const vorDownload = seite.url();
	const [download] = await Promise.all([
		seite.waitForEvent('download', { timeout: 15000 }).catch(() => null),
		knopf(seite, 'icon__download'),
	]);
	let groesse = 0;
	if (download) {
		const pfad = await download.path().catch(() => null);
		groesse = pfad ? require('fs').statSync(pfad).size : 0;
	}
	await seite.waitForTimeout(800);
	pruefe('Herunterladen: Datei mit # und & im Namen kommt vollständig an', !!download && download.suggestedFilename() === BILD_SONDER && groesse > 1000,
		(download ? download.suggestedFilename() + ', ' + groesse + ' Byte' : 'kein Download') + ', Seite danach: ' + seite.url().replace(BASIS, ''));
	pruefe('Herunterladen: Betrachter bleibt offen', (await betrachterZustand(seite)).offen && seite.url() === vorDownload, seite.url().replace(BASIS, ''));

	// --- schließen ---------------------------------------------------------------
	await knopf(seite, 'icon__close');
	await seite.waitForTimeout(800);
	z = await betrachterZustand(seite);
	pruefe('Schließen per Knopf', !z.offen && !/files_mediaviewer\/./.test(z.anker), JSON.stringify(z));

	await oeffne(seite, VIDEO);
	await warteAufName(seite, VIDEO);
	await seite.keyboard.press('Escape');
	await seite.waitForTimeout(800);
	z = await betrachterZustand(seite);
	pruefe('Schließen per Escape (Video)', !z.offen, JSON.stringify(z));
	const videoGestoppt = await seite.evaluate(() => Array.from(document.querySelectorAll('#files_mediaviewer video')).every((v) => v.paused));
	pruefe('Nach dem Schließen läuft kein Video weiter', videoGestoppt);

	// --- Öffnen, wenn die Adresse schon auf dem Medium steht (4dd217d) ----------
	// Eine neu geladene Betrachteradresse öffnet nichts von selbst (auch in
	// main nicht: das Bündel lädt erst über die Dateiaktion). Öffnet man das
	// Medium dann, darf der Router nicht über eine Navigation auf die eigene
	// Stelle stolpern.
	const vorAnker = konsole.length;
	await seite.goto(BASIS + '/index.php/apps/files/?dir=%2F' + ORDNER + '#/files_mediaviewer/' + encodeURIComponent(BILD), { waitUntil: 'load' });
	await seite.waitForSelector('#fileList tr[data-file="' + BILD + '"]', { timeout: 30000 }).catch(() => {});
	await oeffne(seite, BILD);
	await warteAufName(seite, BILD);
	z = await betrachterZustand(seite);
	pruefe('Öffnen bei bereits gesetzter Betrachteradresse, ohne Routerfehler', z.offen && z.name === BILD && z.geladen === true && konsole.length === vorAnker, JSON.stringify(z) + ' ' + konsole.slice(vorAnker).join(' | '));
	await seite.keyboard.press('Escape');

	// --- 400 px ------------------------------------------------------------------
	const schmal = await kontext.newPage();
	konsoleMitschneiden(schmal, konsole);
	await schmal.setViewportSize({ width: 400, height: 800 });
	await schmal.goto(BASIS + '/index.php/apps/files/?dir=%2F' + ORDNER, { waitUntil: 'load' });
	await schmal.waitForSelector('#fileList tr[data-file="' + BILD + '"]', { timeout: 30000 }).catch(() => {});
	await oeffne(schmal, BILD);
	await warteAufName(schmal, BILD);
	const leiste = await schmal.evaluate(() => {
		const knoepfe = Array.from(document.querySelectorAll('#files_mediaviewer .viewer__controls--image button')).filter((b) => b.getClientRects().length > 0);
		const aussen = knoepfe.filter((b) => { const r = b.getBoundingClientRect(); return r.left < 0 || r.right > window.innerWidth + 1 || r.bottom > window.innerHeight + 1; });
		// verdeckt: an der Knopfmitte liegt etwas anderes (etwa die Reiterleiste)
		const verdeckt = knoepfe.filter((b) => {
			const r = b.getBoundingClientRect();
			const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
			return !e || (e !== b && !b.contains(e));
		});
		return { knoepfe: knoepfe.length, ausserhalb: aussen.map((b) => b.className).join(','), verdeckt: verdeckt.map((b) => b.className).join(',') };
	});
	pruefe('400 px: alle Bedienknöpfe im Bild und nicht verdeckt', leiste.knoepfe >= 6 && leiste.ausserhalb === '' && leiste.verdeckt === '', JSON.stringify(leiste));
	const mitte = await schmal.evaluate(() => {
		const b = document.querySelector('#files_mediaviewer .swiper-slide-active .viewer__media');
		const r = b ? b.getBoundingClientRect() : null;
		return r ? Math.round(Math.abs((r.top + r.bottom) / 2 - window.innerHeight / 2)) : null;
	});
	pruefe('Bild sitzt senkrecht mittig (kein 45-px-Versatz)', mitte !== null && mitte <= 3, mitte);
	await schmal.close();

	// --- öffentlicher Ordner-Link -----------------------------------------------
	await seite.goto(BASIS + '/index.php/apps/files/', { waitUntil: 'load' });
	const link = await seite.evaluate(async (ordner) => {
		const r = await fetch(OC.linkToOCS('apps/files_sharing/api/v1', 2) + 'shares?format=json', {
			method: 'POST',
			headers: { requesttoken: OC.requestToken, 'OCS-APIRequest': 'true', 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ path: '/' + ordner, shareType: '3', permissions: '1' }),
		});
		const j = await r.json();
		return { id: j.ocs.data && j.ocs.data.id, token: j.ocs.data && j.ocs.data.token };
	}, ORDNER);
	if (link.token) {
		const gast = await browser.newContext({ locale: 'de-DE', viewport: { width: 1440, height: 900 } });
		const g = await gast.newPage();
		konsoleMitschneiden(g, konsole);
		await g.goto(BASIS + '/index.php/s/' + link.token, { waitUntil: 'load' });
		await g.waitForSelector('#fileList tr[data-file="' + BILD + '"]', { timeout: 30000 }).catch(() => {});
		await oeffne(g, BILD);
		await warteAufName(g, BILD);
		z = await betrachterZustand(g);
		pruefe('Öffentlicher Link: Bild öffnet im Betrachter', z.offen && z.obenauf && z.name === BILD && z.geladen === true, JSON.stringify(z));
		for (let i = 0; i < 3 && (await betrachterZustand(g)).name !== VIDEO; i++) {
			await knopf(g, 'icon__next');
			await g.waitForTimeout(900);
		}
		await g.locator('#files_mediaviewer .viewer__controls--video button.icon__play, #files_mediaviewer .viewer__controls--video button.icon__pause').first().click({ timeout: 10000 }).catch(() => {});
		await g.waitForTimeout(1800);
		const gSpielt = await g.evaluate(() => {
			const v = document.querySelector('#files_mediaviewer .swiper-slide-active video');
			return v ? { pausiert: v.paused, zeit: v.currentTime, fehler: v.error && v.error.code } : null;
		});
		pruefe('Öffentlicher Link: Video spielt ab', !!gSpielt && !gSpielt.pausiert && gSpielt.zeit > 0.3, JSON.stringify(gSpielt));
		await gast.close();
	} else {
		pruefe('Öffentlicher Link angelegt', false, JSON.stringify(link));
	}

	// --- aufräumen -----------------------------------------------------------------
	await seite.evaluate(async ([id, ordner]) => {
		const h = { requesttoken: OC.requestToken };
		if (id) {
			await fetch(OC.linkToOCS('apps/files_sharing/api/v1', 2) + 'shares/' + id, { method: 'DELETE', headers: Object.assign({ 'OCS-APIRequest': 'true' }, h) });
		}
		await fetch(OC.linkToRemoteBase('dav') + '/files/admin/' + ordner, { method: 'DELETE', headers: h });
	}, [link.id, ORDNER]);

	pruefe('keine Konsolenfehler', konsole.length === 0, konsole.join(' | '));
	await browser.close();
	process.exit(ausgabe() === 0 ? 0 : 1);
})().catch((e) => {
	console.error(String(e.message || e).split('\n')[0]);
	ausgabe();
	process.exit(2);
});

function ausgabe() {
	let fehler = 0;
	for (const e of ergebnisse) {
		console.log((e.ok ? 'OK    ' : 'FEHL  ') + e.name + (e.zusatz ? '  (' + e.zusatz + ')' : ''));
		if (!e.ok) {
			fehler++;
		}
	}
	console.log('\n' + (ergebnisse.length - fehler) + '/' + ergebnisse.length + ' bestanden');
	return fehler;
}
