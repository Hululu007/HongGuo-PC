import React, { useCallback, useEffect, useState } from 'react';

export const LOCALES = ['zh-CN', 'en-US'];
export function resolveLocale(setting, candidates = []) {
  if (setting === 'zh-CN' || setting === 'en-US') return setting;
  for (const candidate of (candidates.length ? candidates : ['zh-CN'])) {
    const value = String(candidate).toLowerCase();
    if (value === 'en' || value.startsWith('en-')) return 'en-US';
    if (value === 'zh' || value.startsWith('zh-')) return 'zh-CN';
  }
  return 'zh-CN';
}

const MESSAGES = {
  'zh-CN': {
    'nav.main': '主导航',
    'nav.content': '内容',
    'nav.browse': '发现短剧',
    'nav.feed': '热播推荐',
    'nav.download': '搜索与下载',
    'nav.player': '我的剧库',
    'nav.history': '观看记录',
    'nav.calendar': '收藏与上新',
    'nav.manager': '下载管理',
    'nav.account': '登录账号',
    'nav.announcements': '更新日志',
    'nav.settings': '设置',
    'nav.search': '搜索页面、剧集…',
    'nav.collapse': '收起',
    'nav.expand': '展开侧栏',
    'nav.preview': '功能预览',
    'nav.brandSub': '每一集，都值得期待',
    'nav.more': '更多',
    'nav.portrait': '竖屏版',
    'nav.landscape': '横屏版',
    'nav.switching': '切换中…',
    'settings.title': '设置',
    'settings.subtitle': '让下载、保存和网络连接，按你的习惯运行。',
    'settings.search': '搜索设置，例如：下载、弹幕、代理',
    'settings.language': '语言 / Language',
    'settings.auto': '自动（当前：{locale}）',
    'settings.englishPartial': 'English (partial)',
    'settings.languageHint': '自动模式按浏览器或系统语言选择，无法识别时默认中文。目前仅导航与部分设置提供英文，其余界面仍为中文；视频、剧名和来源内容保持原文。选择后立即预览，点击「保存设置」后会记住语言偏好。',
    'settings.reload': '重新加载',
    'settings.loading': '加载中…',
    'settings.close': '关闭提示',
    'announcements.title': '更新日志',
    'announcements.subtitle': '检查新版本，查看每个版本更新了什么。',
  },
  'en-US': {
    'nav.main': 'Main navigation',
    'nav.content': 'Content',
    'nav.browse': 'Discover dramas',
    'nav.feed': 'Trending',
    'nav.download': 'Search & download',
    'nav.player': 'My library',
    'nav.history': 'Watch history',
    'nav.calendar': 'Favorites & releases',
    'nav.manager': 'Download manager',
    'nav.account': 'Account',
    'nav.announcements': 'Release notes',
    'nav.settings': 'Settings',
    'nav.search': 'Search pages and dramas…',
    'nav.collapse': 'Collapse',
    'nav.expand': 'Expand sidebar',
    'nav.preview': 'Preview build',
    'nav.brandSub': 'Every episode is worth watching',
    'nav.more': 'More',
    'nav.portrait': 'Portrait',
    'nav.landscape': 'Landscape',
    'nav.switching': 'Switching…',
    'settings.title': 'Settings',
    'settings.subtitle': 'Tune downloads, storage, and connections to your workflow.',
    'settings.search': 'Search settings, for example: downloads, danmaku, proxy',
    'settings.language': 'Language / 语言',
    'settings.auto': 'Auto (current: {locale})',
    'settings.englishPartial': 'English (partial)',
    'settings.languageHint': 'Auto follows the browser or system language and falls back to Chinese. Only navigation and some settings are translated into English; the rest of the interface remains Chinese. Video titles, drama names, and source content stay original. Changes preview immediately; click “保存设置” (Save settings) to remember your language preference.',
    'settings.reload': 'Reload',
    'settings.loading': 'Loading…',
    'settings.close': 'Dismiss',
    'announcements.title': 'Release notes',
    'announcements.subtitle': 'Check for new versions and review what changed in each release.',
  },
};

function browserCandidates() {
  if (typeof navigator === 'undefined') return [];
  return Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : navigator.language ? [navigator.language] : [];
}

let currentSetting = 'auto';
let currentLocale = resolveLocale('auto', browserCandidates());
let initialized = false;
const listeners = new Set();
function applyGlobalSetting(next) {
  currentSetting = next === 'zh-CN' || next === 'en-US' ? next : 'auto';
  currentLocale = resolveLocale(currentSetting, browserCandidates());
  // English is partial: most screens and source content remain Chinese.
  // Keep the document's primary language honest; translated regions can use locale as their lang.
  if (typeof document !== 'undefined') document.documentElement.lang = 'zh-CN';
  listeners.forEach((listener) => listener());
}

export function LocaleProvider({ children }) {
  return children;
}

export function useI18n() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const listener = () => rerender((value) => value + 1);
    listeners.add(listener);
    if (!initialized) {
      initialized = true;
      applyGlobalSetting('auto');
      try {
        const getSettings = globalThis.window?.electronAPI?.getSettings;
        if (typeof getSettings === 'function') Promise.resolve(getSettings()).then((value) => applyGlobalSetting(value?.locale)).catch(() => {});
      } catch { /* 使用浏览器语言作为默认值 */ }
    }
    const onLocaleChange = (event) => applyGlobalSetting(event?.detail);
    globalThis.window?.addEventListener?.('hongguo:locale-change', onLocaleChange);
    return () => {
      listeners.delete(listener);
      globalThis.window?.removeEventListener?.('hongguo:locale-change', onLocaleChange);
    };
  }, []);
  const setLocaleSetting = useCallback((next) => applyGlobalSetting(next), []);
  const t = useCallback((key, fallback = key, params = {}) => {
    let value = MESSAGES[currentLocale]?.[key] ?? MESSAGES['zh-CN']?.[key] ?? fallback;
    Object.entries(params).forEach(([name, replacement]) => { value = value.replace(`{${name}}`, String(replacement)); });
    return value;
  }, []);
  return { setting: currentSetting, locale: currentLocale, t, setLocaleSetting };
}
