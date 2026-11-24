/* ==========================================================================
   SORA — script.js (shared by every page)
   Each feature runs only if its elements exist on the current page:
     product.html : #filter-bar, #product-list
     order.html   : #orderForm, #customerName, #contact, #items, #total, #note
     admin.html   : #ordersTable tbody
   ========================================================================== */

var ORDER_API_URL =
  "https://script.google.com/macros/s/AKfycbwQnd1FyIq5RR6V-Yw6Enm-ebp-uovQR3jZtwxwZii-Mv8XbNKzPNGoXsvtfx0fVlQr/exec";

var CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vT1rjpg7R3tJLph2fqd060VkDia51O-nFwh1RGx6XIYREDSqKRILBOSxmJZg7kGs7JQIZuaQFHBkS9R/pub?gid=0&single=true&output=csv";

var MOODS = ["Botanical Harmony", "Lavender Infusion", "Peach Blossom Infusion"];

var MOOD_CLASS = {
  "Botanical Harmony": "mood--botanical",
  "Lavender Infusion": "mood--lavender",
  "Peach Blossom Infusion": "mood--peach"
};

document.addEventListener("DOMContentLoaded", function () {
  if (document.getElementById("product-list")) initProductPage();
  if (document.getElementById("orderForm")) initOrderPage();
  if (document.querySelector("#ordersTable tbody")) initAdminPage();
});

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */
function formatPrice(value) {
  var n = Number(value);
  return isNaN(n) ? String(value) : n.toLocaleString("th-TH") + " บาท";
}

/* Match ?mood=xxx to a mood name (case-insensitive, partial match allowed,
   e.g. "peach" or "Peach Blossom Infusion"). Returns "" when nothing matches. */
function resolveMood(param) {
  var p = (param || "").trim().toLowerCase();
  if (!p) return "";
  for (var i = 0; i < MOODS.length; i++) {
    var m = MOODS[i].toLowerCase();
    if (m === p || m.indexOf(p) === 0 || m.split(" ")[0] === p) return MOODS[i];
  }
  return "";
}

/* --------------------------------------------------------------------------
   1) product.html — product cards + mood filter
   -------------------------------------------------------------------------- */
function initProductPage() {
  var filterBar = document.getElementById("filter-bar");
  var list = document.getElementById("product-list");
  var allProducts = [];
  var currentMood = "";

  function renderFilters() {
    if (!filterBar) return;
    filterBar.innerHTML = "";
    [""].concat(MOODS).forEach(function (mood) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-btn" + (mood === currentMood ? " is-active" : "");
      btn.textContent = mood || "ทั้งหมด";
      btn.addEventListener("click", function () {
        currentMood = mood;
        renderFilters();
        renderProducts();
      });
      filterBar.appendChild(btn);
    });
  }

  function createCard(p) {
    var card = document.createElement("article");
    card.className = "product-card " + (MOOD_CLASS[p.mood] || "");

    var imgWrap = document.createElement("div");
    imgWrap.className = "product-card__image";
    var img = document.createElement("img");
    img.src = p.image;
    img.alt = p.name;
    img.loading = "lazy";
    imgWrap.appendChild(img);

    var body = document.createElement("div");
    body.className = "product-card__body";

    var mood = document.createElement("div");
    mood.className = "product-card__mood";
    var dot = document.createElement("span");
    dot.className = "mood-dot";
    mood.appendChild(dot);
    mood.appendChild(document.createTextNode(p.mood));

    var name = document.createElement("h3");
    name.className = "product-card__name";
    name.textContent = p.name;

    var size = document.createElement("span");
    size.className = "size-tag";
    size.textContent = p.size;

    var sizeWrap = document.createElement("div");
    sizeWrap.className = "product-card__desc";
    sizeWrap.appendChild(size);

    var footer = document.createElement("div");
    footer.className = "product-card__footer";

    var price = document.createElement("span");
    price.className = "product-card__price";
    price.textContent = formatPrice(p.price);

    var buy = document.createElement("a");
    buy.className = "btn btn--small";
    buy.textContent = "สั่งซื้อ";
    buy.href =
      "order.html?item=" + encodeURIComponent(p.name) +
      "&price=" + encodeURIComponent(p.price);

    footer.appendChild(price);
    footer.appendChild(buy);

    body.appendChild(mood);
    body.appendChild(name);
    body.appendChild(sizeWrap);
    body.appendChild(footer);

    card.appendChild(imgWrap);
    card.appendChild(body);
    return card;
  }

  function renderProducts() {
    list.innerHTML = "";
    var shown = allProducts.filter(function (p) {
      return !currentMood || p.mood === currentMood;
    });
    if (shown.length === 0) {
      var empty = document.createElement("p");
      empty.className = "text-center";
      empty.textContent = "ไม่พบสินค้า";
      list.appendChild(empty);
      return;
    }
    shown.forEach(function (p) {
      list.appendChild(createCard(p));
    });
  }

  currentMood = resolveMood(new URLSearchParams(window.location.search).get("mood"));
  renderFilters();

  fetch("products.json")
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      allProducts = data;
      renderProducts();
    })
    .catch(function (error) {
      console.error(error);
      list.innerHTML = "";
      var msg = document.createElement("p");
      msg.className = "text-center";
      msg.textContent = "ไม่สามารถโหลดข้อมูลสินค้าได้ กรุณาลองใหม่อีกครั้ง";
      list.appendChild(msg);
    });
}

