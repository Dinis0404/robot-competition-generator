/* ==========================================================
   極簡 Markdown 解析器
   支援：frontmatter、標題、清單、引用、分隔線、
   粗體、斜體、行內程式碼、圖片、連結
   ========================================================== */
(function (global) {
  'use strict';

  /** 解析 `---` 包夾的 frontmatter，回傳 { attrs, body } */
  function parseFrontmatter(text) {
    const body = String(text).replace(/\r\n/g, '\n');
    const attrs = {};
    const m = body.match(/^---\n([\s\S]*?)\n---\n?/);
    let rest = body;
    if (m) {
      m[1].split('\n').forEach(function (line) {
        const kv = line.match(/^([A-Za-z0-9_\-]+)\s*:\s*(.*)$/);
        if (kv) {
          attrs[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
        }
      });
      rest = body.slice(m[0].length);
    }
    return { attrs: attrs, body: rest.trim() };
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** 行內語法 */
  function inline(s) {
    s = esc(s);
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return s;
  }

  /** 區塊級語法，回傳 HTML */
  function mdToHtml(md) {
    const lines = String(md).split('\n');
    const out = [];
    let list = null; // 'ul' | 'ol'

    function closeList() {
      if (list) { out.push('</' + list + '>'); list = null; }
    }

    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t) { closeList(); continue; }
      let m;
      if ((m = t.match(/^(#{1,4})\s+(.+)$/))) {
        closeList();
        const lv = Math.min(m[1].length + 2, 6); // # -> h3，避免搶頁面標題層級
        out.push('<h' + lv + '>' + inline(m[2]) + '</h' + lv + '>');
      } else if (/^(-{3,}|\*{3,})$/.test(t)) {
        closeList();
        out.push('<hr>');
      } else if ((m = t.match(/^[-*]\s+(.+)$/))) {
        if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
        out.push('<li>' + inline(m[1]) + '</li>');
      } else if ((m = t.match(/^\d+[.、)]\s+(.+)$/))) {
        if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; }
        out.push('<li>' + inline(m[1]) + '</li>');
      } else if ((m = t.match(/^>\s?(.*)$/))) {
        closeList();
        out.push('<blockquote>' + inline(m[1]) + '</blockquote>');
      } else {
        closeList();
        out.push('<p>' + inline(t) + '</p>');
      }
    }
    closeList();
    return out.join('\n');
  }

  /** 取正文第一行有意義的純文字（作為卡片摘要） */
  function firstPlain(md) {
    const lines = String(md).split('\n');
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t || /^#{1,4}\s/.test(t) || /^(-{3,}|\*{3,})$/.test(t) || /^>/.test(t)) continue;
      return t
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/[*`]/g, '')
        .trim();
    }
    return '';
  }

  global.MD = { parseFrontmatter: parseFrontmatter, mdToHtml: mdToHtml, firstPlain: firstPlain };
})(window);
