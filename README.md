# Media Viewer (files_mediaviewer)

Die App zeigt Bilder und Videos direkt im Browser an, statt sie
herunterzuladen. Sie ergänzt die Dateiliste und öffentliche Links um eine
Vollbild-Ansicht mit Blättern, Drehen, Zoomen und Video-Steuerung. Die
Bilddarstellung setzt auf der Vorschau-Erzeugung von owncloud.online auf;
Videos werden unverändert aus dem Speicher gestreamt.

## Was die App tut

- Registriert für geeignete Dateitypen die Dateiaktion „Mit Media Viewer
  öffnen“ und setzt sie als Standardaktion. Ein Klick auf eine Bild- oder
  Videodatei öffnet damit den Viewer statt des Downloads.
- Zeigt alle passenden Dateien des aktuellen Ordners als Slideshow. Blättern
  per Wischgeste, über die Schaltflächen „Zurück“ und „Weiter“ oder mit den
  Pfeiltasten links und rechts. „Esc“ schließt die Ansicht.
- Bilder: Drehen in Schritten von 90°, „Vergrößern“, „Verkleinern“,
  „Herunterladen“, „Schließen“.
- Videos: „Abspielen“, „Wiedergeben“ (von vorn), „Ton aus“, „Vollbildschirm“,
  Fortschrittsleiste mit Sprungmarke und Zeitanzeige.
- Arbeitet in der Dateiliste angemeldeter Nutzer und in öffentlichen Links
  auf Ordner.

Wichtig für das Verständnis der Voraussetzungen:

- **Bilder** lädt der Viewer nicht im Original, sondern über die Vorschau des
  Servers (WebDAV mit `?preview=1`, in öffentlichen Links über
  `publicpreview.php`). Die angeforderte Kantenlänge richtet sich nach der
  Fensterbreite und liegt zwischen 1024 und 3840 Pixeln; der Server begrenzt
  sie zusätzlich (siehe „Einstellungen“). Ohne nutzbare Vorschau bleibt das
  Bild leer.
- **Videos** laufen ohne Vorschau und ohne Umkodierung: Die Datei wird direkt
  gestreamt und vom Browser abgespielt — angemeldet über WebDAV
  (`remote.php/webdav`), in öffentlichen Links über den Download-Endpunkt
  `/s/<token>/download`. Kann der Browser den Typ nicht wiedergeben,
  registriert die App für diesen Typ keine Dateiaktion; in der Slideshow
  taucht die Datei trotzdem auf, bleibt dort aber stumm.

## Unterstützte Formate

Videos sind in der App fest hinterlegt:

| Typ               | Bemerkung                                        |
| ----------------- | ------------------------------------------------ |
| `video/mp4`       | in der Praxis der zuverlässigste Typ             |
| `video/webm`      | abhängig vom Browser                             |
| `video/ogg`       | abhängig vom Browser                             |
| `video/quicktime` | nur, wenn der Browser den enthaltenen Codec kann |

Jeder dieser Typen wird beim Laden der Seite gegen den Browser geprüft und
nur dann als Dateiaktion angeboten, wenn dieser ihn abspielen kann. Die
Slideshow selbst filtert nicht nach Browser-Fähigkeit.

Bei Bildern übernimmt die App alle `image/…`-Typen, für die auf dem Server
ein Vorschau-Anbieter registriert ist. Ohne weitere Konfiguration sind das
PNG, JPEG, WebP, GIF, BMP und X-Bitmap; HEIC/HEIF und SGI kommen hinzu,
sobald die PHP-Erweiterung `imagick` geladen ist und das Format beherrscht.
SVG und TIFF müssen Sie zusätzlich in `enabledPreviewProviders` eintragen;
sie benötigen ebenfalls `imagick`.

## Voraussetzungen

- owncloud.online 11.0 (`appinfo/info.xml`: `min-version 11`,
  `max-version 11.99`)
- PHP 8.4
- Aktive Vorschau-Erzeugung (`enable_previews`, Standard `true`). Ist sie
  abgeschaltet, lässt sich kein Bild anzeigen.
