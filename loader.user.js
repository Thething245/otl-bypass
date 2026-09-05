// ==UserScript==
// @name         Chodenocto-Bypass
// @namespace    http://tampermonkey.net/
// @version      2.0.1
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
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.addStyle
// @grant        GM.setClipboard
// @grant        GM.notification
// @grant        GM.registerMenuCommand
// @grant        GM.getResourceText
// @grant        GM.addElement
// @connect      *
// @connect      raw.githubusercontent.com
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
  if (window.__chodenoctoLoaderRunning) return;
  window.__chodenoctoLoaderRunning = true;

  var SCRIPT_URL =
    'https://raw.githubusercontent.com/Thething245/otl-bypass/main/octolink.js';
  var MAX_ATTEMPTS = 3;
  var RETRY_DELAY = 1500;

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
    typeof GM_getValue === 'function' ? GM_getValue : modernApi('getValue'),
    typeof GM_setValue === 'function' ? GM_setValue : modernApi('setValue'),
    typeof GM_addStyle === 'function' ? GM_addStyle : modernApi('addStyle'),
    typeof GM_setClipboard === 'function' ? GM_setClipboard : modernApi('setClipboard'),
    typeof GM_notification === 'function' ? GM_notification : modernApi('notification'),
    typeof GM_registerMenuCommand === 'function'
      ? GM_registerMenuCommand
      : modernApi('registerMenuCommand'),
    typeof GM_getResourceText === 'function'
      ? GM_getResourceText
      : modernApi('getResourceText'),
    typeof GM_addElement === 'function' ? GM_addElement : modernApi('addElement')
  ];

  function executeSource(source) {
    if (
      typeof source !== 'string' ||
      source.length < 1000 ||
      source.indexOf('var main = function') === -1
    ) {
      throw new Error('Payload GitHub không hợp lệ');
    }

    var runner = Function.apply(
      null,
      apiNames.concat(source + '\n//# sourceURL=chodenocto-octolink.js')
    );
    runner.apply(window, apiValues);
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
    var url = SCRIPT_URL + '?t=' + Date.now() + '&attempt=' + attempt;
    var settled = false;

    function success(source, status) {
      if (settled) return;
      settled = true;

      try {
        console.log('[Loader] HTTP status:', status || 200);
        executeSource(source);
        console.log('[Loader] Loaded script (' + Math.round(source.length / 1024) + 'KB)');
      } catch (error) {
        window.__chodenoctoLoaderRunning = false;
        console.error('[Loader] Execute error:', error);
      }
    }

    function retry(error) {
      if (settled) return;
      settled = true;
      if (attempt >= MAX_ATTEMPTS) {
        window.__chodenoctoLoaderRunning = false;
        console.error('[Loader] Load failed after ' + attempt + ' attempts:', error);
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

  loadSource(1);
})();
