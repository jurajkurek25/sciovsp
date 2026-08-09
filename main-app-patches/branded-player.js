// Branded video player — volt-green custom controls, no native download UI.
// Usage: mountBrandedPlayer(containerEl, videoUrl, { poster, compact, muted, loop })
(function () {
  if (window.mountBrandedPlayer) return;

  const CSS = `
.bp-wrap{position:relative;width:100%;background:#000;border-radius:12px;overflow:hidden;user-select:none}
.bp-wrap video{width:100%;display:block;background:#000}
.bp-bar{position:absolute;left:0;right:0;bottom:0;padding:.6rem .7rem .55rem;background:linear-gradient(to top,rgba(0,0,0,.85),rgba(0,0,0,0));display:flex;align-items:center;gap:.55rem;opacity:0;transition:opacity .2s;font-family:'DM Mono',monospace}
.bp-wrap:hover .bp-bar,.bp-wrap.bp-touched .bp-bar,.bp-wrap.bp-paused .bp-bar{opacity:1}
.bp-btn{background:none;border:none;color:#eeeef5;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;width:26px;height:26px;flex-shrink:0}
.bp-btn svg{width:16px;height:16px;fill:currentColor}
.bp-progress{flex:1;height:4px;background:rgba(255,255,255,.25);border-radius:99px;position:relative;cursor:pointer}
.bp-progress-fill{position:absolute;left:0;top:0;bottom:0;background:#c8ff00;border-radius:99px;width:0%}
.bp-time{font-size:.68rem;color:#a1a1bc;white-space:nowrap;flex-shrink:0}
.bp-vol{width:50px;height:3px;accent-color:#c8ff00;flex-shrink:0}
.bp-center-play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.25);cursor:pointer;opacity:1;transition:opacity .15s}
.bp-center-play.bp-hide{opacity:0;pointer-events:none}
.bp-center-play svg{width:52px;height:52px;fill:#c8ff00;filter:drop-shadow(0 2px 10px rgba(0,0,0,.5))}
.bp-wrap.bp-compact .bp-bar{padding:.4rem .5rem}
.bp-wrap.bp-compact .bp-vol,.bp-wrap.bp-compact .bp-fs{display:none}
`;

  function injectCss() {
    if (document.getElementById('bp-styles')) return;
    const style = document.createElement('style');
    style.id = 'bp-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  const ICONS = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
    volOn: '<svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2A4.5 4.5 0 0 0 14 7.97v8.05A4.5 4.5 0 0 0 16.5 12z"/></svg>',
    volOff: '<svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3zm15.27 2 2.13 2.12-1.41 1.41L17 15.41l-2.12 2.12-1.41-1.41L15.59 14l-2.12-2.12 1.41-1.41L17 12.59l2.12-2.12 1.41 1.41z"/></svg>',
    fs: '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>'
  };

  function fmt(s) {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  window.mountBrandedPlayer = function (container, src, opts) {
    opts = opts || {};
    injectCss();
    container.innerHTML = '';
    container.classList.add('bp-wrap');
    if (opts.compact) container.classList.add('bp-compact');

    const video = document.createElement('video');
    video.src = src;
    video.playsInline = true;
    video.controls = false;
    video.controlsList = 'nodownload noremoteplayback';
    video.disablePictureInPicture = true;
    video.oncontextmenu = () => false;
    video.ondragstart = () => false;
    if (opts.poster) video.poster = opts.poster;
    if (opts.muted) video.muted = true;
    if (opts.loop) video.loop = true;
    container.appendChild(video);

    const centerPlay = document.createElement('div');
    centerPlay.className = 'bp-center-play';
    centerPlay.innerHTML = ICONS.play;
    container.appendChild(centerPlay);

    const bar = document.createElement('div');
    bar.className = 'bp-bar';
    const playBtn = document.createElement('button');
    playBtn.className = 'bp-btn bp-play';
    playBtn.innerHTML = ICONS.play;
    const progress = document.createElement('div');
    progress.className = 'bp-progress';
    const progressFill = document.createElement('div');
    progressFill.className = 'bp-progress-fill';
    progress.appendChild(progressFill);
    const time = document.createElement('span');
    time.className = 'bp-time';
    time.textContent = '0:00 / 0:00';
    const volBtn = document.createElement('button');
    volBtn.className = 'bp-btn bp-vol-btn';
    volBtn.innerHTML = ICONS.volOn;
    const vol = document.createElement('input');
    vol.type = 'range'; vol.min = '0'; vol.max = '1'; vol.step = '0.05'; vol.value = opts.muted ? '0' : '1';
    vol.className = 'bp-vol';
    const fsBtn = document.createElement('button');
    fsBtn.className = 'bp-btn bp-fs';
    fsBtn.innerHTML = ICONS.fs;

    bar.appendChild(playBtn);
    bar.appendChild(progress);
    bar.appendChild(time);
    bar.appendChild(volBtn);
    bar.appendChild(vol);
    bar.appendChild(fsBtn);
    container.appendChild(bar);

    function togglePlay() {
      if (video.paused) video.play(); else video.pause();
    }
    function updatePlayIcon() {
      const icon = video.paused ? ICONS.play : ICONS.pause;
      playBtn.innerHTML = icon;
      centerPlay.innerHTML = ICONS.play;
      centerPlay.classList.toggle('bp-hide', !video.paused);
      container.classList.toggle('bp-paused', video.paused);
    }
    playBtn.onclick = togglePlay;
    centerPlay.onclick = togglePlay;
    video.onclick = togglePlay;
    video.onplay = updatePlayIcon;
    video.onpause = updatePlayIcon;
    video.ontimeupdate = () => {
      const pct = video.duration ? (video.currentTime / video.duration) * 100 : 0;
      progressFill.style.width = pct + '%';
      time.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration);
    };
    progress.onclick = (e) => {
      const rect = progress.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      if (video.duration) video.currentTime = pct * video.duration;
    };
    volBtn.onclick = () => {
      video.muted = !video.muted;
      volBtn.innerHTML = video.muted ? ICONS.volOff : ICONS.volOn;
      vol.value = video.muted ? '0' : video.volume;
    };
    vol.oninput = () => {
      video.volume = Number(vol.value);
      video.muted = video.volume === 0;
      volBtn.innerHTML = video.muted ? ICONS.volOff : ICONS.volOn;
    };
    fsBtn.onclick = () => {
      if (container.requestFullscreen) container.requestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    };
    container.addEventListener('touchstart', () => container.classList.add('bp-touched'), { passive: true });

    updatePlayIcon();
    return video;
  };
})();