- `imagick` nur für SVG, TIFF, HEIC/HEIF und SGI. Für PNG, JPEG, WebP, GIF,
  BMP und X-Bitmap genügt die GD-Erweiterung von PHP.
- `ffmpeg` oder `avconv` werden **nicht** für die Wiedergabe benötigt. Sie
  sind nur nötig, damit der Vorschau-Anbieter `OC\Preview\Movie`
  Vorschaubilder von Videos in der Dateiliste erzeugt. Fehlen sie, bleibt in
  der Dateiliste das allgemeine Video-Symbol stehen; der Viewer spielt die
  Datei trotzdem ab.
- Ein Browser, der den jeweiligen Video-Codec beherrscht.
- Node.js und yarn nur dann, wenn Sie die App aus dem Quelltext bauen.

## Installation

Der einfachere Weg ist der Markt in der Administration: Dort wird ein fertig
gebautes Paket installiert, ein Bauschritt entfällt.

Aus dem Quelltext:

```
cd /var/www/owncloud.online/apps
git clone https://github.com/BWTECH-github/files_mediaviewer.git
cd files_mediaviewer
yarn install && yarn build
chown -R www-data:www-data .
sudo -u www-data php8.4 ../../occ app:enable files_mediaviewer
```

Die App hat keine `composer.json`, ein `composer install` entfällt. Der
Schritt `yarn install && yarn build` ist dagegen zwingend: Das Repository
enthält nicht alle fertigen JavaScript-Bündel. Insbesondere
`js/files_mediaviewer_init.js` entsteht erst beim Bauen; ohne diese Datei
lädt zwar die App, es wird aber keine einzige Dateiaktion registriert und der
Viewer öffnet nie. Alternativ kopieren Sie das Verzeichnis eines gebauten
Pakets an dieselbe Stelle.

In `appinfo/info.xml` ist `default_enable` gesetzt. Bei einer Neuinstallation
des Servers ist die App daher bereits aktiv; `app:enable` ist dann nicht mehr
nötig.

## Einstellungen

Die App selbst besitzt keine Konfigurationsschlüssel und keine
Einstellungsseite. Was sie anzeigen kann, steuern Sie über die
Vorschau-Einstellungen des Servers in `config/config.php`:

| Schlüssel                  | Standard | Wirkung                                                   |
| -------------------------- | -------- | --------------------------------------------------------- |
| `enable_previews`          | `true`   | `false` schaltet die Vorschau ab; dann bleibt jedes Bild leer. |
| `enabledPreviewProviders`  | s. u.    | Liste der aktiven Vorschau-Anbieter. Bestimmt, welche Bildtypen der Viewer anbietet. |
| `preview_max_x`            | `2048`   | Obergrenze der Vorschaubreite in Pixeln.                  |
| `preview_max_y`            | `2048`   | Obergrenze der Vorschauhöhe in Pixeln.                    |
| `preview_max_scale_factor` | `2`      | Zulässige Hochskalierung kleiner Vorlagen. `1` schaltet das Hochrechnen ab. (`2` ist die Vorgabe im Code für den nicht gesetzten Schlüssel; `config/config.sample.php` schlägt abweichend `10` vor.) |

Ohne gesetzten Schlüssel sind folgende Anbieter aktiv: `OC\Preview\MarkDown`,
`OC\Preview\MP3`, `OC\Preview\TXT`, `OC\Preview\PNG`, `OC\Preview\JPEG`,
`OC\Preview\WEBP`, `OC\Preview\GIF`, `OC\Preview\BMP`, `OC\Preview\Heic`,
`OC\Preview\XBitmap`, `OC\Preview\SGI`.

Sobald Sie `enabledPreviewProviders` selbst setzen, ersetzt Ihre Liste diese
Vorgabe vollständig. Tragen Sie deshalb auch die Anbieter ein, die Sie
behalten wollen. Ein Beispiel, das die Standard-Bildtypen behält und SVG
sowie TIFF ergänzt:

