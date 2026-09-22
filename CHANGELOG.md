# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/).

## [2.0.0] - 2026-09-22

Redesign-Linie (owncloud.online Redesign 11.1). Nur im Zweig `redesign`.
Im Redesign-Kern Ende zu Ende geprüft (tests/visual/pruefe-mediaviewer.js,
23/23; die Probe erzeugt PNG, JPEG und WebM selbst im Browser).

### Fixed

- Öffentliche Linkseite: Der Betrachter öffnete sich unterhalb des sichtbaren
  Bereichs und blieb unsichtbar. Das Overlay lag mit `position: absolute`
  ohne top/left am Ende des Body; der Redesign-Kern hatte das nur für
  angemeldete Seiten (`body.oco-shell`) überschrieben. Jetzt `position: fixed`
  mit festen Rändern in der App selbst.
- Herunterladen aus dem Betrachter bei Dateinamen mit `#`, `&` oder `?`: Die
  Adresse wurde ohne Kodierung aufgerufen, der Browser landete auf einer
  404-Seite und verließ die Dateiliste. Pfad jetzt wie beim Abspielen kodiert.

### Changed

- Bau mit npm statt yarn (maßgeblich ist package-lock.json); Makefile ohne
  Transifex-Ziele und ohne Download eines Hilfsskripts aus fremdem Gist;
  dist.yml baut selbst statt über fremde wiederverwendbare Workflows.
- info.xml-Autor BW-Tech GmbH, Paketlinks auf BWTECH-github, CHANGELOG-Verweise
  als "Upstream #N", tote Transifex-Konfiguration (l10n/.tx) entfernt.

## [1.1.3] - 2026-08-13

### Changed

- README als Betriebsdokumentation neu geschrieben: Installation, Einstellungen,
  Kommandozeile und Fehlersuche; tote und fremde Verweise entfernt.

## [1.1.2] - 2026-08-13

### Changed

- Produktname, Beschreibung und uebersetzte Zeichenketten nennen owncloud.online;
  Verweise auf Fehlerbereich, Repository und Dokumentation zeigen auf das eigene
  Repository. Screenshots aus fremden Repositories entfernt.

## [1.0.5] - 2021-11-09

### Changed

- [Security] Bump y18n from 4.0.0 to 4.0.3 - Upstream #400
- [Security] Bump ssri from 6.0.1 to 6.0.2 - Upstream #407
- Translation updates - Upstream #548
- Bump Libraries


## [1.0.4] - 2021-01-10

### Added

- Add icon and correct text in the file actions menu - Upstream #337
- Possibly fix Gallery & files_mediaviewer compatibility issue - Upstream #310
- Add bgcolor and adopt the height of the video scrubber - Upstream #287

### Changed

- Bump libraries

## [1.0.3] - 2020-06-23

### Added

- Update config.json to support mimetype video/quicktime - Upstream #194
- Add time display to viewer controls - Upstream #225
- Add l10n support - Upstream #217

### Changed

- Bump libraries

## [1.0.2] - 2020-03-17

### Added

- add QT and check playable - Upstream #196

### Fixed

- Add notification on playback error - Upstream #109
- Fix moderate Cross-Site-Scripting vulnerability - Upstream #163
- Fix media controls on small devices - Upstream #164
- Encode # in media URI - Upstream #152

### Changed

- [Security] Bump serialize-javascript from 1.8.0 to 2.1.2 - Upstream #200
- Update dependencies - Upstream #155

## [1.0.1] - 2019-11-13

### Fixed

- Mobile browser view fix - Upstream #136

### Added

- Add fullscreen support for MSIE, Edge and Safari - Upstream #104
- Document how to support more media types - Upstream #100

## 1.0.0

- Initial release
