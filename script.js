const button = document.querySelector('.menu-button');
const nav = document.querySelector('.site-nav');

// 音声機能：BGMの選択状態と再生状態は分けて管理します。
const AUDIO_SETTING_KEY = 'mimikoko-audio-enabled';
// BGMの標準音量（0〜1）。音量を調整したい場合は、この数値を変更できます。
const BGM_VOLUME = 0.25;
const bgm = document.querySelector('#site-bgm');
const musicToggle = document.querySelector('#music-toggle');
let audioPreference = null;
let bgmPlaying = false;
let audioContext;
let effectsMaster;
let effectTimers = [];
let resumeAfterVisibility = false;
const forceAudioChoice = new URLSearchParams(window.location.search).get('sound') === 'choose';

try { audioPreference = localStorage.getItem(AUDIO_SETTING_KEY); } catch (error) { /* 保存できないブラウザではこのページ内だけで動作します。 */ }

function saveAudioPreference(value) {
  audioPreference = value;
  try { localStorage.setItem(AUDIO_SETTING_KEY, value); } catch (error) { /* 保存できなくても再生操作はできます。 */ }
}

function updateMusicButton() {
  if (!musicToggle) return;
  musicToggle.classList.toggle('is-playing', bgmPlaying);
  musicToggle.setAttribute('aria-pressed', String(bgmPlaying));
  musicToggle.setAttribute('aria-label', bgmPlaying ? '音楽を停止する' : '音楽を再生する');
}

function fadeBgm(target, duration, done) {
  if (!bgm) return;
  const start = bgm.volume;
  const startedAt = performance.now();
  const step = (now) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    bgm.volume = Math.max(0, Math.min(1, start + (target - start) * progress));
    if (progress < 1) window.requestAnimationFrame(step);
    else done?.();
  };
  window.requestAnimationFrame(step);
}

async function startBgm({ fadeIn = true } = {}) {
  if (!bgm || bgmPlaying) return bgmPlaying;
  bgm.volume = 0;
  try {
    await bgm.play();
    bgmPlaying = true;
    updateMusicButton();
    if (fadeIn) fadeBgm(BGM_VOLUME, 2000);
    return true;
  } catch (error) {
    bgmPlaying = false;
    updateMusicButton();
    return false;
  }
}

function stopBgm() {
  if (!bgm || !bgmPlaying) return;
  fadeBgm(0, 350, () => {
    bgm.pause();
    bgmPlaying = false;
    updateMusicButton();
  });
}

function getAudioContext() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  return audioContext;
}

async function prepareEffects() {
  if (!window.AudioContext && !window.webkitAudioContext) return false;
  const context = getAudioContext();
  try { await context.resume(); } catch (error) { return false; }
  if (!effectsMaster) {
    effectsMaster = context.createGain();
    effectsMaster.gain.value = 0.5;
    effectsMaster.connect(context.destination);
  }
  return context.state === 'running' ? context : false;
}

function softTone(context, frequency, start, duration, volume, type = 'sine') {
  if (!effectsMaster) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(effectsMaster);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function paperSound(context) {
  if (!effectsMaster) return;
  const length = Math.floor(context.sampleRate * 0.26);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  filter.type = 'lowpass';
  filter.frequency.value = 1300;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.15, context.currentTime + 0.035);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.25);
  source.buffer = buffer;
  source.connect(filter).connect(gain).connect(effectsMaster);
  source.start();
}

function playOpeningChime(context) {
  const now = context.currentTime;
  [523.25, 659.25, 783.99].forEach((frequency, index) => softTone(context, frequency, now + index * 0.11, 0.62, 0.095));
}

function playStarDust(context) {
  const now = context.currentTime;
  [587.33, 698.46, 783.99, 880, 1046.5, 880, 783.99].forEach((frequency, index) => softTone(context, frequency, now + index * 0.075, 0.38, 0.065));
}

function playWhiteout(context) {
  const now = context.currentTime;
  softTone(context, 293.66, now, 0.48, 0.095);
  softTone(context, 440, now + 0.08, 0.48, 0.07);
}

