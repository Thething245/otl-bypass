// ==UserScript==
// @name         Chodenocto-Bypass
// @namespace    http://tampermonkey.net/
// @version      2.2.0
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
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @grant        GM_getResourceText
// @grant        GM_addElement
// @grant        GM_openInTab
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.addStyle
// @grant        GM.setClipboard
// @grant        GM.notification
// @grant        GM.registerMenuCommand
// @grant        GM.getResourceText
// @grant        GM.addElement
// @grant        GM.openInTab
// @connect      *
// @connect      raw.githubusercontent.com
// @connect      cdn.jsdelivr.net
// @connect      octolink.vip
// @connect      api.github.com
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/Thething245/otl-bypass/main/loader.user.js
// @updateURL    https://raw.githubusercontent.com/Thething245/otl-bypass/main/loader.user.js
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  var currentHost = window.location.hostname;
  var hasRedirectTarget = new URLSearchParams(window.location.search).has('redirect_to_octo');
  var isSupportedHost =
    currentHost === 'minuc.vn' ||
    currentHost.endsWith('.minuc.vn') ||
    currentHost === 'linkhuongdan.online' ||
    currentHost.endsWith('.linkhuongdan.online') ||
    currentHost === 'totreview.com' ||
    currentHost.endsWith('.totreview.com') ||
    currentHost === 'octolink.vip' ||
    currentHost.endsWith('.octolink.vip');

  if (!isSupportedHost && !hasRedirectTarget) return;
  // Trang giai captcha lay link goc — khong nap payload, moi thu script
  // lam (ghi de referrer/visibility/Error/querySelectorAll) deu khien
  // captcha khong giai duoc.
  if (
    (currentHost === 'octolink.vip' || currentHost.endsWith('.octolink.vip')) &&
    /^\/+finish(\/|$)/i.test(window.location.pathname || '')
  ) {
    console.log('[Loader] Trang captcha — bo qua, khong nap script.');
    return;
  }
  if (window.__chodenoctoLoaderRunning) return;
  window.__chodenoctoLoaderRunning = true;

  // QUAN TRONG: dung /refs/heads/main/ chu KHONG phai /main/.
  // raw.githubusercontent.com BO QUA query string khi tinh cache key, nen
  // ?v=Date.now() KHONG bust duoc cache — do da kiem chung: /main/ tra ve
  // ban cu (x-cache=HIT) toi 5 phut (max-age=300) du them query gi.
  // Duong dan /refs/heads/main/ la cache key khac va luon tuoi hon.
  var REPO_BASE = 'https://raw.githubusercontent.com/Thething245/otl-bypass/refs/heads/main/';
  var REPO_BASE_FALLBACK = 'https://cdn.jsdelivr.net/gh/Thething245/otl-bypass@main/';
  var SCRIPT_URL = REPO_BASE + 'octolink.js';
  var SCRIPT_URL_FALLBACK = REPO_BASE_FALLBACK + 'octolink.js';
  var LOADER_URL = REPO_BASE + 'loader.user.js';
  var MAX_ATTEMPTS = 3;
  var RETRY_DELAY = 1500;

  // ---- auto update ----------------------------------------------------
  var PAYLOAD_CACHE_KEY = 'octo_payload_cache_v1';
  var PAYLOAD_TS_KEY = 'octo_payload_ts_v1';
  var UPDATE_CHECK_KEY = 'octo_loader_update_check_v1';
  var UPDATE_FOUND_KEY = 'octo_loader_update_found_v1';
  var UPDATE_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 giờ

  function modernApi(name) {
    if (typeof GM !== 'undefined' && GM && typeof GM[name] === 'function') {
      return GM[name].bind(GM);
    }
    return undefined;
  }

  var requestApi =
    typeof GM_xmlhttpRequest === 'function'
      ? GM_xmlhttpRequest
      : modernApi('xmlHttpRequest');
  var getValueApi =
    typeof GM_getValue === 'function' ? GM_getValue : modernApi('getValue');
  var setValueApi =
    typeof GM_setValue === 'function' ? GM_setValue : modernApi('setValue');
  var notifyApi =
    typeof GM_notification === 'function' ? GM_notification : modernApi('notification');
  var menuApi =
    typeof GM_registerMenuCommand === 'function'
      ? GM_registerMenuCommand
      : modernApi('registerMenuCommand');
  var openTabApi =
    typeof GM_openInTab === 'function' ? GM_openInTab : modernApi('openInTab');

  // Chỉ dùng storage của trình quản lý userscript. KHÔNG dùng localStorage
  // vì loader chạy trên mọi domain, payload ~530KB sẽ ăn hết quota trang lạ.
  function storeGet(key, fallback) {
    try {
      if (getValueApi) {
        var v = getValueApi(key, fallback);
        if (v !== undefined && v !== null) return v;
      }
    } catch (error) {}
    return fallback;
  }

  function storeSet(key, value) {
    try {
      if (setValueApi) setValueApi(key, value);
    } catch (error) {}
  }

  function currentVersion() {
    try {
      if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) {
        return String(GM_info.script.version || '0');
      }
    } catch (error) {}
    return '0';
  }

  // So sánh kiểu semver đơn giản: 1 = a mới hơn, -1 = b mới hơn, 0 = bằng.
  function compareVersion(a, b) {
    var pa = String(a).split('.');
    var pb = String(b).split('.');
    var len = Math.max(pa.length, pb.length);
    for (var i = 0; i < len; i++) {
      var x = parseInt(pa[i], 10) || 0;
      var y = parseInt(pb[i], 10) || 0;
      if (x > y) return 1;
      if (x < y) return -1;
    }
    return 0;
  }

  function openUpdatePage() {
    // Mở raw URL — Tampermonkey nhận diện .user.js và hiện trang cài đặt.
    try {
      if (openTabApi) {
        openTabApi(LOADER_URL, { active: true, insert: true });
        return;
      }
    } catch (error) {}
    try {
      window.open(LOADER_URL, '_blank');
    } catch (error) {
      console.warn('[Loader] Không mở được trang cập nhật, vào thủ công: ' + LOADER_URL);
    }
  }

  function announceUpdate(remoteVersion) {
    var mine = currentVersion();
    console.warn(
      '[Loader] Có bản mới: ' + mine + ' → ' + remoteVersion + '. ' + LOADER_URL
    );
    try {
      if (notifyApi) {
        notifyApi({
          title: 'Chodenocto-Bypass',
          text: 'Có bản cập nhật ' + remoteVersion + ' (đang dùng ' + mine + '). Bấm để cài.',
          timeout: 12000,
          onclick: openUpdatePage
        });
      }
    } catch (error) {}
    try {
      if (menuApi) {
        menuApi('⬆ Cài bản mới ' + remoteVersion, openUpdatePage);
      }
    } catch (error) {}
  }

  // Tải header loader trên GitHub, đọc @version, so với bản đang chạy.
  function checkLoaderUpdate(force) {
    var now = Date.now();
    if (!force) {
      var last = parseInt(storeGet(UPDATE_CHECK_KEY, 0), 10) || 0;
      if (now - last < UPDATE_CHECK_INTERVAL) {
        // Trong thời gian throttle: nếu lần trước đã thấy bản mới thì nhắc lại.
        var known = String(storeGet(UPDATE_FOUND_KEY, '') || '');
        if (known && compareVersion(known, currentVersion()) > 0) announceUpdate(known);
        return;
      }
    }
    storeSet(UPDATE_CHECK_KEY, String(now));

    function handleHeader(text) {
      var match = String(text || '').match(/@version\s+([0-9][0-9.]*)/);
      if (!match) return;
      var remote = match[1];
      if (compareVersion(remote, currentVersion()) > 0) {
        storeSet(UPDATE_FOUND_KEY, remote);
        announceUpdate(remote);
      } else {
        storeSet(UPDATE_FOUND_KEY, '');
        if (force) console.log('[Loader] Đang dùng bản mới nhất (' + currentVersion() + ').');
      }
    }

    var url = LOADER_URL + '?t=' + now;
    if (requestApi) {
      try {
        requestApi({
          method: 'GET',
          url: url,
          timeout: 15000,
          headers: { Accept: 'text/plain, */*', 'Cache-Control': 'no-cache' },
          onload: function (response) {
            if (response.status === 200) handleHeader(response.responseText);
          },
          onerror: function () {},
          ontimeout: function () {}
        });
        return;
      } catch (error) {}
    }
    if (typeof fetch === 'function') {
      fetch(url, { method: 'GET', cache: 'no-store', credentials: 'omit' })
        .then(function (response) {
          return response.ok ? response.text() : '';
        })
        .then(handleHeader)
        .catch(function () {});
    }
  }

  var apiNames = [
    'GM_xmlhttpRequest',
    'GM_getValue',
    'GM_setValue',
    'GM_addStyle',
    'GM_setClipboard',
    'GM_notification',
    'GM_registerMenuCommand',
    'GM_getResourceText',
    'GM_addElement'
  ];

  var apiValues = [
    requestApi,
    getValueApi,
    setValueApi,
    typeof GM_addStyle === 'function' ? GM_addStyle : modernApi('addStyle'),
    typeof GM_setClipboard === 'function' ? GM_setClipboard : modernApi('setClipboard'),
    notifyApi,
    menuApi,
    typeof GM_getResourceText === 'function'
      ? GM_getResourceText
      : modernApi('getResourceText'),
    typeof GM_addElement === 'function' ? GM_addElement : modernApi('addElement')
  ];

  function isValidPayload(source) {
    return (
      typeof source === 'string' &&
      source.length >= 1000 &&
      source.indexOf('var main = function') !== -1
    );
  }

  function executeSource(source) {
    if (!isValidPayload(source)) {
      throw new Error('Payload GitHub không hợp lệ');
    }

    var runner = Function.apply(
      null,
      apiNames.concat(source + '\n//# sourceURL=chodenocto-octolink.js')
    );
    runner.apply(window, apiValues);
  }

  function cachePayload(source) {
    if (!setValueApi || !isValidPayload(source)) return;
    try {
      if (storeGet(PAYLOAD_CACHE_KEY, '') === source) {
        storeSet(PAYLOAD_TS_KEY, String(Date.now()));
        return;
      }
      storeSet(PAYLOAD_CACHE_KEY, source);
      storeSet(PAYLOAD_TS_KEY, String(Date.now()));
      console.log('[Loader] Đã lưu bản dự phòng (' + Math.round(source.length / 1024) + 'KB)');
    } catch (error) {}
  }

  // Mất mạng / GitHub bị chặn -> chạy bản đã lưu lần trước.
  function runCachedPayload(reason) {
    var cached = String(storeGet(PAYLOAD_CACHE_KEY, '') || '');
    if (!isValidPayload(cached)) return false;
    var ts = parseInt(storeGet(PAYLOAD_TS_KEY, 0), 10) || 0;
    var ageHours = ts ? Math.round((Date.now() - ts) / 3600000) : -1;
    console.warn(
      '[Loader] ' +
        reason +
        ' → dùng bản dự phòng' +
        (ageHours >= 0 ? ' (lưu ' + ageHours + 'h trước)' : '')
    );
    try {
      executeSource(cached);
      return true;
    } catch (error) {
      console.error('[Loader] Bản dự phòng lỗi:', error);
      return false;
    }
  }

  function loadWithFetch(url, onSuccess, onFailure) {
    if (typeof fetch !== 'function') {
      onFailure(new Error('Không có API request tương thích'));
      return;
    }

    fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit'
    })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.text();
      })
      .then(onSuccess)
      .catch(onFailure);
  }

  function loadSource(attempt) {
    // Lan 3 tro di doi sang jsDelivr, phong truong hop raw.githubusercontent
    // bi chan hoac dang tra ban cu tu cache.
    var base = attempt >= 3 ? SCRIPT_URL_FALLBACK : SCRIPT_URL;
    var url = base + '?t=' + Date.now() + '&attempt=' + attempt;
    var settled = false;

    function success(source, status) {
      if (settled) return;
      settled = true;

      try {
        console.log('[Loader] HTTP status:', status || 200, '·', base);
        executeSource(source);
        console.log('[Loader] Loaded script (' + Math.round(source.length / 1024) + 'KB)');
        cachePayload(source);
      } catch (error) {
        window.__chodenoctoLoaderRunning = false;
        console.error('[Loader] Execute error:', error);
      }
    }

    function retry(error) {
      if (settled) return;
      settled = true;
      if (attempt >= MAX_ATTEMPTS) {
        console.error('[Loader] Load failed after ' + attempt + ' attempts:', error);
        if (!runCachedPayload('Tải payload thất bại')) {
          window.__chodenoctoLoaderRunning = false;
        }
        return;
      }

      console.warn('[Loader] Retry ' + (attempt + 1) + '/' + MAX_ATTEMPTS, error);
      setTimeout(function () {
        loadSource(attempt + 1);
      }, RETRY_DELAY * attempt);
    }

    if (!requestApi) {
      loadWithFetch(url, function (source) {
        success(source, 200);
      }, retry);
      return;
    }

    try {
      var requestResult = requestApi({
        method: 'GET',
        url: url,
        timeout: 20000,
        headers: {
          Accept: 'text/javascript, */*',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache'
        },
        onload: function (response) {
          if (response.status !== 200) {
            retry(new Error('HTTP ' + response.status));
            return;
          }
          success(response.responseText, response.status);
        },
        onerror: function (error) {
          retry(error || new Error('Network error'));
        },
        ontimeout: function () {
          retry(new Error('Request timeout'));
        }
      });

      if (requestResult && typeof requestResult.then === 'function') {
        requestResult
          .then(function (response) {
            if (settled || !response) return;
            if (response.status !== 200) {
              retry(new Error('HTTP ' + response.status));
              return;
            }
            success(response.responseText, response.status);
          })
          .catch(retry);
      }
    } catch (error) {
      loadWithFetch(url, function (source) {
        success(source, 200);
      }, retry);
    }
  }

  try {
    if (menuApi) {
      menuApi('Kiểm tra cập nhật', function () {
        console.log('[Loader] Đang kiểm tra cập nhật...');
        checkLoaderUpdate(true);
      });
    }
  } catch (error) {}

  loadSource(1);
  // Kiểm tra bản mới sau khi payload đã chạy, không chặn luồng chính.
  setTimeout(function () {
    checkLoaderUpdate(false);
  }, 4000);
})();
