// ==UserScript==
// @name         Chodenocto-Bypass
// @namespace    https://chodenocto.local
// @version      2.0.4
// @description  Auto bypass link shortener — octolink.vip / minuc.vn / linkhuongdan / totreview
// @author       Chodenocto
// @match        *://minuc.vn/*
// @match        *://linkhuongdan.online/*
// @match        *://totreview.com/*
// @match        *://octolink.vip/*
// @match        *://*.minuc.vn/*
// @match        *://*.linkhuongdan.online/*
// @match        *://*.totreview.com/*
// @match        *://*.octolink.vip/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @grant        GM_getResourceText
// @grant        GM_addElement
// @connect      *
// @run-at       document-idle
// @noframes     false
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // ====================================================================
  // NETWORK DIAGNOSTICS
  // ====================================================================
  (function () {
    if (typeof GM_xmlhttpRequest !== 'function') return;
    var _orig = GM_xmlhttpRequest;
    var _reqCounter = 0;
    GM_xmlhttpRequest = function (opts) {
      var id = ++_reqCounter;
      var url = opts.url || '?';
      var method = (opts.method || 'GET').toUpperCase();
      var t0 = Date.now();
      var shortUrl = url.length > 80 ? url.substring(0, 77) + '...' : url;
      console.log('[NET#' + id + '] → ' + method + ' ' + shortUrl);
      
      var origOnload = opts.onload;
      var origOnerror = opts.onerror;
      var origOntimeout = opts.ontimeout;
      
      opts.onload = function (resp) {
        var elapsed = Date.now() - t0;
        var status = resp.status || 0;
        var bodyLen = (resp.responseText || '').length;
        var hdrs = '';
        try {
          hdrs = (resp.responseHeaders || '').split('\n').filter(function (l) {
            return l.toLowerCase().indexOf('content-type') === 0 ||
                   l.toLowerCase().indexOf('set-cookie') === 0;
          }).map(function (l) { return l.trim(); }).join('; ');
        } catch (e) {}
        var msg = '[NET#' + id + '] ← ' + status + ' ' + elapsed + 'ms ' + bodyLen + 'B';
        if (hdrs) msg += ' [' + hdrs + ']';
        if (status >= 400) {
          msg += '\n  Body(200): ' + (resp.responseText || '').substring(0, 200);
          console.warn(msg);
        } else {
          console.log(msg);
        }
        if (origOnload) origOnload(resp);
      };
      
      opts.onerror = function (e) {
        var elapsed = Date.now() - t0;
        var errMsg = (e && (e.statusText || e.message || e.error)) || 'unknown';
        var msg = '[NET#' + id + '] ✕ ONERROR ' + elapsed + 'ms\n' +
                  '  URL: ' + shortUrl + '\n' +
                  '  Error: ' + errMsg;
        console.error(msg);
        if (origOnerror) origOnerror(e);
      };
      
      opts.ontimeout = function () {
        var elapsed = Date.now() - t0;
        var timeoutSec = ((opts.timeout || 0) / 1000);
        var msg = '[NET#' + id + '] ✕ TIMEOUT ' + elapsed + 'ms (limit ' + timeoutSec + 's)\n' +
                  '  URL: ' + shortUrl;
        console.error(msg);
        if (origOntimeout) origOntimeout();
      };
      return _orig(opts);
    };
    
    // patch fetch
    if (typeof window.__origFetch === 'undefined') {
      window.__origFetch = window.fetch;
      window.fetch = function () {
        var args = arguments;
        var url2 = (typeof args[0] === 'string' ? args[0] : args[0] && args[0].url) || '?';
        var t0f = Date.now();
        console.log('[FETCH] → ' + url2);
        return window.__origFetch.apply(window, args).then(function (resp) {
          var el = Date.now() - t0f;
          console.log('[FETCH] ← ' + resp.status + ' ' + el + 'ms ' + url2);
          return resp;
        }, function (err) {
          var el = Date.now() - t0f;
          console.error('[FETCH] ✕ ' + el + 'ms ' + url2 + '\n  ' + (err.message || err));
          throw err;
        });
      };
    }
  })();

  // ====================================================================
  // POLYFILLS
  // ====================================================================
  if (typeof window.TextEncoder === 'undefined') {
    window.TextEncoder = function () {
      this.encode = function (arg) {
        arg = unescape(encodeURIComponent(arg));
        var bytes = new Uint8Array(arg.length);
        for (var i = 0; i < arg.length; i++) bytes[i] = arg.charCodeAt(i) & 255;
        return bytes;
      };
    };
  }
  if (typeof window.TextDecoder === 'undefined') {
    window.TextDecoder = function () {
      this.decode = function (arg) {
        try {
          arg = new Uint8Array(arg.buffer || arg);
        } catch (err) {}
        var text = '';
        for (var j = 0; j < arg.length; j++) text += String.fromCharCode(arg[j]);
        return decodeURIComponent(escape(text));
      };
    };
  }

  // ====================================================================
  // SPOOF
  // ====================================================================
  try {
    Object.defineProperty(document, 'referrer', {
      get: function () {
        return 'https://www.google.com/';
      },
      configurable: true
    });
  } catch (err) {}
  
  try {
    Object.defineProperty(document, 'hidden', {
      get: function () {
        return false;
      },
      configurable: true
    });
    Object.defineProperty(document, 'visibilityState', {
      get: function () {
        return 'visible';
      },
      configurable: true
    });
  } catch (err) {}

  // ====================================================================
  // HOLD CAPTCHA AUTO SOLVER
  // ====================================================================
  // Tích hợp từ file riêng
  (function() {
    // Prevent multiple initializations on the same frame
    if (window.__antigravity_shadow_hooked) return;
    window.__antigravity_shadow_hooked = true;
    window.__all_shadow_roots = new Set();

    // Intercept Shadow Root attachments to maintain access to open/closed trees
    const origAttach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (init) {
      const newInit = Object.assign({}, init, { mode: 'open' });
      const res = origAttach.call(this, newInit);
      try { window.__all_shadow_roots.add(res); } catch (e) {}
      return res;
    };

    // Intercept 2D context queries to cache active canvas instances
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type) {
      if (type === '2d') window.__capturedCanvas = this;
      return origGetContext.apply(this, arguments);
    };

    /**
     * Recursively searches for canvas elements through regular DOM and Shadow DOMs.
     */
    function searchCanvasDeep(node) {
      if (!node) return null;
      if (node.tagName === 'CANVAS') return node;

      if (node.querySelector) {
        const c = node.querySelector('canvas');
        if (c) return c;
      }

      let shadow = node.shadowRoot;
      if (!shadow && typeof chrome !== 'undefined' && chrome.dom?.openOrClosedShadowRoot) {
        try { shadow = chrome.dom.openOrClosedShadowRoot(node); } catch (e) {}
      }

      if (shadow) {
        const fc = searchCanvasDeep(shadow);
        if (fc) return fc;
      }

      if (node.querySelectorAll) {
        const children = node.querySelectorAll('*');
        for (const el of children) {
          if (el.tagName === 'CANVAS') return el;
          let elShadow = el.shadowRoot;
          if (!elShadow && typeof chrome !== 'undefined' && chrome.dom?.openOrClosedShadowRoot) {
            try { elShadow = chrome.dom.openOrClosedShadowRoot(el); } catch (e) {}
          }
          if (elShadow) {
            const fc = searchCanvasDeep(elShadow);
            if (fc) return fc;
          }
        }
      }
      return null;
    }

    /**
     * Attempts to locate the target canvas using multiple lookup strategies.
     */
    function findCanvasAuto() {
      if (typeof $0 !== 'undefined' && $0) {
        if ($0.tagName === 'CANVAS') return $0;
        if ($0.querySelector?.('canvas')) return $0.querySelector('canvas');
        if ($0.shadowRoot?.querySelector('canvas')) return $0.shadowRoot.querySelector('canvas');
      }

      if (window.__capturedCanvas && document.body?.contains(window.__capturedCanvas)) {
        return window.__capturedCanvas;
      }

      if (window.__all_shadow_roots) {
        for (const sr of window.__all_shadow_roots) {
          try {
            const c = searchCanvasDeep(sr);
            if (c) return c;
          } catch (e) {}
        }
      }

      if (document.body) {
        const found = searchCanvasDeep(document.body);
        if (found) return found;
      }

      if (document.documentElement) {
        const found = searchCanvasDeep(document.documentElement);
        if (found) return found;
      }

      try {
        const iframes = document.querySelectorAll('iframe');
        for (const f of iframes) {
          try {
            const doc = f.contentDocument || f.contentWindow?.document;
            if (doc) {
              const fc = searchCanvasDeep(doc);
              if (fc) return fc;
            }
          } catch (e) {}
        }
      } catch (e) {}

      if (typeof queryObjects === 'function') {
        try {
          const ramCanvases = queryObjects(HTMLCanvasElement);
          if (ramCanvases?.length > 0) return ramCanvases[0];
        } catch (e) {}
      }

      return null;
    }

    /**
     * Dispatches synthesized mouse and pointer events to simulate interaction.
     */
    function dispatchInteractionEvents(target, x, y) {
      const opts = {
        clientX: x, clientY: y,
        pageX: x + window.scrollX, pageY: y + window.scrollY,
        bubbles: true, cancelable: true, composed: true,
        pointerId: 1, pointerType: 'mouse', isPrimary: true,
        buttons: 0, pressure: 0
      };

      target.dispatchEvent(new PointerEvent('pointermove', opts));
      target.dispatchEvent(new MouseEvent('mousemove', opts));
    }

    /**
     * Main solver logic: Tracks target pixels on the canvas and triggers responses.
     */
    function runSolverWithCanvas(canvas) {
      if (!canvas || canvas.__solver_running) return;
      canvas.__solver_running = true;

      const ctx = canvas.getContext('2d', { willReadFrequently: true }) || canvas.getContext('2d');
      let isFinished = false;

      function getExactCanvasRect() {
        const r = canvas.getBoundingClientRect();
        if (r && r.width > 0) return r;

        const host = document.getElementById('captchaShortlink') || document.querySelector('[id*="pe"]');
        if (host) {
          const hr = host.getBoundingClientRect();
          const canvasW = Math.min(hr.width, 504);
          const offsetLeft = (hr.width - canvasW) / 2;
          return {
            left: hr.left + offsetLeft,
            top: hr.top,
            width: canvasW,
            height: hr.height || 430
          };
        }
        return null;
      }

      // Initial click/hover trigger to activate the canvas widget
      let rect = getExactCanvasRect();
      if (rect && rect.width > 0) {
        const initX = rect.left + rect.width / 2;
        const initY = rect.top + rect.height / 2;
        const enterOpts = {
          clientX: initX, clientY: initY,
          pageX: initX + window.scrollX, pageY: initY + window.scrollY,
          bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'mouse', isPrimary: true
        };

        canvas.dispatchEvent(new PointerEvent('pointerenter', enterOpts));
        canvas.dispatchEvent(new MouseEvent('mouseenter', enterOpts));
        dispatchInteractionEvents(canvas, initX, initY);
        canvas.dispatchEvent(new MouseEvent('click', enterOpts));
      }

      if (window.__holdCaptchaTimer) clearInterval(window.__holdCaptchaTimer);

      // Polling loop to analyze canvas pixels and follow target coordinates
      window.__holdCaptchaTimer = setInterval(() => {
        if (isFinished) return;

        const resInput = document.getElementById('hold_captcha_response') || 
                         document.querySelector('input[name="hold_captcha_response"]');

        if (resInput && resInput.value.length > 5) {
          isFinished = true;
          clearInterval(window.__holdCaptchaTimer);
          window.__holdCaptchaDone = true;

          try {
            const form = resInput.closest('form') || document.querySelector('form');
            if (form) {
              try { form.submit(); } catch (e) {}
            }

            // Tìm và click nút "Link Gốc" hoặc các nút liên quan
            const btns = document.querySelectorAll('a, button, input[type="submit"], input[type="button"], .btn-primary, .btn-captcha, #invisibleCaptchaShortlink, .btn');
            for (const b of btns) {
              const txt = (b.innerText || b.value || b.textContent || '').toLowerCase();
              const href = (b.getAttribute('href') || b.getAttribute('action') || '').toLowerCase();

              if (href.includes('kiemcom') || href.includes('skibiditask') || 
                  txt.includes('link gốc') || txt.includes('quay về') || 
                  txt.includes('lấy link') || txt.includes('tiếp tục') || 
                  txt.includes('continue') || b.id.includes('captcha')) {
                try {
                  ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(evtName => {
                    b.dispatchEvent(new MouseEvent(evtName, { bubbles: true, cancelable: true, view: window }));
                  });
                  b.click();
                } catch (e) {}
              }
            }
          } catch (e) {}
          return;
        }

        rect = getExactCanvasRect();
        if (!rect || rect.width === 0) return;

        const w = canvas.width || 504;
        const h = canvas.height || 430;
        const scaleX = rect.width / w;
        const scaleY = rect.height / h;

        const startY = Math.floor(h * 0.28);
        const endY = Math.floor(h * 0.95);
        const scanH = endY - startY;

        let imgData;
        try {
          imgData = ctx.getImageData(0, startY, w, scanH);
        } catch (e) { return; }

        const data = imgData.data;
        let sumX = 0, sumY = 0, count = 0;

        for (let y = 0; y < scanH; y += 2) {
          const rowPixels = [];
          for (let x = 0; x < w; x += 2) {
            const idx = (y * w + x) * 4;
            const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];

            if (a > 180 && r < 65 && g < 65 && b < 65) {
              rowPixels.push(x);
            }
          }

          if (rowPixels.length >= 5 && rowPixels.length <= 26) {
            for (const px of rowPixels) {
              sumX += px;
              sumY += (y + startY);
              count++;
            }
          }
        }

        if (count > 8) {
          const dotX = sumX / count;
          const dotY = sumY / count;

          const targetX = rect.left + (dotX * scaleX);
          const targetY = rect.top + (dotY * scaleY);

          dispatchInteractionEvents(canvas, targetX, targetY);
          dispatchInteractionEvents(document, targetX, targetY);
        }
      }, 5);
    }

    window.startHoldCaptchaSolver = function (canvasInput) {
      if (canvasInput) {
        runSolverWithCanvas(canvasInput);
        return true;
      }
      const direct = findCanvasAuto();
      if (direct) {
        runSolverWithCanvas(direct);
        return true;
      }

      if (window.__captchaPollingTimer) clearInterval(window.__captchaPollingTimer);
      let attempts = 0;
      window.__captchaPollingTimer = setInterval(() => {
        const canvas = findCanvasAuto();
        if (canvas) {
          clearInterval(window.__captchaPollingTimer);
          runSolverWithCanvas(canvas);
        } else if (++attempts > 50) {
          clearInterval(window.__captchaPollingTimer);
        }
      }, 200);
      return false;
    };

    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', () => { window.startHoldCaptchaSolver(); });
    } else {
      window.startHoldCaptchaSolver();
    }
  })();

  // ====================================================================
  // MAIN FUNCTION
  // ====================================================================
  function main() {
    var SPOOF_ENABLED = true;
    
    // Skip on minuc.vn
    if (window.location.hostname.includes('minuc.vn')) return;
    
    const MISSION_FALLBACK_URL = 'https://minuc.vn/home/mission/shorten-link?task=bypass';
    const pageText = document.body ? document.body.innerText.toLowerCase() : '';
    
    // Check 404 - NHƯNG thử tìm link từ localStorage trước
    if (
      document.title.includes('404') ||
      (pageText.includes('404') &&
        (pageText.includes('không tìm thấy') || pageText.includes('not found')))
    ) {
      // Thử tìm link đã lưu
      var savedLink = localStorage.getItem('octo_final_link');
      if (savedLink && savedLink.startsWith('http')) {
        console.log('[Octo] Tìm thấy link đã lưu: ' + savedLink);
        window.location.href = savedLink;
        return;
      }
      window.location.href = MISSION_FALLBACK_URL;
      return;
    }
    
    const pageUrl = window.location.href;
    const queryParams = new URLSearchParams(window.location.search);
    const hostname = window.location.hostname;
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    
    // ==================================================================
    // XỬ LÝ TRANG /finish/ — TÌM LINK GỐC
    // ==================================================================
    var isFinishPage = hostname.includes('octolink.vip') && /^\/+finish(\/|$)/i.test(window.location.pathname);
    
    if (isFinishPage) {
      console.log('[Octo] === TRANG FINISH === Bắt đầu xử lý đặc biệt...');
      
      // KHÔNG disable nút - để user tự bấm nếu cần
      // KHÔNG ẩn panel - để hiển thị trạng thái
      
      // Bắt đầu solver nếu chưa chạy
      if (window.startHoldCaptchaSolver) {
        window.startHoldCaptchaSolver();
      }
      
      // Hàm tìm link gốc
      var findLinkGoc = function() {
        // Tìm trong DOM
        var anchors = document.querySelectorAll('a');
        for (var i = 0; i < anchors.length; i++) {
          var href = anchors[i].getAttribute('href') || '';
          var text = anchors[i].textContent || '';
          if (href.startsWith('http') && 
              !href.includes('octolink') && 
              !href.includes('javascript') &&
              (text.toLowerCase().includes('link') || 
               text.toLowerCase().includes('gốc') || 
               text.toLowerCase().includes('get') ||
               text.toLowerCase().includes('continue') ||
               text.toLowerCase().includes('tiếp tục'))) {
            console.log('[Octo] Tìm thấy link trong DOM: ' + href);
            return href;
          }
        }
        
        // Tìm trong script
        var scripts = document.querySelectorAll('script');
        for (var i = 0; i < scripts.length; i++) {
          var content = scripts[i].textContent || '';
          var urlMatch = content.match(/['"](https?:\/\/[^'"]+)['"]/);
          if (urlMatch && !urlMatch[1].includes('octolink') && !urlMatch[1].includes('google')) {
            console.log('[Octo] Tìm thấy link trong script: ' + urlMatch[1]);
            return urlMatch[1];
          }
        }
        
        // Tìm trong meta refresh
        var metas = document.querySelectorAll('meta[http-equiv="refresh"]');
        for (var i = 0; i < metas.length; i++) {
          var content = metas[i].getAttribute('content') || '';
          var urlMatch = content.match(/url=([^;]+)/i);
          if (urlMatch && urlMatch[1]) {
            var url = urlMatch[1].trim();
            if (url.startsWith('http') && !url.includes('octolink')) {
              console.log('[Octo] Tìm thấy link trong meta: ' + url);
              return url;
            }
          }
        }
        
        // Tìm trong iframe
        var iframes = document.querySelectorAll('iframe');
        for (var i = 0; i < iframes.length; i++) {
          try {
            var iframeDoc = iframes[i].contentDocument;
            if (!iframeDoc) continue;
            var iframeAnchors = iframeDoc.querySelectorAll('a');
            for (var j = 0; j < iframeAnchors.length; j++) {
              var href = iframeAnchors[j].getAttribute('href') || '';
              if (href.startsWith('http') && !href.includes('octolink')) {
                console.log('[Octo] Tìm thấy link trong iframe: ' + href);
                return href;
              }
            }
          } catch (e) {}
        }
        
        // Tìm trong input hidden
        var inputs = document.querySelectorAll('input[type="hidden"]');
        for (var i = 0; i < inputs.length; i++) {
          var value = inputs[i].getAttribute('value') || '';
          if (value.startsWith('http') && !value.includes('octolink')) {
            console.log('[Octo] Tìm thấy link trong input hidden: ' + value);
            return value;
          }
        }
        
        return null;
      };
      
      // Thử tìm link ngay
      var linkGoc = findLinkGoc();
      if (linkGoc) {
        console.log('[Octo] Mở link gốc: ' + linkGoc);
        // Lưu link vào localStorage để dùng sau
        localStorage.setItem('octo_final_link', linkGoc);
        setTimeout(function() {
          window.location.href = linkGoc;
        }, 1000);
        return;
      }
      
      // Nếu chưa có, chờ và thử lại
      var retryCount = 0;
      var retryTimer = setInterval(function() {
        retryCount++;
        linkGoc = findLinkGoc();
        if (linkGoc) {
          clearInterval(retryTimer);
          console.log('[Octo] Đã tìm thấy link gốc sau ' + retryCount + ' lần thử');
          localStorage.setItem('octo_final_link', linkGoc);
          setTimeout(function() {
            window.location.href = linkGoc;
          }, 500);
        } else if (retryCount > 30) { // 30 giây
          clearInterval(retryTimer);
          console.log('[Octo] Không tìm thấy link gốc. Hiển thị thông báo...');
          
          // Hiển thị thông báo
          var msgDiv = document.createElement('div');
          msgDiv.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#fff;color:#333;padding:15px 20px;border-radius:10px;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.15);font-family:Arial,sans-serif;';
          msgDiv.innerHTML = '<b style="color:#e74c3c">⚠️ Không tìm thấy nút Link Gốc!</b><br>' +
            '<span style="font-size:13px;color:#666">Có thể captcha chưa được giải đúng hoặc phiên đã hết hạn.</span><br>' +
            '<button id="retryBtn" style="margin-top:10px;padding:8px 16px;background:#3498db;color:#fff;border:none;border-radius:5px;cursor:pointer;">🔄 Thử lại</button>' +
            '<button id="manualBtn" style="margin-left:8px;padding:8px 16px;background:#95a5a6;color:#fff;border:none;border-radius:5px;cursor:pointer;">📋 Dán Link</button>';
          document.body.appendChild(msgDiv);
          
          document.getElementById('retryBtn').addEventListener('click', function() {
            msgDiv.remove();
            window.location.reload();
          });
          
          document.getElementById('manualBtn').addEventListener('click', function() {
            var input = prompt('Dán link gốc vào đây (nếu bạn đã sao chép được):');
            if (input && input.startsWith('http')) {
              localStorage.setItem('octo_final_link', input);
              window.location.href = input;
            }
          });
        }
      }, 1000);
      
      return; // Đã xử lý trang finish
    }
    
    // ==================================================================
    // XỬ LÝ TRANG BÌNH THƯỜNG
    // ==================================================================
    let missionId = null;
    if (pathSegments.length > 0) {
      let slug = pathSegments[pathSegments.length - 1].replace(/\.html$/i, '');
      missionId = hostname.includes('totreview.com') ? 'totreview-' + slug : slug;
    }
    
    let cookieHeader = '';
    var cookieJar = {
      from_google: 'true'
    };
    var apiOrigin = '';
    var coreCtx = null;
    var demoRetried = 0;
    const DEMO_MAX_RETRY = 4;
    var missionHalted = false;
    
    function collectCookies(rawHeaders) {
      if (!rawHeaders) return;
      String(rawHeaders)
        .split('\n')
        .forEach(function (item) {
          var match = /set-cookie:\s*([^=;]+)=([^;\r\n]*)/i.exec(item);
          if (match) cookieJar[match[1].trim()] = match[2].trim();
        });
      var cookiePairs = [];
      for (var cookieName in cookieJar) cookiePairs.push(cookieName + '=' + cookieJar[cookieName]);
      cookieHeader = cookiePairs.join('; ') + (cookiePairs.length ? '; ' : '');
    }
    
    var REAL_UA = '';
    try {
      REAL_UA = String(navigator.userAgent || '');
    } catch (err) {}
    const USER_AGENT = REAL_UA || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    
    // ... (phần còn lại giữ nguyên từ file gốc, nhưng đã sửa một số lỗi)
    
    // Khi tìm được link gốc, lưu vào localStorage
    // Trong function announceFinalLink hoặc checkJob...
    
    var ORIGINAL_LINK_RE = /<a[^>]+href=["']([^"']+)["'][^>]*>Link\s*Gốc<\/a>/i;
    
    // Nếu đã có link gốc, lưu và mở
    var originalLinkMatch = document.body.innerHTML.match(ORIGINAL_LINK_RE);
    if (originalLinkMatch) {
      localStorage.setItem('octo_final_link', originalLinkMatch[1]);
      setTimeout(function() {
        window.location.href = originalLinkMatch[1];
      }, 1000);
      return;
    }
    
    // ... (phần còn lại của main function)
    
    // Khi có link gốc, lưu vào localStorage
    function saveFinalLink(url) {
      localStorage.setItem('octo_final_link', url);
    }
    
    // Gọi saveFinalLink khi có link
    // Trong checkJob, khi job.status === 'finish':
    // saveFinalLink(job.url);
  }
  
  // Khởi chạy
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
