/*
 * Cardápio dinâmico: lê o CSV publicado do Google Planilhas e monta o HTML
 * com a mesma estrutura usada pelo CSS (grid + subgrid).
 *
 * Uso: <div class="conteudoHolder" id="cardapio">Carregando cardápio…</div>
 *      <script src="cardapio.js" defer></script>
 */
(function () {
  "use strict";

  // 1) Cole aqui o link gerado em Arquivo > Compartilhar > Publicar na web (formato CSV)
  var CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOEe5xjPHHyTXWAPKQV1obr_ZBPfuqHjp4dQK-8FjqVH164QffoDER8Hw6qOa8EoQS5KA16J4SAKFc/pub?gid=1461428682&single=true&output=csv";

  var CACHE_KEY = "cardapio_csv_v1";
  var container = document.getElementById("cardapio");
  if (!container) return;

  /* ---------- CSV ---------- */

  // Parser simples que respeita aspas, vírgulas e quebras de linha dentro de células
  function parseCSV(text) {
    var rows = [], row = [], field = "", inQuotes = false;
    text = text.replace(/^\uFEFF/, "");
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field); field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        rows.push(row); row = [];
      } else field += ch;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  // Converte as linhas em objetos usando o cabeçalho (primeira linha)
  function toObjects(rows) {
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    return rows.slice(1).map(function (r) {
      var o = {};
      head.forEach(function (h, i) { o[h] = (r[i] || "").trim(); });
      return o;
    }).filter(function (o) { return o.categoria && o.item; });
  }

  /* ---------- HTML ---------- */

  // Sempre textContent (nunca innerHTML): a planilha é editável por outras pessoas
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function linhaComTexto(texto, italico) {
    var linha = el("div");
    var span = el("span");
    if (texto) {
      if (italico) span.appendChild(el("i", null, texto));
      else span.textContent = texto;
    }
    linha.appendChild(span);
    return linha;
  }

  function render(items) {
    if (!items.length) throw new Error("planilha vazia");

    // Agrupa por coluna e depois por categoria, mantendo a ordem da planilha
    var colunas = {};
    items.forEach(function (o) {
      var c = o.coluna || "1";
      var lista = colunas[c] = colunas[c] || [];
      var bloco = lista.filter(function (b) { return b.nome === o.categoria; })[0];
      if (!bloco) {
        bloco = { nome: o.categoria, preco: "", itens: [] };
        lista.push(bloco);
      }
      if (!bloco.preco && o.preco_categoria) bloco.preco = o.preco_categoria;
      bloco.itens.push(o);
    });

    container.textContent = "";

    Object.keys(colunas).sort(function (a, b) { return a - b; }).forEach(function (k) {
      var conjunto = el("div", "conjuntoDoces");

      colunas[k].forEach(function (b) {
        var tipo = el("div", "tipoProdutos");

        var cab = el("div", "cabecalho");
        cab.appendChild(el("span", null, b.nome));
        if (b.preco) cab.appendChild(el("span", null, b.preco));
        tipo.appendChild(cab);

        var itens = el("div", "itens");
        var ultimoSub = "";

        b.itens.forEach(function (it, idx) {
          // Mudou o subtítulo: espaçamento + rótulo em itálico
          if (it.subtitulo !== ultimoSub) {
            if (idx > 0) itens.appendChild(linhaComTexto(""));
            if (it.subtitulo) itens.appendChild(linhaComTexto(it.subtitulo, true));
            ultimoSub = it.subtitulo;
          }

          var linha = el("div");
          var nome = el("span");
          if (it.detalhes) {
            nome.appendChild(el("i", null, it.item));
            nome.appendChild(document.createTextNode(" " + it.detalhes));
          } else {
            nome.textContent = it.item;
          }
          linha.appendChild(nome);
          if (it.preco_item) linha.appendChild(el("span", "preco", it.preco_item));
          itens.appendChild(linha);
        });

        tipo.appendChild(itens);
        conjunto.appendChild(tipo);
      });

      container.appendChild(conjunto);
    });
  }

  function mostrar(csv) {
    render(toObjects(parseCSV(csv)));
  }

  /* ---------- Carregamento ---------- */

  fetch(CSV_URL)
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    })
    .then(function (csv) {
      mostrar(csv);
      try { localStorage.setItem(CACHE_KEY, csv); } catch (e) {}
    })
    .catch(function () {
      // Falhou (sem internet, planilha fora do ar...): usa a última versão salva no aparelho
      var cache = null;
      try { cache = localStorage.getItem(CACHE_KEY); } catch (e) {}
      if (cache) {
        try { mostrar(cache); return; } catch (e) {}
      }
      container.textContent = "Não foi possível carregar o cardápio agora. Tente novamente em instantes.";
    });
})();