```php
  'enable_previews' => true,
  'enabledPreviewProviders' =>
  array (
    0 => 'OC\\Preview\\PNG',
    1 => 'OC\\Preview\\JPEG',
    2 => 'OC\\Preview\\WEBP',
    3 => 'OC\\Preview\\GIF',
    4 => 'OC\\Preview\\BMP',
    5 => 'OC\\Preview\\XBitmap',
    6 => 'OC\\Preview\\Heic',
    7 => 'OC\\Preview\\SGI',
    8 => 'OC\\Preview\\SVG',
    9 => 'OC\\Preview\\TIFF',
  ),
  'preview_max_scale_factor' => 1,
```

Wollen Sie zusätzlich Vorschaubilder von Videos in der Dateiliste, ergänzen
Sie `OC\Preview\Movie` und installieren `ffmpeg` oder `avconv` auf dem
Server. Auf die Wiedergabe im Viewer hat das keinen Einfluss.

Die Liste der anzeigbaren Typen wird beim Laden der Seite an den Browser
übergeben. Nach einer Änderung an der Konfiguration müssen Sie die
Dateiansicht neu laden.

## Fehlersuche

| Symptom | Ursache | Abhilfe |
| ------- | ------- | ------- |
| Der Klick auf ein Bild lädt die Datei herunter, der Viewer öffnet nicht. | Für diesen Mime-Typ ist kein Vorschau-Anbieter registriert, deshalb legt die App keine Dateiaktion an. | Passenden Anbieter in `enabledPreviewProviders` eintragen, gegebenenfalls `imagick` installieren, Seite neu laden. |
| Nach `git clone` reagiert die App gar nicht. | `js/files_mediaviewer_init.js` ist ein Bauartefakt und liegt nicht im Repository. | `yarn install && yarn build` ausführen oder das Paket aus dem Markt verwenden. |
| Viewer öffnet, das Bild bleibt leer, Meldung „Failed to load image data“. | Der Vorschau-Endpunkt antwortet mit 404, etwa weil `enable_previews` auf `false` steht oder für diese Datei keine Vorschau erzeugt werden kann. | `enable_previews` und die Anbieterliste prüfen, danach das Server-Log auswerten. |
| Ein Video hat keine Dateiaktion, der Klick lädt es herunter. | Der Browser meldet den Codec als nicht abspielbar, oder der Mime-Typ gehört nicht zu den vier unterstützten Videotypen. Beim ersten Fall bleibt die Datei in der Slideshow erreichbar, spielt dort aber nicht ab. | Datei nach MP4 (H.264/AAC) umwandeln oder einen Browser mit passendem Codec verwenden. |
| Video startet nicht, Meldung „Failed to load video data“. | Der direkte Abruf der Datei schlägt fehl — angemeldet über `remote.php/webdav`, im öffentlichen Link über `/s/<token>/download` —, etwa durch einen Proxy ohne Unterstützung für Teilabrufe (Range) oder durch fehlende Leserechte. | Proxy-Konfiguration und Freigaberechte prüfen. |
| In einem öffentlichen Link fehlen alle Vorschauen. | Der Link erteilt kein Leserecht, etwa bei einem reinen Upload-Link. Vorschau und Download antworten dann mit 404. | Freigabe mit Leserecht verwenden. |
| Bilder wirken unscharf oder werden klein dargestellt. | Der Viewer fordert je nach Fenster bis zu 3840 Pixel an, `preview_max_x`/`preview_max_y` begrenzen auf 2048; `preview_max_scale_factor` rechnet kleine Vorlagen hoch. | Grenzwerte erhöhen und `preview_max_scale_factor` auf `1` setzen. |

## Herkunft

Die App geht auf `files_mediaviewer` der ownCloud GmbH und deren Mitwirkende
zurück. Sie wurde von der BW-Tech GmbH für owncloud.online und PHP 8.4
angepasst. Lizenz: GPL Version 2 (siehe `LICENSE`).

Quelltext und Fehlermeldungen:
https://github.com/BWTECH-github/files_mediaviewer

Weitere Dokumentation zu owncloud.online: https://docs.owncloud.online