function clearEffects() {
  effectTimers.forEach((timer) => window.clearTimeout(timer));
  effectTimers = [];
  if (effectsMaster && audioContext) effectsMaster.gain.setTargetAtTime(0.0001, audioContext.currentTime, 0.035);
}

function scheduleEffect(callback, delay) {
  effectTimers.push(window.setTimeout(callback, delay));
}

// ホームページを開くたび、絵本のオープニングを表示します。
const opening = document.querySelector('#book-opening');
const openingSkip = document.querySelector('#opening-skip');
const openingReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const audioChoice = document.querySelector('#opening-audio-choice');
const audioChoiceOn = document.querySelector('#audio-choice-on');
const audioChoiceOff = document.querySelector('#audio-choice-off');
let openingTimers = [];

function clearOpeningTimers() {
  openingTimers.forEach((timer) => window.clearTimeout(timer));
  openingTimers = [];
}

function scheduleOpening(callback, delay) {
  openingTimers.push(window.setTimeout(callback, delay));
}

function finishOpening() {
  if (!opening || opening.dataset.finished === 'true') return;
  opening.dataset.finished = 'true';
  clearOpeningTimers();
  clearEffects();
  opening.classList.add('is-fading');
  document.documentElement.classList.remove('has-opening-intro');
  if (audioPreference === 'on') {
    if (bgmPlaying) fadeBgm(BGM_VOLUME, 2000);
    else startBgm();
  }
  window.setTimeout(() => opening.remove(), 650);
}

function startOpening(withSound) {
  if (!opening) return;
  opening.classList.remove('is-choosing');
  if (openingReducedMotion) {
    opening.classList.add('is-ready');
    scheduleOpening(finishOpening, 250);
  } else {
    window.requestAnimationFrame(() => opening.classList.add('is-ready'));
    // GIFは約2.16秒でループするため、1周目の終わりで白く切り替えます。
    scheduleOpening(() => opening.classList.add('is-whiteout'), 2050);
    scheduleOpening(finishOpening, 2280);
    if (withSound) {
      prepareEffects().then((context) => {
        if (!context || opening.dataset.finished === 'true') return;
        effectsMaster.gain.setTargetAtTime(0.5, context.currentTime, 0.02);
        playOpeningChime(context);
        scheduleEffect(() => paperSound(context), 720);
        scheduleEffect(() => playStarDust(context), 1280);
        scheduleEffect(() => playWhiteout(context), 2010);
      });
    }
  }
}

if (opening && document.documentElement.classList.contains('has-opening-intro')) {
  if (!forceAudioChoice && (audioPreference === 'on' || audioPreference === 'off')) startOpening(audioPreference === 'on');
  else {
    opening.classList.add('is-choosing');
    audioChoiceOn?.focus();
    audioChoiceOn?.addEventListener('click', () => {
      saveAudioPreference('on');
      // タップの瞬間に音声を解放し、iPhone等の自動再生制限に対応します。
      prepareEffects();
      startBgm({ fadeIn: false });
      startOpening(true);
    });
    audioChoiceOff?.addEventListener('click', () => { saveAudioPreference('off'); startOpening(false); });
  }
  openingSkip?.addEventListener('click', finishOpening);
}

musicToggle?.addEventListener('click', async () => {
  if (bgmPlaying) {
    saveAudioPreference('off');
    stopBgm();
  } else {
    saveAudioPreference('on');
    await startBgm();
  }
});

bgm?.addEventListener('error', () => {
  bgmPlaying = false;
  updateMusicButton();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && bgmPlaying) {
    resumeAfterVisibility = true;
    bgm?.pause();
    bgmPlaying = false;
    updateMusicButton();
  } else if (!document.hidden && resumeAfterVisibility && audioPreference === 'on') {
    resumeAfterVisibility = false;
    startBgm();
  }
});

document.querySelectorAll('video').forEach((video) => {
  video.addEventListener('play', () => { if (bgmPlaying) { resumeAfterVisibility = true; stopBgm(); } });
  video.addEventListener('ended', () => { if (resumeAfterVisibility && audioPreference === 'on') { resumeAfterVisibility = false; startBgm(); } });
});

updateMusicButton();

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
