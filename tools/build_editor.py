"""Schreibt den Dialog-Block (zwischen den Markern) und die Editor-Konfiguration in dashboard/index.html."""
import html, json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from editor_spec import TYPES
e = html.escape

def field(fid, prop, key, kind, label, x):
    wide = ' cc-wide' if x.get('wide') else ''
    if kind == 'multi':
        boxes = ''.join(f'<label class="cc-check"><input type="checkbox" value="{e(o)}"> {e(o)}</label>' for o in x['options'])
        return f'<fieldset class="cc-field cc-multi{wide}" id="{fid}"><legend>{e(label)}</legend><div class="cc-checks">{boxes}</div></fieldset>'
    if kind == 'select':
        labels = x.get('labels') or x['options']
        opts = '' if x.get('nonempty') else '<option value="">keine Angabe</option>'
        opts += ''.join(f'<option value="{e(o)}">{e(l)}</option>' for o, l in zip(x['options'], labels))
        ctl = f'<select class="dash-select" id="{fid}">{opts}</select>'
    elif kind == 'relation':
        ctl = f'<select class="dash-select" id="{fid}" data-draw="projekt-optionen" data-source="projekte"></select>'
    elif kind == 'area':
        ctl = f'<textarea class="cc-input" id="{fid}" rows="{x.get("rows", 3)}"></textarea>'
    elif kind == 'date':
        ctl = f'<input class="cc-input" id="{fid}" type="date" min="2020-01-01" max="2035-12-31">'
    elif kind == 'number':
        ctl = f'<input class="cc-input" id="{fid}" type="number" step="any" inputmode="decimal" placeholder="leer = unbekannt">'
    else:
        ctl = f'<input class="cc-input" id="{fid}" type="text" maxlength="500" autocomplete="off">'
    return f'<label class="cc-field{wide}" for="{fid}">{e(label)}{ctl}</label>'

parts = []
for t, cfg in TYPES.items():
    parts.append(f'<h2 class="cc-h2" data-type="{t}" data-mode="edit" hidden>{e(cfg["title"])} bearbeiten</h2>')
    parts.append(f'<h2 class="cc-h2" data-type="{t}" data-mode="new" hidden>{e(cfg["new"])}</h2>')
for t, cfg in TYPES.items():
    inner = ''.join(field(*f) for f in cfg['fields'])
    if cfg['progress']:
        pid = cfg['progress'][0]
        inner += f'<label class="cc-check cc-wide" for="{pid}"><input type="checkbox" id="{pid}"> „Letzter Fortschritt“ auf heute setzen</label>'
    if t == 'projekt':
        inner += ('<div class="cc-wide cc-sublist" data-mode="edit"><div class="cc-block-head"><span class="cc-label">Aufgaben in diesem Projekt</span>'
                  '<button type="button" class="cc-btn" data-new="aufgabe" data-prefill="projekt">Neue Aufgabe in diesem Projekt</button></div>'
                  '<ul class="cc-list" data-draw="editor-projekt-aufgaben" data-source="aufgaben"></ul></div>')
    parts.append(f'<div class="cc-form-grid" data-type="{t}" hidden>{inner}</div>')

dialog = f'''  <dialog class="cc-dialog" id="editor" aria-label="Eintrag bearbeiten">
    <form class="cc-form" id="editor-form" novalidate>
      <div class="cc-dialog-head">
        <div>{''.join(p for p in parts if p.startswith('<h2'))}</div>
        <span data-draw="editor-notion-link"></span>
      </div>
      {''.join(p for p in parts if not p.startswith('<h2'))}
      <p class="cc-msg is-bad" data-msg="noname" hidden>Bitte einen Titel eingeben.</p>
      <p class="cc-msg is-bad" data-msg="baddate" hidden>Ein Datum ist unvollständig.</p>
      <p class="cc-msg is-bad" data-msg="badnum" hidden>Bitte in Zahlenfeldern nur Zahlen eintragen. Leer heißt unbekannt.</p>
      <div class="cc-msgs" role="status" aria-live="polite">
        <p class="cc-msg is-wait" data-msg="saving" hidden>Wird in Notion gespeichert …</p>
        <p class="cc-msg is-ok" data-msg="saved" hidden>In Notion gespeichert.</p>
        <p class="cc-msg is-ok" data-msg="archived" hidden>Archiviert.</p>
        <p class="cc-msg is-ok" data-msg="deleted" hidden>In den Notion-Papierkorb verschoben. Dort lässt sich der Eintrag wiederherstellen.</p>
        <p class="cc-msg is-bad" data-msg="approval" hidden>Speichern braucht deine Freigabe für den Notion-Connector. Erlaube den Zugriff, wenn claude.ai danach fragt, und versuche es erneut.</p>
        <p class="cc-msg is-bad" data-msg="reconnect" hidden>Der Notion-Connector ist nicht verbunden oder abgelaufen. Verbinde Notion in claude.ai unter Einstellungen › Connectors neu.</p>
        <p class="cc-msg is-bad" data-msg="nomcp" hidden>In dieser Ansicht kann das Dashboard nicht in Notion schreiben. Öffne es in claude.ai.</p>
        <p class="cc-msg is-bad" data-msg="error" hidden>Notion hat die Änderung nicht übernommen: <span data-draw="save-detail"></span></p>
        <p class="cc-msg is-wait" data-msg="unchanged" hidden>Nichts geändert.</p>
      </div>
      <div class="cc-form-actions">
        <div>
          <button type="submit" class="cc-btn is-primary" id="dlg-save">Speichern</button>
          <button type="button" class="cc-btn" id="dlg-cancel">Schließen</button>
        </div>
        <div data-mode="edit">
          <button type="button" class="cc-btn" id="dlg-archive">Archivieren</button>
          <button type="button" class="cc-btn is-danger" id="dlg-archive-yes" hidden>Ja, archivieren</button>
          <button type="button" class="cc-btn is-danger" id="dlg-delete">Löschen</button>
          <button type="button" class="cc-btn is-danger" id="dlg-delete-yes" hidden>Ja, in den Papierkorb</button>
          <button type="button" class="cc-btn" id="dlg-confirm-no" hidden>Doch nicht</button>
        </div>
      </div>
    </form>
  </dialog>'''

cfg_js = {t: dict(dataset=c['dataset'], ds=c['ds'], archive=c['archive'],
                  progress=c['progress'][0] if c['progress'] else None,
                  fields=[dict(el=f[0], prop=f[1], key=f[2], kind=f[3], required=bool(f[5].get('required')), default=f[5].get('default'))
                          for f in c['fields']]) for t, c in TYPES.items()}

p = pathlib.Path(__file__).resolve().parent.parent / 'dashboard' / 'index.html'
s = p.read_text('utf-8')
s = re.sub(r'  <!-- editor:start -->.*?<!-- editor:end -->', lambda m: '  <!-- editor:start -->\n' + dialog + '\n  <!-- editor:end -->', s, flags=re.S)
s = re.sub(r'/\* editor-config:start \*/.*?/\* editor-config:end \*/',
           lambda m: '/* editor-config:start */ ' + json.dumps(cfg_js, ensure_ascii=False) + ' /* editor-config:end */', s, flags=re.S)
p.write_text(s, 'utf-8')
print('ok', len(s))
