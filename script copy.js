/* ==========================================================================
   SORA — script.js (shared by every page)
   Each feature runs only if its elements exist on the current page:
     product.html : #filter-bar, #product-list
     order.html   : #orderForm, #customerName, #contact, #items, #total, #note
     admin.html   : #ordersTable tbody
   Orders are stored in this browser's localStorage (no server).
   ========================================================================== */

/* One key for BOTH saving (order.html) and reading (admin.html) */
var ORDERS_KEY = "SORAOrders";

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
   2) order.html — prefill from URL, save order to localStorage
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
      note: document.getElementById("note").value.trim(),
      timestamp: new Date().toISOString()
    };

    try {
      var orders = [];
      var stored = localStorage.getItem(ORDERS_KEY);
      if (stored) {
        var parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) orders = parsed;
      }
      orders.push(payload);
      localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
      window.location.href = "thankyou.html";
    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาด ไม่สามารถบันทึกคำสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง");
    }
  });
}

/* --------------------------------------------------------------------------
   3) admin.html — read orders from localStorage, newest first
   -------------------------------------------------------------------------- */
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

  var orders = [];
  try {
    var stored = localStorage.getItem(ORDERS_KEY);
    if (stored) {
      var parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) orders = parsed;
    }
  } catch (error) {
    console.error(error);
  }

  if (orders.length === 0) {
    showMessage("ยังไม่มีคำสั่งซื้อ");
    return;
  }

  orders.sort(function (a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  tbody.innerHTML = "";
  orders.forEach(function (o) {
    var d = new Date(o.timestamp);
    var cells = [
      isNaN(d.getTime()) ? "" : d.toLocaleString("th-TH"),
      o.customerName,
      o.contact,
      o.items,
      o.total,
      o.note
    ];

    var tr = document.createElement("tr");
    cells.forEach(function (value) {
      var td = document.createElement("td");
      td.textContent = value !== undefined && value !== null ? value : ""; /* textContent: order data is user-submitted */
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}
