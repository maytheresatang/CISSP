/* Site-wide search for CISSP Study Notes.
   Injects a search bar (top right) on every page, searches the current page
   (including hidden tabs) plus every other page, and jumps to + highlights matches. */
(function () {
  'use strict';

  var PAGES = [
    { file: 'index.html',   title: 'Home' },
    { file: 'domain1.html', title: 'Domain 1 · Security & Risk Management' },
    { file: 'domain2.html', title: 'Domain 2 · Asset Security' },
    { file: 'domain3.html', title: 'Domain 3 · Security Architecture & Engineering' },
    { file: 'domain4.html', title: 'Domain 4 · Communication & Network Security' },
    { file: 'domain5.html', title: 'Domain 5 · Identity & Access Management' },
    { file: 'domain6.html', title: 'Domain 6 · Security Assessment & Testing' },
    { file: 'domain7.html', title: 'Domain 7 · Security Operations' },
    { file: 'domain8.html', title: 'Domain 8 · Software Development Security' }
  ];

  var currentFile = location.pathname.split('/').pop() || 'index.html';
  if (currentFile.indexOf('.html') === -1) currentFile = 'index.html';

  var ICON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2.5' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cline x1='21' y1='21' x2='16.5' y2='16.5'/%3E%3C/svg%3E\")";

  var CSS = [
    '.site-search{position:relative;z-index:200;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
    '.site-search input{width:240px;max-width:70vw;padding:7px 12px 7px 32px;border:1px solid #CBD5E1;border-radius:20px;font-size:13px;color:#1E293B;background:#fff ' + ICON + ' no-repeat 11px center;outline:none;transition:border-color .2s,box-shadow .2s;-webkit-appearance:none;appearance:none;}',
    '.site-search input:focus{border-color:#0D9488;box-shadow:0 0 0 3px rgba(13,148,136,.18);}',
    '.home-bar.has-search{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}',
    '.header.has-search{position:relative;}',
    '.header.has-search .site-search{position:absolute;top:18px;right:28px;}',
    '.ss-results{position:absolute;top:calc(100% + 6px);right:0;width:400px;max-width:92vw;max-height:60vh;overflow-y:auto;background:#fff;border:1px solid #E2E8F0;border-radius:10px;box-shadow:0 12px 32px rgba(2,6,23,.2);text-align:left;}',
    '.ss-item{display:block;width:100%;text-align:left;background:none;border:none;font:inherit;padding:10px 14px;border-bottom:1px solid #F1F5F9;text-decoration:none;color:#1E293B;cursor:pointer;font-size:13px;line-height:1.45;}',
    '.ss-item:last-child{border-bottom:none;}',
    '.ss-item:hover,.ss-item.sel{background:#F0FDFA;}',
    '.ss-where{font-size:11px;font-weight:700;color:#0D9488;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;display:flex;justify-content:space-between;gap:8px;}',
    '.ss-count{color:#64748B;font-weight:600;letter-spacing:0;text-transform:none;}',
    '.ss-snippet{color:#334155;}',
    '.ss-snippet mark{background:#FEF3C7;color:#92400E;border-radius:3px;padding:0 2px;}',
    '.ss-empty,.ss-note{padding:12px 14px;color:#64748B;font-size:13px;}',
    'mark.ss-mark{background:#FDE68A;color:#78350F;border-radius:3px;padding:0 1px;}',
    '@media(max-width:640px){.header.has-search .site-search{position:static;margin-top:14px;}.site-search input{width:100%;max-width:none;}.home-bar.has-search .site-search{flex:1;min-width:180px;}.ss-results{left:0;right:auto;width:100%;}}'
  ].join('\n');

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }

  /* ---- section extraction (works on this document or a fetched one) ---- */
  function tabLabel(doc, id) {
    var btns = doc.querySelectorAll('.tab-btn');
    for (var i = 0; i < btns.length; i++) {
      var oc = btns[i].getAttribute('onclick') || '';
      if (oc.indexOf("'" + id + "'") !== -1) return btns[i].textContent.trim();
    }
    return id;
  }

  function getSections(doc, page) {
    var out = [];
    var tabs = doc.querySelectorAll('.tab-content');
    if (tabs.length) {
      for (var i = 0; i < tabs.length; i++) {
        out.push({ page: page, id: tabs[i].id, label: tabLabel(doc, tabs[i].id), text: norm(tabs[i].textContent) });
      }
    } else {
      var content = doc.querySelector('.content') || doc.body;
      out.push({ page: page, id: '', label: 'Page content', text: norm(content.textContent) });
    }
    return out;
  }

  var localSections = getSections(document, PAGES.filter(function (p) { return p.file === currentFile; })[0] || { file: currentFile, title: document.title });

  /* ---- lazy cross-page index ---- */
  var remoteSections = null;   // null = not loaded, [] possible after load
  var remoteState = 'idle';    // idle | loading | done | failed

  function loadRemote(onDone) {
    if (remoteState !== 'idle') return;
    remoteState = 'loading';
    var others = PAGES.filter(function (p) { return p.file !== currentFile; });
    var parser = new DOMParser();
    Promise.all(others.map(function (p) {
      return fetch(p.file).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.text();
      }).then(function (html) {
        return getSections(parser.parseFromString(html, 'text/html'), p);
      }).catch(function () { return []; });
    })).then(function (lists) {
      remoteSections = [].concat.apply([], lists);
      remoteState = remoteSections.length ? 'done' : 'failed';
      onDone();
    }).catch(function () {
      remoteSections = [];
      remoteState = 'failed';
      onDone();
    });
  }

  /* ---- searching ---- */
  function matchSection(section, term) {
    var re = new RegExp(escapeRe(term), 'gi');
    var hits = section.text.match(re);
    if (!hits) return null;
    var idx = section.text.search(re);
    var start = Math.max(0, idx - 45);
    var end = Math.min(section.text.length, idx + term.length + 70);
    var raw = section.text.slice(start, end);
    var snippet = escapeHtml(raw).replace(new RegExp(escapeRe(escapeHtml(term)), 'gi'), function (m) { return '<mark>' + m + '</mark>'; });
    if (start > 0) snippet = '…' + snippet;
    if (end < section.text.length) snippet += '…';
    return { section: section, count: hits.length, snippet: snippet };
  }

  function search(term) {
    var results = [];
    localSections.forEach(function (s) {
      var m = matchSection(s, term);
      if (m) { m.local = true; results.push(m); }
    });
    if (remoteSections) {
      remoteSections.forEach(function (s) {
        var m = matchSection(s, term);
        if (m) { m.local = false; results.push(m); }
      });
    }
    return results.slice(0, 40);
  }

  /* ---- highlighting in the live page ---- */
  function clearMarks() {
    var marks = document.querySelectorAll('mark.ss-mark');
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i], parent = m.parentNode;
      parent.replaceChild(document.createTextNode(m.textContent), m);
      parent.normalize();
    }
  }

  function markMatches(scope, term) {
    var re = new RegExp(escapeRe(term), 'gi');
    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var t = node.parentNode && node.parentNode.nodeName;
        if (t === 'SCRIPT' || t === 'STYLE' || t === 'MARK') return NodeFilter.FILTER_REJECT;
        return re.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      var text = node.nodeValue, last = 0, m;
      re.lastIndex = 0;
      while ((m = re.exec(text)) !== null) {
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        var mark = document.createElement('mark');
        mark.className = 'ss-mark';
        mark.textContent = m[0];
        frag.appendChild(mark);
        last = m.index + m[0].length;
      }
      frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  function activateTab(id) {
    var target = document.getElementById(id);
    if (!target || !target.classList.contains('tab-content')) return;
    var i;
    var contents = document.querySelectorAll('.tab-content');
    for (i = 0; i < contents.length; i++) contents[i].classList.remove('active');
    target.classList.add('active');
    var btns = document.querySelectorAll('.tab-btn');
    for (i = 0; i < btns.length; i++) {
      var oc = btns[i].getAttribute('onclick') || '';
      btns[i].classList.toggle('active', oc.indexOf("'" + id + "'") !== -1);
    }
  }

  function jumpTo(sectionId, term) {
    clearMarks();
    var scope;
    if (sectionId) {
      activateTab(sectionId);
      scope = document.getElementById(sectionId);
    }
    if (!scope) scope = document.querySelector('.content') || document.body;
    markMatches(scope, term);
    var first = scope.querySelector('mark.ss-mark');
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ---- widget ---- */
  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  var wrap = document.createElement('div');
  wrap.className = 'site-search';
  wrap.innerHTML = '<input type="search" placeholder="Search all notes…" aria-label="Search study notes" autocomplete="off">' +
                   '<div class="ss-results" hidden></div>';

  var homeBar = document.querySelector('.home-bar');
  var header = document.querySelector('.header');
  if (homeBar) { homeBar.classList.add('has-search'); homeBar.appendChild(wrap); }
  else if (header) { header.classList.add('has-search'); header.appendChild(wrap); }
  else { document.body.insertBefore(wrap, document.body.firstChild); }

  var input = wrap.querySelector('input');
  var panel = wrap.querySelector('.ss-results');
  var sel = -1;

  function close() { panel.hidden = true; sel = -1; }

  function render() {
    var term = input.value.trim();
    sel = -1;
    if (term.length < 2) { close(); return; }
    if (remoteState === 'idle') loadRemote(render);

    var results = search(term);
    var html = '';
    results.forEach(function (r) {
      var where = r.local
        ? escapeHtml((r.section.page.title !== 'Home' ? 'This page · ' : 'Home · ') + r.section.label)
        : escapeHtml(r.section.page.title + (r.section.label && r.section.label !== 'Page content' ? ' · ' + r.section.label : ''));
      var countTxt = r.count + (r.count === 1 ? ' match' : ' matches');
      if (r.local) {
        html += '<button type="button" class="ss-item" data-section="' + escapeHtml(r.section.id) + '">';
      } else {
        var href = r.section.page.file + '?q=' + encodeURIComponent(term) + (r.section.id ? '#' + encodeURIComponent(r.section.id) : '');
        html += '<a class="ss-item" href="' + escapeHtml(href) + '">';
      }
      html += '<div class="ss-where"><span>' + where + '</span><span class="ss-count">' + countTxt + '</span></div>' +
              '<div class="ss-snippet">' + r.snippet + '</div>' +
              (r.local ? '</button>' : '</a>');
    });
    if (!results.length) html = '<div class="ss-empty">No matches for “' + escapeHtml(term) + '”' + (remoteState === 'loading' ? ' yet' : '') + '.</div>';
    if (remoteState === 'loading') html += '<div class="ss-note">Searching other domains…</div>';
    if (remoteState === 'failed') html += '<div class="ss-note">Other pages couldn’t be searched (open via a web server for cross-page results).</div>';
    panel.innerHTML = html;
    panel.hidden = false;
  }

  var debounceTimer;
  input.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(render, 150);
  });
  input.addEventListener('focus', function () { if (input.value.trim().length >= 2) render(); });

  input.addEventListener('keydown', function (e) {
    var items = panel.querySelectorAll('.ss-item');
    if (e.key === 'Escape') { input.value = ''; close(); clearMarks(); input.blur(); return; }
    if (panel.hidden || !items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      sel = e.key === 'ArrowDown' ? Math.min(sel + 1, items.length - 1) : Math.max(sel - 1, 0);
      for (var i = 0; i < items.length; i++) items[i].classList.toggle('sel', i === sel);
      items[sel].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[sel === -1 ? 0 : sel].click();
    }
  });

  panel.addEventListener('click', function (e) {
    var item = e.target.closest('.ss-item');
    if (!item || !item.hasAttribute('data-section')) return; // links navigate on their own
    jumpTo(item.getAttribute('data-section'), input.value.trim());
    close();
  });

  document.addEventListener('click', function (e) {
    if (!wrap.contains(e.target)) close();
  });

  /* ---- honour ?q= arriving from another page ---- */
  var params = new URLSearchParams(location.search);
  var q = (params.get('q') || '').trim();
  if (q) {
    input.value = q;
    var hashId = decodeURIComponent(location.hash.replace('#', ''));
    var target = hashId && document.getElementById(hashId) ? hashId : '';
    if (!target) {
      for (var i = 0; i < localSections.length; i++) {
        if (matchSection(localSections[i], q)) { target = localSections[i].id; break; }
      }
    }
    jumpTo(target, q);
  }
})();
