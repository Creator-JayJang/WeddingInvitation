/* ══════════════════════════════════════════════════════════════════════════
   장재준 · 심혜은 모바일 청첩장 — 인터랙션
   구현 근거: _workspace/04_motion-designer_motion-spec.md (rev.2)
   외부 라이브러리 0개 (Firebase 만 방명록 진입 시 동적 import)
   애니메이션은 transform · opacity 만 (예외: 아코디언 grid-template-rows §3-8)
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── 0. 공통 헬퍼 ─────────────────────────────────────────────────────── */
  var rmq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = rmq.matches;

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v === '' ? fallback : v;
  }

  /* 배경 파티클은 모션 명세 rev.3에서 제거 확정. 상시 렌더 루프를 두지 않는다 —
     아래 rAF 호출은 전부 1회성(스크롤 스로틀·클래스 토글·볼륨 페이드)이다. */

  /* 값 교체 페이드 (카운트다운 · 갤러리 카운터 공용, §3-1) */
  function setUnit(el, v, dur) {
    if (!el || el.textContent === v) return;
    if (reduced || typeof el.animate !== 'function') { el.textContent = v; return; }
    el.animate([{ opacity: 1 }, { opacity: .4 }, { opacity: 1 }],
      { duration: dur || 240, easing: 'cubic-bezier(.4,0,.2,1)' });
    setTimeout(function () { el.textContent = v; }, Math.round((dur || 240) * 0.42));
  }

  /* ── 1. 토스트 (§3-5, 공용) ───────────────────────────────────────────── */
  var toastEl = $('#toast');
  var toastTimer = null;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-in');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-in'); }, 1600);
  }

  /* ── 2. 복사 유틸 + placeholder 안전장치 (§3-5 / §3-7) ────────────────── */
  // "{{...}}", "[...]", "YOUR_..." 로 시작하면 아직 채워지지 않은 값으로 간주한다.
  function isPlaceholder(v) { return !v || /^\s*(\{\{|\[|YOUR_)/.test(v); }

  function copyText(txt) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(txt);
    }
    return new Promise(function (res, rej) {
      try {
        var ta = document.createElement('textarea');
        ta.value = txt;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        var ok = document.execCommand('copy');
        ta.remove();
        ok ? res() : rej();
      } catch (e) { rej(e); }
    });
  }

  function enableIfReady(btn, value) {
    if (isPlaceholder(value)) return false;
    btn.disabled = false;
    btn.removeAttribute('aria-disabled');
    var label = btn.getAttribute('data-label-ready');
    if (label) {
      btn.textContent = label;
      if (btn.hasAttribute('aria-label')) btn.setAttribute('aria-label', label);
    }
    return true;
  }

  /* 계좌·주소 복사 버튼 */
  $$('[data-copy]').forEach(function (btn) {
    var val = btn.getAttribute('data-copy');
    if (btn.disabled) enableIfReady(btn, val);
    if (isPlaceholder(val)) return;                 // 여전히 placeholder → 비활성 유지

    btn.addEventListener('click', function () {
      copyText(btn.getAttribute('data-copy')).then(function () {
        toast(btn.getAttribute('data-toast') || '복사되었습니다.');
        buzz(10);
        if (btn.classList.contains('btn-copy')) {
          var orig = btn.textContent;
          btn.textContent = '복사됨';
          btn.classList.add('is-done');
          setTimeout(function () { btn.textContent = orig; btn.classList.remove('is-done'); }, 1200);
        }
      })['catch'](function () {
        toast('복사에 실패했습니다. 길게 눌러 직접 복사해 주세요.');
      });
    });
  });

  /* 외부 링크 버튼(RSVP · 포토앨범) — URL 이 채워지면 자동 활성화 (§3-7) */
  $$('[data-ext-url]').forEach(function (btn) {
    var url = btn.getAttribute('data-ext-url');
    if (!enableIfReady(btn, url)) return;

    // 외부 이동을 숨기지 않는다 — 아이콘 + aria-label 양쪽에 명시
    var label = btn.textContent;
    btn.setAttribute('aria-label', label + ' (새 창에서 열립니다)');
    var NS = 'http://www.w3.org/2000/svg';
    var ico = document.createElementNS(NS, 'svg');
    ico.setAttribute('class', 'btn__ext');
    ico.setAttribute('viewBox', '0 0 14 14');
    ico.setAttribute('width', '12'); ico.setAttribute('height', '12');
    ico.setAttribute('fill', 'none'); ico.setAttribute('stroke', 'currentColor');
    ico.setAttribute('stroke-width', '1.2'); ico.setAttribute('stroke-linecap', 'round');
    ico.setAttribute('stroke-linejoin', 'round'); ico.setAttribute('aria-hidden', 'true');
    ['M5.5 1.5H12.5V8.5', 'M12.5 1.5L6 8', 'M10 8.5v4H1.5V4h4'].forEach(function (d) {
      var path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      ico.appendChild(path);
    });
    btn.appendChild(ico);

    btn.addEventListener('click', function () {
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  });

  /* ── 3. 스크롤 리빌 (§2-0) ────────────────────────────────────────────── */
  var revealEls = $$('.reveal');
  var revealIO = null;

  function revealAll() { revealEls.forEach(function (el) { el.classList.add('is-in'); }); }

  if (reduced || !('IntersectionObserver' in window)) {
    revealAll();
  } else {
    revealIO = new IntersectionObserver(function (entries, obs) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        entries[i].target.classList.add('is-in');
        obs.unobserve(entries[i].target);           // 1회성 — 재진입 시 재생 금지
      }
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { revealIO.observe(el); });
  }

  /* 런타임에 감속 설정이 바뀌면 즉시 반영 */
  function onMotionPrefChange() {
    reduced = rmq.matches;
    if (reduced) {
      if (revealIO) revealIO.disconnect();
      revealAll();
      var h = $('.hero');
      if (h) { h.classList.add('is-type-in'); h.classList.add('is-photo-in'); }
    }
  }
  if (rmq.addEventListener) rmq.addEventListener('change', onMotionPrefChange);
  else if (rmq.addListener) rmq.addListener(onMotionPrefChange);

  /* ── 4. 히어로 진입 시퀀스 (모션 명세 rev.4 §2-1) — opacity 전용, 2트랙 비동기
     트랙 A(사진)와 트랙 B(타이포)는 의도적으로 서로를 기다리지 않는다.
     · 트랙 B: DOMContentLoaded + 1프레임. 스트립이 최상단이라 300KB 사진을 기다리면
       체감 성능이 나빠진다. (이 파일은 defer 로드이므로 실행 시점이 곧 DOM 준비 시점)
     · 트랙 A: 이미지 자체 load. window.load 게이트는 금지 — 갤러리 15장·폰트를 전부
       기다려 LCP가 초 단위로 밀린다. 명세가 "가장 중요한 한 줄"로 못박은 항목이다.
     Ken Burns 폐기에 따라 확대 관련 코드(변형·레이어 승격·애니메이션 종료 훅)는 전부 없다. */
  (function heroIntro() {
    var hero = $('.hero');
    var photo = $('.hero__photo');
    if (!hero) return;

    /* 트랙 B — 타이포 스트립 (사진 대기 없음) */
    requestAnimationFrame(function () { hero.classList.add('is-type-in'); });

    /* 트랙 A — 사진 */
    var shown = false;
    function showPhoto() {
      if (shown) return;
      shown = true;
      hero.classList.add('is-photo-in');
    }

    if (!photo) { showPhoto(); return; }
    if (photo.complete) {
      showPhoto();                                  // 캐시 히트 — 즉시
    } else {
      photo.addEventListener('load', showPhoto, { once: true });
      photo.addEventListener('error', showPhoto, { once: true });   // 실패해도 투명 잔존 금지
      setTimeout(showPhoto, 1500);                  // 명세의 1500ms 실패 타이머
    }
  })();

  /* ── 5. 스크롤 인디케이터 (§2-2) ──────────────────────────────────────── */
  (function scrollIndicator() {
    var si = $('.scroll-indicator');
    if (!si) return;
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        if (window.scrollY > 40) {
          si.classList.add('is-gone');
          window.removeEventListener('scroll', onScroll);
          setTimeout(function () { si.style.display = 'none'; }, reduced ? 0 : 400);
        }
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
  })();

  /* ── 6. 실시간 카운트다운 (Must, §3-1) ────────────────────────────────── */
  (function countdown() {
    var box = $('[data-cd-target]');
    if (!box) return;

    var target = new Date(box.getAttribute('data-cd-target'));
    if (isNaN(target.getTime())) return;

    var u = {
      days:    $('[data-cd="days"]', box),
      hours:   $('[data-cd="hours"]', box),
      minutes: $('[data-cd="minutes"]', box),
      seconds: $('[data-cd="seconds"]', box),
      after:   $('[data-cd="after-days"]', box)
    };
    var leads = {
      before: $('[data-cd-state="before"]', box),
      dday:   $('[data-cd-state="dday"]', box),
      after:  $('[data-cd-state="after"]', box)
    };
    var units = $('.countdown__units', box);
    var timer = null, visible = true, finished = false;

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    /* KST(UTC+9) 달력 기준 날짜 차이 — 뷰어 타임존과 무관하게 정확 */
    function kstDayIndex(ms) {
      var d = new Date(ms + 9 * 3600000);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000;
    }

    function setState(key) {
      Object.keys(leads).forEach(function (k) {
        if (leads[k]) leads[k].hidden = (k !== key);
      });
      if (units) units.hidden = (key === 'after');
    }

    function render() {
      var now = Date.now();
      var diff = target.getTime() - now;
      var dayGap = kstDayIndex(target.getTime()) - kstDayIndex(now);

      if (diff <= 0) {
        finished = true;
        setUnit(u.days, '0'); setUnit(u.hours, '00');
        setUnit(u.minutes, '00'); setUnit(u.seconds, '00');
        if (u.after) u.after.textContent = String(-dayGap + 1);
        setState('after');
        return;
      }

      setState(dayGap === 0 ? 'dday' : 'before');

      var s = Math.floor(diff / 1000);
      setUnit(u.days,    String(Math.floor(s / 86400)));
      setUnit(u.hours,   pad(Math.floor(s % 86400 / 3600)));
      setUnit(u.minutes, pad(Math.floor(s % 3600 / 60)));
      setUnit(u.seconds, pad(s % 60));
    }

    function stop() { clearTimeout(timer); timer = null; }
    function schedule() {
      stop();
      if (finished) return;
      var delay = 1000 - (Date.now() % 1000);      // 초 경계 정렬 (드리프트 방지)
      timer = setTimeout(function () { render(); schedule(); }, delay);
    }
    function resume() {
      if (!visible || document.hidden || finished) return;
      render();                                     // 복귀 즉시 1회 갱신
      schedule();
    }

    render();
    schedule();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        visible ? resume() : stop();
      }, { threshold: 0 }).observe(box);
    }
    document.addEventListener('visibilitychange', function () {
      document.hidden ? stop() : resume();
    });
  })();

  /* ── 7. 갤러리 (Must, §3-2) ───────────────────────────────────────────── */
  var galleryImgs = [];
  var gallerySync = null;
  (function gallery() {
    var track = $('#gallery-track');
    if (!track) return;

    var slides = $$(':scope > li', track);
    var total = slides.length;
    var curEl = $('[data-gal-current]');
    var totEl = $('[data-gal-total]');
    var prevBtn = $('.gallery-nav--prev');
    var nextBtn = $('.gallery-nav--next');
    var hint = $('#gallery-hint');
    var index = 0;

    galleryImgs = slides.map(function (li) { return $('img', li); });
    if (totEl) totEl.textContent = String(total);   // 하드코딩 금지 — 실제 개수에서 산출

    function syncNav() {
      if (prevBtn) prevBtn.disabled = (index <= 0);
      if (nextBtn) nextBtn.disabled = (index >= total - 1);
    }

    function setIndex(i) {
      i = Math.max(0, Math.min(total - 1, i));
      if (i === index) return;
      index = i;
      setUnit(curEl, String(index + 1), 160);
      syncNav();
      buzz(8);
      prefetch(index + 1);
      if (hint && !hint.classList.contains('is-hidden')) hint.classList.add('is-hidden');
    }

    function prefetch(i) {                          // 다음 1장 선로딩 (흰 프레임 방지)
      var img = galleryImgs[i];
      if (!img) return;
      var pre = new Image();
      pre.src = img.currentSrc || img.src;
    }

    function scrollTo(i) {
      var li = slides[i];
      if (!li) return;
      var left = track.scrollLeft
        + li.getBoundingClientRect().left - track.getBoundingClientRect().left
        - (track.clientWidth - li.clientWidth) / 2;
      if (track.scrollTo) {
        track.scrollTo({ left: left, behavior: reduced ? 'auto' : 'smooth' });
      } else {
        track.scrollLeft = left;
      }
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { scrollTo(index - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { scrollTo(index + 1); });

    /* 카운터 갱신은 scroll 이벤트 대신 IO (§3-2) */
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        var best = null;
        entries.forEach(function (e) {
          if (e.isIntersecting && (!best || e.intersectionRatio > best.intersectionRatio)) best = e;
        });
        if (best) setIndex(slides.indexOf(best.target));
      }, { root: track, threshold: 0.6 });
      slides.forEach(function (li) { io.observe(li); });
    }

    syncNav();
    prefetch(1);

    $$('.gallery-item', track).forEach(function (btn, i) {
      btn.addEventListener('click', function () { openLightbox(i, btn); });
    });

    gallerySync = scrollTo;
  })();

  /* ── 8. Lightbox + 핀치 줌 (Must, §3-3) ───────────────────────────────── */
  var openLightbox = function () {};
  (function lightbox() {
    var lb = $('#lightbox');
    var stage = $('#lightbox-stage');
    var img = $('#lightbox-img');
    var closeBtn = $('#lightbox-close');
    var prevBtn = $('#lightbox-prev');
    var nextBtn = $('#lightbox-next');
    var curEl = $('[data-lb-current]');
    var totEl = $('[data-lb-total]');

    if (!lb || !stage || !img) return;

    var idx = 0, opener = null, scrollY = 0, isOpen = false;
    var scale = 1, tx = 0, ty = 0;
    var pointers = new Map();
    var startDist = 0, startScale = 1, startTx = 0, startTy = 0, midX = 0, midY = 0;
    var dragMode = '', dragSX = 0, dragSY = 0, lastTap = 0, lastTapX = 0, lastTapY = 0;
    var tapEligible = false;                 // 핀치 잔여 포인터를 탭으로 오인하지 않기 위한 플래그
    var TAP_SLOP = 10;                       // 명세 §3-3: 이동 <10px 여야 탭으로 판정

    if (totEl) totEl.textContent = String(galleryImgs.length);

    function apply(anim) {
      img.classList.toggle('is-dragging', !anim);
      img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
    }
    /* 인라인 transform 을 비워 CSS 의 열기 애니메이션(scale .96→1)을 살린다 */
    function resetTransform() {
      scale = 1; tx = 0; ty = 0;
      img.classList.remove('is-dragging');
      img.style.transform = '';
    }

    function clamp() {
      var maxX = Math.max(0, (img.clientWidth * scale - stage.clientWidth) / 2);
      var maxY = Math.max(0, (img.clientHeight * scale - stage.clientHeight) / 2);
      tx = Math.max(-maxX, Math.min(maxX, tx));
      ty = Math.max(-maxY, Math.min(maxY, ty));
    }

    function show(i) {
      idx = Math.max(0, Math.min(galleryImgs.length - 1, i));
      var src = galleryImgs[idx];
      if (!src) return;
      img.src = src.currentSrc || src.src;
      img.alt = src.alt || '';
      lastTap = 0;                           // 사진이 바뀌면 탭 연속성 끊기
      resetTransform();
      if (curEl) curEl.textContent = String(idx + 1);
      if (prevBtn) prevBtn.disabled = (idx <= 0);
      if (nextBtn) nextBtn.disabled = (idx >= galleryImgs.length - 1);
      if (gallerySync) gallerySync(idx);
    }

    function open(i, trigger) {
      opener = trigger || null;
      scrollY = window.scrollY;
      lb.hidden = false;
      show(i);
      requestAnimationFrame(function () { lb.classList.add('is-open'); });
      document.body.style.position = 'fixed';
      document.body.style.top = (-scrollY) + 'px';
      document.body.style.width = '100%';
      isOpen = true;
      if (closeBtn) closeBtn.focus();
      document.addEventListener('keydown', onKey);
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      lb.classList.remove('is-open');
      lb.style.opacity = '';
      document.removeEventListener('keydown', onKey);
      var delay = reduced ? 0 : 180;
      setTimeout(function () {
        lb.hidden = true;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
        if (opener) opener.focus();
      }, delay);
    }

    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowLeft') { show(idx - 1); return; }
      if (e.key === 'ArrowRight') { show(idx + 1); return; }
      if (e.key !== 'Tab') return;
      var f = [closeBtn, prevBtn, nextBtn].filter(function (b) { return b && !b.disabled; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    if (closeBtn) closeBtn.addEventListener('click', close);
    if (prevBtn) prevBtn.addEventListener('click', function () { show(idx - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { show(idx + 1); });

    stage.addEventListener('pointerdown', function (e) {
      if (!isOpen) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}

      if (pointers.size === 2) {
        var p = Array.from(pointers.values());
        startDist = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y) || 1;
        startScale = scale; startTx = tx; startTy = ty;
        var r = stage.getBoundingClientRect();
        midX = (p[0].x + p[1].x) / 2 - r.left - r.width / 2;
        midY = (p[0].y + p[1].y) / 2 - r.top - r.height / 2;
        dragMode = 'pinch';
        tapEligible = false;                 // 두 손가락 제스처는 탭이 아니다
        lastTap = 0;
      } else if (pointers.size === 1) {
        dragSX = e.clientX; dragSY = e.clientY;
        startTx = tx; startTy = ty;
        dragMode = scale > 1 ? 'pan' : 'swipe';
        tapEligible = true;
      } else {
        tapEligible = false;
      }
    });

    stage.addEventListener('pointermove', function (e) {
      if (!isOpen || !pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (dragMode === 'pinch' && pointers.size === 2) {
        var p = Array.from(pointers.values());
        var d = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
        var next = Math.max(1, Math.min(3, startScale * (d / startDist)));
        var k = next / startScale;
        scale = next;
        tx = midX - k * (midX - startTx);
        ty = midY - k * (midY - startTy);
        clamp(); apply(false);
        return;
      }

      var dx = e.clientX - dragSX, dy = e.clientY - dragSY;

      if (dragMode === 'pan') {
        tx = startTx + dx; ty = startTy + dy;
        clamp(); apply(false);
      } else if (dragMode === 'swipe' && Math.abs(dy) > Math.abs(dx) && dy > 0) {
        lb.style.opacity = String(Math.max(.3, 1 - dy / 400));   // 아래로 끌면 배경 흐려짐
      }
    });

    function endPointer(e) {
      if (!pointers.has(e.pointerId)) return;
      var startX = dragSX, startY = dragSY;
      var mode = dragMode;
      pointers['delete'](e.pointerId);

      /* 핀치 종료 — 손가락이 하나 남으면 팬/스와이프로 인계한다.
         이 잔여 포인터는 '탭'이 아니므로 tapEligible 을 내려 더블탭 오판정을 막는다. */
      if (mode === 'pinch') {
        if (pointers.size < 2) {
          if (scale < 1.02) { scale = 1; tx = 0; ty = 0; }
          clamp(); apply(true);
          if (pointers.size === 1) {
            var only = Array.from(pointers.values())[0];
            dragSX = only.x; dragSY = only.y; startTx = tx; startTy = ty;
            dragMode = scale > 1 ? 'pan' : 'swipe';
            tapEligible = false;
          } else {
            dragMode = '';
          }
        }
        return;
      }

      if (mode !== 'swipe' && mode !== 'pan') {
        if (!pointers.size) dragMode = '';
        return;
      }

      var dx = e.clientX - startX, dy = e.clientY - startY;

      if (mode === 'swipe') {
        lb.style.opacity = '';
        /* 세로 100px 초과 → 닫기 */
        if (Math.abs(dy) > 100 && Math.abs(dy) > Math.abs(dx)) {
          dragMode = ''; lastTap = 0; close(); return;
        }
        /* 가로 50px 초과 → 이전/다음 사진 */
        if (Math.abs(dx) > 50) {
          show(dx > 0 ? idx - 1 : idx + 1);
          buzz(8);
          dragMode = '';
          return;
        }
      } else {
        /* pan — 확대 상태의 드래그 종료 */
        if (scale < 1.02) { scale = 1; tx = 0; ty = 0; }
        clamp(); apply(true);
      }

      /* 더블탭 줌 토글 (§3-3 `scale 1 ↔ 2.5`) — swipe·pan 양쪽에서 동작해야
         확대 상태에서도 축소가 된다. dragMode 는 pointerdown 시점의 scale 로
         정해지므로, 확대 중에는 'pan' 으로 들어온다. */
      if (tapEligible && Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) {
        var now = Date.now();
        var paired = (now - lastTap < 300)
          && Math.abs(e.clientX - lastTapX) < TAP_SLOP
          && Math.abs(e.clientY - lastTapY) < TAP_SLOP;
        if (paired) {
          if (scale > 1) {
            scale = 1; tx = 0; ty = 0;                       // 확대 상태 → 원본 배율 복귀
          } else {
            var r2 = stage.getBoundingClientRect();
            var fx = e.clientX - r2.left - r2.width / 2;
            var fy = e.clientY - r2.top - r2.height / 2;
            scale = 2.5;
            tx = fx - 2.5 * fx; ty = fy - 2.5 * fy;           // 탭 지점 기준 확대
          }
          clamp(); apply(true);
          lastTap = 0;
        } else {
          lastTap = now; lastTapX = e.clientX; lastTapY = e.clientY;
        }
      } else {
        lastTap = 0;                                          // 드래그가 섞이면 탭 연속성 끊기
      }

      if (!pointers.size) dragMode = '';
    }
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);

    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });

    openLightbox = open;
  })();

  /* ── 9. BGM — 자동재생 + 첫 인터랙션 폴백 (Must, §3-4) ─────────────────
     알려진 한계(iOS): iOS Safari 는 HTMLMediaElement.volume 의 프로그램 설정을
     무시하므로 페이드가 적용되지 않고 시스템 볼륨으로 즉시 재생된다.
     정확한 페이드가 필요하면 Web Audio GainNode 로 전환해야 한다(Nice-to-have). */
  (function bgm() {
    var btn = $('#bgm-toggle');
    var audio = $('#bgm');
    if (!btn || !audio) return;

    var MAXVOL = 0.6, FADE_IN = 1500, FADE_OUT = 500;
    var GESTURES = ['pointerdown', 'touchstart', 'keydown', 'scroll', 'click'];
    var userOptedOut = false, armed = false, attempts = 0, wasPlaying = false, fadeRAF = 0;

    /* 상태의 진실의 원천은 audio.paused — UI 는 play/pause 이벤트에만 반응한다 */
    function syncUI() {
      var on = !audio.paused;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? '배경 음악 정지' : '배경 음악 재생');
      btn.classList.remove('is-pending');
    }
    audio.addEventListener('play', syncUI);
    audio.addEventListener('pause', syncUI);

    function fade(to, dur, done) {
      cancelAnimationFrame(fadeRAF);
      var from = audio.volume, t0 = performance.now();
      (function step(now) {
        var k = dur <= 0 ? 1 : Math.min(1, (now - t0) / dur);
        try { audio.volume = Math.max(0, Math.min(1, from + (to - from) * k)); } catch (e) {}
        if (k < 1) fadeRAF = requestAnimationFrame(step);
        else if (done) done();
      })(t0);
    }

    function tryPlay() {
      try { audio.volume = 0; } catch (e) {}
      var p;
      try { p = audio.play(); } catch (e) { return Promise.reject(e); }
      if (p && typeof p.then === 'function') {
        return p.then(function () { fade(MAXVOL, FADE_IN); });
      }
      fade(MAXVOL, FADE_IN);
      return Promise.resolve();
    }

    function disarm() {
      armed = false;
      GESTURES.forEach(function (t) { window.removeEventListener(t, onFirstGesture); });
    }
    function arm() {
      if (armed || userOptedOut) return;
      armed = true;
      GESTURES.forEach(function (t) {
        window.addEventListener(t, onFirstGesture, { once: true, passive: true });
      });
    }
    function onFirstGesture() {
      // once:true 는 발화한 1개만 해제한다 — 나머지 4개는 수동 해제가 필수
      disarm();
      if (userOptedOut) return;
      tryPlay()['catch'](function () {
        attempts++;
        if (attempts < 2) arm();            // 재무장 1회만 더 (총 2회) 후 포기
      });
    }

    /* 1) 진입 시 자동재생 시도 → 2) 차단되면 첫 인터랙션 폴백
       attempts 는 '제스처 재시도' 횟수만 센다(자동재생 시도는 포함하지 않는다).
       0 으로 시작해야 명세 §3-4 의 "재무장 1회만 더 (총 2회)" 가 성립한다. */
    attempts = 0;
    tryPlay()['catch'](function () { arm(); });

    btn.addEventListener('click', function () {
      buzz(10);
      if (audio.paused) {
        userOptedOut = false;
        btn.classList.add('is-pending');    // 로딩 지연 체감 보정 (play 이벤트에서 해제)
        tryPlay()['catch'](function () {
          btn.classList.remove('is-pending');
          toast('음악을 재생할 수 없습니다');
          syncUI();
        });
      } else {
        userOptedOut = true;                // 사용자가 끄면 세션 동안 자동 시작 영구 금지
        disarm();
        fade(0, FADE_OUT, function () { audio.pause(); });
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        wasPlaying = !audio.paused;
        if (wasPlaying) audio.pause();
      } else if (wasPlaying && !userOptedOut) {
        tryPlay()['catch'](function () {});
      }
    });

    /* LCP 확정 이후 preload 를 auto 로 승격 (Should) — load() 는 호출하지 않는다 */
    window.addEventListener('load', function () {
      try { audio.preload = 'auto'; } catch (e) {}
    }, { once: true });

    /* 첫 진입 툴팁 — 1회, 3초 후 소멸 */
    var tip = $('#bgm-tip');
    if (tip) {
      var seen = false;
      try { seen = sessionStorage.getItem('bgm-tip') === '1'; } catch (e) {}
      if (!seen) {
        setTimeout(function () {
          tip.hidden = false;
          requestAnimationFrame(function () { tip.classList.add('is-in'); });
          setTimeout(function () {
            tip.classList.remove('is-in');
            setTimeout(function () { tip.hidden = true; }, 400);
          }, 3000);
          try { sessionStorage.setItem('bgm-tip', '1'); } catch (e) {}
        }, 1800);
      }
    }
  })();

  /* ── 10. 계좌 아코디언 (§3-8) ─────────────────────────────────────────── */
  $$('.acc__btn').forEach(function (btn) {
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (!panel) return;
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      if (open) {
        panel.classList.remove('is-open');
        setTimeout(function () {
          if (btn.getAttribute('aria-expanded') === 'false') panel.style.visibility = 'hidden';
        }, reduced ? 0 : 260);
      } else {
        panel.style.visibility = 'visible';
        panel.classList.add('is-open');
      }
    });
  });

  /* ── 11. 공유 (§3-9) ──────────────────────────────────────────────────── */
  (function share() {
    var SHARE_TITLE = '장재준 ♥ 심혜은 결혼합니다';
    var SHARE_DESC = '2026년 10월 31일 토요일 오후 1시 20분 · 전주 더메이 호텔 그랜드볼룸';
    // 카카오 JavaScript 키 (지도 SDK와 동일한 키를 공유한다)
    var KAKAO_JS_KEY = '1408e0961d10a6e184b5f161631d8ee1';

    /* SDK 는 async 로드이므로 초기화를 클릭 시점까지 늦춘다.
       SDK 가 차단·미등록이면 false 를 반환하고 아래 폴백 체인으로 넘어간다. */
    function kakaoReady() {
      try {
        if (!window.Kakao || !window.Kakao.Share) return false;
        if (!window.Kakao.isInitialized()) window.Kakao.init(KAKAO_JS_KEY);
        return window.Kakao.isInitialized();
      } catch (e) { return false; }
    }

    function copyLink(msg) {
      copyText(location.href).then(function () {
        toast(msg || '청첩장 링크가 복사되었습니다.');
        buzz(10);
      })['catch'](function () { toast('복사에 실패했습니다. 길게 눌러 직접 복사해 주세요.'); });
    }

    var linkBtn = $('#share-link');
    if (linkBtn) linkBtn.addEventListener('click', function () { copyLink(linkBtn.getAttribute('data-toast')); });

    var kakaoBtn = $('#share-kakao');
    if (kakaoBtn) kakaoBtn.addEventListener('click', function () {
      buzz(10);
      // 1순위: 카카오 JS SDK → 2순위: 웹 공유 → 3순위: 링크 복사
      try {
        if (kakaoReady()) {
          window.Kakao.Share.sendDefault({
            objectType: 'feed',
            content: {
              title: SHARE_TITLE,
              description: SHARE_DESC,
              /* ?v= 는 카카오 OG 캐시 무효화용 — 사진 교체 시 값을 갱신할 것 */
              imageUrl: new URL('images/photos/og-cover.jpg?v=20260817', location.href).href,
              link: { mobileWebUrl: location.href, webUrl: location.href }
            },
            buttons: [{ title: '청첩장 보기', link: { mobileWebUrl: location.href, webUrl: location.href } }]
          });
          return;
        }
      } catch (e) {}
      if (navigator.share) {
        navigator.share({ title: SHARE_TITLE, text: SHARE_DESC, url: location.href })['catch'](function () {});
        return;
      }
      copyLink();
    });
  })();

  /* ── 12. 맨 위로 ──────────────────────────────────────────────────────── */
  (function toTop() {
    var btn = $('#to-top');
    if (!btn) return;
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
  })();

  /* ── 13. 지도 임베드 (venue) ──────────────────────────────────────────────
     2026-08-17 교체: 카카오맵 JS SDK 는 개발자 콘솔에 배포 도메인이 등록돼야
     로드되는데, 미등록 상태로 라이브에서 안내 카드만 남았다. 키·콘솔 등록 없이
     동작하는 구글 지도 임베드(iframe)로 대체한다.
     · src 는 venue 섹션이 화면에 가까워질 때만 data-src 에서 주입한다(로드 예산 보호).
     · load 이벤트가 온 뒤에만 지도를 드러내고 잠금 해제 버튼을 노출한다.
       실패하면 안내 카드와 지도 앱 버튼이 그대로 남는다 — 토스트·에러 문구 없음(§3-6-B).
     · 스크롤 트랩 방지: iframe 은 CSS pointer-events:none 으로 시작하고,
       잠금 해제 버튼 탭 이후에만 조작이 열린다(1회성, 재잠금 없음).              */
  (function mapEmbed() {
    var frame = $('#map-frame');
    var iframe = $('#map-embed');
    var fallback = $('#map-fallback');
    var unlock = $('#map-unlock');
    if (!frame || !iframe) return;

    var started = false;

    function succeed() {
      frame.classList.add('is-live');
      if (fallback) fallback.hidden = true;
      if (unlock) unlock.hidden = false;   // 지도가 실제로 떴을 때만 잠금 해제 버튼을 노출
    }

    /* 오버레이 탭 → 확대·이동 개방. 1회성이며 재잠금은 없다. */
    if (unlock) {
      unlock.addEventListener('click', function () {
        frame.classList.add('is-unlocked');
        unlock.hidden = true;
        buzz(10);
      }, { once: true });
    }

    function load() {
      if (started) return;
      started = true;
      /* load 는 응답이 실제로 왔을 때만 발화한다 — 네트워크 실패·차단 시에는
         발화하지 않으므로 별도 giveUp 없이 안내 카드가 그대로 남는다. */
      iframe.addEventListener('load', succeed, { once: true });
      iframe.src = iframe.getAttribute('data-src');
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries, obs) {
        if (!entries[0].isIntersecting) return;
        obs.unobserve(entries[0].target);       // 1회만
        load();
      }, { rootMargin: '300px 0px' }).observe(frame);
    } else {
      load();
    }
  })();

  /* ── 14. 방명록 GUEST BOOK (Must, §3-10 — 옵션 A) ──────────────────────
     옵션 A 확정: 비밀번호 필드·삭제 기능 미구현.
     근거: Firestore 클라이언트 SDK 만으로는 삭제 요청을 서버에서 검증할 수
     없어 `allow delete: if true` 가 필요해지고, 그러면 누구나 임의의 글을
     지울 수 있다. 컨셉 시트의 "비밀번호 기반 삭제는 범위 밖" 지시를 따른다.

     ── 설정 ────────────────────────────────────────────────────────────────
     실제 Firebase 프로젝트 키가 주입되어 방명록이 활성화됐다.
     (한 글자라도 `{{`/`[`/`YOUR_` 로 시작하면 섹션이 숨겨지고 초기화를 건너뛴다 —
      가드는 그대로 살아 있으므로 키를 지우면 자동으로 다시 숨겨진다.)

     ⚠ 반드시 함께 설정할 것 — Firestore 보안 규칙.
       규칙을 기본값(테스트 모드/전체 거부)으로 두면 방명록이 동작하지 않거나
       누구나 글을 지울 수 있다. 아래 규칙은 이 구현의 컬렉션·필드·길이 제약과
       정확히 일치한다. Firebase 콘솔 → Firestore Database → 규칙에 붙여넣는다.
       (전문·해설은 `_workspace/05_frontend-developer_summary.md` §6 참조)

       rules_version = '2';
       service cloud.firestore {
         match /databases/{database}/documents {
           match /guestbook/{docId} {
             allow read: if true;
             allow create: if request.resource.data.keys().hasOnly(['name','message','createdAt'])
                           && request.resource.data.name is string
                           && request.resource.data.name.size() >= 1
                           && request.resource.data.name.size() <= 10
                           && request.resource.data.message is string
                           && request.resource.data.message.size() >= 1
                           && request.resource.data.message.size() <= 200
                           && request.resource.data.createdAt == request.time;
             allow update, delete: if false;
           }
           match /{document=**} { allow read, write: if false; }
         }
       }
  ──────────────────────────────────────────────────────────────────────── */
  var FIREBASE_CONFIG = {
    apiKey:            'AIzaSyAUp1pgW0m4aVjKUBD5BPZUKuHG3y9KIdU',
    authDomain:        'weddinginvitation-ce9d0.firebaseapp.com',
    projectId:         'weddinginvitation-ce9d0',
    storageBucket:     'weddinginvitation-ce9d0.firebasestorage.app',
    messagingSenderId: '43963373435',
    appId:             '1:43963373435:web:6a4c6416fc087b97c84fde'
  };

  (function guestbook() {
    var section = $('#guestbook');
    if (!section) return;

    var configReady = !Object.keys(FIREBASE_CONFIG).some(function (k) {
      return isPlaceholder(FIREBASE_CONFIG[k]);
    });

    if (!configReady) {
      section.hidden = true;                       // 초기화 자체를 시도하지 않는다
      var div = $('#divider-guestbook');           // 인접 디바이더도 함께 숨긴다
      if (div) div.hidden = true;
      return;
    }
    section.hidden = false;

    var form = $('#gb-form');
    var nameEl = $('#gb-name');
    var msgEl = $('#gb-message');
    var countEl = $('[data-gb-count]');
    var listEl = $('#gb-list');
    var statusEl = $('#gb-status');
    var moreBtn = $('#gb-more');
    var retryBtn = $('#gb-retry');
    var submitBtn = $('#gb-submit');
    var nameErr = $('#gb-name-err');
    var msgErr = $('#gb-message-err');

    var db = null, fs = null, lastDoc = null, loading = false, submitting = false, itemSeq = 0;

    /* 글자 수 카운터 */
    if (msgEl && countEl) {
      msgEl.addEventListener('input', function () {
        var n = msgEl.value.length;
        countEl.textContent = String(n);
        countEl.parentNode.classList.toggle('is-near', n > 180);
      });
    }

    function showErr(el, field, msg) {
      if (!el) return;
      el.textContent = msg;
      el.hidden = false;
      requestAnimationFrame(function () { el.classList.add('is-in'); });
      if (field) field.setAttribute('aria-invalid', 'true');
    }
    function clearErr(el, field) {
      if (!el) return;
      el.classList.remove('is-in');
      el.hidden = true;
      if (field) field.removeAttribute('aria-invalid');
    }

    function fmtDate(d) {
      if (!d) return '방금 전';
      var m = d.getMonth() + 1, day = d.getDate();
      return d.getFullYear() + '. ' + (m < 10 ? '0' + m : m) + '. ' + (day < 10 ? '0' + day : day);
    }

    /* 렌더는 반드시 textContent — 하객 입력이 DOM 에 들어가는 유일한 지점 (XSS 방지) */
    function makeItem(name, message, date, pending) {
      var li = document.createElement('li');
      li.className = 'gb-item' + (pending ? ' is-pending' : '');
      li.style.setProperty('--k', String(itemSeq++ % 8));

      var head = document.createElement('div');
      head.className = 'gb-item__head';
      var nm = document.createElement('p');
      nm.className = 'gb-item__name';
      nm.textContent = name;
      var dt = document.createElement('p');
      dt.className = 'gb-item__date';
      dt.textContent = fmtDate(date);
      head.appendChild(nm); head.appendChild(dt);

      var body = document.createElement('p');
      body.className = 'gb-item__msg';
      body.textContent = message;

      li.appendChild(head); li.appendChild(body);
      return li;
    }

    function reveal(li) {
      if (reduced) { li.classList.add('is-in'); return; }
      requestAnimationFrame(function () { li.classList.add('is-in'); });
    }

    function setStatus(msg) {
      if (!statusEl) return;
      statusEl.textContent = msg || '';
      statusEl.hidden = !msg;
    }

    function fail(msg) {
      setStatus(msg);
      if (form) form.hidden = true;
      if (moreBtn) moreBtn.hidden = true;
      if (retryBtn) retryBtn.hidden = false;
    }

    /* SDK 지연 로드 — 스크롤 진입 300px 전에 1회만 (§3-10-B) */
    var loaded = false;
    function loadSdk() {
      if (loaded) return Promise.resolve();
      loaded = true;
      itemSeq = 0;
      return Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')
      ]).then(function (mods) {
        var app = mods[0].initializeApp(FIREBASE_CONFIG);
        fs = mods[1];
        db = fs.getFirestore(app);
        return fetchPage(true);
      });
    }

    function fetchPage(first) {
      if (loading || !db) return Promise.resolve();
      loading = true;
      if (first) setStatus('방명록을 불러오는 중입니다.');

      var parts = [fs.orderBy('createdAt', 'desc')];
      if (!first && lastDoc) parts.push(fs.startAfter(lastDoc));
      parts.push(fs.limit(20));
      var q = fs.query.apply(null, [fs.collection(db, 'guestbook')].concat(parts));

      return fs.getDocs(q).then(function (snap) {
        loading = false;
        if (first && snap.empty) {
          setStatus('아직 남겨진 메시지가 없습니다. 첫 축하를 남겨 주세요.');
          if (moreBtn) moreBtn.hidden = true;
          return;
        }
        setStatus('');
        snap.forEach(function (doc) {
          var d = doc.data();
          var ts = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate() : null;
          var li = makeItem(String(d.name || ''), String(d.message || ''), ts, false);
          listEl.appendChild(li);
          reveal(li);
        });
        lastDoc = snap.docs[snap.docs.length - 1] || lastDoc;
        if (moreBtn) moreBtn.hidden = snap.size < 20;
      })['catch'](function () {
        loading = false;
        fail('방명록을 불러오지 못했습니다.');
      });
    }

    if (moreBtn) moreBtn.addEventListener('click', function () { itemSeq = 0; fetchPage(false); });
    if (retryBtn) retryBtn.addEventListener('click', function () {
      retryBtn.hidden = true;
      if (form) form.hidden = false;
      loaded = false; lastDoc = null;
      loadSdk()['catch'](function () { fail('방명록을 불러오지 못했습니다.'); });
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries, obs) {
        if (!entries[0].isIntersecting) return;
        obs.unobserve(entries[0].target);          // 1회만
        loadSdk()['catch'](function () { fail('방명록을 불러오지 못했습니다.'); });
      }, { rootMargin: '300px 0px' }).observe(section);
    } else {
      loadSdk()['catch'](function () { fail('방명록을 불러오지 못했습니다.'); });
    }

    /* 제출 — 낙관적 렌더 + 실패 시 입력값 복원 (§3-10-C) */
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitting || !db) return;

      var name = (nameEl.value || '').trim();
      var message = (msgEl.value || '').trim();
      clearErr(nameErr, nameEl); clearErr(msgErr, msgEl);

      var bad = false;
      if (!name) { showErr(nameErr, nameEl, '성함을 입력해 주세요.'); bad = true; }
      else if (name.length > 10) { showErr(nameErr, nameEl, '성함은 10자 이내로 입력해 주세요.'); bad = true; }
      if (!message) { showErr(msgErr, msgEl, '축하 메시지를 입력해 주세요.'); bad = true; }
      else if (message.length > 200) { showErr(msgErr, msgEl, '메시지는 200자까지 입력하실 수 있습니다.'); bad = true; }
      if (bad) { toast('성함과 축하 메시지를 모두 입력해 주세요.'); return; }

      submitting = true;
      submitBtn.disabled = true;
      var origLabel = submitBtn.textContent;
      submitBtn.textContent = '등록 중';

      // 낙관적 삽입 — 입력값은 변수에 보관해 두고 폼을 즉시 비운다
      var li = makeItem(name, message, null, true);
      if (statusEl && !statusEl.hidden) setStatus('');
      listEl.insertBefore(li, listEl.firstChild);
      reveal(li);
      nameEl.value = ''; msgEl.value = '';
      if (countEl) { countEl.textContent = '0'; countEl.parentNode.classList.remove('is-near'); }

      fs.addDoc(fs.collection(db, 'guestbook'), {
        name: name, message: message, createdAt: fs.serverTimestamp()
      }).then(function () {
        li.classList.remove('is-pending');
        toast('축하 메시지가 등록되었습니다. 감사합니다.');
        buzz(10);
      })['catch'](function () {
        li.classList.add('is-leaving');
        setTimeout(function () { if (li.parentNode) li.parentNode.removeChild(li); }, reduced ? 0 : 200);
        nameEl.value = name; msgEl.value = message;        // 쓴 글을 절대 날리지 않는다
        if (countEl) countEl.textContent = String(message.length);
        toast('등록에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }).then(function () {
        submitting = false;
        submitBtn.disabled = false;
        submitBtn.textContent = origLabel;
      });
    });
  })();

})();
