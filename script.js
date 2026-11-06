const button = document.querySelector('.menu-button');
const nav = document.querySelector('.site-nav');

button?.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  button.setAttribute('aria-expanded', String(open));
});

document.querySelectorAll('.site-nav a').forEach((link) => link.addEventListener('click', () => {
  nav.classList.remove('is-open');
  button?.setAttribute('aria-expanded', 'false');
}));

// ミミのおしゃべりはここへ追加・編集できます。
const mimiLines = {
  normal: ['遊びに来てくれてありがとうにゃ！', 'ミミココのお部屋へようこそ！', '今日は何を見ていくにゃ？', 'ちくわ、おいしいにゃ〜♡', 'ゆっくりしていってにゃ！', 'また遊びに来てほしいにゃ！'],
  top: ['ようこそにゃ！ゆっくりしていってね！', '今日も遊びに来てくれて嬉しいにゃ！'],
  friends: ['ミミのお友達を紹介するにゃ！', 'みんなのことも知ってほしいにゃ！'],
  movies: ['ミミたちのお話を読んでいくにゃ？', 'どんな物語が待っているかな？'],
  exclusive: ['ここだけのお話があるにゃ！', 'ゆっくり楽しんでいってにゃ！'],
  kamishibai: ['今日はどんなお話を読むにゃ？', 'ミミココ紙芝居の時間にゃ！'],
  goods: ['ミミたちのグッズを見ていってにゃ！'],
};

const guideButton = document.querySelector('#mimi-guide-button');
const bubble = document.querySelector('#mimi-bubble');
const bubbleText = bubble?.querySelector('p');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastLine = '';
let activeSection = 'top';
let hideTimer;
let nextTimer;
let lastShownAt = 0;

function sectionKey(id) {
  return mimiLines[id] ? id : 'normal';
}

function getLine(key) {
  const options = mimiLines[key] || mimiLines.normal;
  const available = options.filter((line) => line !== lastLine);
  const line = (available.length ? available : options)[Math.floor(Math.random() * (available.length || options.length))];
  lastLine = line;
  return line;
}

function queueNextLine() {
  window.clearTimeout(nextTimer);
  nextTimer = window.setTimeout(() => showLine(activeSection), reducedMotion ? 45000 : 24000);
}

function showLine(key = activeSection, force = false) {
  if (!bubble || !bubbleText) return;
  const now = Date.now();
  if (!force && now - lastShownAt < 8000) return;

  window.clearTimeout(hideTimer);
  window.clearTimeout(nextTimer);
  bubbleText.textContent = getLine(sectionKey(key));
  bubble.classList.add('is-visible');
  lastShownAt = now;

  hideTimer = window.setTimeout(() => {
    bubble.classList.remove('is-visible');
    queueNextLine();
  }, reducedMotion ? 7000 : 5500);
}

guideButton?.addEventListener('click', () => showLine(activeSection, true));

const sectionIds = ['friends', 'movies', 'exclusive', 'kamishibai', 'goods'];
const observedSections = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible || visible.target.id === activeSection) return;
    activeSection = visible.target.id;
    showLine(activeSection);
  }, { rootMargin: '-25% 0px -55% 0px', threshold: [0.01, 0.2] });

  observedSections.forEach((section) => observer.observe(section));
}

function updateFromHash() {
  const id = window.location.hash.replace('#', '');
  activeSection = sectionIds.includes(id) ? id : 'top';
  showLine(activeSection, true);
}

window.addEventListener('hashchange', updateFromHash);
window.setTimeout(updateFromHash, 700);
