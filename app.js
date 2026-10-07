(function () {
  "use strict";

  var ALL_ID = "all";
  var ALL_NAME = "すべて";
  var ACCENT = "#B8613F";

  var els = {
    categoryList: document.getElementById("category-list"),
    card: document.getElementById("card"),
    cardBack: document.getElementById("card-back"),
    cardFront: document.getElementById("card-front"),
    backCategory: document.getElementById("card-back-category"),
    emblem: document.querySelector(".card-emblem"),
    frontCategory: document.getElementById("card-category"),
    question: document.getElementById("card-question"),
    nextButton: document.getElementById("next-button"),
    notice: document.getElementById("notice"),
    srAnnounce: document.getElementById("sr-announce")
  };

  var state = {
    categories: [],
    byId: {},
    selected: ALL_ID,
    deck: [],
    current: null,
    flipped: false,
    busy: false,
    // カテゴリ切り替えで、進行中のアニメーションを無効にするための番号
    token: 0
  };

  var reducedMotionQuery = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

  function prefersReducedMotion() {
    return !!(reducedMotionQuery && reducedMotionQuery.matches);
  }

  function flipDuration() {
    var value = getComputedStyle(document.documentElement).getPropertyValue("--flip-duration");
    var seconds = parseFloat(value);
    return isNaN(seconds) ? 500 : seconds * 1000;
  }

  function hexToRgba(hex, alpha) {
    var h = hex.replace("#", "");
    if (h.length === 3) {
      h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    }
    var n = parseInt(h, 16);
    return "rgba(" + ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " + (n & 255) + ", " + alpha + ")";
  }

  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  /* ---------- 山札 ---------- */

  function cardsFor(categoryId) {
    var cats = categoryId === ALL_ID ? state.categories : [state.byId[categoryId]];
    var cards = [];
    cats.forEach(function (cat) {
      cat.questions.forEach(function (text) {
        cards.push({ category: cat, text: text });
      });
    });
    return cards;
  }

  function buildDeck() {
    var deck = shuffle(cardsFor(state.selected));
    // 作り直した直後に、直前と同じ問いが出ないようにする（山札の末尾から引く）
    var last = deck.length - 1;
    if (state.current && deck.length > 1 && deck[last].text === state.current.text) {
      var tmp = deck[last];
      deck[last] = deck[0];
      deck[0] = tmp;
    }
    state.deck = deck;
  }

  function drawCard() {
    if (state.deck.length === 0) {
      buildDeck();
    }
    setNotice("");
    state.current = state.deck.pop();
    if (state.deck.length === 0) {
      setNotice("すべての問いを引きました。次のカードから、山札を作り直します。");
    }
    return state.current;
  }

  /* ---------- 表示 ---------- */

  function setNotice(text) {
    els.notice.textContent = text;
  }

  function announce(text) {
    els.srAnnounce.textContent = "";
    window.setTimeout(function () {
      els.srAnnounce.textContent = text;
    }, 50);
  }

  function renderBack() {
    var isAll = state.selected === ALL_ID;
    var color = isAll ? ACCENT : state.byId[state.selected].color;
    els.backCategory.textContent = isAll ? ALL_NAME : state.byId[state.selected].name;
    els.card.style.setProperty("--deck", color);
    els.card.style.setProperty("--deck-tint", hexToRgba(color, 0.12));
    els.emblem.classList.toggle("is-single", !isAll);
  }

  function renderFront(item) {
    // 「すべて」でも、引いた問いのカテゴリの色を使う
    els.card.style.setProperty("--cat", item.category.color);
    els.card.style.setProperty("--cat-tint", hexToRgba(item.category.color, 0.16));
    els.frontCategory.textContent = item.category.name;
    els.question.textContent = item.text;
  }

  function setFlipped(flipped) {
    state.flipped = flipped;
    els.card.classList.toggle("is-flipped", flipped);
    els.cardBack.setAttribute("aria-hidden", flipped ? "true" : "false");
    els.cardFront.setAttribute("aria-hidden", flipped ? "false" : "true");
    els.card.setAttribute("aria-disabled", flipped ? "true" : "false");
  }

  function renderCategoryButtons() {
    var buttons = els.categoryList.querySelectorAll(".category-button");
    Array.prototype.forEach.call(buttons, function (button) {
      var pressed = button.getAttribute("data-cat") === state.selected;
      button.setAttribute("aria-pressed", pressed ? "true" : "false");
    });
  }

  function createCategoryButton(id, name, color) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "category-button";
    button.setAttribute("data-cat", id);
    button.setAttribute("aria-pressed", "false");
    button.style.setProperty("--c", color);
    button.style.setProperty("--c-tint", hexToRgba(color, 0.14));
    button.textContent = name;
    button.addEventListener("click", function () {
      selectCategory(id, true);
    });
    return button;
  }

  /* ---------- 操作 ---------- */

  function wait(ms, token, fn) {
    window.setTimeout(function () {
      if (token === state.token) fn();
    }, ms);
  }

  function revealCard() {
    if (state.flipped || state.busy) return;
    var item = drawCard();
    renderFront(item);
    setFlipped(true);
    announce(item.category.name + "。" + item.text);
    if (!prefersReducedMotion()) {
      state.busy = true;
      wait(flipDuration(), state.token, function () {
        state.busy = false;
      });
    }
  }

  function nextCard() {
    if (state.busy) return;
    if (!state.flipped) {
      revealCard();
      return;
    }

    if (prefersReducedMotion()) {
      var item = drawCard();
      renderFront(item);
      announce(item.category.name + "。" + item.text);
      return;
    }

    // いったん裏に戻してから、新しい問いでめくり直す
    var token = state.token;
    var duration = flipDuration();
    state.busy = true;
    setFlipped(false);
    wait(duration, token, function () {
      var item = drawCard();
      renderFront(item);
      setFlipped(true);
      announce(item.category.name + "。" + item.text);
      wait(duration, token, function () {
        state.busy = false;
      });
    });
  }

  function selectCategory(id, updateUrl) {
    if (id !== ALL_ID && !state.byId[id]) id = ALL_ID;

    state.token++;
    state.busy = false;
    state.selected = id;
    state.current = null;

    renderCategoryButtons();
    renderBack();
    setFlipped(false);
    buildDeck();
    setNotice("");

    if (updateUrl) syncUrl(id);
  }

  function syncUrl(id) {
    if (!window.history || !window.history.replaceState || !window.URL) return;
    try {
      var url = new URL(window.location.href);
      if (id === ALL_ID) {
        url.searchParams.delete("cat");
      } else {
        url.searchParams.set("cat", id);
      }
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (e) {
      // URL を書き換えられない環境では何もしない
    }
  }

  function categoryFromUrl() {
    var match = /[?&]cat=([^&#]*)/.exec(window.location.search);
    if (!match) return ALL_ID;
    var id = decodeURIComponent(match[1].replace(/\+/g, " ")).trim().toLowerCase();
    return state.byId[id] ? id : ALL_ID;
  }

  function bindEvents() {
    els.card.addEventListener("click", revealCard);
    els.card.addEventListener("keydown", function (event) {
      var key = event.key;
      if (key === "Enter" || key === " " || key === "Spacebar") {
        event.preventDefault();
        revealCard();
      }
    });
    els.nextButton.addEventListener("click", nextCard);
  }

  function init(data) {
    state.categories = (data && data.categories ? data.categories : []).filter(function (cat) {
      return cat && cat.id && cat.name && Array.isArray(cat.questions) && cat.questions.length > 0;
    });
    if (state.categories.length === 0) throw new Error("no categories");

    state.categories.forEach(function (cat) {
      state.byId[cat.id] = cat;
    });

    var fragment = document.createDocumentFragment();
    fragment.appendChild(createCategoryButton(ALL_ID, ALL_NAME, ACCENT));
    state.categories.forEach(function (cat) {
      fragment.appendChild(createCategoryButton(cat.id, cat.name, cat.color || ACCENT));
    });
    els.categoryList.appendChild(fragment);

    bindEvents();
    selectCategory(categoryFromUrl(), false);
  }

  function showLoadError() {
    els.card.setAttribute("aria-disabled", "true");
    els.nextButton.disabled = true;
    els.backCategory.textContent = "読み込みに失敗しました";
    document.querySelector(".card-back-hint").textContent = "ページを再読み込みしてください。";
    setNotice("問いのデータを読み込めませんでした。時間をおいて、もう一度お試しください。");
  }

  fetch("questions.json", { cache: "no-cache" })
    .then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    })
    .then(init)
    .catch(showLoadError);
})();
