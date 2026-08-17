/* ==========================================================================
   OHKNEE APP · Kinetic Arsenal — standalone behaviour
   Zero dependencies. Works from file:// with no server.
   ========================================================================== */

(function () {
  "use strict";

  var STORE_KEY = "ohknee.buttonLabels.v1";

  /* ----------------------------------------------------------------------
     Storage helper — localStorage is unavailable on some file:// origins,
     so fall back to an in-memory object instead of throwing.
     ---------------------------------------------------------------------- */
  var store = (function () {
    var mem = {};
    var ok = false;
    try {
      var probe = "__ohknee_probe__";
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      ok = true;
    } catch (e) {
      ok = false;
    }
    return {
      read: function () {
        if (!ok) return mem;
        try {
          return JSON.parse(window.localStorage.getItem(STORE_KEY) || "{}") || {};
        } catch (e) {
          return {};
        }
      },
      write: function (obj) {
        mem = obj;
        if (!ok) return;
        try {
          window.localStorage.setItem(STORE_KEY, JSON.stringify(obj));
        } catch (e) {
          /* quota or opaque origin — in-memory copy still applies */
        }
      }
    };
  })();

  /* ----------------------------------------------------------------------
     Restore any custom button text saved on a previous visit.
     ---------------------------------------------------------------------- */
  function applySavedLabels() {
    var saved = store.read();
    Object.keys(saved).forEach(function (id) {
      var link = document.querySelector('[data-label="' + id + '"]');
      if (!link) return;
      var span = link.querySelector(".signup-label");
      if (span && saved[id]) span.textContent = saved[id];
    });
  }

  /* ----------------------------------------------------------------------
     Pencil buttons — rename the sign-up button on a card.
     ---------------------------------------------------------------------- */
  function bindEditButtons() {
    var buttons = document.querySelectorAll(".edit-btn");
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();

        var id = btn.getAttribute("data-edit");
        var link = document.querySelector('[data-label="' + id + '"]');
        if (!link) return;

        var span = link.querySelector(".signup-label");
        var current = span ? span.textContent.trim() : "SIGN UP";
        var next = window.prompt("Button text for this card:", current);
        if (next === null) return;

        next = next.trim();
        var final = next === "" ? "SIGN UP" : next;
        if (span) span.textContent = final;

        var saved = store.read();
        if (final === "SIGN UP") {
          delete saved[id];
        } else {
          saved[id] = final;
        }
        store.write(saved);
      });
    });
  }

  /* ----------------------------------------------------------------------
     Category tabs + search.

     One shared filter pass runs on both: the search box only ever
     filters the cells inside whichever tab is currently open.
     ---------------------------------------------------------------------- */
  function bindTabsAndSearch() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
    var panels = Array.prototype.slice.call(document.querySelectorAll(".panel"));
    var input = document.getElementById("search");
    var empty = document.getElementById("no-results");
    if (!tabs.length || !panels.length) return;

    function activePanel() {
      for (var i = 0; i < panels.length; i++) {
        if (!panels[i].hidden) return panels[i];
      }
      return null;
    }

    function filter() {
      var panel = activePanel();
      if (!panel) return;

      var term = input ? input.value.trim().toLowerCase() : "";
      var cells = panel.querySelectorAll("[data-name]");
      var visible = 0;

      Array.prototype.forEach.call(cells, function (cell) {
        var name = cell.getAttribute("data-name") || "";
        var match = term === "" || name.indexOf(term) !== -1;
        cell.hidden = !match;
        if (match) visible++;
      });

      // Only report "no matches" for tabs that actually hold cells;
      // empty tabs show their own placeholder instead.
      if (empty) empty.hidden = !(cells.length > 0 && visible === 0);
    }

    function selectTab(slug, moveFocus) {
      tabs.forEach(function (tab) {
        var on = tab.getAttribute("data-tab") === slug;
        tab.classList.toggle("is-active", on);
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.setAttribute("tabindex", on ? "0" : "-1");
        if (on && moveFocus) tab.focus();
      });

      panels.forEach(function (panel) {
        panel.hidden = panel.id !== "panel-" + slug;
      });

      filter();
    }

    tabs.forEach(function (tab, index) {
      tab.addEventListener("click", function () {
        selectTab(tab.getAttribute("data-tab"), false);
      });

      // Left/right arrows walk the tab strip, as expected of a tablist.
      tab.addEventListener("keydown", function (event) {
        var step = 0;
        if (event.key === "ArrowRight") step = 1;
        else if (event.key === "ArrowLeft") step = -1;
        else if (event.key === "Home") step = -index;
        else if (event.key === "End") step = tabs.length - 1 - index;
        else return;

        event.preventDefault();
        var next = (index + step + tabs.length) % tabs.length;
        selectTab(tabs[next].getAttribute("data-tab"), true);
      });
    });

    // Header nav buttons jump straight to a category.
    var navLinks = document.querySelectorAll("[data-tab-link]");
    Array.prototype.forEach.call(navLinks, function (link) {
      link.addEventListener("click", function () {
        selectTab(link.getAttribute("data-tab-link"), false);
        var section = document.getElementById("arsenal");
        if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    if (input) {
      input.addEventListener("input", filter);
      input.addEventListener("search", filter);
      input.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          input.value = "";
          filter();
        }
      });
    }

    filter();
  }

  /* ----------------------------------------------------------------------
     Proof pillars — tapping an image launches that engine's referral link.
     ---------------------------------------------------------------------- */
  function bindPillars() {
    var engines = document.querySelectorAll(".engine");
    Array.prototype.forEach.call(engines, function (engine) {
      var link = engine.querySelector(".engine-btn");
      if (!link) return;
      var href = link.getAttribute("href");

      var frames = engine.querySelectorAll(".pillar-frame");
      Array.prototype.forEach.call(frames, function (frame) {
        frame.setAttribute("role", "link");
        frame.setAttribute("tabindex", "0");

        function launch() {
          window.open(href, "_blank", "noopener,noreferrer");
        }

        frame.addEventListener("click", launch);
        frame.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            launch();
          }
        });
      });
    });
  }

  /* ------------------------------------------------------------------
     Promo code copy buttons.
     navigator.clipboard is often blocked on file:// pages, so this falls
     back to a hidden textarea + execCommand, then to selecting the code
     text so a manual copy is one keystroke. Never throws.
     ------------------------------------------------------------------ */
  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      ta.setSelectionRange(0, text.length);
    } catch (err) {}
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (err) {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }

  /* navigator.clipboard is unavailable on file:// in several browsers, and in
     some sandboxes its promise hangs forever instead of rejecting. So we race
     it against a short timer and fall back to the classic textarea trick,
     which guarantees the button always reports back to the user. */
  function copyText(text) {
    return new Promise(function (resolve, reject) {
      var settled = false;

      function finish(viaApi) {
        if (settled) return;
        settled = true;
        if (viaApi || legacyCopy(text)) {
          resolve();
        } else {
          reject(new Error("copy unavailable"));
        }
      }

      var timer = window.setTimeout(function () { finish(false); }, 500);

      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          navigator.clipboard.writeText(text).then(
            function () { window.clearTimeout(timer); finish(true); },
            function () { window.clearTimeout(timer); finish(false); }
          );
          return;
        } catch (err) {
          /* fall through */
        }
      }
      window.clearTimeout(timer);
      finish(false);
    });
  }

  function bindCodeCopy() {
    var buttons = document.querySelectorAll(".code-copy");
    for (var i = 0; i < buttons.length; i++) {
      (function (btn) {
        var label = btn.querySelector(".code-copy-text");
        var original = label ? label.textContent : "";
        var timer = null;

        function flash(msg) {
          btn.classList.add("is-copied");
          if (label) label.textContent = msg;
          if (timer) window.clearTimeout(timer);
          timer = window.setTimeout(function () {
            btn.classList.remove("is-copied");
            if (label) label.textContent = original;
          }, 1600);
        }

        btn.addEventListener("click", function () {
          var code = btn.getAttribute("data-copy") || "";
          copyText(code).then(
            function () {
              flash("COPIED");
            },
            function () {
              var row = btn.parentNode;
              var node = row && row.querySelector(".code-value");
              if (node && window.getSelection && document.createRange) {
                var range = document.createRange();
                range.selectNodeContents(node);
                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
              }
              flash("SELECT");
            }
          );
        });
      })(buttons[i]);
    }
  }

  function init() {
    applySavedLabels();
    bindEditButtons();
    bindTabsAndSearch();
    bindPillars();
    bindCodeCopy();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
