  /* Bearbeiten-Menü für Aufgaben, Projekte, Content, Kennzahlen und Routinen.
     Schreibt nur auf Knopfdruck über den Notion-Connector des Betrachters. Feldliste: tools/editor_spec.py */
  window.ccEdit = (() => {
    const TYPES = /* editor-config:start */ {} /* editor-config:end */;
    const st = { type: null, mode: 'edit', row: null, projekt: '', dirty: new Set(), detail: '', busy: false, confirm: null };
    const byId = (id) => document.getElementById(id);
    const pageId = (u) => ((String(u || '').match(/[0-9a-f]{32}/i) || [''])[0]).toLowerCase();
    let barTimer = 0;

    function setMsg(scope, key) {
      if (!scope) return;
      scope.querySelectorAll('[data-msg]').forEach((p) => { p.hidden = p.getAttribute('data-msg') !== key; });
    }
    function bar(key, autoHide) {
      clearTimeout(barTimer);
      setMsg(byId('speicherstatus'), key);
      if (autoHide) barTimer = setTimeout(() => setMsg(byId('speicherstatus'), ''), 6000);
    }

    dash.draw('save-detail', (el) => { el.textContent = st.detail || 'unbekannter Fehler'; });

    dash.draw('editor-notion-link', (el) => {
      const url = st.row && st.row.url;
      if (st.mode === 'edit' && typeof url === 'string' && url.startsWith('https://')) {
        el.replaceChildren(cc.link(url, 'In Notion öffnen', 'cc-notion-link'));
      } else {
        el.replaceChildren();
      }
    });

    function projectsAll() { const d = dash.data('projekte'); return d.status === 'ok' ? d.data : []; }
    function currentProject(row) {
      const ids = cc.list(row && row.projekt_urls).map(pageId).filter(Boolean);
      if (!ids.length) return '';
      const p = projectsAll().find((x) => ids.includes(pageId(x.url)));
      return p ? p.url : 'https://www.notion.so/' + ids[0];
    }

    dash.draw('projekt-optionen', (sel) => {
      const all = projectsAll();
      const choose = all.filter((p) => p.status !== 'Abgeschlossen' || pageId(p.url) === pageId(st.projekt));
      const opts = [new Option('kein Projekt', ''), ...choose.map((p) => new Option(p.name || 'ohne Titel', p.url))];
      if (st.projekt && !choose.some((p) => pageId(p.url) === pageId(st.projekt))) opts.push(new Option('verknüpftes Projekt', st.projekt));
      sel.replaceChildren(...opts);
      sel.value = st.projekt;
      sel.onchange = () => { st.projekt = sel.value; st.dirty.add(sel.id); };
    });

    dash.draw('editor-projekt-aufgaben', (el) => {
      if (st.type !== 'projekt' || !st.row) { el.replaceChildren(); return; }
      const s = cc.state(el, ['aufgaben']);
      if (!s.ok) return cc.fallback(el, s, 'Die Aufgaben');
      const id = pageId(st.row.url);
      const rows = dash.data('aufgaben').data
        .filter((a) => cc.list(a.projekt_urls).map(pageId).includes(id))
        .sort((a, b) => Number(!cc.isOpen(a)) - Number(!cc.isOpen(b)) || cc.byPrioThenDeadline(a, b));
      el.replaceChildren(...rows.map((r) => cc.taskCard(r, { status: true, next: false, actions: false })));
      if (!rows.length) el.replaceChildren(cc.emptyItem('Noch keine verknüpften Aufgaben.'));
    });

    function setBusy(on) {
      st.busy = on;
      ['dlg-save', 'dlg-archive', 'dlg-archive-yes', 'dlg-delete', 'dlg-delete-yes'].forEach((id) => { const b = byId(id); if (b) b.disabled = on; });
    }
    function showConfirm(which) {
      st.confirm = which;
      const cfg = TYPES[st.type] || {};
      const vis = {
        'dlg-archive': !which && cfg.archive, 'dlg-delete': !which,
        'dlg-archive-yes': which === 'archive', 'dlg-delete-yes': which === 'delete', 'dlg-confirm-no': !!which
      };
      Object.entries(vis).forEach(([id, on]) => { const b = byId(id); if (b) b.hidden = !on; });
    }

    function isoWeekStart() {
      const d = new Date(); const dow = d.getDay() || 7;
      const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow + 1);
      const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
      const t = new Date(Date.UTC(mon.getFullYear(), mon.getMonth(), mon.getDate() + 3));
      const y1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
      const wk = Math.ceil(((t - y1) / 864e5 + 1) / 7);
      const p = (n) => String(n).padStart(2, '0');
      const iso = `${mon.getFullYear()}-${p(mon.getMonth() + 1)}-${p(mon.getDate())}`;
      const range = mon.getMonth() === sun.getMonth()
        ? `${p(mon.getDate())}.–${p(sun.getDate())}.${p(sun.getMonth() + 1)}.${sun.getFullYear()}`
        : `${p(mon.getDate())}.${p(mon.getMonth() + 1)}.–${p(sun.getDate())}.${p(sun.getMonth() + 1)}.${sun.getFullYear()}`;
      return { stichtag: iso, zeitraum: `KW${wk} · ${range}` };
    }

    function fill(cfg, row, prefill) {
      cfg.fields.forEach((f) => {
        const el = byId(f.el);
        if (!el) return;
        const v = row ? row[f.key] : (prefill[f.key] ?? f.default ?? null);
        if (f.kind === 'multi') {
          const arr = cc.list(v);
          el.querySelectorAll('input[type="checkbox"]').forEach((c) => { c.checked = arr.includes(c.value); });
        } else if (f.kind === 'relation') {
          st.projekt = row ? currentProject(row) : (prefill.projekt_url || '');
        } else if (f.kind === 'date') {
          el.value = v ? cc.day(v) : '';
        } else {
          el.value = v == null ? '' : String(v);
        }
      });
      if (cfg.progress) { const fc = byId(cfg.progress); if (fc) fc.checked = false; }
    }

    function open(type, row, prefill) {
      const d = byId('editor'), f = byId('editor-form');
      const cfg = TYPES[type];
      if (!d || !f || !cfg) return;
      st.type = type; st.mode = row ? 'edit' : 'new'; st.row = row || null; st.dirty = new Set();
      f.querySelectorAll('[data-type]').forEach((x) => {
        const okType = x.getAttribute('data-type') === type;
        const m = x.getAttribute('data-mode');
        x.hidden = !(okType && (!m || m === st.mode));
      });
      f.querySelectorAll('[data-mode]:not([data-type])').forEach((x) => { x.hidden = x.getAttribute('data-mode') !== st.mode; });
      let pre = prefill || {};
      if (!row && type === 'aufgabe') { const p = dash.params() || {}; pre = { prio: p.prio || null, entitaet: p.entitaet || null, ...pre }; }
      if (!row && type === 'kennzahl') pre = { ...isoWeekStart(), erfasst_durch: 'Chris', ...pre };
      fill(cfg, row, pre);
      ['projekt-optionen', 'editor-notion-link', 'editor-projekt-aufgaben'].forEach((n) => dash.draw(n));
      showConfirm(null);
      setMsg(f, '');
      setBusy(false);
      if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
      const first = byId(cfg.fields[0].el); if (first) first.focus();
    }
    function close() { const d = byId('editor'); if (!d) return; if (typeof d.close === 'function') d.close(); else d.removeAttribute('open'); }

    function readField(f) {
      const el = byId(f.el);
      if (!el) return { skip: true };
      if (f.kind === 'multi') return { value: [...el.querySelectorAll('input[type="checkbox"]')].filter((c) => c.checked).map((c) => c.value) };
      if (f.kind === 'relation') return { value: st.projekt };
      const raw = String(el.value || '').trim();
      if (f.kind === 'date') {
        if (raw && (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || (el.validity && !el.validity.valid))) return { error: 'baddate' };
        return { value: raw };
      }
      if (f.kind === 'number') {
        if (raw === '') return { value: null };
        const n = Number(raw.replace(',', '.'));
        return Number.isFinite(n) ? { value: n } : { error: 'badnum' };
      }
      return { value: raw };
    }

    function collect() {
      const cfg = TYPES[st.type];
      const f = byId('editor-form');
      const isNew = st.mode === 'new';
      const o = st.row || {};
      const props = {};
      for (const fd of cfg.fields) {
        if (!isNew && !st.dirty.has(fd.el)) continue;
        const r = readField(fd);
        if (r.skip) continue;
        if (r.error) { setMsg(f, r.error); return null; }
        const v = r.value;
        if (fd.required && !v) { setMsg(f, 'noname'); return null; }
        if (fd.kind === 'multi') {
          const before = JSON.stringify([...cc.list(o[fd.key])].sort());
          if (isNew ? v.length : JSON.stringify([...v].sort()) !== before) props[fd.prop] = v.length ? JSON.stringify(v) : null;
        } else if (fd.kind === 'relation') {
          if (pageId(v) !== pageId(isNew ? '' : currentProject(o))) {
            props[fd.prop] = v ? [v] : null;
            const p = projectsAll().find((x) => pageId(x.url) === pageId(v));
            const textField = cfg.fields.find((x) => x.key === 'projekt');
            if (p && textField && !o.projekt && !st.dirty.has(textField.el)) props[textField.prop] = p.name;
          }
        } else if (fd.kind === 'date') {
          const before = o[fd.key] ? cc.day(o[fd.key]) : '';
          if (isNew ? v : v !== before) {
            props[`date:${fd.prop}:start`] = v || null;
            if (v) props[`date:${fd.prop}:is_datetime`] = 0;
          }
        } else if (fd.kind === 'number') {
          const before = o[fd.key] == null || o[fd.key] === '' ? null : Number(o[fd.key]);
          if (isNew ? v != null : v !== before) props[fd.prop] = v;
        } else {
          if (isNew ? v : v !== String(o[fd.key] ?? '')) props[fd.prop] = v || null;
        }
      }
      if (cfg.progress) {
        const fc = byId(cfg.progress);
        if (fc && fc.checked) { props['date:Letzter Fortschritt:start'] = cc.today(); props['date:Letzter Fortschritt:is_datetime'] = 0; }
      }
      if (isNew && cfg.archive) props['Archiviert'] = '__NO__';
      return props;
    }

    function errKey(e) {
      const c = e && e.code;
      if (['approval_required', 'not_granted', 'not_in_manifest', 'consent_required'].includes(c)) return 'approval';
      if (['needs_reauth', 'server_not_connected', 'selection_required', 'server_not_found'].includes(c)) return 'reconnect';
      if (['capability_disabled', 'capability_removed'].includes(c)) return 'nomcp';
      return 'error';
    }

    async function call(tool, input) {
      const mcp = await claude.use('mcp');
      if (!mcp) return { key: 'nomcp' };
      try {
        await mcp.callTool('Notion', tool, input);
        return { key: 'ok' };
      } catch (e) {
        const key = errKey(e);
        if (key === 'error') {
          let m = String((e && e.message) || (e && e.code) || '');
          try { const j = JSON.parse(m); m = (j && (j.message || (j.error && j.error.message))) || m; } catch { /* Text bleibt */ }
          st.detail = `${m.slice(0, 300)}${e && e.code ? ` (${e.code})` : ''}`;
          dash.draw('save-detail');
        }
        return { key };
      }
    }
    const update = (row, props) => call('notion-update-page', { page_id: row.url, command: 'update_properties', properties: props, allow_async: false });
    const create = (cfg, props) => call('notion-create-pages', { parent: { data_source_id: cfg.ds }, pages: [{ properties: props }], allow_async: false });
    const trash = (row) => call('notion-delete-pages', { page_ids: [pageId(row.url)], user_confirmed: true });

    function reload(type) {
      const ds = TYPES[type] && TYPES[type].dataset;
      if (!ds) return;
      dash.refresh(ds);
      setTimeout(() => dash.refresh(ds), 3000);
    }

    async function run(action, okKey) {
      if (st.busy) return;
      const f = byId('editor-form');
      setBusy(true);
      setMsg(f, 'saving');
      const res = await action();
      setBusy(false);
      const key = res.key === 'ok' ? okKey : res.key;
      setMsg(f, key);
      if (res.key === 'ok') {
        bar(okKey, true);
        reload(st.type);
        setTimeout(close, okKey === 'saved' ? 700 : 1400);
      } else {
        showConfirm(null);
      }
    }

    function submit() {
      const props = collect();
      if (!props) return;
      if (!Object.keys(props).length) { setMsg(byId('editor-form'), 'unchanged'); return; }
      const cfg = TYPES[st.type];
      run(() => (st.mode === 'edit' ? update(st.row, props) : create(cfg, props)), 'saved');
    }

    async function quickDone(row, btn) {
      if (!row || !row.url) return;
      if (btn) btn.disabled = true;
      bar('saving');
      const res = await update(row, { 'Status': 'Erledigt', 'date:Letzter Fortschritt:start': cc.today(), 'date:Letzter Fortschritt:is_datetime': 0 });
      bar(res.key === 'ok' ? 'saved' : res.key, res.key === 'ok');
      if (res.key === 'ok') reload('aufgabe');
      else if (btn) btn.disabled = false;
    }

    /* Bedienung */
    const form = byId('editor-form');
    if (form) {
      form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
      const markDirty = (e) => {
        const holder = e.target && e.target.closest ? e.target.closest('[id]') : null;
        if (!holder) return;
        const multi = e.target.closest('.cc-multi');
        st.dirty.add(multi ? multi.id : holder.id);
      };
      form.addEventListener('input', markDirty);
      form.addEventListener('change', markDirty);
      form.addEventListener('change', (e) => {
        const cfg = TYPES[st.type];
        if (!cfg || !cfg.progress || st.mode !== 'edit' || !st.row) return;
        const statusField = cfg.fields.find((x) => x.key === 'status');
        if (statusField && e.target && e.target.id === statusField.el && e.target.value !== st.row.status) {
          const fc = byId(cfg.progress); if (fc) fc.checked = true;
        }
      });
    }
    document.querySelectorAll('#dlg-cancel').forEach((b) => b.addEventListener('click', close));
    document.querySelectorAll('#dlg-archive').forEach((b) => b.addEventListener('click', () => showConfirm('archive')));
    document.querySelectorAll('#dlg-delete').forEach((b) => b.addEventListener('click', () => showConfirm('delete')));
    document.querySelectorAll('#dlg-confirm-no').forEach((b) => b.addEventListener('click', () => showConfirm(null)));
    document.querySelectorAll('#dlg-archive-yes').forEach((b) => b.addEventListener('click', () => {
      if (st.mode === 'edit' && st.row) run(() => update(st.row, { 'Archiviert': '__YES__' }), 'archived');
    }));
    document.querySelectorAll('#dlg-delete-yes').forEach((b) => b.addEventListener('click', () => {
      if (st.mode === 'edit' && st.row) run(() => trash(st.row), 'deleted');
    }));
    document.querySelectorAll('[data-new]').forEach((b) => b.addEventListener('click', () => {
      const type = b.getAttribute('data-new');
      let prefill = {};
      if (b.getAttribute('data-prefill') === 'projekt' && st.type === 'projekt' && st.row) {
        prefill = { projekt_url: st.row.url, entitaet: st.row.entitaet || null };
      }
      open(type, null, prefill);
    }));

    return { open, quickDone };
  })();
