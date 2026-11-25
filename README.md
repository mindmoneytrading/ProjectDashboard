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

## Aufgaben bearbeiten

Jede Aufgabenkarte hat „Bearbeiten“ und „Erledigt“, dazu gibt es „Neue Aufgabe“ in Übersicht und Aufgaben. Gespeichert wird direkt in Notion über den Notion-Connector der Person, die das Dashboard geöffnet hat (`notion-update-page`, `notion-create-pages`), und nur auf Knopfdruck. Beim Bearbeiten werden nur geänderte Felder gesendet. „Archivieren“ setzt das Feld „Archiviert“ nach einer Rückfrage; nichts wird gelöscht.

Bearbeitbar: Titel, Status, Priorität, Deadline, Entität, Projekt (Projekt-Verknüpfung), Nächster Schritt, Fertigkriterium und optional „Letzter Fortschritt“ = heute (bei Statuswechsel vorausgewählt).

## Aufbau

```
dashboard/
  index.html                 Seite (HTML, CSS, Skripte), gespeichert als files/index.html
  store/
    dash.meta.json           Titel und Sprache
    datasets.<id>.json       Live-Abfragen (Notion-Ansicht im View-Modus) je Datenbank
tools/
  pack-page.py               packt index.html als {"text": …} für den Upload
```

Die Seite liest Daten nur über `dash.data(id)`. Berechnete Werte (`kpis`, `projektstand`, `aufgabenstatus`, `contentstatus`) sind als `dash.calc` in `index.html` deklariert und im Dashboard unter „Sources“ einsehbar.

## Änderungen veröffentlichen

1. `dashboard/index.html` oder `dashboard/store/*.json` bearbeiten.
2. `python3 tools/pack-page.py build/files.index.html.json`
3. Die Dokumente in den Store des Artifacts schreiben (`files/index.html`, `datasets/<id>`). Am einfachsten Claude bitten: „Veröffentliche den Stand aus dem Repo im Dashboard.“

Änderungen, die direkt im Dashboard gemacht werden (Stift-Editor, Sources), landen nicht automatisch hier im Repo.