/* --------------------------------------------------------------------------
   2) order.html — prefill from URL, submit to Apps Script
   -------------------------------------------------------------------------- */
function initOrderPage() {
  var form = document.getElementById("orderForm");
  var params = new URLSearchParams(window.location.search);

  /* Prefill BOTH fields immediately on load */
  var itemsField = document.getElementById("items");
  var totalField = document.getElementById("total");
  var item = params.get("item");
  var price = params.get("price");
  if (itemsField && item !== null) itemsField.value = item;
  if (totalField && price !== null) totalField.value = price;

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var payload = {
      customerName: document.getElementById("customerName").value.trim(),
      contact: document.getElementById("contact").value.trim(),
      items: document.getElementById("items").value.trim(),
      total: document.getElementById("total").value.trim(),
      note: document.getElementById("note").value.trim()
    };

    var submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    fetch(ORDER_API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      if (submitBtn) submitBtn.disabled = false;
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
  });
}

/* --------------------------------------------------------------------------
   3) admin.html — load CSV from published Google Sheet, newest first
   -------------------------------------------------------------------------- */

/* Minimal CSV parser: handles quoted fields, "" escapes, commas and
   line breaks inside quotes, and both \n and \r\n line endings. */
function parseCSV(text) {
  var rows = [];
  var row = [];
  var field = "";
  var inQuotes = false;

  for (var i = 0; i < text.length; i++) {
    var c = text.charAt(i);

    if (inQuotes) {
      if (c === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text.charAt(i + 1) === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter(function (r) {
    return r.some(function (cell) { return cell.trim() !== ""; });
  });
}

function initAdminPage() {
  var tbody = document.querySelector("#ordersTable tbody");
  var COLUMNS = 6;

  function showMessage(text) {
    tbody.innerHTML = "";
    var tr = document.createElement("tr");
    var td = document.createElement("td");
    td.colSpan = COLUMNS;
    td.style.textAlign = "center";
    td.textContent = text;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  showMessage("กำลังโหลดข้อมูล...");

  var sep = CSV_URL.indexOf("?") === -1 ? "?" : "&";
  fetch(CSV_URL + sep + "t=" + Date.now(), { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then(function (text) {
      var rows = parseCSV(text);
      rows.shift(); /* drop header row */
      rows.reverse(); /* newest first */

      if (rows.length === 0) {
        showMessage("ยังไม่มีรายการสั่งซื้อ");
        return;
      }

      tbody.innerHTML = "";
      rows.forEach(function (r) {
        var tr = document.createElement("tr");
        for (var i = 0; i < COLUMNS; i++) {
          var td = document.createElement("td");
          td.textContent = r[i] !== undefined ? r[i] : ""; /* textContent: order data is user-submitted */
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });
    })
    .catch(function (error) {
      console.error(error);
      showMessage("ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
    });
}
