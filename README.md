# ProjectDashboard

Live-Dashboard für das Notion **Control Centre** (Projekte, Aufgaben, Content, Kennzahlen, Routinen).

**Dashboard:** https://claude.ai/artifact/RTn7H3d7DY5WXcmmH4JmJV

Das Dashboard ist ein Claude-Artifact vom Typ „Data“. Es liest die Notion-Datenbanken bei jedem Öffnen live über den Notion-Connector des jeweiligen Betrachters. Antworten, die jünger als 10 Minuten sind, werden wiederverwendet.

Die Abfragen nutzen gespeicherte **Notion-Ansichten** (View-Modus), nicht SQL: SQL-Abfragen haben unterhalb des Business-Plans ein gemeinsames Kontingent pro Workspace, das schnell aufgebraucht ist. Je Quelle wandelt ein `dash.loader` in `index.html` die Antwort in Zeilen um (alle Seiten, umbenannte Spalten). Wer Filter oder Spalten einer verwendeten Ansicht in Notion ändert, ändert damit auch, was das Dashboard zeigt.

| Quelle | Notion-Ansicht |
| --- | --- |
| projekte | Projekte › Aktive Projekte |
| aufgaben | Aufgaben › Aktive Aufgaben |
| content | Content › Default view |
| kennzahlen | Kennzahlen › Default view |
| routinen | Routinen › Default view |

## Ansichten

| Register | Inhalt |
| --- | --- |
| Übersicht | Lage-Satz, Kennzahlen-Leiste, Fokusliste (MUSS und bis morgen fällig), Projektfortschritt, Zeitleiste der letzten 7 und nächsten 14 Tage |
| Aufgaben | Kanban nach Status mit Suche und Filtern (Entität, Priorität), geparkte Aufgaben eingeklappt. Aufgaben sind bearbeitbar (siehe unten) |
| Projekte | Aktive, geplante und blockierte Projekte nach Bereich: Fortschritt, Meilenstein, Blocker, „ohne Fortschritt seit X Tagen“ |
| Content | Pipeline nach Status, Redaktionsplan, Ideenspeicher |
| Kennzahlen | Wochentabelle; leere Felder erscheinen als „k. A.“ (unbekannt, nicht null) |
| Routinen | Wiederkehrende Abläufe mit Rhythmus und nächster Aktion |

## Bearbeiten

Ein Klick auf eine Aufgabe, ein Projekt, einen Beitrag, eine Kennzahlen-Woche oder eine Routine öffnet das Bearbeiten-Menü. „In Notion öffnen“ steht oben im Menü.

- **Ändern:** alle Felder des Eintrags, bei Kennzahlen die Wochenzahlen (leer = unbekannt, nicht 0). Gesendet werden nur geänderte Felder.
- **Anlegen:** „Neue Aufgabe“, „Neues Projekt“, „Neuer Beitrag“, „Neue Woche“, „Neue Routine“; im Projekt-Menü „Neue Aufgabe in diesem Projekt“.
- **Archivieren** (Aufgaben, Projekte) setzt „Archiviert“. **Löschen** verschiebt den Eintrag in den Notion-Papierkorb (wiederherstellbar). Beides erst nach einer Rückfrage.
- **Erledigt** auf offenen Aufgabenkarten setzt Status und „Letzter Fortschritt“ in einem Schritt.

Geschrieben wird über den Notion-Connector der Person, die das Dashboard geöffnet hat (`notion-update-page`, `notion-create-pages`, `notion-delete-pages`), nur auf Knopfdruck. Die Felder des Menüs stehen in `tools/editor_spec.py`; `python3 tools/build_editor.py` erzeugt daraus Dialog und Konfiguration in `index.html`.

## Kacheln

Die Kennzahlen-Kacheln oben sind antippbar und zeigen darunter die Einträge dahinter: offene, MUSS-, überfällige und in 7 Tagen fällige Aufgaben, aktive Projekte und die Zahlen der jüngsten Woche (mit „Zahlen dieser Woche eintragen“).

## Aufbau

```
dashboard/
  index.html                 Seite (HTML, CSS, Skripte), gespeichert als files/index.html
  store/
    dash.meta.json           Titel und Sprache
    datasets.<id>.json       Live-Abfragen (Notion-Ansicht im View-Modus) je Datenbank
tools/
  editor_spec.py             Felder des Bearbeiten-Menüs je Datenbank
  build_editor.py            schreibt Dialog und Editor-Konfiguration in index.html
  editor.js                  Quelle des Editor-Skripts (in index.html eingebettet)
  pack-page.py               packt index.html als {"text": …} für den Upload
```

Die Seite liest Daten nur über `dash.data(id)`. Berechnete Werte (`kpis`, `projektstand`, `aufgabenstatus`, `contentstatus`) sind als `dash.calc` in `index.html` deklariert und im Dashboard unter „Sources“ einsehbar.

## Änderungen veröffentlichen

1. `dashboard/index.html` oder `dashboard/store/*.json` bearbeiten.
2. `python3 tools/pack-page.py build/files.index.html.json`
3. Die Dokumente in den Store des Artifacts schreiben (`files/index.html`, `datasets/<id>`). Am einfachsten Claude bitten: „Veröffentliche den Stand aus dem Repo im Dashboard.“

Änderungen, die direkt im Dashboard gemacht werden (Stift-Editor, Sources), landen nicht automatisch hier im Repo.
